-- M2 (공고 자동마감 Approach B): fn_update_job_posting_stats 에 capacity_full 자동 전이 추가
--
-- 기존 본문(20260525190000_filled_positions_trigger.sql)을 100% 보존하고,
-- filled_positions/stats UPDATE 직후 status 자동 전이 UPDATE 1개만 append.
-- 전이 매트릭스 (spec §2 M2):
--   active        + filled >= total(>0) → capacity_full
--   capacity_full + filled <  total     → active (자동 재노출, UC2=A)
--   closed/cancelled/draft              → 불변 (의도 보존)
-- 두 번째 UPDATE 는 별도 statement 라 첫 UPDATE 가 갱신한 filled_positions 를 읽는다.
-- pitfall_posting_role_filled_dead_counter: 현행 본문 diff 기반 재정의.

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

  -- ── M2 추가: 인원마감 자동 전이 (active ↔ capacity_full). 위 UPDATE 후 filled_positions 기준. ──
  UPDATE public.job_postings jp
  SET status = CASE
        WHEN jp.status = 'active'
         AND jp.total_positions > 0
         AND jp.filled_positions >= jp.total_positions
         THEN 'capacity_full'::posting_status
        WHEN jp.status = 'capacity_full'
         AND jp.filled_positions < jp.total_positions
         THEN 'active'::posting_status
        ELSE jp.status
      END,
      updated_at = CASE
        WHEN (jp.status = 'active' AND jp.filled_positions >= jp.total_positions AND jp.total_positions > 0)
          OR (jp.status = 'capacity_full' AND jp.filled_positions < jp.total_positions)
        THEN now() ELSE jp.updated_at
      END
  WHERE jp.id = v_job_posting_id;

  RETURN NULL;
END;
$function$;
