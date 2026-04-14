-- T-A4: stats/increment RPC 4개 회수 마이그레이션
-- 회수 일시: 2026-04-14
-- 출처: increment_view_count, increment_announcement_view_count, increment_template_usage — NOT FOUND (기대 계약 사용)
--        get_job_posting_stats — FOUND (pg_get_functiondef 결과 사용)

-- ============================================================
-- 1. increment_view_count (NOT FOUND — 기대 계약)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_view_count(posting_id uuid)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.job_postings
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = posting_id;
$$;

REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO authenticated;

-- ============================================================
-- 2. increment_announcement_view_count (NOT FOUND — 기대 계약)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_announcement_view_count(p_announcement_id uuid)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.announcements
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_announcement_id;
$$;

REVOKE ALL ON FUNCTION public.increment_announcement_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_announcement_view_count(uuid) TO authenticated;

-- ============================================================
-- 3. increment_template_usage (NOT FOUND — 기대 계약)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_template_usage(p_template_id uuid)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.job_posting_templates
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_template_id;
$$;

REVOKE ALL ON FUNCTION public.increment_template_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_template_usage(uuid) TO authenticated;

-- ============================================================
-- 4. get_job_posting_stats (FOUND — pg_get_functiondef 원문)
-- 참고: status 값이 소문자('active','closed','cancelled') 기반임
--        stats->>'totalApplicants' JSON 컬럼 사용
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_job_posting_stats(p_owner_id uuid)
 RETURNS TABLE(total bigint, active bigint, closed bigint, cancelled bigint, total_applications bigint, total_views bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE status = 'closed'),
    count(*) FILTER (WHERE status = 'cancelled'),
    coalesce(sum((stats->>'totalApplicants')::int), 0),
    coalesce(sum(view_count), 0)
  FROM public.job_postings
  WHERE owner_id = p_owner_id
    AND status IN ('active', 'closed', 'cancelled');
$function$;

REVOKE ALL ON FUNCTION public.get_job_posting_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_posting_stats(uuid) TO authenticated;
