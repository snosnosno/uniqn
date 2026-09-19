-- ============================================================
-- update_work_log_custom_settlement RPC (감사 S-D)
--
-- 마이그레이션: 20260807190000_update_work_log_custom_settlement_rpc.sql
--
-- 무엇을 지키는 테스트인가:
--   개인 정산 설정 저장이 클라이언트 read-modify-write 였다 —
--   select(work_log) → 이력 배열 append → update 통째 덮어쓰기.
--   동시 요청이 겹치면 앞 이력 항목이 **에러 없이** 사라진다(Lost Update).
--   정산 수정 이력은 금액 분쟁 시 "누가 언제 얼마로 바꿨나"의 유일한 근거다.
--
-- 🔴 Lost Update 자체는 단일 트랜잭션 pgTAP 으로 재현할 수 없다(두 세션이 필요하다).
--    대신 **그것을 원리적으로 불가능하게 만드는 구조**를 고정한다:
--      · 시그니처에 이력 배열 파라미터가 **없다** → 클라가 읽은 배열을 되돌려보낼 방법이 없다
--        (단언 1 이 이걸 고정한다 — 인자가 추가되면 red)
--      · append 가 UPDATE 문 안에서 일어난다 → 연속 호출이 서로를 덮지 않는다
--        (단언 10~13 이 관측 가능한 증거다)
--    이 두 가지가 유지되는 한, 어느 순서로 커밋되든 앞 항목은 남는다.
--
-- ⚠️ 시드 함정 (형제 테스트 settlement_payroll_status_rpc.test.sql 의 교훈 승계):
--    `protect_work_log_payroll_columns` 는 SECDEF RPC 안에서도 **호출자의 JWT** 를 읽는다.
--    `jpc_test_set_user()` 는 app_metadata 를 싣지 않아 v_role='' → staff 분기로 42501 이 난다.
--    반드시 `jpc_test_set_user_with_role(..., 'employer')` 를 쓸 것.
--    또 정산 완료 행은 UPDATE 가 아니라 **INSERT** 로 세운다(BEFORE UPDATE 트리거 회피).
-- ============================================================
BEGIN;
SELECT plan(19);

DO $$
DECLARE
  s        RECORD;
  v_wl     uuid := gen_random_uuid();
  v_wl_done uuid := gen_random_uuid();
  v_wl_bad  uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('ucs.owner_id',    s.owner_id::text,       true);
  PERFORM set_config('ucs.outsider_id', s.outsider_id::text,    true);
  PERFORM set_config('ucs.jp_id',       s.job_posting_id::text, true);
  PERFORM set_config('ucs.wl_id',       v_wl::text,             true);
  PERFORM set_config('ucs.wl_done_id',  v_wl_done::text,        true);
  PERFORM set_config('ucs.wl_bad_id',   v_wl_bad::text,         true);

  -- 미정산(pending) 행 — 정상 경로의 대상.
  -- status='checked_out' 은 work_logs_status_timestamp_consistency CHECK 이 두 ts 를 요구하기 때문.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status,
    settlement_modification_history, created_at, updated_at
  ) VALUES (
    v_wl, s.outsider_id, s.job_posting_id, s.owner_id,
    to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'staff',
    now() - interval '8 hours', now(), 'pending',
    '[]'::jsonb, now(), now()
  );

  -- 정산 완료 행 — 동결 계약 확인용.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts,
    payroll_status, payroll_amount, payroll_date,
    settlement_modification_history, created_at, updated_at
  ) VALUES (
    v_wl_done, s.outsider_id, s.job_posting_id, s.owner_id,
    to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'staff',
    now() - interval '8 hours', now(),
    'completed', 120000, now(),
    '[]'::jsonb, now(), now()
  );

  -- 이력이 오염된 행(배열이 아닌 스칼라) — 클라 zod 폴백이 하던 일을 서버가 이어받았는지 확인용.
  -- 전환 전에는 SettlementRepository 가 safeParse 실패 시 [] 로 접고 logger.error 만 남겼다.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status,
    settlement_modification_history, created_at, updated_at
  ) VALUES (
    v_wl_bad, s.outsider_id, s.job_posting_id, s.owner_id,
    to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'staff',
    now() - interval '8 hours', now(), 'pending',
    '"corrupt-not-an-array"'::jsonb, now(), now()
  );
END $$;

-- ============================================================
-- 계약 표면
-- ============================================================

-- 1. 🔑 시그니처 고정 — 이력 배열 파라미터가 없다는 것이 Lost Update 방어의 전제다
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_work_log_custom_settlement'),
  'p_work_log_id uuid, p_custom_salary_info jsonb, p_custom_tax_settings jsonb, p_modification_entry jsonb, p_custom_allowances jsonb',
  'update_work_log_custom_settlement 시그니처가 고정돼 있다 (이력 배열 인자 없음)');

-- 2. anon 은 실행할 수 없고 authenticated 는 할 수 있다
SELECT ok(
  NOT has_function_privilege('anon', 'public.update_work_log_custom_settlement(uuid, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.update_work_log_custom_settlement(uuid, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE'),
  'anon EXECUTE 없음 / authenticated EXECUTE 있음');

-- 3. SECURITY DEFINER + search_path 고정 (SECDEF 하드닝 규약)
SELECT ok(
  (SELECT p.prosecdef AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%'
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_work_log_custom_settlement'),
  'SECURITY DEFINER + search_path 고정');

-- ============================================================
-- 인가
-- ============================================================

-- 4. 미인증 → PERMISSION_DENIED
SELECT jpc_test_clear_user();
SELECT throws_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":10000}'::jsonb,
             '{"type":"none","value":0}'::jsonb, '{"reason":"테스트"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_id')),
  'P0001',
  'PERMISSION_DENIED: 인증이 필요합니다',
  '미인증 호출은 차단된다');

-- 5. 권한 없는 사용자 → PERMISSION_DENIED
SELECT jpc_test_set_user_with_role((current_setting('ucs.outsider_id'))::uuid, 'employer');
SELECT throws_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":10000}'::jsonb,
             '{"type":"none","value":0}'::jsonb, '{"reason":"테스트"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_id')),
  'P0001',
  'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산 설정을 수정할 수 있습니다',
  '남의 공고 근무기록은 수정할 수 없다');

-- 여기부터 공고 소유자 컨텍스트.
-- ⚠️ app_metadata.role 을 반드시 실어야 한다 — 헤더의 payroll 가드 트리거 설명 참조.
SELECT jpc_test_set_user_with_role((current_setting('ucs.owner_id'))::uuid, 'employer');

-- 6. 존재하지 않는 근무기록 → WORK_LOG_NOT_FOUND
SELECT throws_ok(
  $q$SELECT public.update_work_log_custom_settlement(
       '00000000-0000-0000-0000-000000000000'::uuid,
       '{"type":"hourly","amount":10000}'::jsonb,
       '{"type":"none","value":0}'::jsonb, '{"reason":"테스트"}'::jsonb, NULL)$q$,
  'P0001',
  'WORK_LOG_NOT_FOUND: 근무 기록을 찾을 수 없습니다',
  '없는 근무기록은 못 찾는다고 말한다');

-- ============================================================
-- 입력 검증 — 서버가 재현한다
-- ============================================================

-- 7. 급여 설정이 객체가 아니면 거부 (배열이 컬럼에 들어가면 계산기가 나중에 터진다)
SELECT throws_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '[1,2]'::jsonb,
             '{"type":"none","value":0}'::jsonb, '{"reason":"테스트"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_id')),
  'P0001',
  'INVALID_INPUT: 급여 설정 형식이 올바르지 않습니다',
  '급여 설정 비객체는 거부된다');

-- 8. 사유 200자 초과 → 거부 (형제 set_work_log_payroll_status 와 같은 상한)
SELECT throws_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":10000}'::jsonb,
             '{"type":"none","value":0}'::jsonb,
             jsonb_build_object('reason', repeat('가', 201)), NULL)$q$,
         current_setting('ucs.wl_id')),
  'P0001',
  'INVALID_INPUT: 수정 사유는 200자 이하여야 합니다',
  '사유 200자 상한을 서버가 강제한다');

-- 9. 사유 XSS 패턴 → 거부
SELECT throws_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":10000}'::jsonb,
             '{"type":"none","value":0}'::jsonb,
             '{"reason":"<script>alert(1)</script>"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_id')),
  'P0001',
  'INVALID_INPUT: 수정 사유에 허용되지 않는 문자가 포함되어 있습니다',
  '사유 XSS 패턴을 서버가 막는다');

-- ============================================================
-- 정상 경로 + 이력 누적
-- ============================================================

-- 10·11. 저장 성공 + 이력 1건
SELECT lives_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":12000}'::jsonb,
             '{"type":"percent","value":3.3}'::jsonb,
             '{"reason":"첫 번째 수정","newSalaryInfo":{"type":"hourly","amount":12000}}'::jsonb,
             '{"meal":10000}'::jsonb)$q$,
         current_setting('ucs.wl_id')),
  '소유자는 미정산 건의 정산 설정을 저장할 수 있다');

SELECT is(
  (SELECT jsonb_array_length(settlement_modification_history)
   FROM public.work_logs WHERE id = (current_setting('ucs.wl_id'))::uuid),
  1,
  '이력이 1건 쌓였다');

-- 12·13. 🔑 두 번째 저장이 첫 항목을 덮어쓰지 않는다 (append 가 UPDATE 문 안에서 일어난다는 증거)
SELECT lives_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":15000}'::jsonb,
             '{"type":"none","value":0}'::jsonb,
             '{"reason":"두 번째 수정"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_id')),
  '연속 저장이 가능하다');

SELECT is(
  (SELECT settlement_modification_history -> 0 ->> 'reason'
   FROM public.work_logs WHERE id = (current_setting('ucs.wl_id'))::uuid),
  '첫 번째 수정',
  '두 번째 저장 뒤에도 첫 이력 항목이 남아 있다 (Lost Update 방어)');

-- 14·15. 🔑 modifiedBy 를 서버가 박는다 — 클라가 보낸 값을 신뢰하지 않는다
SELECT lives_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":16000}'::jsonb,
             '{"type":"none","value":0}'::jsonb,
             '{"reason":"위조 시도","modifiedBy":"00000000-0000-0000-0000-000000000001"}'::jsonb,
             NULL)$q$,
         current_setting('ucs.wl_id')),
  '클라가 modifiedBy 를 실어 보내도 호출은 성공한다');

SELECT is(
  (SELECT settlement_modification_history -> -1 ->> 'modifiedBy'
   FROM public.work_logs WHERE id = (current_setting('ucs.wl_id'))::uuid),
  current_setting('ucs.owner_id'),
  '이력의 modifiedBy 는 클라 값이 아니라 auth.uid() 로 덮인다');

-- ============================================================
-- 동결 계약
-- ============================================================

-- 16. 정산 완료 건은 거부 — 트리거 문구가 아니라 RPC 의 사용자 대면 코드로 접힌다
SELECT throws_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":99000}'::jsonb,
             '{"type":"none","value":0}'::jsonb, '{"reason":"완료 건 수정"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_done_id')),
  'P0001',
  'ALREADY_SETTLED: 정산이 완료된 근무 기록은 정산 설정을 수정할 수 없습니다',
  '정산 완료 건의 정산 설정은 동결된다');

-- 17. 완료 건의 값이 실제로 안 바뀌었다 (예외가 롤백까지 했는지 확인 — 문구만 보고 넘어가지 않는다)
SELECT is(
  (SELECT jsonb_array_length(settlement_modification_history)
   FROM public.work_logs WHERE id = (current_setting('ucs.wl_done_id'))::uuid),
  0,
  '거부된 호출은 완료 건의 이력을 건드리지 않았다');

-- ============================================================
-- 오염 이력 폴백 — 클라 zod safeParse 폴백을 서버가 이어받았다
-- (SettlementRepository.modificationHistory.test.ts 의 "오염 → [] 폴백" 3·4번의 서버측 짝 — 단언 18·19)
-- ============================================================

-- 18. 이력이 배열이 아니어도 저장은 성공한다 (throw 하면 그 행이 영구히 편집 불가가 된다)
SELECT lives_ok(
  format($q$SELECT public.update_work_log_custom_settlement(
             %L::uuid, '{"type":"hourly","amount":11000}'::jsonb,
             '{"type":"none","value":0}'::jsonb, '{"reason":"오염 위 저장"}'::jsonb, NULL)$q$,
         current_setting('ucs.wl_bad_id')),
  '이력 jsonb 가 오염돼 있어도 저장은 성공한다');

-- 19. 오염분은 버려지고 새 항목 1건만 남는다 ('[]' 로 접은 위에 누적)
SELECT is(
  (SELECT jsonb_array_length(settlement_modification_history)
   FROM public.work_logs WHERE id = (current_setting('ucs.wl_bad_id'))::uuid),
  1,
  '오염된 이력은 빈 배열로 접히고 새 항목 1건만 남는다');

SELECT jpc_test_clear_user();
SELECT * FROM finish();
ROLLBACK;
