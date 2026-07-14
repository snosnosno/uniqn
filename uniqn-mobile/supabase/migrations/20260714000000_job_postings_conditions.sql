-- 공고 모집 조건(복장·경력) — additive nullable, RLS 무변경
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS conditions jsonb;

COMMENT ON COLUMN public.job_postings.conditions IS
  '모집 조건 { dressCode?: string, experience?: string } — 키오스크 주문서에서 작성';
