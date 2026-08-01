-- ============================================================
-- work_logs.time_slot 형식 CHECK (감사 후속 P5 · L2)
--
-- 마이그레이션: 20260802120000_work_logs_identity_pin_and_time_slot_check.sql
--
-- 무엇을 지키는 테스트인가:
--   `add_direct_staff(p_job_posting_id, p_staff_id, p_assignments jsonb)` 는
--   **클라이언트가 보낸 jsonb** 의 `v_assignment->>'timeSlot'` 을 아무 검증 없이
--   그대로 work_logs.time_slot 에 INSERT 한다(confirm_application 도 동형).
--   둘 다 authenticated 에 GRANT 돼 있어 raw RPC 호출로 임의 문자열을 넣을 수 있었고,
--   유일한 형식 게이트는 클라이언트(assertSlotStartTime)뿐이었다.
--   work_logs_xss_check 트리거는 notes·custom_role 만 보므로 time_slot 을 못 막는다
--   (로컬에서 '<script>alert(1)</script>' 가 실제로 들어가는 것을 확인했다).
--
-- 🔴 허용 집합이 좁아지면 기존 데이터가 즉시 깨진다:
--    prod 레거시 범위 실측값은 `'18:30 - 03:00'` · `'17:00 - 00:00'` 처럼
--    **하이픈 양쪽에 공백**이 있다. 그 형태를 반드시 통과시켜야 한다.
--    아래 5번이 그 회귀를 막는 단언이다.
-- ============================================================
BEGIN;
SELECT plan(13);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wlt.wl_id', s.work_log_id::text, true);
END $$;

-- 제약이 존재하고 검증까지 끝난 상태인가 (NOT VALID 로 남아 있으면 기존 행을 안 지킨다)
SELECT is(
  (SELECT count(*)::int
   FROM pg_constraint con
   JOIN pg_class c ON c.oid = con.conrelid
   WHERE c.relname = 'work_logs'
     AND con.conname = 'work_logs_time_slot_format'
     AND con.contype = 'c'
     AND con.convalidated),
  1,
  'work_logs_time_slot_format CHECK 이 존재하고 VALIDATE 까지 끝나 있다');

-- ------------------------------------------------------------
-- 허용되어야 하는 값 (하나라도 막히면 기존 기능이 깨진다)
-- ------------------------------------------------------------

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '19:00' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '현행 단일 시각 HH:MM 을 허용한다 (활성 생산 형태)');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '00:00' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '경계값 00:00 을 허용한다');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '23:59' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '경계값 23:59 를 허용한다');

-- 🔴 prod 실측 레거시 형태 — 하이픈 양쪽 공백. 이걸 막으면 기존 행이 깨진다.
SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '18:30 - 03:00' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '레거시 범위(하이픈 양쪽 공백)를 허용한다 — prod 실측 형태');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '18:00~03:00' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '레거시 범위(물결, 공백 없음)를 허용한다');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = 'NEGOTIABLE' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  'FIXED_TIME_MARKER(NEGOTIABLE) 를 허용한다');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '미정' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  'TBA_TIME_MARKER(미정) 를 허용한다');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = '' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '레거시 빈 문자열을 허용한다 (_posting_slot_key 가 미정으로 정규화한다)');

SELECT lives_ok(
  format($q$UPDATE public.work_logs SET time_slot = NULL WHERE id = %L$q$, current_setting('wlt.wl_id')),
  'NULL(시각 미지정)을 허용한다');

-- ------------------------------------------------------------
-- 차단되어야 하는 값 (CHECK 위반 = 23514)
-- ------------------------------------------------------------

SELECT throws_ok(
  format($q$UPDATE public.work_logs SET time_slot = '<script>alert(1)</script>' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '23514', NULL,
  '스크립트 주입 문자열을 차단한다 (work_logs_xss_check 는 time_slot 을 안 본다)');

SELECT throws_ok(
  format($q$UPDATE public.work_logs SET time_slot = '18:00:00' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '23514', NULL,
  '초 단위가 붙은 값을 차단한다');

SELECT throws_ok(
  format($q$UPDATE public.work_logs SET time_slot = '25:00' WHERE id = %L$q$, current_setting('wlt.wl_id')),
  '23514', NULL,
  '시 범위를 벗어난 값을 차단한다');

SELECT * FROM finish();
ROLLBACK;
