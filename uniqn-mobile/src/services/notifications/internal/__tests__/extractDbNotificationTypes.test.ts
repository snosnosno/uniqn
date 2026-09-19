/**
 * 추출기 자체 검증 (dbNotificationTypeDrift.test.ts 가 의존하는 파싱 규칙)
 *
 * @description 규칙 하나가 조용히 깨지면 상위 가드가 "타입 0건 = 드리프트 없음"으로
 *              빈 통과한다. 그래서 파싱 규칙마다 픽스처를 둔다.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { extractDbNotificationTypes } from './helpers/extractDbNotificationTypes';

/** 임시 디렉터리에 마이그레이션 픽스처를 쓰고 추출한다. */
function extractFrom(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uniqn-migfix-'));
  try {
    Object.entries(files).forEach(([name, sql]) => fs.writeFileSync(path.join(dir, name), sql));
    return extractDbNotificationTypes(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const wrap = (body: string, name = 'notify_x', args = '') =>
  `CREATE OR REPLACE FUNCTION public.${name}(${args}) RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n${body}\nEND;\n$$;\n`;

describe('extractDbNotificationTypes', () => {
  it('VALUES 튜플에서 type 리터럴을 뽑는다', () => {
    const { types, unresolved } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
         VALUES (NEW.user_id, 'schedule_created', '제목', '본문', '/schedule', '{}'::jsonb, 'normal');`
      ),
    });
    expect([...types]).toEqual(['schedule_created']);
    expect(unresolved).toEqual([]);
  });

  it('컬럼 순서가 달라도 type 위치를 컬럼 리스트로 찾는다', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO notifications (title, body, type, recipient_id)
         VALUES ('제목', '본문', 'new_report', NEW.id);`
      ),
    });
    expect([...types]).toEqual(['new_report']);
  });

  it('CASE 식이면 분기 리터럴을 전부 수집한다', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type, title)
         VALUES (NEW.id, CASE WHEN NEW.parent_id IS NULL THEN 'board_comment' ELSE 'board_reply' END, '제목');`
      ),
    });
    expect([...types].sort()).toEqual(['board_comment', 'board_reply']);
  });

  it('plpgsql 변수에 담긴 type 을 역추적한다', () => {
    const { types, unresolved } = extractFrom({
      '20260101000000_a.sql': wrap(
        `v_type := 'job_closed';
         INSERT INTO public.notifications (recipient_id, type, title)
         VALUES (NEW.id, v_type, '제목');`
      ),
    });
    expect([...types]).toEqual(['job_closed']);
    expect(unresolved).toEqual([]);
  });

  it('INSERT ... SELECT 의 CTE 별칭을 역추적한다', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type, title)
         SELECT u.id, n_type, '제목' FROM targets u, (SELECT 'review_reminder'::text AS n_type) s;`
      ),
    });
    expect([...types]).toEqual(['review_reminder']);
  });

  it('나중 마이그레이션의 DROP 이 앞선 CREATE 를 죽인다 (재생)', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'legacy_dead_type');`
      ),
      '20260102000000_b.sql': `DROP FUNCTION IF EXISTS public.notify_x();\n`,
    });
    expect([...types]).toEqual([]);
  });

  it('나중 마이그레이션의 CREATE OR REPLACE 가 앞선 정의를 대체한다', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'old_type_gone');`
      ),
      '20260102000000_b.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'new_type_live');`
      ),
    });
    expect([...types]).toEqual(['new_type_live']);
  });

  it('arity 가 다르면 다른 함수로 취급한다 (DEFAULT now() 포함 시그니처)', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'arity_one');`,
        'notify_y',
        'p_a uuid'
      ),
      '20260102000000_b.sql':
        wrap(
          `INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'arity_two');`,
          'notify_y',
          'p_a uuid, p_at timestamptz DEFAULT now()'
        ) + `DROP FUNCTION IF EXISTS public.notify_y(p_a uuid);\n`,
    });
    // arity 1 은 DROP 으로 죽고, DEFAULT now() 가 든 arity 2 만 살아남아야 한다.
    expect([...types]).toEqual(['arity_two']);
  });

  it('OR REPLACE 없는 CREATE FUNCTION (pg_dump 산출) 도 슬라이싱한다', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql': `CREATE FUNCTION public.notify_z() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'dump_style_type');
  RETURN NEW;
END;
$function$;
`,
    });
    expect([...types]).toEqual(['dump_style_type']);
  });

  it('해소 못 한 표현식은 버리지 않고 unresolved 에 담는다', () => {
    const { types, unresolved } = extractFrom({
      '20260101000000_a.sql': wrap(
        `INSERT INTO public.notifications (recipient_id, type, title)
         VALUES (NEW.id, resolve_type_from(NEW.kind), '제목');`
      ),
    });
    expect([...types]).toEqual([]);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toContain('resolve_type_from');
  });

  it('본문 밖(GRANT·COMMENT)의 잡음 문자열은 수집하지 않는다', () => {
    const { types } = extractFrom({
      '20260101000000_a.sql':
        wrap(
          `INSERT INTO public.notifications (recipient_id, type) VALUES (NEW.id, 'real_type_here');`
        ) + `COMMENT ON FUNCTION public.notify_x() IS 'fake_type_here 라고 적힌 주석';\n`,
    });
    expect([...types]).toEqual(['real_type_here']);
  });
});
