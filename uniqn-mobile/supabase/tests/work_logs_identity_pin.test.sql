-- ============================================================
-- work_logs.staff_id / owner_id 불변 고정 트리거 (감사 후속 P5 · M4)
--
-- 마이그레이션: 20260802120000_work_logs_identity_pin_and_time_slot_check.sql
--
-- 무엇을 지키는 테스트인가:
--   워크스페이스 멤버(= wl_update 정책을 통과하는 사람)가 raw PostgREST 로
--   출근·정산이 끝난 work_log 의 staff_id 를 타인 UUID 로 바꿔치기해
--   **스태프 본인 이력에서 무음으로 지우는** 경로를 닫는다.
--   work_logs 에는 DELETE 정책이 아예 없고 remove_direct_staff 는 출근 이후를
--   거부하므로, 이 재지정이 그 가드를 우회하는 유일한 무음 삭제 수단이었다.
--   owner_id 쪽은 NULL 로 고아화해 **공고 소유자의 owner 축 조회에서 행을 감추는** 경로를 닫는다
--   (클라가 `.eq('owner_id', ...)` 로 조회한다 — WorkLogRepository.ts:226,264.
--    그 둘의 유일한 소비처는 `useReviews.ts:316,320` = 미작성 리뷰 대상 목록이다).
--
-- ⚠️ 컬럼 권한 REVOKE 로는 못 막는다(감사 §7 P5 의 원 처방은 무효).
--    authenticated 가 테이블 레벨 UPDATE 전권을 갖고 있어 컬럼 부분집합을 뺄 수 없다.
--
-- 🔴 **42501 만 단언하면 red-스왑된다** — `wl_update` 의 WITH CHECK(=USING 재사용) 위반도
--    같은 42501 을 낸다. 트리거를 빼도 다른 이유로 42501 이 나 green 이 유지될 수 있다.
--    그래서 차단 단언은 전부 `throws_like` 로 **메시지 접두사**를 본다.
--
-- ⚠️ 이 테스트는 "권한이 없어서 못 한다"가 아니라 **실제 UPDATE 를 쏴서 거부를 받는다**.
--    레포에 컬럼 권한 pgTAP 선례가 0건이라 이 형식으로 새로 세웠다.
-- ============================================================
BEGIN;
SELECT plan(8);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wlp.owner_id',    s.owner_id::text,     true);
  PERFORM set_config('wlp.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('wlp.wl_id',       s.work_log_id::text,  true);
END $$;

-- 1. 배선 자체가 존재하는가 (트리거를 지우면 이 단언부터 red 가 된다)
SELECT is(
  (SELECT count(*)::int
   FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE c.relname = 'work_logs'
     AND t.tgname = 'tr_work_logs_pin_identity'
     AND p.proname = 'fn_work_logs_pin_identity'
     AND NOT t.tgisinternal),
  1,
  'tr_work_logs_pin_identity 트리거가 work_logs 에 배선돼 있다');

-- 2. 트리거 함수는 직접 호출 대상이 아니다 — PUBLIC/anon/authenticated EXECUTE 0
--    (prod 하드닝 관례 20260731090000 과 정합. 선례 fn_work_logs_pin_posting_id 는
--     이 REVOKE 가 없어 PUBLIC EXECUTE 가 남아 있다 — 같은 상태를 반복하지 않는다.)
SELECT is(
  (SELECT count(*)::int
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'fn_work_logs_pin_identity'
     AND (p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.proacl, '{}'::aclitem[])) a
                     WHERE a::text ~ '^(=|anon=|authenticated=)'))),
  0,
  'fn_work_logs_pin_identity 에 PUBLIC/anon/authenticated EXECUTE 가 없다');

-- 여기부터는 공고 소유자(= wl_update 정책을 통과하는 정상 사용자) 컨텍스트다.
-- 즉 "권한이 없는 사람"이 아니라 **권한이 있는 사람도 못 한다**를 단언한다.
SELECT jpc_test_set_user((current_setting('wlp.owner_id'))::uuid);

-- 3. staff_id 재지정 차단 — 정당한 UPDATE writer 가 DB·클라 통틀어 0곳이므로 예외가 없다
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET staff_id = %L WHERE id = %L$q$,
    current_setting('wlp.editor_id'),
    current_setting('wlp.wl_id')
  ),
  'WORK_LOG_STAFF_IMMUTABLE%',
  'work_logs.staff_id 재지정은 공고 소유자여도 트리거가 차단한다');

-- 4. owner_id 를 다른 사용자로 재지정 차단 (채널 무관 전면 차단)
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET owner_id = %L WHERE id = %L$q$,
    current_setting('wlp.editor_id'),
    current_setting('wlp.wl_id')
  ),
  'WORK_LOG_OWNER_IMMUTABLE%',
  'work_logs.owner_id 를 타 사용자로 재지정하면 트리거가 차단한다');

-- 5. 오탐 방지 — 같은 값이 SET 절에 실리기만 해도 트리거는 발화한다(로컬 실증).
--    IS DISTINCT FROM 가드가 빠지면 객체를 통째로 보내는 호출이 전부 죽는다.
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs SET staff_id = staff_id, owner_id = owner_id, notes = 'pin guard smoke' WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  '두 컬럼을 동일한 값으로 다시 써도 통과한다 (IS DISTINCT FROM 가드)');

-- 6. 정상 경로 무영향 — 두 컬럼이 SET 절에 없으면 트리거는 아예 발화하지 않는다
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now() WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  '두 컬럼을 건드리지 않는 정상 UPDATE 는 영향받지 않는다');

-- 7. 🔴 "NULL 이면 무조건 허용" 이 남기던 구멍.
--    wl_update 의 USING 은 워크스페이스 멤버·협업자를 통과시키므로, NULL 화를 무조건 허용하면
--    에디터가 **남의 공고 행**을 고아화해 공고 소유자의 정산 목록에서 감출 수 있었다.
--    자해가 아니라 타인 피해다. 이 단언이 그 구멍이 닫혀 있음을 지킨다.
--    ⚠️ 판별은 소유자 비교가 아니라 **채널**(current_user)로 한다 — 그래서 owner 컨텍스트에서도
--       직접 UPDATE 인 이상 똑같이 차단된다. 아래 8번이 신뢰 채널만 통과함을 보인다.
SELECT jpc_test_set_user((current_setting('wlp.editor_id'))::uuid);
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET owner_id = NULL WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  'WORK_LOG_OWNER_IMMUTABLE%',
  'owner_id 를 NULL 로 고아화하는 직접 UPDATE 는 워크스페이스 멤버여도 차단된다');

-- 8. permanently_delete_user 의 참조 해제 경로는 살아 있어야 한다.
--    그 함수는 SECDEF + 소유자 postgres 라 내부에서 current_user 가 'postgres' 로 바뀐다(로컬 실증).
--    여기서는 그 신뢰 채널을 role 리셋으로 재현한다.
--    ⚠️ jpc_test_clear_user() 만으로는 부족하다 — 그 헬퍼는 role GUC 를 건드리지 않는다
--       (fixtures/jpc_helpers.sql 주석). RESET ROLE 이 반드시 필요하다.
--    ⚠️ 맨 마지막에 둔다 — owner_id 가 NULL 이 되면 wl_update 의 첫 분기가 깨져 뒤 테스트 전제가 바뀐다.
SELECT jpc_test_clear_user();
RESET ROLE;
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs SET owner_id = NULL WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  '신뢰 컨텍스트(SECDEF/postgres)에서는 owner_id NULL 화가 허용된다 — 계정 삭제 경로 보존');

SELECT * FROM finish();
ROLLBACK;
