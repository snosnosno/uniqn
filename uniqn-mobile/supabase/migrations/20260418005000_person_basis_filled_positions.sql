-- =============================================================================
-- FIX: filled_positions 사람 기준(person basis) 정렬
-- =============================================================================
-- 증상(복합):
--   1) confirm_application RPC가 jsonb_array_length(p_assignments)만큼 filled_positions 증가
--      → 그룹일정(dates 여러 개) 1명 확정 시 +N → "사람 1명 = 슬롯 N개" 혼재 표시
--   2) cancel_application_atomically RPC가 동일하게 assignment_count(슬롯) 단위로 감소
--      → GREATEST(0, ...) clamp로 감소량이 의도치 않게 0에 걸릴 수 있음
--   3) stats.filledPositions도 같이 슬롯 단위로 축적 → 집계 API 일관성 파괴
--
-- 정책 결정:
--   filled_positions / stats.filledPositions = 확정된 지원서(사람) 수
--   그룹일정, 멀티역할 여부와 무관하게 1 application = 1 filled_position
--
-- 수정:
--   1. confirm_application: filled_positions += 1 (jsonb_array_length 제거)
--   2. cancel_application_atomically: filled_positions -= 1 (slot 단위 감소 제거,
--      assignment_count는 반환 JSON에 유지하여 backward-compat)
--   3. 데이터 백필: filled_positions = COUNT(applications WHERE status IN
--      ('confirmed','completed','cancellation_pending')) per posting
--
-- Related: docs/analysis/2026-04-17-confirmed-count-sync-root-cause.md
-- =============================================================================

-- =============================================================================
-- 1. confirm_application — filled_positions += 1
-- =============================================================================
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
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;
  IF v_job.owner_id != p_owner_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 소유자만 확정 가능';
  END IF;

  -- work_logs INSERT: flat 포맷(p_assignments) 사용 (슬롯 단위, 날짜×역할 1:1)
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

  -- applications UPDATE: assignments 컬럼은 v3 canonical 사용 (덮어쓰기 버그 방지)
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

  -- job_postings filled_positions: 사람 단위(+1) ← CHANGED from jsonb_array_length(p_assignments)
  UPDATE job_postings SET
    filled_positions = filled_positions + 1,
    stats = jsonb_set(
      jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{confirmedApplicants}',
        to_jsonb(COALESCE((stats->>'confirmedApplicants')::int, 0) + 1)
      ),
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

COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) IS
  '지원서 확정 RPC (person basis). applications.assignments=v3 canonical, work_logs=flat 전개, filled_positions += 1 (사람 단위).';

-- =============================================================================
-- 2. cancel_application_atomically — filled_positions -= 1 (사람 단위)
-- =============================================================================
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
  -- 1. Lock application row
  SELECT * INTO v_application FROM applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- is_active guard (T-E4-rest)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled');
  END IF;

  -- 2. Idempotency
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- 3. State validation (actor-specific)
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

  -- 4. Lock job_posting
  SELECT * INTO v_job_posting FROM job_postings
  WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 5. Manual permission check
  IF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_job_posting.owner_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;
  END IF;

  -- 6. confirmation_history 갱신
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

  -- 7. New status + cancellation_request update
  IF p_actor_type = 'staff_initiates' THEN
    v_new_status := 'applied';
  ELSE
    v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request
      || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  -- 8. Update applications
  UPDATE applications SET
    status = v_new_status::application_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now_ts,
    updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 9. assignment_count는 backward-compat을 위해 계산 유지 (반환 JSON용)
  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  -- job_postings filled_positions: 사람 단위(-1) ← CHANGED from v_assignment_count
  v_new_filled := GREATEST(0, v_job_posting.filled_positions - 1);

  -- stats.filledPositions은 filled_positions 컬럼과 동기화, confirmedApplicants는 별도 관리 RPC에서 이미 감소됨
  -- (staff_initiates: confirmed→applied / staff_approves_cancel_request: cancellation_pending→cancelled
  --  둘 다 confirmedApplicants를 이 RPC에서 감소시킬지 여부는 request_cancellation RPC 동작과의 중복
  --  리스크가 있어 본 마이그레이션에서는 손대지 않음. 백필로 초기 sync만 맞춤.)
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

  -- 10. work_logs DELETE (scheduled 상태만)
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

COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '지원 취소 원자 RPC (person basis). filled_positions -= 1 (사람 단위, assignment_count는 반환 JSON에 유지).';

-- =============================================================================
-- 3. 데이터 백필 — 기존 filled_positions / stats.filledPositions 재계산
-- =============================================================================
-- 논리: 1 application(status=confirmed | completed | cancellation_pending) = 1 filled
-- cancellation_pending은 "확정된 상태에서 취소 요청만 한 것"이므로 슬롯은 여전히 점유.
-- =============================================================================
UPDATE job_postings jp SET
  filled_positions = sub.cnt,
  stats = jsonb_set(
    jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{filledPositions}',
      to_jsonb(sub.cnt)
    ),
    '{confirmedApplicants}',
    to_jsonb(sub.confirmed_only_cnt)
  ),
  updated_at = now()
FROM (
  SELECT
    jp2.id AS posting_id,
    COALESCE(COUNT(a.id) FILTER (
      WHERE a.status IN ('confirmed', 'completed', 'cancellation_pending')
    ), 0)::int AS cnt,
    COALESCE(COUNT(a.id) FILTER (
      WHERE a.status = 'confirmed'
    ), 0)::int AS confirmed_only_cnt
  FROM job_postings jp2
  LEFT JOIN applications a ON a.job_posting_id = jp2.id
  GROUP BY jp2.id
) sub
WHERE jp.id = sub.posting_id
  AND (
    jp.filled_positions IS DISTINCT FROM sub.cnt
    OR COALESCE((jp.stats->>'filledPositions')::int, -1) != sub.cnt
    OR COALESCE((jp.stats->>'confirmedApplicants')::int, -1) != sub.confirmed_only_cnt
  );

-- 백필 결과 로그 (idempotent — 재실행 시 WHERE 조건으로 0행 업데이트)
DO $$
DECLARE
  v_fixed_count int;
BEGIN
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'filled_positions 백필 완료: % rows', v_fixed_count;
END $$;
