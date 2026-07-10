-- uniqn-mobile/supabase/tests/wl_update_staff_self_revoke.test.sql
-- 유저플로우 감사 P0#1 — work_logs 자기행 UPDATE 회수 (스태프 정산 입력값 조작 차단)
--
-- 배경 (docs/analysis/2026-07-10-userflow-audit.md §5):
--   prod 실측 결과 wl_update USING 이 `staff_id = auth.uid()` 를 허용하고,
--   protect_work_log_payroll_columns 트리거는 payroll_amount/status/date/notes 4개만 막는다.
--   정산 금액을 실제로 결정하는 입력값 — check_in_ts / check_out_ts /
--   custom_salary_info / custom_allowances / custom_tax_settings — 은 무방비였다.
--   → 스태프가 자기 JWT 로 REST PATCH 하여 자기 정산액을 부풀릴 수 있었다.
--
-- 수정: wl_update USING 에서 staff_id 자기행 분기를 제거한다.
--   QR 출퇴근은 process_qr_checkin_atomically(SECURITY DEFINER, owner=postgres)를
--   경유하므로 RLS 를 우회한다 — 이 파일이 그 회귀를 고정한다.
--
-- ⚠️ 잔여 벡터(의도적, P1 후속): job_posting_collaborators 로 추가된 staff-role
--   사용자는 is_posting_collaborator 분기로 여전히 UPDATE 가능하다.
--   협업자 추가는 workspace owner 만 할 수 있어(jpc_insert_ws_owner) 외부인은 자가 진입 불가.
--   케이스 6 이 이 잔여 동작을 명시적으로 고정한다.

BEGIN;
SELECT plan(8);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wl.owner_id',    s.owner_id::text,        true);
  PERFORM set_config('wl.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('wl.staff_id',    s.outsider_id::text,     true);
  PERFORM set_config('wl.jp_id',       s.job_posting_id::text,  true);
  PERFORM set_config('wl.wl_id',       s.work_log_id::text,     true);
  PERFORM set_config('wl.work_date',   (current_date + 14)::text, true);
END $$;

-- ============================================================================
-- 1. 구조 — wl_update USING 에 staff_id 분기가 없어야 한다
-- ============================================================================

SELECT ok(
  (SELECT qual FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_logs' AND policyname = 'wl_update')
  NOT LIKE '%staff_id%',
  'wl_update USING 에 staff_id 자기행 분기가 없다'
);

-- ============================================================================
-- 2~3. 스태프 직접 UPDATE — 정산 입력값 조작 차단 (핵심 취약점)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('wl.staff_id'))::uuid);

WITH u AS (
  UPDATE public.work_logs SET check_in_ts = now() - interval '5 hours'
   WHERE id = (current_setting('wl.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 0,
  'staff 가 자기 work_log 의 check_in_ts 를 직접 수정할 수 없다');

WITH u AS (
  UPDATE public.work_logs
     SET custom_salary_info = '{"type":"hourly","amount":999999}'::jsonb
   WHERE id = (current_setting('wl.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 0,
  'staff 가 자기 work_log 의 custom_salary_info 를 직접 수정할 수 없다');

-- ============================================================================
-- 4. 회귀 — 스태프의 SELECT 는 그대로 (wl_select 는 staff_id 유지)
-- ============================================================================

SELECT is(
  (SELECT count(*)::int FROM public.work_logs
    WHERE id = (current_setting('wl.wl_id'))::uuid),
  1, '회귀: staff 는 자기 work_log 를 여전히 조회할 수 있다');

-- ============================================================================
-- 5~6. 회귀 — owner / collaborator 의 UPDATE 는 그대로
-- ============================================================================

SELECT jpc_test_set_user((current_setting('wl.owner_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET notes = 'owner edit'
   WHERE id = (current_setting('wl.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1, '회귀: owner 는 여전히 UPDATE 할 수 있다');

SELECT jpc_test_set_user((current_setting('wl.collab_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET notes = 'collab edit'
   WHERE id = (current_setting('wl.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  '회귀(잔여 벡터 고정): posting collaborator 는 여전히 UPDATE 할 수 있다');

-- ============================================================================
-- 7~8. 회귀 — QR 출퇴근은 SECURITY DEFINER RPC 라 RLS 축소의 영향을 받지 않는다
-- ============================================================================

SELECT jpc_test_set_user((current_setting('wl.staff_id'))::uuid);

SELECT is(
  (SELECT public.process_qr_checkin_atomically(
     (current_setting('wl.wl_id'))::uuid,
     (current_setting('wl.staff_id'))::uuid,
     (current_setting('wl.jp_id'))::uuid,
     'checkIn',
     now(),
     current_setting('wl.work_date')
   ) ->> 'success'),
  'true',
  '회귀: staff 의 QR 체크인 RPC 는 여전히 성공한다 (SECURITY DEFINER 우회)');

SELECT isnt(
  (SELECT check_in_ts FROM public.work_logs
    WHERE id = (current_setting('wl.wl_id'))::uuid),
  NULL,
  '회귀: QR 체크인 후 check_in_ts 가 기록된다');

SELECT * FROM finish();
ROLLBACK;
