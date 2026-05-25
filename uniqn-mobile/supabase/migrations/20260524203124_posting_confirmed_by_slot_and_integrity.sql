-- =============================================================================
-- 공고 확정/취소 정합성: 슬롯/역할별 확정 집계 헬퍼 + 읽기 래퍼 + RPC 가드
-- H0(역할별 표시), H1(정원 가드), H4(협업자 권한), H5(체크인 후 취소 차단)
-- 베이스: 프로덕션 현행 본문(2026-05-24 pg_get_functiondef 확인) + H1/H4/H5 레이어.
--   확인된 보존 포인트:
--     · confirm_application work_logs INSERT 의 staff_photo_url_blurhash 컬럼 유지
--     · confirmedApplicants 는 tr_update_job_posting_stats 트리거가 담당 → RPC 에서 수동 증가 금지
-- =============================================================================

-- 1. 공유 헬퍼: (date, time_slot, role) 별 활성 확정 수
--    work_logs.time_slot 은 raw 값(TBA→'미정', 일반→'HH:MM') — 표시 라벨 아님.
CREATE OR REPLACE FUNCTION public.count_posting_confirmed_by_slot(
  p_job_posting_ids uuid[]
)
RETURNS TABLE (
  job_posting_id uuid,
  work_date text,
  time_slot text,
  role_key text,
  confirmed_count int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $function$
  SELECT
    wl.job_posting_id,
    wl.date AS work_date,
    COALESCE(wl.time_slot, '미정') AS time_slot,
    CASE
      WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role, '')
      ELSE wl.role::text
    END AS role_key,
    COUNT(*)::int AS confirmed_count
  FROM public.work_logs wl
  WHERE wl.job_posting_id = ANY(p_job_posting_ids)
    AND wl.status NOT IN ('cancelled', 'no_show')
  GROUP BY wl.job_posting_id, wl.date, COALESCE(wl.time_slot, '미정'),
    CASE WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role, '') ELSE wl.role::text END;
$function$;

COMMENT ON FUNCTION public.count_posting_confirmed_by_slot(uuid[]) IS
  '공고별 (date,time_slot,role) 활성 확정 수 집계(카운트만 반환, PII 없음). H0 표시 + H1 가드 공용.';

GRANT EXECUTE ON FUNCTION public.count_posting_confirmed_by_slot(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.count_posting_confirmed_by_slot(uuid[]) FROM PUBLIC, anon;

-- 2. 읽기 래퍼 (클라이언트 표시용 — 동일 결과, 명시적 진입점)
CREATE OR REPLACE FUNCTION public.get_posting_filled_counts(
  p_job_posting_ids uuid[]
)
RETURNS TABLE (
  job_posting_id uuid,
  work_date text,
  time_slot text,
  role_key text,
  confirmed_count int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $function$
  SELECT * FROM public.count_posting_confirmed_by_slot(p_job_posting_ids);
$function$;

COMMENT ON FUNCTION public.get_posting_filled_counts(uuid[]) IS
  '공고 카드/상세 역할별 (filled/count) 표시용 집계. count_posting_confirmed_by_slot 래핑.';

GRANT EXECUTE ON FUNCTION public.get_posting_filled_counts(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_posting_filled_counts(uuid[]) FROM PUBLIC, anon;

-- 3. confirm_application — 프로덕션 본문 + H1 정원 가드 + H4 권한 술어
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
  v_existing int;
  v_capacity int;
  v_role_key text;
  v_slot_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_owner_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;

  -- H4: 권한 술어 (RLS jp_update_workspace_member 와 정렬)
  -- is_admin() 는 무인자(Task 0 확인) — caller JWT app_metadata.role 기준, SECDEF 안에서도 호출자 평가.
  -- 클라가 p_owner_id=본인으로 호출하므로 일치.
  IF NOT (
    v_job.owner_id = p_owner_id
    OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  -- H1: 역할/슬롯별 정원 가드 (work_logs INSERT 전, FOR UPDATE 직렬화 하에서 재검증)
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      v_role_key := CASE
        WHEN (v_assignment->>'role') = 'other'
          THEN 'other:' || COALESCE(v_assignment->>'customRole', '')
        ELSE v_assignment->>'role' END;
      v_slot_key := COALESCE(v_assignment->>'timeSlot', '미정');

      SELECT COUNT(*) INTO v_existing
      FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id
        AND wl.date = (v_assignment->>'date')
        AND COALESCE(wl.time_slot, '미정') = v_slot_key
        AND (CASE WHEN wl.role::text = 'other' THEN 'other:' || COALESCE(wl.custom_role,'') ELSE wl.role::text END) = v_role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE req->>'date' = (v_assignment->>'date')
        AND (CASE WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false)
                  THEN '미정' ELSE COALESCE(ts->>'startTime', ts->>'time', '미정') END) = v_slot_key
        AND (CASE WHEN (r->>'role') = 'other' THEN 'other:' || COALESCE(r->>'customRole','') ELSE r->>'role' END) = v_role_key;

      IF v_capacity > 0 AND v_existing + 1 > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
          v_role_key, v_assignment->>'date', v_slot_key, v_existing + 1, v_capacity;
      END IF;
    END LOOP;
  END IF;

  -- work_logs INSERT (flat 포맷) — 프로덕션과 동일(blurhash 컬럼 포함)
  IF NOT p_is_fixed_posting AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id,
        assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id,
        status, is_fixed_posting,
        created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname,
        v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff'),
        v_assignment->>'customRole', p_owner_id,
        'scheduled', false, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

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

  -- confirmedApplicants 갱신은 tr_update_job_posting_stats trigger 가 담당(중복 증가 금지).
  -- filledPositions 는 applications 상태와 별개 개념이므로 여기서 유지.
  UPDATE job_postings SET
    filled_positions = filled_positions + 1,
    stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{filledPositions}',
      to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)
    ),
    updated_at = v_now
  WHERE id = v_app.job_posting_id;

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments)
  );
END;
$function$;

-- 4. cancel_application_atomically — 프로덕션 본문 + H4 권한 술어 + H5 체크인 후 차단
CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL::text,
  p_rejection_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_application applications%ROWTYPE;
  v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb;
  v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb;
  v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now();
  v_assignment_count int := 0;
  v_new_filled int;
  v_new_status text;
  v_updated_cancellation_request jsonb;
BEGIN
  SELECT * INTO v_application FROM applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled');
  END IF;

  -- Idempotency
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- State validation
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation');
    END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval');
    END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type');
  END IF;

  SELECT * INTO v_job_posting FROM job_postings
  WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- H4: 권한 술어 (staff_approves_cancel_request = 공고 관리 권한자, staff_initiates = 본인)
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF NOT (
      v_job_posting.owner_id = p_actor_id
      OR public.is_workspace_member(v_job_posting.workspace_id, p_actor_id)
      OR public.is_posting_collaborator(v_job_posting.id, p_actor_id)
      OR public.is_admin()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  END IF;

  -- H5: 이미 출근(checked_in/checked_out)한 work_log 있으면 차단 (변이 전)
  IF EXISTS (
    SELECT 1 FROM work_logs
    WHERE application_id = p_application_id
      AND status IN ('checked_in', 'checked_out')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_already_checked_in');
  END IF;

  -- confirmation_history 갱신
  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1
  INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY
  WHERE (value->>'cancelled_at') IS NULL
  LIMIT 1;

  IF v_active_confirmation_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation');
  END IF;

  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history,
    ARRAY[v_active_confirmation_index::text, 'cancellation_reason'],
    COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  IF p_actor_type = 'staff_initiates' THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request
      || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  UPDATE applications SET
    status = v_new_status::application_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now_ts,
    updated_at = v_now_ts
  WHERE id = p_application_id;

  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  -- job_postings filled_positions: 사람 단위(-1)
  v_new_filled := GREATEST(0, v_job_posting.filled_positions - 1);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{filledPositions}',
      to_jsonb(v_new_filled)
    ),
    status = CASE
      WHEN status = 'closed' AND v_new_filled < total_positions THEN 'active'::posting_status
      ELSE status
    END,
    updated_at = v_now_ts
  WHERE id = v_job_posting.id;

  DELETE FROM work_logs
  WHERE application_id = p_application_id
    AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'new_status', v_new_status,
    'assignment_count', v_assignment_count,
    'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count,
    'cancelled_at', v_now
  );
END;
$function$;
