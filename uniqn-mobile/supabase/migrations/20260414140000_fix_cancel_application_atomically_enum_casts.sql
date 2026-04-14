-- T-W3.1 fix: cancel_application_atomically RPC type cast 누락 수정
-- ============================================================
-- 발견: 2026-04-14 SQL 회귀 테스트 중 production 호출 첫 번째에서 실패
--   ERROR 42804: column "status" is of type application_status but expression is of type text
--
-- 원인: v_new_status가 text로 선언되어 enum 컬럼에 직접 대입 불가.
--       v_now도 text라 timestamptz 컬럼 cancelled_at/updated_at에 대입 불가.
--       (string literal은 unknown 타입이라 auto-cast되지만, typed text는 거부됨)
--
-- 영향: cancel_application_atomically RPC가 호출 즉시 type error로 실패.
--       applicationRepository.cancelConfirmationTransaction 경로 전체가 깨짐.
--       사용자가 확정 취소 시도 시마다 ERROR. (TS 클라이언트는 throw)
--
-- 수정: 명시적 cast 추가 (v_new_status::application_status, v_now_ts timestamptz).
--       posting_status CASE 분기에도 'active'::posting_status cast 추가.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  -- 8. Update applications  ← FIX: 명시적 enum cast + timestamptz 변수 사용
  UPDATE applications SET
    status = v_new_status::application_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now_ts,
    updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 9. job_postings: filled_positions 재계산
  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  v_new_filled := GREATEST(0, v_job_posting.filled_positions - v_assignment_count);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    status = CASE
      WHEN status = 'closed' AND v_new_filled < total_positions THEN 'active'::posting_status
      ELSE status
    END,
    updated_at = v_now_ts
  WHERE id = v_job_posting.id;

  -- 10. work_logs DELETE
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
$$;
