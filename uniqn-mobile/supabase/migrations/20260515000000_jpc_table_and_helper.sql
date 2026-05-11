-- 공고별 협업자 (job_posting_collaborators) — Phase 1.1
-- 기획: docs/superpowers/specs/2026-05-11-job-posting-collaborators-design.md
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Task 1.1)
--
-- D7: workspace_members 확장이 아닌 별도 테이블 (외부인이 ws_members 더럽힘 회피)
-- D2: 풀 관리권 (UI/Service 레이어에서 강제, 본 테이블은 부여 사실만 저장)
-- 자가 추가 차단: CHECK (user_id != added_by)
-- cascade: 공고 삭제 / user 탈퇴 시 collaborator 행도 삭제

CREATE TABLE public.job_posting_collaborators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  added_by        uuid NOT NULL REFERENCES auth.users(id),
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_posting_id, user_id),
  CHECK (user_id != added_by)
);

CREATE INDEX idx_jpc_user_id    ON public.job_posting_collaborators(user_id);
CREATE INDEX idx_jpc_posting_id ON public.job_posting_collaborators(job_posting_id);

ALTER TABLE public.job_posting_collaborators ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.job_posting_collaborators IS
  '공고 단위 협업자 — workspace editor 와 별개의 입자 권한 (D1 OR 평가)';

-- is_posting_collaborator 헬퍼 — RLS 정책 핫패스
-- is_workspace_member 와 같은 패턴 (SECURITY DEFINER + STABLE + search_path 격리)
-- 메모리 학습: pitfall_rls_with_check_self_select_recursion — 무한 재귀 회피
CREATE FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.job_posting_collaborators
    WHERE job_posting_id = p_posting_id AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_posting_collaborator IS
  '공고별 협업자 여부 — RLS 정책 핫패스. workspace_members 와 OR 평가.';

GRANT EXECUTE ON FUNCTION public.is_posting_collaborator(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_posting_collaborator(uuid, uuid) FROM PUBLIC, anon;
