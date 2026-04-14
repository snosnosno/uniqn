-- T-A4 보완: job_posting_templates.usage_count 컬럼 추가 + increment_template_usage RPC
-- increment_template_usage (P2) — TemplateRepository.ts:130 fire-and-forget 호출

ALTER TABLE public.job_posting_templates
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

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
