-- 역할 필터(P2) — role_keys overlaps 쿼리용 GIN 인덱스. 인덱스만이라 RLS/권한 비관여.
-- (filters.roles → .overlaps('role_keys', ...) 는 이미 배선됨 — GIN 없으면 seq scan)
CREATE INDEX IF NOT EXISTS idx_job_postings_role_keys
  ON public.job_postings USING gin (role_keys);
