-- 1. board_type enum에 'substitute' 추가
ALTER TYPE public.board_type ADD VALUE IF NOT EXISTS 'substitute';

-- 2. cancel_application_atomically RPC 패치: expired 재오픈 방지
--    + 기존 enum cast fix (20260414140000) 통합 유지
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

  -- 3. State validation
  IF p_actor_type = 'staff_initiates' THEN
    IF v_application.status != 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation',
                                'current_status', v_application.status);
    END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval',
                                'current_status', v_application.status);
    END IF;
    IF v_application.cancellation_request IS NULL
       OR (v_application.cancellation_request->>'status') != 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_pending_cancellation_request');
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

  -- 5. Permission check
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

  -- 8. Update applications  ← enum cast + timestamptz 변수 사용
  UPDATE applications SET
    status = v_new_status::application_status,
    confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request),
    cancelled_at = v_now_ts,
    updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 9. job_postings: filled_positions 재계산 + expired 재오픈 방지
  SELECT COUNT(*)::int INTO v_assignment_count
  FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  v_new_filled := GREATEST(0, v_job_posting.filled_positions - v_assignment_count);

  UPDATE job_postings SET
    filled_positions = v_new_filled,
    status = CASE
      WHEN status = 'closed'
        AND v_new_filled < total_positions
        -- NULL closed_reason means manual close; safe to reopen
        AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date')
      THEN 'active'::posting_status
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

GRANT EXECUTE ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '취소 흐름 원자화 RPC. 스태프 자체 취소(staff_initiates) 또는 구인자 취소요청 승인(staff_approves_cancel_request)을 단일 트랜잭션으로 처리. SELECT FOR UPDATE로 row 잠금 후 권한 검사 → confirmation_history 갱신 → applications.update → job_postings.filled_positions 재계산 + expired/expired_by_work_date 공고는 재오픈 안함 → SCHEDULED work_logs 삭제 순으로 수행. Idempotent (재호출 시 success+idempotent 반환).';
