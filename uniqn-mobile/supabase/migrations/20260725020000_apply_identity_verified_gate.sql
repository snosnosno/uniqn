-- 지원(applications) 본인인증(identity_verified) 서버 게이트
--
-- 배경: 지원 게이트가 클라이언트 라우팅(useAuthGuard/authRedirect)에만 있어,
-- 유효한 세션 토큰을 가진 사용자가 앱 UI를 우회해 applications 테이블에 직접
-- INSERT 하면 identity_verified=false 상태로도 지원이 생성됐다.
-- (2026-07-25 prod 실측 확정: app_insert RLS with_check = auth.uid()=applicant_id 뿐,
--  identity_verified 검사 전무. 실제 지원 경로는 ApplicationRepository 의 applications
--  직접 upsert 이고, apply_with_capacity_check RPC 는 클라 미사용 dead 코드였다.)
--
-- 주 경로 = applications INSERT RLS(app_insert). 이 정책에 본인인증 게이트를 추가한다.
-- apply_with_capacity_check(SECURITY DEFINER, RLS 우회) 게이트는 dead 이지만 직접 호출
-- 공격 표면 방어를 위해 함께 추가한다(defense-in-depth).
--
-- 영향: prod 사용자 21명 전원 identity_verified=true 라 기존 사용자 영향 0.
-- 재지원(cancelled→applied)은 기존 행 UPDATE(app_update) 경로이며, 행이 존재한다는 것은
-- 과거 INSERT 게이트를 통과했다는 의미라 별도 게이트 불필요. 신규 INSERT 만 게이트한다.

-- 1) identity_verified 확인 헬퍼.
-- SECURITY DEFINER 로 users 를 조회해 users RLS 를 우회한다 — with_check 안에서 users 를
-- 직접 SELECT 하면 users 의 RLS 정책(SECDEF 헬퍼 참조)이 얽혀 재귀·anon poison 위험이
-- 있기 때문(wiki rls-model 함정). 자기 자신 행 조회지만 헬퍼 경유가 안전.
CREATE OR REPLACE FUNCTION public.is_identity_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_user_id AND identity_verified = true
  );
$function$;

-- anon 노출 차단(secdef-hardening). 지원은 authenticated 만.
REVOKE ALL ON FUNCTION public.is_identity_verified(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_identity_verified(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_identity_verified(uuid) TO authenticated;

-- 2) 주 게이트: applications INSERT RLS 에 본인인증 조건 추가.
-- 기존 with_check = ((SELECT auth.uid()) = applicant_id) 를 그대로 유지하고 identity 조건만 AND.
DROP POLICY IF EXISTS app_insert ON public.applications;
CREATE POLICY app_insert ON public.applications
  FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = applicant_id)
    AND public.is_identity_verified(applicant_id)
  );

-- 3) 방어 게이트: apply_with_capacity_check(SECURITY DEFINER RPC). 현재 클라 미사용이나
-- authenticated EXECUTE 가 열려 있어 직접 호출 시 RLS 를 우회하므로 함수 내부에도 게이트를 둔다.
-- 기존 baseline(20260710000002) 정의를 그대로 복제하고 권한 체크 직후 identity 게이트만 추가.
CREATE OR REPLACE FUNCTION public.apply_with_capacity_check(
  p_applicant_id uuid,
  p_job_posting_id uuid,
  p_applicant_name text,
  p_applicant_phone text DEFAULT NULL::text,
  p_applicant_email text DEFAULT NULL::text,
  p_applicant_nickname text DEFAULT NULL::text,
  p_applicant_photo_url text DEFAULT NULL::text,
  p_applicant_role text DEFAULT NULL::text,
  p_custom_role text DEFAULT NULL::text,
  p_job_posting_title text DEFAULT NULL::text,
  p_job_posting_date text DEFAULT NULL::text,
  p_recruitment_type text DEFAULT NULL::text,
  p_message text DEFAULT NULL::text,
  p_assignments jsonb DEFAULT '[]'::jsonb,
  p_pre_question_answers jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_posting record; v_existing record; v_total_positions int; v_active_count int;
  v_application_id uuid; v_now timestamptz := now(); v_is_reapply boolean := false;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_applicant_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PERMISSION_DENIED', 'message', '본인만 지원할 수 있습니다.');
  END IF;

  -- 본인인증 게이트(2026-07-25 추가). admin 대리 지원은 예외.
  IF NOT public.is_admin() AND NOT public.is_identity_verified(p_applicant_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'IDENTITY_NOT_VERIFIED', 'message', '본인인증을 완료해야 지원할 수 있습니다.');
  END IF;

  SELECT id, status, total_positions, filled_positions, schedule INTO v_posting
  FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', '공고를 찾을 수 없습니다.');
  END IF;
  IF v_posting.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'POSTING_CLOSED', 'message', '지원이 마감된 공고입니다.');
  END IF;

  SELECT id, status INTO v_existing FROM applications
  WHERE job_posting_id = p_job_posting_id AND applicant_id = p_applicant_id;
  IF FOUND THEN
    IF v_existing.status != 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_APPLIED', 'message', '이미 지원한 공고입니다.', 'application_id', v_existing.id);
    END IF;
    v_is_reapply := true;
    v_application_id := v_existing.id;
  END IF;

  v_total_positions := COALESCE(v_posting.total_positions, 0);
  IF v_total_positions > 0 THEN
    SELECT count(*) INTO v_active_count FROM applications
    WHERE job_posting_id = p_job_posting_id AND status IN ('applied', 'confirmed', 'cancellation_pending');
    IF v_active_count >= v_total_positions THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'CAPACITY_FULL', 'message', '모집 인원이 마감되었습니다.', 'total_positions', v_total_positions, 'active_count', v_active_count);
    END IF;
  END IF;

  IF v_is_reapply THEN
    UPDATE applications SET
      status = 'applied', applicant_name = p_applicant_name, applicant_phone = p_applicant_phone,
      applicant_email = p_applicant_email, applicant_nickname = p_applicant_nickname,
      applicant_photo_url = p_applicant_photo_url, applicant_role = p_applicant_role::staff_role,
      custom_role = p_custom_role, job_posting_title = p_job_posting_title, job_posting_date = p_job_posting_date,
      recruitment_type = p_recruitment_type, message = p_message, assignments = p_assignments,
      pre_question_answers = p_pre_question_answers, is_read = false, cancelled_at = NULL,
      cancellation_request = NULL, rejection_reason = NULL, updated_at = v_now
    WHERE id = v_application_id;
  ELSE
    INSERT INTO applications (
      applicant_id, job_posting_id, status, applicant_name, applicant_phone, applicant_email,
      applicant_nickname, applicant_photo_url, applicant_role, custom_role,
      job_posting_title, job_posting_date, recruitment_type, message,
      assignments, pre_question_answers, is_read, created_at, updated_at
    ) VALUES (
      p_applicant_id, p_job_posting_id, 'applied', p_applicant_name, p_applicant_phone, p_applicant_email,
      p_applicant_nickname, p_applicant_photo_url, p_applicant_role::staff_role, p_custom_role,
      p_job_posting_title, p_job_posting_date, p_recruitment_type, p_message,
      p_assignments, p_pre_question_answers, false, v_now, v_now
    ) RETURNING id INTO v_application_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'application_id', v_application_id, 'is_reapply', v_is_reapply);
END;
$function$;
