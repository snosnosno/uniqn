-- ops 결함⑦-1 — 수동 추가 스태프 배정 알림(마이그 20260809100000) 회귀 고정.
--
-- 검증 축:
--   (1~11)  주 경로: ops_add_staff(source=manual) → 알림 정확히 1건 + 계약(수신자·타입·
--           link NULL·priority·본문 4요소·data 키). link NULL 은 설계 결정이다 —
--           is_ops_member 가 ops_staff 를 멤버로 보지 않아 착지시킬 ops 화면이 없다.
--           누군가 "친절하게" 딥링크를 심으면 RLS 가 막는 빈 화면으로 보내게 되므로 고정한다.
--   (12~14) 중복 발송 차단: 같은 스태프 2회 추가(DUPLICATE_STAFF) · snapshot_import 침묵.
--           이 레포는 알림 트리거 중복으로 푸시 2회를 두 번 냈다(20260620151331/20260726000000).
--   (15~16) other + custom_role → '기타' 대신 실제 직무명.
--   (17)    자기가 자기를 추가하면 침묵.
--   (18~19) fail-soft: 알림 INSERT 가 폭발해도 ops_staff 행은 남는다.
--           인라인 구현이었다면 라이브 대회의 스태프 추가가 통째로 롤백된다.
--   (20)    ops_staff 트리거 정확히 1개 — 중복 신설 회귀 가드.
--   (21~23) 권한/하드닝: anon EXECUTE 없음 · anon-executable ops SECDEF =2 불변 ·
--           SECDEF search_path 에 pg_temp 포함.
--
-- [가드] RLS 테이블의 pgTAP "0건"은 "행이 없다"가 아니라 "안 보인다"일 수 있다 —
--   notifications 는 RLS ENABLE 이므로 **모든 알림 단언은 postgres role 에서** 한다.
-- [가드] JWT 주입은 헬퍼(ops_test_set_user) 경유만 — 인라인 set_config 금지.
--   선행 로드: npm run test:db:helpers
-- 안전: BEGIN/ROLLBACK.

BEGIN;
SELECT plan(23);

-- ════════════════════════════════════════════════════════════════════════════
-- 시드: ops_test_seed() 기본(owner=employer, member, outsider)
--   + 후보 스태프 4인(cand1 주경로 / cand2 custom_role / cand3 fail-soft / cand4 import)
--   + 시드 대회에 event_date·venue 주입(본문 4요소 단언용 — 시드는 둘 다 NULL).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  s       RECORD;
  v_c1    uuid := gen_random_uuid();
  v_c2    uuid := gen_random_uuid();
  v_c3    uuid := gen_random_uuid();
  v_c4    uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM ops_test_seed();

  PERFORM set_config('role', 'postgres', true);

  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_c1, 'ops_notif_c1_' || v_c1 || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_c2, 'ops_notif_c2_' || v_c2 || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_c3, 'ops_notif_c3_' || v_c3 || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_c4, 'ops_notif_c4_' || v_c4 || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  INSERT INTO public.users (id, email, name, nickname, role, is_active, status, created_at, updated_at)
  VALUES
    (v_c1, (SELECT email FROM auth.users WHERE id = v_c1), '후보1', NULL, 'staff'::user_role, true, 'active', now(), now()),
    (v_c2, (SELECT email FROM auth.users WHERE id = v_c2), '후보2', NULL, 'staff'::user_role, true, 'active', now(), now()),
    (v_c3, (SELECT email FROM auth.users WHERE id = v_c3), '후보3', NULL, 'staff'::user_role, true, 'active', now(), now()),
    (v_c4, (SELECT email FROM auth.users WHERE id = v_c4), '후보4', NULL, 'staff'::user_role, true, 'active', now(), now())
  -- baseline on_auth_user_created 트리거 공존(선점 행 흡수)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active, status = EXCLUDED.status;

  UPDATE public.ops_tournaments
     SET event_date = DATE '2026-09-01', venue = '강남홀덤펍'
   WHERE id = s.tournament_id;

  PERFORM set_config('ops.owner_id', s.owner_id::text,      true);
  PERFORM set_config('ops.t_id',     s.tournament_id::text, true);
  PERFORM set_config('ops.c1',       v_c1::text,            true);
  PERFORM set_config('ops.c2',       v_c2::text,            true);
  PERFORM set_config('ops.c3',       v_c3::text,            true);
  PERFORM set_config('ops.c4',       v_c4::text,            true);
END $$;

-- ── 주 경로: owner(employer)가 cand1 을 딜러로 수동 추가 ──
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM ops_test_set_user((current_setting('ops.owner_id'))::uuid);
  r := public.ops_add_staff((current_setting('ops.t_id'))::uuid,
                            (current_setting('ops.owner_id'))::uuid,
                            (current_setting('ops.c1'))::uuid,
                            'dealer'::public.staff_role, NULL);
  PERFORM set_config('ops.c1_staff_row', (r ->> 'opsStaffId'), true);
  PERFORM set_config('role', 'postgres', true);
END $$;

SELECT is(                                                                   -- [1]
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  1, '수동 추가 1회 → 알림 정확히 1건');

SELECT is(                                                                   -- [2]
  (SELECT type FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  'ops_staff_assigned', '타입 = ops_staff_assigned');

SELECT is(                                                                   -- [3]
  (SELECT title FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  '대회 스태프 배정', '제목 고정');

-- link 는 반드시 NULL — ops 화면으로 보내면 RLS 가 막는 빈 화면이다(설계 결정).
SELECT ok(                                                                   -- [4]
  (SELECT link IS NULL FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  'link 은 NULL — 배정 스태프는 is_ops_member 밖이라 착지시킬 ops 화면이 없다');

SELECT is(                                                                   -- [5]
  (SELECT priority FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  'high', 'priority = high (NOTIFICATION_DEFAULT_PRIORITY 와 일치)');

SELECT ok(                                                                   -- [6]
  (SELECT body FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid) LIKE '%ops test cup%',
  '본문에 대회명');

SELECT ok(                                                                   -- [7]
  (SELECT body FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid) LIKE '%담당 딜러%',
  '본문에 담당 역할(한글 라벨)');

SELECT ok(                                                                   -- [8]
  (SELECT body FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid) LIKE '%2026-09-01%',
  '본문에 대회 날짜');

SELECT ok(                                                                   -- [9]
  (SELECT body FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid) LIKE '%강남홀덤펍%',
  '본문에 장소 — 딥링크가 없으므로 본문이 유일한 전달 매체다');

SELECT is(                                                                   -- [10]
  (SELECT data ->> 'tournamentId' FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  current_setting('ops.t_id'), 'data.tournamentId 일치');

SELECT is(                                                                   -- [11]
  (SELECT data ->> 'opsStaffId' FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  current_setting('ops.c1_staff_row'), 'data.opsStaffId = 실제 ops_staff 행');

-- ── 중복 발송 차단 (1): 같은 스태프 2회 추가 ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [12]
  $$ SELECT public.ops_add_staff((current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid, (current_setting('ops.c1'))::uuid,
       'dealer'::public.staff_role, NULL) $$,
  'DUPLICATE_STAFF%', '같은 스태프 2회 추가는 RPC 가 접는다');

DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
SELECT is(                                                                   -- [13]
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c1'))::uuid),
  1, '중복 시도 후에도 알림 총 1건 (푸시 2회 회귀 가드)');

-- ── 중복 발송 차단 (2): snapshot_import 는 침묵 ──
-- 공고 파이프라인 유입분은 work_logs 트리거의 'schedule_created' 를 이미 받는다.
-- 트리거 WHEN 절이 함수 진입 자체를 막는지 직접 INSERT 로 확인한다.
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_staff
    (tournament_id, staff_id, role, staff_name, source, source_work_log_id)
  VALUES ((current_setting('ops.t_id'))::uuid, (current_setting('ops.c4'))::uuid,
          'dealer'::public.staff_role, '후보4', 'snapshot_import', NULL);
END $$;

SELECT is(                                                                   -- [14]
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c4'))::uuid),
  0, 'snapshot_import 는 알림 0건 (schedule_created 와 중복 금지)');

-- ── other + custom_role ──
DO $$ BEGIN
  PERFORM ops_test_set_user((current_setting('ops.owner_id'))::uuid);
  PERFORM public.ops_add_staff((current_setting('ops.t_id'))::uuid,
                               (current_setting('ops.owner_id'))::uuid,
                               (current_setting('ops.c2'))::uuid,
                               'other'::public.staff_role, '칩러너');
  PERFORM set_config('role', 'postgres', true);
END $$;

SELECT ok(                                                                   -- [15]
  (SELECT body FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c2'))::uuid) LIKE '%담당 칩러너%',
  'other 는 custom_role 을 담당으로 보여준다');

SELECT ok(                                                                   -- [16]
  (SELECT body FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c2'))::uuid) NOT LIKE '%기타%',
  'custom_role 이 있으면 ''기타'' 라고 말하지 않는다');

-- ── 자기가 자기를 추가하면 침묵 ──
DO $$ BEGIN
  PERFORM ops_test_set_user((current_setting('ops.owner_id'))::uuid);
  PERFORM public.ops_add_staff((current_setting('ops.t_id'))::uuid,
                               (current_setting('ops.owner_id'))::uuid,
                               (current_setting('ops.owner_id'))::uuid,
                               'manager'::public.staff_role, NULL);
  PERFORM set_config('role', 'postgres', true);
END $$;

SELECT is(                                                                   -- [17]
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('ops.owner_id'))::uuid
      AND type = 'ops_staff_assigned'),
  0, '본인이 본인을 추가하면 침묵');

-- ── fail-soft: 알림 INSERT 가 폭발해도 스태프 추가는 살아남는다 ──
-- notifications 에 임시 폭발 트리거를 걸어 알림 경로만 죽인다(ROLLBACK 으로 정리).
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS
    $f$ BEGIN RAISE EXCEPTION 'BOOM: 알림 경로 강제 실패'; END; $f$;
  EXECUTE 'CREATE TRIGGER zz_ops_notify_boom BEFORE INSERT ON public.notifications '
       || 'FOR EACH ROW WHEN (NEW.type = ''ops_staff_assigned'') '
       || 'EXECUTE FUNCTION pg_temp.boom()';

  PERFORM ops_test_set_user((current_setting('ops.owner_id'))::uuid);
  PERFORM public.ops_add_staff((current_setting('ops.t_id'))::uuid,
                               (current_setting('ops.owner_id'))::uuid,
                               (current_setting('ops.c3'))::uuid,
                               'floor'::public.staff_role, NULL);

  PERFORM set_config('role', 'postgres', true);
  DROP TRIGGER zz_ops_notify_boom ON public.notifications;
END $$;

SELECT is(                                                                   -- [18]
  (SELECT count(*)::int FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid
      AND staff_id = (current_setting('ops.c3'))::uuid),
  1, 'fail-soft: 알림이 폭발해도 ops_staff 행은 남는다 (인라인이었다면 롤백)');

SELECT is(                                                                   -- [19]
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('ops.c3'))::uuid),
  0, 'fail-soft: 그 경우 알림은 조용히 없다 (WARNING 만)');

-- ── 트리거 카탈로그: ops_staff 의 트리거는 정확히 1개 ──
-- 중복 신설이 곧 푸시 2회다. "다음에 추가될 이름 모르는 트리거"까지 잡는다.
SELECT is(                                                                   -- [20]
  (SELECT count(*)::int FROM pg_trigger t
    WHERE t.tgrelid = 'public.ops_staff'::regclass AND NOT t.tgisinternal),
  1, 'ops_staff 트리거 총량=1 (알림 트리거 중복 신설 회귀 가드)');

-- ── 권한/하드닝 ──
SELECT ok(                                                                   -- [21]
  NOT has_function_privilege('anon', 'public.notify_on_ops_staff_insert()', 'EXECUTE'),
  'anon 은 notify_on_ops_staff_insert EXECUTE 불가');

SELECT is(                                                                   -- [22]
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'ops\_%' AND p.proname NOT LIKE 'ops\_test\_%'
      AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  2, 'anon-executable ops SECDEF 총량=2 불변(monitor/player)');

SELECT ok(                                                                   -- [23]
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'notify_on_ops_staff_insert'
             AND p.prosecdef
             AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
                          WHERE c LIKE 'search_path=%' AND c ILIKE '%pg_temp%')),
  'SECDEF search_path 에 pg_temp 포함(temp-table shadowing 방어)');

SELECT * FROM finish();
ROLLBACK;
