-- ============================================================
-- set_work_log_payroll_status RPC (감사 후속 P5 · L1 1/2)
--
-- 마이그레이션: 20260802130000_set_work_log_payroll_status_rpc.sql
--
-- 무엇을 지키는 테스트인가:
--   지급 완료 되돌리기의 **사유 필수**가 클라(SettlementRepository)에만 있었다.
--   raw PostgREST 로 work_logs 를 직접 UPDATE 하면 사유 없이도 금전 상태를 역행시킬 수 있었고,
--   이력(settlement_modification_history)은 select→update read-modify-write 라
--   동시 요청이 앞 항목을 조용히 지웠다(Lost Update).
--
-- 🔴 계약 제약: P2(#397)의 notify_on_work_log_update Case 3-B 가 되돌리기 알림 본문에
--    사유를 실을 때 이 배열의 **마지막 항목**에서 `type='payroll_status_revert'` +
--    `previousStatus='completed'` 를 확인하고 `reason` 을 읽는다.
--    아래 5~7번이 그 계약을 고정한다 — 키 이름이 바뀌면 알림이 사유 없이 나간다.
--
-- ⚠️ 시드 함정: `protect_work_log_payroll_columns` 는 JWT 가 없는 postgres 컨텍스트를
--    service_role 도 admin/employer 도 아닌 것으로 보고 **payroll 컬럼 UPDATE 를 막는다**.
--    그래서 완료 상태를 UPDATE 로 만들지 않고 INSERT 로 직접 세운다(BEFORE UPDATE 트리거 무관).
--
-- 🔑 이 테스트를 쓰다가 실측으로 알아낸 것 — **SECDEF RPC 라도 payroll 가드 트리거를
--    우회하지 못한다.** 트리거는 SECDEF 함수의 소유자가 아니라 **호출자의 JWT**
--    (`auth.jwt() -> 'app_metadata' ->> 'role'`)를 읽기 때문이다.
--    `jpc_test_set_user()` 는 app_metadata 를 싣지 않아 v_role='' → staff 분기로 42501 이 났고,
--    `jpc_test_set_user_with_role(..., 'employer')` 로 바꾸자 그대로 통과했다
--    (같은 호출에서 role 만 바꿔 대조 — RPC 권한 검사·CHECK 가설은 이걸로 기각됐다).
--    → 앱에서는 employer 사용자가 app_metadata.role='employer' 를 갖고 있어 정상 동작하지만,
--      **협업자(is_posting_collaborator)가 employer 역할이 아니면 RPC 는 통과시켜도
--      트리거가 막는다.** 이는 전환 전 클라 직접 UPDATE 도 똑같이 겪던 선재 제약이라
--      이번 변경의 회귀는 아니다. 별도 항목으로 남긴다.
-- ============================================================
BEGIN;
SELECT plan(16);

DO $$
DECLARE
  s RECORD;
  v_wl uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('sps.owner_id',    s.owner_id::text,     true);
  PERFORM set_config('sps.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('sps.jp_id',       s.job_posting_id::text, true);
  PERFORM set_config('sps.wl_id',       v_wl::text,           true);

  -- 정산 완료 상태의 work_log 를 직접 세운다.
  -- status 는 checked_out — work_logs_status_timestamp_consistency CHECK 이 두 ts 를 요구한다.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts,
    payroll_status, payroll_amount, payroll_date,
    settlement_modification_history, created_at, updated_at
  ) VALUES (
    v_wl, s.outsider_id, s.job_posting_id, s.owner_id,
    to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'staff',
    now() - interval '8 hours', now(),
    'completed', 120000, now(),
    '[]'::jsonb, now(), now()
  );
END $$;

-- 1. 함수가 기대한 시그니처로 존재하는가
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'set_work_log_payroll_status'),
  'p_work_log_id uuid, p_status text, p_reason text',
  'set_work_log_payroll_status 시그니처가 고정돼 있다');

-- 2. anon 은 실행할 수 없고 authenticated 는 할 수 있다
SELECT ok(
  NOT has_function_privilege('anon', 'public.set_work_log_payroll_status(uuid, text, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.set_work_log_payroll_status(uuid, text, text)', 'EXECUTE'),
  'anon EXECUTE 없음 / authenticated EXECUTE 있음');

-- 여기부터 공고 소유자 컨텍스트.
-- ⚠️ app_metadata.role 을 반드시 실어야 한다 — 위 헤더의 payroll 가드 트리거 설명 참조.
SELECT jpc_test_set_user_with_role((current_setting('sps.owner_id'))::uuid, 'employer');

-- 3. 🔑 사유 없이 되돌리기 → 차단 (이 테스트가 이 마이그의 본체다)
SELECT throws_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', NULL)$q$,
         current_setting('sps.wl_id')),
  'P0001', NULL,
  '사유 없이 지급 완료를 되돌리면 차단된다');

-- 4. 공백만 있는 사유도 차단 (btrim 후 빈 문자열)
SELECT throws_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', '   ')$q$,
         current_setting('sps.wl_id')),
  'P0001', NULL,
  '공백만 있는 사유도 차단된다');

-- 5. XSS 패턴 사유 차단
SELECT throws_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', '<script>alert(1)</script>')$q$,
         current_setting('sps.wl_id')),
  'P0001', NULL,
  'XSS 패턴이 든 사유는 차단된다');

-- 6. 200자 초과 사유 차단
SELECT throws_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', %L)$q$,
         current_setting('sps.wl_id'), repeat('가', 201)),
  'P0001', NULL,
  '200자를 넘는 사유는 차단된다');

-- 7. 알 수 없는 상태값 차단 (enum 캐스팅 22P02 가 그대로 새지 않는다)
SELECT throws_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'bogus', '사유')$q$,
         current_setting('sps.wl_id')),
  'P0001', NULL,
  '화이트리스트에 없는 상태값은 앱이 매핑할 수 있는 코드로 거부된다');

-- 8. 정상 되돌리기 성공
SELECT lives_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', '금액 산정 오류로 취소')$q$,
         current_setting('sps.wl_id')),
  '사유가 있으면 되돌리기가 성공한다');

-- 9. 상태·지급일 반영 — payroll_amount(동결 표시액)는 남는다
-- payroll_amount 는 numeric 이라 '120000.00' 으로 직렬화된다 — 표현이 아니라 값으로 비교한다.
SELECT is(
  (SELECT payroll_status::text || '|' || (payroll_date IS NULL)::text || '|' || (payroll_amount = 120000)::text
   FROM public.work_logs WHERE id = (current_setting('sps.wl_id'))::uuid),
  'pending|true|true',
  '되돌리면 상태=pending·지급일=NULL 이고 동결 표시액은 보존된다');

-- 10. 🔴 P2 Case 3-B 읽기 계약 — 마지막 항목의 type/previousStatus/newStatus
SELECT is(
  (SELECT (h ->> 'type') || '|' || (h ->> 'previousStatus') || '|' || (h ->> 'newStatus')
   FROM public.work_logs w,
        LATERAL (SELECT w.settlement_modification_history
                        -> (jsonb_array_length(w.settlement_modification_history) - 1) AS h) x
   WHERE w.id = (current_setting('sps.wl_id'))::uuid),
  'payroll_status_revert|completed|pending',
  '이력 마지막 항목이 알림 트리거(Case 3-B)의 읽기 계약과 일치한다');

-- 11. 사유가 이력에 실려야 알림 본문에 사유가 들어간다
SELECT is(
  (SELECT h ->> 'reason'
   FROM public.work_logs w,
        LATERAL (SELECT w.settlement_modification_history
                        -> (jsonb_array_length(w.settlement_modification_history) - 1) AS h) x
   WHERE w.id = (current_setting('sps.wl_id'))::uuid),
  '금액 산정 오류로 취소',
  '되돌리기 사유가 이력에 그대로 기록된다');

-- 12. 🔴 인가 — 이 RPC 는 SECDEF 라 **RLS 가 적용되지 않는다.** 따라서 함수 안의 권한 술어가
--     유일한 관문이고, 그것이 깨져도 다른 무엇도 막아주지 않는다.
--     ⚠️ app_metadata.role 을 'employer' 로 실어야 한다 — 그래야 거부한 주체가
--        payroll 가드 트리거가 아니라 **RPC 술어**임이 증명된다(헤더의 대조법).
SELECT jpc_test_set_user_with_role((current_setting('sps.outsider_id'))::uuid, 'employer');
SELECT throws_like(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', '무관한 사용자의 시도')$q$,
         current_setting('sps.wl_id')),
  'PERMISSION_DENIED%',
  '공고와 무관한 사용자는 정산 상태를 바꿀 수 없다 (SECDEF 라 RLS 가 못 막는 자리)');

-- 13. 존재하지 않는 근무 기록
SELECT throws_like(
  $q$SELECT public.set_work_log_payroll_status('00000000-0000-0000-0000-000000000000'::uuid, 'pending', '사유')$q$,
  'WORK_LOG_NOT_FOUND%',
  '없는 근무 기록은 WORK_LOG_NOT_FOUND 로 거부한다');

-- 소유자 컨텍스트로 복귀
SELECT jpc_test_set_user_with_role((current_setting('sps.owner_id'))::uuid, 'employer');

-- 14. 되돌리기가 아닌 정상 전이(pending→completed)는 사유 없이 통과하고 이력을 남기지 않는다.
--     헤더가 계약으로 선언한 의미론인데 8~11번이 되돌리기만 보고 있어 비어 있던 자리다.
SELECT lives_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'completed', NULL)$q$,
         current_setting('sps.wl_id')),
  '되돌리기가 아닌 전이는 사유 없이 통과한다');

SELECT is(
  (SELECT (payroll_date IS NOT NULL)::text || '|' || jsonb_array_length(settlement_modification_history)::text
   FROM public.work_logs WHERE id = (current_setting('sps.wl_id'))::uuid),
  'true|1',
  'completed 로 갈 때 지급일을 찍고 이력은 늘리지 않는다 (되돌리기 1건만 남아 있다)');

-- 15. jsonb_typeof 배열 폴백 — 이력이 배열이 아닌 값으로 오염돼 있어도 예외 없이 복구한다.
--     P2(#397)가 정확히 이 클래스로 데였다(배열 아닌 jsonb 하나가 상류 알림까지 삼켰다).
SELECT jpc_test_clear_user();
RESET ROLE;
UPDATE public.work_logs SET settlement_modification_history = '{"corrupted": true}'::jsonb, payroll_status = 'completed'
 WHERE id = (current_setting('sps.wl_id'))::uuid;
SELECT jpc_test_set_user_with_role((current_setting('sps.owner_id'))::uuid, 'employer');
SELECT lives_ok(
  format($q$SELECT public.set_work_log_payroll_status(%L::uuid, 'pending', '오염 이력 복구 확인')$q$,
         current_setting('sps.wl_id')),
  '이력이 배열이 아니어도 예외 없이 되돌리기가 성공한다 (jsonb_typeof 폴백)');

SELECT * FROM finish();
ROLLBACK;
