-- =============================================================================
-- FIX: confirm_application — v3 assignments 덮어쓰기 방지
-- =============================================================================
-- 증상: 지원 확정 RPC가 work_logs용 flat 포맷({role, date, groupId})을
--       applications.assignments JSONB 컬럼에 그대로 UPDATE → v3 스키마
--       ({roleIds, dates, isGrouped, timeSlot, ...}) 구조 파괴. 이후
--       모든 read에서 parseApplicationDocument()가 safeParse 실패 →
--       BusinessError E6042 ("지원 데이터가 올바르지 않습니다.").
--
-- 영향: status IN ('confirmed', 'completed') 전체 레코드의 assignments 컬럼
--       flat 포맷으로 오염. 발견 시점 3건: 2건은 original_application에 v3
--       원본 보존 → 복구 가능.
--
-- 수정:
--   1. confirm_application RPC에 p_assignments_v3 jsonb 파라미터 추가
--      → applications.assignments 컬럼에는 v3 포맷 저장
--      → work_logs INSERT는 기존 p_assignments(flat) 그대로 사용
--   2. 파괴된 기존 레코드 복구: original_application.assignments → assignments
--
-- 배포 순서: 이 마이그레이션 → 클라이언트 배포 (p_assignments_v3 넘겨주기).
--           구 클라이언트가 호출하면 p_assignments_v3=NULL이 되어 assignments
--           컬럼은 업데이트되지 않음(기존 'applied' 상태의 v3 그대로 유지).
-- =============================================================================

-- 기존 시그니처 DROP (파라미터 추가로 시그니처 변경)
DROP FUNCTION IF EXISTS public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean);

CREATE OR REPLACE FUNCTION public.confirm_application(
  p_application_id uuid,
  p_owner_id uuid,
  p_assignments jsonb DEFAULT '[]'::jsonb,
  p_original_application jsonb DEFAULT NULL::jsonb,
  p_confirmation_history jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL::text,
  p_is_fixed_posting boolean DEFAULT false,
  p_assignments_v3 jsonb DEFAULT NULL::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app record;
  v_job record;
  v_work_log_ids uuid[] := '{}';
  v_wl_id uuid;
  v_assignment jsonb;
  v_now timestamptz := now();
BEGIN
  -- is_active guard (T-E4-rest)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_owner_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status; END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;
  IF v_job.owner_id != p_owner_id THEN RAISE EXCEPTION 'PERMISSION_DENIED: 공고 소유자만 확정 가능'; END IF;

  -- work_logs INSERT: flat 포맷(p_assignments) 사용
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id,
        assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url,
        role, custom_role, owner_id,
        status, is_fixed_posting,
        created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname, v_app.applicant_photo_url,
        COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff'),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', false, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  -- applications UPDATE: assignments 컬럼은 p_assignments_v3(v3 포맷) 사용
  -- p_assignments_v3 NULL(구 클라이언트)이면 assignments 컬럼 미갱신 → 기존 v3 유지
  UPDATE applications SET
    status = 'confirmed',
    assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history,
    confirmed_at = v_now,
    processed_by = p_owner_id::text,
    processed_at = v_now,
    notes = COALESCE(p_notes, notes),
    updated_at = v_now
  WHERE id = p_application_id;

  -- job_postings filled_positions: flat 개수 기준 (work_logs와 1:1 매핑)
  UPDATE job_postings SET
    filled_positions = filled_positions + jsonb_array_length(p_assignments),
    stats = jsonb_set(jsonb_set(stats, '{confirmedApplicants}',
      to_jsonb(COALESCE((stats->>'confirmedApplicants')::int, 0) + 1)),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + jsonb_array_length(p_assignments))),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) IS
  '지원서 확정 RPC. applications.assignments 컬럼은 p_assignments_v3(v3 canonical)로 저장, work_logs INSERT는 p_assignments(flat)로 전개. p_assignments_v3 NULL 시 assignments 컬럼 미갱신(backward-compat).';


-- =============================================================================
-- 데이터 복구: flat으로 오염된 assignments → original_application.assignments
-- =============================================================================
-- 조건: status IN ('confirmed','completed','cancellation_pending') AND
--       assignments가 flat 포맷(첫 원소에 roleIds 키 없음) AND
--       original_application.assignments가 v3 포맷(roleIds 키 있음)
-- =============================================================================
UPDATE applications
SET assignments = original_application->'assignments',
    updated_at = now()
WHERE jsonb_typeof(assignments) = 'array'
  AND jsonb_array_length(assignments) > 0
  AND NOT (assignments->0 ? 'roleIds')
  AND original_application IS NOT NULL
  AND jsonb_typeof(original_application->'assignments') = 'array'
  AND jsonb_array_length(original_application->'assignments') > 0
  AND (original_application->'assignments'->0 ? 'roleIds');
