-- 기존 job_postings.stats 카운터 정합성 재계산 (후속 리팩토링 #3)
-- trigger(tr_update_job_posting_stats)가 앞으로 유지할 의미론 기준으로 전체 row 백필

UPDATE public.job_postings jp
SET stats = (
  SELECT jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(jp.stats, '{}'::jsonb),
          '{totalApplicants}',
          to_jsonb(COALESCE(a.total, 0))
        ),
        '{activeApplicants}',
        to_jsonb(COALESCE(a.active, 0))
      ),
      '{confirmedApplicants}',
      to_jsonb(COALESCE(a.confirmed, 0))
    ),
    '{cancellationPendingApplicants}',
    to_jsonb(COALESCE(a.cancellation_pending, 0))
  )
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status::text IN ('applied','confirmed','cancellation_pending')) AS total,
      COUNT(*) FILTER (WHERE status::text = 'applied') AS active,
      COUNT(*) FILTER (WHERE status::text = 'confirmed') AS confirmed,
      COUNT(*) FILTER (WHERE status::text = 'cancellation_pending') AS cancellation_pending
    FROM public.applications
    WHERE job_posting_id = jp.id
  ) a
);
