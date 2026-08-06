-- ============================================================
-- work_logs payroll 컬럼 RPC 전용 고정 트리거 (감사 L1 3단계)
--
-- 마이그레이션: 20260805120000_work_logs_payroll_direct_write_block.sql
--
-- 무엇을 지키는 테스트인가:
--   정산 금액·상태는 RPC(settle_work_log / bulk_settle_work_logs /
--   set_work_log_payroll_status)가 서버에서 재계산·검증한다. 그런데 기존
--   `protect_work_log_payroll` 는 게이트가 **앱 역할** 축이라
--   app_metadata.role IN (admin, employer) 를 **무조건 통과**시켰다
--   → 구인자가 raw PostgREST PATCH 로 그 서버 검증을 통째로 우회하고
--     클라가 보낸 금액을 그대로 박을 수 있었다. 이 테스트가 그 구멍을 지킨다.
--
-- 🔴 이 테스트의 핵심은 3·4번이다 — "권한 없는 사람이 못 한다"가 아니라
--    **기존 트리거가 통과시키던 employer 도 못 한다**를 단언한다.
--    그래서 컨텍스트를 `jpc_test_set_user_with_role(..., 'employer')` 로 만든다.
--    평범한 `jpc_test_set_user` 를 쓰면 app_metadata.role 이 비어
--    기존 트리거의 staff 분기('staff_cannot_modify_payroll_fields')에 먼저 걸려
--    **이 트리거를 지워도 green 이 유지된다**(red-스왑 실패).
--
-- ⚠️ 차단 단언은 전부 `throws_like` 로 **메시지 접두사**를 본다.
--    42501 만 보면 기존 트리거·RLS WITH CHECK 위반도 같은 코드를 내므로
--    트리거를 빼도 다른 이유로 42501 이 나 green 이 유지된다.
--
-- ⚠️ 두 BEFORE 트리거는 이름 알파벳 순으로 발화한다
--    (protect_work_log_payroll → tr_work_logs_pin_payroll).
--    employer 컨텍스트에서는 앞 트리거가 RETURN NEW 로 통과시키므로
--    뒤 트리거의 메시지가 관측된다.
-- ============================================================
BEGIN;
SELECT plan(7);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wlp.owner_id', s.owner_id::text,    true);
  PERFORM set_config('wlp.wl_id',    s.work_log_id::text, true);
END $$;

-- 1. 배선 자체가 존재하는가 (트리거를 지우면 이 단언부터 red 가 된다)
SELECT is(
  (SELECT count(*)::int
   FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE c.relname = 'work_logs'
     AND t.tgname = 'tr_work_logs_pin_payroll'
     AND p.proname = 'fn_work_logs_pin_payroll'
     AND NOT t.tgisinternal),
  1,
  'tr_work_logs_pin_payroll 트리거가 work_logs 에 배선돼 있다');

-- 2. 트리거 함수는 직접 호출 대상이 아니다 — PUBLIC/anon/authenticated EXECUTE 0
--    (prod 하드닝 관례 20260731090000 과 정합)
SELECT is(
  (SELECT count(*)::int
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'fn_work_logs_pin_payroll'
     AND (p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.proacl, '{}'::aclitem[])) a
                     WHERE a::text ~ '^(=|anon=|authenticated=)'))),
  0,
  'fn_work_logs_pin_payroll 에 PUBLIC/anon/authenticated EXECUTE 가 없다');

-- 여기부터 **구인자(employer) 앱 역할을 실은** 컨텍스트다.
-- = 기존 protect_work_log_payroll 이 무조건 통과시키던 바로 그 사람.
SELECT jpc_test_set_user_with_role((current_setting('wlp.owner_id'))::uuid, 'employer');

-- 3. 🔴 핵심 — payroll_status 직접 UPDATE 는 구인자여도 차단된다
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET payroll_status = 'completed' WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  'WORK_LOG_PAYROLL_RPC_ONLY%',
  'payroll_status 직접 UPDATE 는 구인자여도 트리거가 차단한다 (정산 RPC 전용)');

-- 4. 🔴 핵심 — payroll_amount 직접 UPDATE 차단.
--    서버 재계산 우회로 임의 금액을 박는 경로가 이 단언이 지키는 것이다.
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET payroll_amount = 999999 WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  'WORK_LOG_PAYROLL_RPC_ONLY%',
  'payroll_amount 직접 UPDATE 는 구인자여도 트리거가 차단한다 (서버 재계산 우회 차단)');

-- 5. 오탐 방지 — 같은 값이 SET 절에 실리기만 해도 BEFORE UPDATE OF 는 발화한다.
--    IS NOT DISTINCT FROM 가드가 빠지면 객체를 통째로 보내는 호출이 전부 죽는다.
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs SET payroll_status = payroll_status, payroll_amount = payroll_amount, notes = 'payroll pin smoke' WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  'payroll 컬럼을 동일한 값으로 다시 써도 통과한다 (IS NOT DISTINCT FROM 가드)');

-- 6. 정상 경로 무영향 — payroll 컬럼이 SET 절에 없으면 트리거는 아예 발화하지 않는다.
--    출퇴근 수정·개인 정산 설정 저장 등 현재 클라의 살아있는 직접 UPDATE 경로가 여기 해당한다.
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now() WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  'payroll 컬럼을 건드리지 않는 정상 UPDATE 는 영향받지 않는다');

-- 7. 신뢰 채널(SECDEF RPC 경유)은 통과해야 한다.
--    정산 RPC 3종은 SECURITY DEFINER + owner=postgres 라 내부에서 current_user 가
--    'postgres' 로 바뀐다(prod 실측). 반면 auth.jwt() 는 **호출자 JWT 를 그대로 본다**
--    (P5 20260802120000 이 로컬 실증). 그래서 재현은 `RESET ROLE` 만 한다 —
--    JWT(employer)는 유지한 채 current_user 만 definer 로 바꾸는 것이 실제 형태다.
--
--    ⚠️ 한계(리뷰 지적) — 이 단언은 `RESET ROLE` 로 채널을 흉내낼 뿐,
--       **정산 RPC 가 실제로 SECDEF 라서 통과한다**는 전제까지 시험하지는 않는다.
--       settle_work_log 가 언젠가 SECURITY INVOKER 로 재정의돼도 여기는 green 이다.
--       그 무회귀 백스톱은 형제 파일에 있고 같은 `supabase test db` 스위트에서 돈다:
--         · settlement_settle_rpcs.test.sql:166      lives_ok(settle_work_log)
--         · settlement_payroll_status_rpc.test.sql:116,220  lives_ok(set_work_log_payroll_status)
--         · settlement_payroll_status_rpc.test.sql:199,210  bulk_settle_work_logs 결과 단언
--       위 셋을 지우면 이 트리거의 통과 조건이 무검증이 된다.
--
--    🔴 jpc_test_clear_user() 로 JWT 까지 비우면 안 된다. 실측으로 확인했다:
--       그러면 **기존** protect_work_log_payroll_columns() 가 app_metadata.role 을
--       빈 문자열로 읽어 staff 분기('staff_cannot_modify_payroll_fields')로 떨어진다.
--       그건 이 트리거와 무관한 선재 동작이라, 이 자리에서 단언하면 남의 결함을 시험하게 된다.
RESET ROLE;
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs SET payroll_status = 'completed', payroll_amount = 120000 WHERE id = %L$q$,
    current_setting('wlp.wl_id')
  ),
  '신뢰 채널(definer/service_role)에서는 payroll 컬럼 변경이 통과한다');

SELECT * FROM finish();
ROLLBACK;
