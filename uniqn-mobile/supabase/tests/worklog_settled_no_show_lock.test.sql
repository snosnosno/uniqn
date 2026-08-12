-- uniqn-mobile/supabase/tests/worklog_settled_no_show_lock.test.sql
-- 정산 완료 근무의 노쇼 전환 동결 — 단방향 비대칭 종료 (감사 3-2 / 2026-08-13)
--
-- 계약 (마이그 20260813100000):
--   OLD.payroll_status='completed' 인 work_log 를 status='no_show' 로 바꾸는 UPDATE 는
--   역할 무관 42501 (ALREADY_SETTLED). service_role 만 예외.
--   · 정산을 함께 되돌리는 UPDATE 는 통과 — 탈출 경로(되돌린 뒤 노쇼)를 남긴다.
--   · 미정산(pending) 건의 노쇼 전환은 기존대로 허용.
--   · no_show 이외의 상태 전이는 이 가드의 범위 밖(의도적 축소).
--
-- 시드 주의: 정산완료 행은 INSERT 로 만든다 — protect_work_log_payroll_columns 는
--   BEFORE UPDATE 트리거라 INSERT 는 통과. UPDATE 로 completed 를 만들면
--   postgres(클레임 없음)조차 staff 분기에 걸려 RAISE.

BEGIN;
SELECT plan(5);

-- employer 클레임 스위치 (worklog_settled_custom_lock.test.sql 과 동일 헬퍼)
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
  PERFORM set_config('t.owner_id',   s.owner_id::text,    true);
  PERFORM set_config('t.wl_pending', s.work_log_id::text, true);
  PERFORM set_config('t.wl_settled', v_wl_settled::text,  true);

  -- 정산 완료 work_log (INSERT 는 BEFORE UPDATE 트리거 미발화)
  -- status='completed' 는 work_logs_status_timestamp_consistency 체크 제약상
  -- check_in_ts/check_out_ts 필수
  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, owner_id, date, status, role,
    check_in_ts, check_out_ts,
    payroll_status, payroll_amount, created_at, updated_at
  )
  VALUES (
    v_wl_settled, s.application_id, s.outsider_id, s.job_posting_id, s.owner_id,
    (current_date + 17)::text, 'completed', 'staff',
    now() - interval '9 hours', now() - interval '1 hour',
    'completed', 100000, now(), now()
  );
END $$;

SELECT t_set_employer((current_setting('t.owner_id'))::uuid);

-- ============================================================================
-- 1. 정산 완료 건의 노쇼 전환 → DENY 42501 (employer 라도)
-- ============================================================================

SELECT throws_ok(
  format(
    $q$UPDATE public.work_logs SET status = 'no_show' WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  '42501', NULL,
  '완료건 status→no_show: employer 도 DENY (settled no-show lock)'
);

-- 2. 안내 문구가 ALREADY_SETTLED 규약을 따른다 (클라 E6009 매핑 근거)
SELECT throws_like(
  format(
    $q$UPDATE public.work_logs SET status = 'no_show' WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  'ALREADY_SETTLED%',
  '완료건 노쇼 거부 메시지는 ALREADY_SETTLED 접두사를 쓴다'
);

-- 3. 노쇼 사유·시각을 함께 써도 막힌다 (실제 markAsNoShow 페이로드 형태)
SELECT throws_ok(
  format(
    $q$UPDATE public.work_logs
          SET status = 'no_show', no_show_reason = '연락 두절', no_show_at = to_jsonb(now())
        WHERE id = %L$q$,
    current_setting('t.wl_settled')
  ),
  '42501', NULL,
  '완료건 노쇼 전체 페이로드: DENY (부분 컬럼 우회 불가)'
);

-- ============================================================================
-- 회귀 방지 — 기존 계약 유지
-- ============================================================================

-- 4. 미정산(pending) 건의 노쇼 전환은 employer 허용 (정상 운영 경로)
SELECT lives_ok(
  format(
    $q$UPDATE public.work_logs
          SET status = 'no_show', no_show_reason = '연락 두절', no_show_at = to_jsonb(now())
        WHERE id = %L$q$,
    current_setting('t.wl_pending')
  ),
  '미정산건 노쇼 전환: employer ALLOW (기존 계약 유지)'
);

-- 5. **탈출 경로는 살아 있어야 한다** — 정산을 되돌린 뒤에는 노쇼가 열린다.
--    되돌리기는 SECDEF RPC(set_work_log_payroll_status) 채널이라 핀 트리거를 통과한다.
--    여기서는 그 채널을 RESET ROLE 로 재현한다(JWT 는 employer 그대로 —
--    protect_work_log_payroll 의 역할 게이트를 통과해야 하므로 클레임을 비우면 안 된다).
SELECT lives_ok(
  format(
    $q$DO $inner$
       BEGIN
         RESET ROLE;
         UPDATE public.work_logs SET payroll_status = 'pending' WHERE id = %L;
         UPDATE public.work_logs SET status = 'no_show' WHERE id = %L;
       END
       $inner$$q$,
    current_setting('t.wl_settled'),
    current_setting('t.wl_settled')
  ),
  '2단계 탈출 경로 유지: 정산을 되돌리면 노쇼 전환이 열린다'
);

SELECT * FROM finish();
ROLLBACK;
