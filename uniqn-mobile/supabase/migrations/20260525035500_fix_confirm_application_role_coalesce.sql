-- fix(db): confirm_application work_logs.role COALESCE 타입 불일치 해소
--
-- 문제: work_logs INSERT 의 role 값이
--   COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff')
-- 인데 v_app.applicant_role 은 user_role(admin|employer|staff) 타입이라
-- staff_role(dealer|floor|serving|staff) 과 COALESCE 공통타입 결정 시
-- "could not convert type user_role to staff_role" 런타임 에러.
-- plpgsql lazy 컴파일로 함수 생성은 통과했으나 person-basis assignment
-- INSERT 실행 시점에 에러 → pgTAP posting_confirm_cancel_integrity 실패.
--
-- 수정: 의미상 무효한 user_role fallback 제거. role 출처는 assignment 이며,
-- 없으면 컬럼 default 와 동일한 'staff'::staff_role 로 폴백.
-- 그 외 본문은 현행 prod pg_get_functiondef 와 1라인만 제외하고 동일.
--
-- 회귀 가드(현행 본문 기준 유지): staff_photo_url_blurhash 보존,
-- confirmedApplicants 는 tr_update_job_posting_stats 트리거 담당(수동 증가 금지).

CREATE OR REPLACE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false, p_assignments_v3 jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app record; v_job record; v_work_log_ids uuid[] := '{}'; v_wl_id uuid; v_assignment jsonb;
  v_now timestamptz := now(); v_existing int; v_capacity int; v_role_key text; v_slot_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_owner_id AND is_active = true) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;
  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status; END IF;
  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;
  -- H4: 권한 술어 (RLS jp_update_workspace_member 와 정렬). is_admin() 무인자 = caller JWT 기준.
  IF NOT (
    v_job.owner_id = p_owner_id OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id) OR public.is_admin()
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음'; END IF;
  -- H1: 역할/슬롯별 정원 가드 (work_logs INSERT 전, FOR UPDATE 직렬화 하에서 재검증)
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
      v_role_key := CASE WHEN (v_assignment->>'role') = 'other' THEN 'other:' || COALESCE(v_assignment->>'customRole', '') ELSE v_assignment->>'role' END;
      v_slot_key := COALESCE(v_assignment->>'timeSlot', '미정');
      SELECT COUNT(*) INTO v_existing FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id AND wl.date = (v_assignment->>'date')
        AND COALESCE(wl.time_slot, '미정') = v_slot_key
        AND (CASE WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role,'') ELSE wl.role::text END) = v_role_key
        AND wl.status NOT IN ('cancelled', 'no_show');
      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE req->>'date' = (v_assignment->>'date')
        AND (CASE WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정' ELSE COALESCE(ts->>'startTime', ts->>'time', '미정') END) = v_slot_key
        AND (CASE WHEN (r->>'role') = 'other' THEN 'other:' || COALESCE(r->>'customRole','') ELSE r->>'role' END) = v_role_key;
      IF v_capacity > 0 AND v_existing + 1 > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)', v_role_key, v_assignment->>'date', v_slot_key, v_existing + 1, v_capacity;
      END IF;
    END LOOP;
  END IF;
  -- work_logs INSERT (flat 포맷) — 프로덕션과 동일(blurhash 컬럼 포함)
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id, assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id, status, is_fixed_posting, created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname, v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
        v_assignment->>'customRole', p_owner_id, 'scheduled', false, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;
  UPDATE applications SET status = 'confirmed', assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history, confirmed_at = v_now, processed_by = p_owner_id::text,
    processed_at = v_now, notes = COALESCE(p_notes, notes), updated_at = v_now
  WHERE id = p_application_id;
  -- confirmedApplicants 갱신은 tr_update_job_posting_stats trigger 가 담당(중복 증가 금지). filledPositions 만 유지.
  UPDATE job_postings SET filled_positions = filled_positions + 1,
    stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{filledPositions}', to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;
  RETURN jsonb_build_object('applicationId', p_application_id, 'workLogIds', to_jsonb(v_work_log_ids), 'assignmentCount', jsonb_array_length(p_assignments));
END;
$function$;
