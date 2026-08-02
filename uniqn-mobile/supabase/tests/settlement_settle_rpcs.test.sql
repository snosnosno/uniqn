-- ============================================================
-- settle_work_log / bulk_settle_work_logs (감사 L1 잔여)
--
-- 마이그레이션: 20260802161000_settle_work_log_rpcs.sql
--
-- 무엇을 지키는 테스트인가:
--   확정·일괄 정산이 클라 다단계 뮤테이션이었다. 금액을 클라가 계산해 실어 보냈고,
--   상태 확인과 update 사이가 벌어져(TOCTOU) 동시 요청이 중복 확정을 성사시킬 수 있었다.
--
-- 🔴 이 RPC 는 SECDEF 라 **RLS 가 적용되지 않는다.** 함수 안 술어가 유일한 관문이고,
--    그것이 "행 접근"이 아니라 **"공고 관리 권한"**이어야 한다는 것이 5번 테스트의 요지다.
--    `wl_update` 의 USING 은 `owner_id = auth.uid()` 도 통과시키므로, 행 접근으로 쓰면
--    지점 직속 배치에서 **staff 가 자기 근무기록에 호출해 셀프 정산**하게 된다.
--
-- ⚠️ 시드 함정 두 가지(P5 에서 실측으로 알아낸 것):
--   1) `protect_work_log_payroll_columns` 는 SECDEF 여도 우회되지 않는다 — definer 가 아니라
--      **호출자 JWT** 의 app_metadata.role 을 읽는다. `jpc_test_set_user_with_role(…, 'employer')` 필수.
--   2) 차단 단언은 `throws_like` 로 **메시지 접두사**를 본다. 42501 단독 단언은 RLS WITH CHECK
--      위반과 겹쳐 게이트를 빼도 green 이 유지되는 red-스왑이 난다.
-- ============================================================
BEGIN;
SELECT plan(16);

DO $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('swl.owner_id',    s.owner_id::text,       true);
  PERFORM set_config('swl.outsider_id', s.outsider_id::text,    true);
  PERFORM set_config('swl.jp_id',       s.job_posting_id::text, true);

  PERFORM set_config('swl.wl_ok',     gen_random_uuid()::text, true);  -- 정상 확정 대상
  PERFORM set_config('swl.wl_open',   gen_random_uuid()::text, true);  -- 출퇴근 미완료
  PERFORM set_config('swl.wl_self',   gen_random_uuid()::text, true);  -- owner_id = staff 본인
  PERFORM set_config('swl.wl_bulk_a', gen_random_uuid()::text, true);
  PERFORM set_config('swl.wl_bulk_b', gen_random_uuid()::text, true);

  -- 정상 확정 대상 (checked_out + 두 ts 존재)
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status, created_at, updated_at
  ) VALUES (
    (current_setting('swl.wl_ok'))::uuid, s.outsider_id, s.job_posting_id, s.owner_id,
    to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'dealer',
    now() - interval '8 hours', now(), 'pending', now(), now()
  );

  -- 출퇴근 미완료 (scheduled) — work_logs_status_timestamp_consistency 가 ts 없음을 요구한다
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    payroll_status, created_at, updated_at
  ) VALUES (
    (current_setting('swl.wl_open'))::uuid, s.outsider_id, s.job_posting_id, s.owner_id,
    to_char(now(), 'YYYY-MM-DD'), 'scheduled', 'dealer', 'pending', now(), now()
  );

  -- 🔴 owner_id 가 **staff 본인**인 행 — 지점 직속 배치에서 실제로 생기는 모양이다.
  --    행 접근으로 권한을 쓰면 이 행에서 셀프 정산이 열린다.
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status, created_at, updated_at
  ) VALUES (
    (current_setting('swl.wl_self'))::uuid, s.outsider_id, s.job_posting_id, s.outsider_id,
    to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'dealer',
    now() - interval '5 hours', now(), 'pending', now(), now()
  );

  -- 일괄용 2건: a=정상, b=이미 완료
  INSERT INTO public.work_logs (
    id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts, payroll_status, payroll_amount, payroll_date, created_at, updated_at
  ) VALUES
  ((current_setting('swl.wl_bulk_a'))::uuid, s.outsider_id, s.job_posting_id, s.owner_id,
   to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'dealer',
   now() - interval '3 hours', now(), 'pending', NULL, NULL, now(), now()),
  ((current_setting('swl.wl_bulk_b'))::uuid, s.outsider_id, s.job_posting_id, s.owner_id,
   to_char(now(), 'YYYY-MM-DD'), 'checked_out', 'dealer',
   now() - interval '3 hours', now(), 'completed', 50000, now(), now(), now());
END $$;

-- 1~2. 시그니처 고정
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'settle_work_log'),
  'p_work_log_id uuid, p_notes text',
  'settle_work_log 시그니처가 고정돼 있다');

SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'bulk_settle_work_logs'),
  'p_work_log_ids uuid[], p_notes text',
  'bulk_settle_work_logs 시그니처가 고정돼 있다');

-- 3~4. anon 은 실행 불가 / authenticated 는 가능
SELECT ok(
  NOT has_function_privilege('anon', 'public.settle_work_log(uuid, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.settle_work_log(uuid, text)', 'EXECUTE'),
  'settle_work_log — anon EXECUTE 없음 / authenticated 있음');

SELECT ok(
  NOT has_function_privilege('anon', 'public.bulk_settle_work_logs(uuid[], text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.bulk_settle_work_logs(uuid[], text)', 'EXECUTE'),
  'bulk_settle_work_logs — anon EXECUTE 없음 / authenticated 있음');

-- ============================================================
-- 여기부터 무관한 사용자(outsider) 컨텍스트.
-- ⚠️ app_metadata.role 을 employer 로 실어야 거부한 주체가 payroll 가드 트리거가 아니라
--    **RPC 술어**임이 증명된다(P5 의 대조법).
-- ============================================================
SELECT jpc_test_set_user_with_role((current_setting('swl.outsider_id'))::uuid, 'employer');

-- 5. 🔴 이 파일의 본체 — owner_id 가 자기 자신인 행이어도 셀프 정산은 막힌다.
SELECT throws_like(
  format($q$SELECT public.settle_work_log(%L::uuid, NULL)$q$, current_setting('swl.wl_self')),
  'PERMISSION_DENIED%',
  '🔴 work_logs.owner_id 가 호출자 본인이어도 공고 권한이 없으면 셀프 정산은 차단된다');

-- 6. 무관한 사용자는 일반 행도 확정할 수 없다
SELECT throws_like(
  format($q$SELECT public.settle_work_log(%L::uuid, NULL)$q$, current_setting('swl.wl_ok')),
  'PERMISSION_DENIED%',
  '공고와 무관한 사용자는 정산 확정을 할 수 없다 (SECDEF 라 RLS 가 못 막는 자리)');

-- 7. 일괄도 같은 술어를 쓴다 — 예외를 던지지 않고 항목별 실패로 접힌다(부분 성공 계약)
SELECT is(
  (public.bulk_settle_work_logs(
     ARRAY[(current_setting('swl.wl_ok'))::uuid], NULL) -> 'results' -> 0 ->> 'message'),
  '권한이 없는 공고입니다',
  '일괄 경로의 권한 거부는 예외가 아니라 항목별 메시지로 접힌다');

-- ============================================================
-- 공고 소유자 컨텍스트
-- ============================================================
SELECT jpc_test_set_user_with_role((current_setting('swl.owner_id'))::uuid, 'employer');

-- 8. 출퇴근 미완료는 확정 불가
SELECT throws_like(
  format($q$SELECT public.settle_work_log(%L::uuid, NULL)$q$, current_setting('swl.wl_open')),
  'INVALID_STATUS%',
  '출퇴근이 완료되지 않은 근무 기록은 확정할 수 없다');

-- 9. 없는 근무 기록
SELECT throws_like(
  $q$SELECT public.settle_work_log('00000000-0000-0000-0000-000000000000'::uuid, NULL)$q$,
  'WORK_LOG_NOT_FOUND%',
  '없는 근무 기록은 WORK_LOG_NOT_FOUND 로 거부한다');

-- 10. 정상 확정
SELECT lives_ok(
  format($q$SELECT public.settle_work_log(%L::uuid, '8월 1주차')$q$, current_setting('swl.wl_ok')),
  '권한이 있으면 확정이 성공한다');

-- 11. 🔑 저장된 금액이 **서버 계산기가 낸 값**이다(클라가 보낸 값이 아니라).
--     계산기와 확정이 갈라지면 여기서 잡힌다.
SELECT is(
  (SELECT w.payroll_amount FROM public.work_logs w WHERE w.id = (current_setting('swl.wl_ok'))::uuid),
  (SELECT (public.fn_settlement_amount(
             w.check_in_ts, w.check_out_ts, w.role::text, w.custom_role,
             w.custom_salary_info, w.custom_allowances, w.custom_tax_settings,
             j.status::text, j.schedule, j.role_catalog, j.compensation) ->> 'afterTaxPay')::numeric
   FROM public.work_logs w JOIN public.job_postings j ON j.id = w.job_posting_id
   WHERE w.id = (current_setting('swl.wl_ok'))::uuid),
  '저장 금액 = fn_settlement_amount 의 canonical 값');

-- 12. 상태·지급일·메모 반영
SELECT is(
  (SELECT payroll_status::text || '|' || (payroll_date IS NOT NULL)::text || '|' || COALESCE(payroll_notes, '(null)')
   FROM public.work_logs WHERE id = (current_setting('swl.wl_ok'))::uuid),
  'completed|true|8월 1주차',
  '확정 시 상태=completed·지급일 기록·메모 반영');

-- 13. 중복 확정 방지
SELECT throws_like(
  format($q$SELECT public.settle_work_log(%L::uuid, NULL)$q$, current_setting('swl.wl_ok')),
  'ALREADY_SETTLED%',
  '이미 확정된 근무 기록은 다시 확정할 수 없다');

-- 14. 🔑 일괄 부분 성공 — 성공 1 · 이미완료 1 · 없는 id 1 이 **한 호출 안에서 공존**한다.
--     all-or-nothing 이면 이 단언이 성립하지 않는다(항목별 서브트랜잭션의 존재 증거).
SELECT is(
  (SELECT r ->> 'successCount' || '|' || (r ->> 'failedCount') || '|' || jsonb_array_length(r -> 'results')::text
   FROM (SELECT public.bulk_settle_work_logs(ARRAY[
           (current_setting('swl.wl_bulk_a'))::uuid,
           (current_setting('swl.wl_bulk_b'))::uuid,
           '00000000-0000-0000-0000-000000000000'::uuid
         ], NULL) AS r) x),
  '1|2|3',
  '일괄은 성공·이미완료·없는 기록이 한 호출에서 공존한다 (부분 성공 계약)');

-- 15. 입력 순서 보존 — 실패 목록에 이름을 붙이는 클라 헬퍼가 결정적 출력을 내려면 필요하다.
SELECT is(
  (SELECT string_agg(e ->> 'message', ',' ORDER BY ord)
   FROM (SELECT public.bulk_settle_work_logs(ARRAY[
           '00000000-0000-0000-0000-000000000000'::uuid,
           (current_setting('swl.wl_bulk_b'))::uuid
         ], NULL) AS r) x,
        LATERAL jsonb_array_elements(x.r -> 'results') WITH ORDINALITY AS t(e, ord)),
  '근무 기록을 찾을 수 없습니다,이미 정산 완료되었습니다',
  '일괄 결과가 입력 순서를 보존한다');

-- 16. 🔴 청크 상한 — 클라 BATCH_CHUNK_SIZE(100)와 같은 값이어야 한다.
--     넘겨 보내면 statement_timeout 대신 명시적 거부가 나가야 원인을 알 수 있다.
SELECT throws_like(
  $q$SELECT public.bulk_settle_work_logs(
       (SELECT array_agg(gen_random_uuid()) FROM generate_series(1, 101)), NULL)$q$,
  'INVALID_INPUT%',
  '한 번에 100건을 넘기면 명시적으로 거부한다 (클라 청크 크기와 동치)');

SELECT * FROM finish();
ROLLBACK;
