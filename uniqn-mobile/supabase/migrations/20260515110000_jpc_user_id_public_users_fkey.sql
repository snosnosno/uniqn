-- BUG-001 fix — job_posting_collaborators.user_id 가 PostgREST 클라이언트 query
-- `users:user_id (nickname, name, email, photo_url)` 와 매핑되도록 public.users(id) 향한
-- 이중 FK 를 추가한다.
--
-- Root cause:
--   기존 FK `job_posting_collaborators_user_id_fkey` 는 auth.users(id) 만 향함.
--   PostgREST 는 public 스키마만 노출하므로 client query 의 unqualified `users`
--   를 public.users 로 해석 → 해당 FK 매핑 없어 schema cache 에서 관계 찾지 못함
--   → 400 "Could not find a relationship between 'job_posting_collaborators'
--   and 'user_id' in the schema cache".
--
-- 적용 효과:
--   public.users.id ↔ auth.users.id 가 1:1 PK 동기화 보장되므로 이중 FK 가
--   데이터 정합성에 미치는 영향 없음. 협업자가 1건이라도 존재하면 즉시
--   재현되던 list query 가 정상 동작한다.
--
-- 참고:
--   QA-REPORT-2026-05-14.md  BUG-001
--   pitfall_jpc_postgrest_user_id_relation.md
--   src/repositories/supabase/JobPostingCollaboratorRepository.ts:110
--
-- ── 1. public.users(id) 향한 이중 FK 추가 ────────────────────────────
-- ON DELETE CASCADE 동일 유지 (auth.users FK 와 의미 일치).
ALTER TABLE public.job_posting_collaborators
  ADD CONSTRAINT job_posting_collaborators_user_id_public_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;

-- ── 2. PostgREST schema cache reload ────────────────────────────────
-- 새 FK 가 즉시 relation hint 로 인식되도록 PostgREST 스키마 캐시를 reload.
NOTIFY pgrst, 'reload schema';
