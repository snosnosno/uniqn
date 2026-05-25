-- SP3: filled_positions 를 applications status 트리거로 이관 (수동 RPC ±1 제거는 후속 마이그레이션)
--
-- filled_positions = "슬롯 점유 인원"(confirmed/cancellation_pending/completed). 현행 의미 보존:
--   confirm 시 +1, cancel(confirmed→applied / cancellation_pending→cancelled) 시 -1,
--   confirmed→cancellation_pending(취소요청) 불변, confirmed→completed(근무완료) 불변.
-- fn_update_job_posting_stats(applications INSERT/UPDATE/DELETE 트리거)에 filled delta 를 통합한다.
-- pitfall_denormalized_counter_drift 표준: 3경로 + 전이 enumerate + GREATEST(0,...).

CREATE OR REPLACE FUNCTION public.fn_update_job_posting_stats()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_counted_statuses TEXT[] := ARRAY['applied','confirmed','cancellation_pending'];
  v_filled_statuses  TEXT[] := ARRAY['confirmed','cancellation_pending','completed'];
  v_old_counted BOOLEAN; v_new_counted BOOLEAN;
  v_old_filled BOOLEAN; v_new_filled BOOLEAN;
  v_total_delta INT := 0; v_active_delta INT := 0; v_confirmed_delta INT := 0; v_cp_delta INT := 0;
  v_filled_delta INT := 0;
  v_job_posting_id UUID;
BEGIN
  v_job_posting_id := COALESCE(NEW.job_posting_id, OLD.job_posting_id);
  IF v_job_posting_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := 1;
      IF NEW.status::text = 'applied' THEN v_active_delta := 1;
      ELSIF NEW.status::text = 'confirmed' THEN v_confirmed_delta := 1;
      ELSIF NEW.status::text = 'cancellation_pending' THEN v_cp_delta := 1;
      END IF;
    END IF;
    IF NEW.status::text = ANY(v_filled_statuses) THEN v_filled_delta := 1; END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := -1;
      IF OLD.status::text = 'applied' THEN v_active_delta := -1;
      ELSIF OLD.status::text = 'confirmed' THEN v_confirmed_delta := -1;
      ELSIF OLD.status::text = 'cancellation_pending' THEN v_cp_delta := -1;
      END IF;
    END IF;
    IF OLD.status::text = ANY(v_filled_statuses) THEN v_filled_delta := -1; END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status::text = NEW.status::text THEN RETURN NULL; END IF;

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

    v_old_filled := OLD.status::text = ANY(v_filled_statuses);
    v_new_filled := NEW.status::text = ANY(v_filled_statuses);
    IF v_old_filled AND NOT v_new_filled THEN v_filled_delta := -1;
    ELSIF NOT v_old_filled AND v_new_filled THEN v_filled_delta := 1;
    END IF;
  END IF;

  IF v_total_delta = 0 AND v_active_delta = 0 AND v_confirmed_delta = 0 AND v_cp_delta = 0
     AND v_filled_delta = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.job_postings
  SET filled_positions = GREATEST(0, filled_positions + v_filled_delta),
      stats = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{totalApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'totalApplicants')::int, 0) + v_total_delta))),
        '{activeApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'activeApplicants')::int, 0) + v_active_delta))),
        '{confirmedApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'confirmedApplicants')::int, 0) + v_confirmed_delta))),
        '{cancellationPendingApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'cancellationPendingApplicants')::int, 0) + v_cp_delta))),
        '{filledPositions}', to_jsonb(GREATEST(0, COALESCE((stats->>'filledPositions')::int, 0) + v_filled_delta)))
  WHERE id = v_job_posting_id;

  RETURN NULL;
END;
$function$;

-- 백필: 트리거 부착 후 기존 drift 청산. filled_positions = 슬롯점유 status app 수.
UPDATE job_postings jp SET
  filled_positions = COALESCE(sub.cnt, 0),
  stats = jsonb_set(COALESCE(stats,'{}'::jsonb), '{filledPositions}', to_jsonb(COALESCE(sub.cnt, 0)))
FROM (
  SELECT job_posting_id, COUNT(*)::int AS cnt
  FROM applications
  WHERE status IN ('confirmed','cancellation_pending','completed')
  GROUP BY job_posting_id
) sub
WHERE jp.id = sub.job_posting_id;

UPDATE job_postings SET
  filled_positions = 0,
  stats = jsonb_set(COALESCE(stats,'{}'::jsonb), '{filledPositions}', '0'::jsonb)
WHERE id NOT IN (
  SELECT DISTINCT job_posting_id FROM applications
  WHERE status IN ('confirmed','cancellation_pending','completed')
);
