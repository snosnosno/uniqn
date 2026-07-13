-- job_postings.stats 카운터 자동 갱신 trigger (후속 리팩토링 #3, EJ-001 근본 해결)
-- applications INSERT/UPDATE/DELETE 시 totalApplicants/activeApplicants/confirmedApplicants/cancellationPendingApplicants 자동 동기화
-- 카운트 규약 (기존 hydrateApplicantCounts 와 동일):
--   total = applied + confirmed + cancellation_pending (rejected/cancelled 제외)
--   active = applied
--   confirmed = confirmed
--   cancellationPending = cancellation_pending

CREATE OR REPLACE FUNCTION public.fn_update_job_posting_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_counted_statuses TEXT[] := ARRAY['applied','confirmed','cancellation_pending'];
  v_old_counted BOOLEAN;
  v_new_counted BOOLEAN;
  v_total_delta INT := 0;
  v_active_delta INT := 0;
  v_confirmed_delta INT := 0;
  v_cp_delta INT := 0;
  v_job_posting_id UUID;
BEGIN
  v_job_posting_id := COALESCE(NEW.job_posting_id, OLD.job_posting_id);
  IF v_job_posting_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := 1;
      IF NEW.status::text = 'applied' THEN v_active_delta := 1;
      ELSIF NEW.status::text = 'confirmed' THEN v_confirmed_delta := 1;
      ELSIF NEW.status::text = 'cancellation_pending' THEN v_cp_delta := 1;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := -1;
      IF OLD.status::text = 'applied' THEN v_active_delta := -1;
      ELSIF OLD.status::text = 'confirmed' THEN v_confirmed_delta := -1;
      ELSIF OLD.status::text = 'cancellation_pending' THEN v_cp_delta := -1;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status::text = NEW.status::text THEN
      RETURN NULL;
    END IF;

    v_old_counted := OLD.status::text = ANY(v_counted_statuses);
    v_new_counted := NEW.status::text = ANY(v_counted_statuses);

    IF v_old_counted AND NOT v_new_counted THEN v_total_delta := -1;
    ELSIF NOT v_old_counted AND v_new_counted THEN v_total_delta := 1;
    END IF;

    IF OLD.status::text = 'applied' AND NEW.status::text <> 'applied' THEN v_active_delta := -1;
    ELSIF NEW.status::text = 'applied' AND OLD.status::text <> 'applied' THEN v_active_delta := 1;
    END IF;

    IF OLD.status::text = 'confirmed' AND NEW.status::text <> 'confirmed' THEN v_confirmed_delta := -1;
    ELSIF NEW.status::text = 'confirmed' AND OLD.status::text <> 'confirmed' THEN v_confirmed_delta := 1;
    END IF;

    IF OLD.status::text = 'cancellation_pending' AND NEW.status::text <> 'cancellation_pending' THEN v_cp_delta := -1;
    ELSIF NEW.status::text = 'cancellation_pending' AND OLD.status::text <> 'cancellation_pending' THEN v_cp_delta := 1;
    END IF;
  END IF;

  IF v_total_delta = 0 AND v_active_delta = 0 AND v_confirmed_delta = 0 AND v_cp_delta = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.job_postings
  SET stats = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(stats, '{}'::jsonb),
          '{totalApplicants}',
          to_jsonb(GREATEST(0, COALESCE((stats->>'totalApplicants')::int, 0) + v_total_delta))
        ),
        '{activeApplicants}',
        to_jsonb(GREATEST(0, COALESCE((stats->>'activeApplicants')::int, 0) + v_active_delta))
      ),
      '{confirmedApplicants}',
      to_jsonb(GREATEST(0, COALESCE((stats->>'confirmedApplicants')::int, 0) + v_confirmed_delta))
    ),
    '{cancellationPendingApplicants}',
    to_jsonb(GREATEST(0, COALESCE((stats->>'cancellationPendingApplicants')::int, 0) + v_cp_delta))
  )
  WHERE id = v_job_posting_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_job_posting_stats ON public.applications;
CREATE TRIGGER tr_update_job_posting_stats
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_job_posting_stats();

-- confirm_application RPC 수정: confirmedApplicants 수동 증가 제거 (trigger가 담당)
-- filledPositions 는 applications 상태와 별개 개념이므로 유지
CREATE OR REPLACE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false, p_assignments_v3 jsonb DEFAULT NULL::jsonb)
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

  -- confirmedApplicants 갱신은 tr_update_job_posting_stats trigger 가 담당
  -- filledPositions 는 applications 상태와 별개 개념이므로 여기서 유지
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
