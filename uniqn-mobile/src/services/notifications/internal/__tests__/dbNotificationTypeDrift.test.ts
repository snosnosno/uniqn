/**
 * DB→클라 알림 타입 드리프트 가드
 *
 * @description
 * typeCategoryMapDrift.test.ts 는 클라 SSOT ↔ EF 사본이라는 **두 축**만 본다.
 * 둘 다 DB 와 어긋나도 통과한다 — 실제로 그 사각지대로 4종이 새어 나갔다
 * (work_log_check_in/out · job_posting_collaborator_added/removed, 2026-08-07 prod 실측).
 * 이 파일이 세 번째 축 "DB 가 실제로 INSERT 하는 타입" 을 강제한다.
 *
 * ⚠️ 한계 3가지 (반드시 읽을 것):
 * 1) 이 가드는 **레포↔클라** 일치다. prod↔클라가 아니다 — prod 에만 있고 레포에 없는
 *    함수는 원리적으로 못 본다(scripts/check-rpc-migrations.js 와 같은 클래스의 한계).
 * 2) SQL 전용이라 **Edge Function 생산자는 사각지대**다: 'announcement' 는
 *    send-job-posting-announcement · send-system-announcement 가 넣는다.
 *    그래서 역방향(클라에만 있는 타입)은 fail 시키지 않고 경고만 남긴다.
 * 3) archive/ 는 제외한다 — 재실행되지 않는 보존용이라 정의 소스가 아니다.
 */

import path from 'path';

import { NOTIFICATION_TYPES } from '@/types/notification';

import { extractDbNotificationTypes } from './helpers/extractDbNotificationTypes';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations');

describe('DB 발송 알림 타입 드리프트 가드', () => {
  const { types, unresolved, liveFunctionCount } = extractDbNotificationTypes(MIGRATIONS_DIR);

  it('추출기가 모든 type 표현식을 리터럴로 해소한다', () => {
    // 미해소를 조용히 버리면, 미래에 진짜 동적 type 이 생겼을 때 이 가드가 빈 통과한다.
    expect(unresolved).toEqual([]);
  });

  it('마이그레이션 재생 결과가 비어 있지 않다 (파싱 붕괴 감지)', () => {
    // 파서가 깨지면 types 가 빈 집합이 되어 아래 단언이 '통과'해 버린다.
    expect(liveFunctionCount).toBeGreaterThan(100);
    expect(types.size).toBeGreaterThan(20);
  });

  it('DB 가 발송하는 알림 타입은 모두 클라 enum 에 등록돼 있다', () => {
    const dbOnly = [...types].filter((t) => !(NOTIFICATION_TYPES as string[]).includes(t)).sort();
    expect(dbOnly).toEqual([]);
  });

  it('[참고] 발송자가 없는 클라 타입 — 실패시키지 않는다', () => {
    const clientOnly = (NOTIFICATION_TYPES as string[]).filter((t) => !types.has(t));
    if (clientOnly.length > 0) {
      // announcement 처럼 Edge Function 이 넣는 타입과, 레거시 흡수용 타입이 여기 걸린다.
      console.warn('[참고] SQL 발송자가 없는 클라 알림 타입:', clientOnly.join(', '));
    }
    expect(Array.isArray(clientOnly)).toBe(true);
  });
});
