-- uniqn-mobile/supabase/tests/worklog_settled_custom_lock.test.sql
-- 정산 완료 건 커스텀 정산 설정 동결 — 방어심화 (2026-07-12)
--
-- 계약 (마이그 20260712010000):
--   OLD.payroll_status='completed' 인 work_log 의 custom_salary_info /
--   custom_allowances / custom_tax_settings 변경은 역할 무관 42501
--   (settled_work_log_custom_fields_locked). service_role 만 예외.
--   payroll_* 컬럼과 미정산(pending) 건의 custom_* 는 기존 계약 유지.
--   2단계 경로(payroll_status 되돌린 뒤 수정)는 의도적으로 허용 — 케이스 6 이 고정.
--
-- 시드 주의: 정산완료 행은 INSERT 로 만든다 — protect_work_log_payroll_columns 는
--   BEFORE UPDATE 트리거라 INSERT 는 통과. UPDATE 로 completed 를 만들면
--   postgres(클레임 없음)조차 staff 분기에 걸려 RAISE.

BEGIN;
SELECT plan(6);

-- employer 클레임 스위치 (jpc_test_set_user 는 app_metadata 미포함 → 별도 헬퍼.
-- 트랜잭션 내 생성 → ROLLBACK 으로 소멸)
CREATE OR REPLACE FUNCTION t_set_employer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated',
                      'app_metadata', json_build_object('role', 'employer'))::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

DO $$
DECLARE
  s RECORD;
  v_wl_settled uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('t.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('t.wl_pending',  s.work_log_id::text, true);
  PERFORM set_config('t.wl_settled',  v_wl_settled::text,  true);

  -- 정산 완료 work_log (INSERT 는 BEFORE UPDATE 트리거 미발화)
  -- status='completed' 는 work_logs_status_timestamp_consistency 체크 제약상
  -- check_in_ts/check_out_ts 필수
  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts,
    payroll_status, payroll_amount, custom_salary_info, created_at, updated_at
  )
  VALUES (
    v_wl_settled, s.application_id, s.outsider_id, s.job_posting_id, s.owner_id,
    (current_date + 16)::text, 'completed', 'staff',
    now() - interval '9 hours', now() - interval '1 hour',
    'completed', 100000, '{"salaryType":"hourly","salaryAmount":10000}'::jsonb, now(), now()
  );
END $$;

-- ============================================================================
-- 완료 건 custom_* 변경 → DENY 42501 (employer 라도)
-- ============================================================================

SELECT t_set_employer((current_setting('t.owner_id'))::uuid);

SELECT throws_ok(
  format(
    $q$UPDATE public.work_logs
          SET custom_salary_info = '{"salaryType":"hourly","salaryAmount":999999}'::jsonb
        WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  '42501', NULL,
  '완료건 custom_salary_info 변경: employer 도 DENY (settled lock)'
);

SELECT throws_ok(
  format(
    $q$UPDATE public.work_logs
          SET custom_allowances = '[{"type":"meal","amount":50000}]'::jsonb
        WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  '42501', NULL,
  '완료건 custom_allowances 변경: employer 도 DENY (settled lock)'
);

SELECT throws_ok(
  format(
    $q$UPDATE public.work_logs
          SET custom_tax_settings = '{"taxType":"none"}'::jsonb
        WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  '42501', NULL,
  '완료건 custom_tax_settings 변경: employer 도 DENY (settled lock)'
);

-- ============================================================================
-- 회귀 방지 — 기존 계약 유지
-- ============================================================================

-- 미정산(pending) 건의 custom_* 변경은 employer 허용 (정산 설정 편집 경로)
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs
          SET custom_salary_info = '{"salaryType":"daily","salaryAmount":150000}'::jsonb
        WHERE id = %L$q$,
    current_setting('t.wl_pending')
  ),
  '미정산건 custom_salary_info 변경: employer ALLOW (기존 계약 유지)'
);

-- 🔄 계약 반전 (2026-08-05, 감사 L1 3단계 / 마이그 20260805120000)
--    아래 두 건은 원래 "employer 는 payroll_* 를 직접 UPDATE 할 수 있다"를 고정했다.
--    `tr_work_logs_pin_payroll` 이 payroll 4컬럼을 **정산 RPC 전용**으로 바꾸면서
--    그 계약이 뒤집혔다 — 회귀가 아니라 의도된 전환이므로 새 계약으로 갱신한다.
--    ⚠️ settled lock(custom_* 동결) 계약 자체는 그대로다. 위 1~4번이 계속 지킨다.

-- 5. 완료 건 payroll_notes 직접 변경: employer 여도 DENY (정산 RPC 전용으로 전환됨)
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET payroll_notes = '정산 메모 수정' WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  'WORK_LOG_PAYROLL_RPC_ONLY%',
  '완료건 payroll_notes 직접 변경: employer 도 DENY (정산 RPC 전용)'
);

-- 6. **2단계 수정 경로는 살아 있어야 한다** — 이 파일의 원래 의도를 채널만 바꿔 보존한다.
--    되돌리기는 이제 SECDEF RPC(set_work_log_payroll_status)를 통해야 하고, 그 안에서는
--    current_user 가 definer 로 바뀌어 핀을 통과한다. 여기서는 그 채널을 RESET ROLE 로 재현한다
--    (JWT 는 employer 그대로 — 기존 protect_work_log_payroll 의 역할 게이트를 통과해야 하므로
--     jpc_test_clear_user() 로 클레임까지 비우면 안 된다).
--    되돌린 뒤 custom_* 수정이 열리는지까지 한 단언으로 묶어 "2단계 경로"를 실제로 증명한다.
SELECT lives_ok(
  format(
    $q$DO $inner$
       BEGIN
         RESET ROLE;
         UPDATE public.work_logs SET payroll_status = 'pending' WHERE id = %L;
         UPDATE public.work_logs
            SET custom_salary_info = '{"salaryType":"hourly","salaryAmount":12000}'::jsonb
          WHERE id = %L;
       END
       $inner$$q$,
    current_setting('t.wl_settled'),
    current_setting('t.wl_settled')
  ),
  '2단계 경로 유지: RPC 채널로 되돌린 뒤 custom_* 수정이 열린다'
);

SELECT * FROM finish();
ROLLBACK;
