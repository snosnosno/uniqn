-- 공고별 협업자 audit log — Phase 1.2
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Task 1.2)
--
-- D11: 보안 중요 액션 (권한 부여/회수) 이력 보존
-- D11 Codex fix: source 컬럼 (user/system/cascade) — actor_user_id 신뢰성 강화
-- DELETE 후 added_by/added_at 손실 방지

CREATE TABLE public.job_posting_collaborator_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL,                                  -- FK 안 검 (공고 삭제돼도 보존)
  target_user_id  uuid NOT NULL,                                  -- FK 안 검 (탈퇴해도 보존)
  actor_user_id   uuid,                                           -- NULL 허용 (system/cascade)
  action          text NOT NULL CHECK (action IN ('added','removed')),
  source          text NOT NULL DEFAULT 'user' CHECK (source IN ('user','system','cascade')),
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jpca_posting_id ON public.job_posting_collaborator_audit(job_posting_id, at DESC);
CREATE INDEX idx_jpca_target_id  ON public.job_posting_collaborator_audit(target_user_id, at DESC);

ALTER TABLE public.job_posting_collaborator_audit ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.job_posting_collaborator_audit IS
  '공고별 협업자 추가/제거 이력 — workspace owner 만 SELECT, trigger 만 쓰기';

-- AFTER INSERT/DELETE 트리거 함수
-- auth.uid() 가 NULL (cascade/service role/백그라운드) 일 때 source='cascade'/'system' 으로 구분
CREATE FUNCTION public.log_collaborator_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES (
      NEW.job_posting_id, NEW.user_id,
      NEW.added_by,                                              -- INSERT 시 added_by 가 신뢰원천
      'added',
      CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES (
      OLD.job_posting_id, OLD.user_id,
      v_actor,                                                   -- DELETE 시 auth.uid() 만 신뢰
      'removed',
      CASE WHEN v_actor IS NULL THEN 'cascade' ELSE 'user' END
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_jpca_log
  AFTER INSERT OR DELETE ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.log_collaborator_audit();

-- RLS: workspace owner 만 SELECT (운영 가시성)
-- 트리거(SECURITY DEFINER)가 쓰기 전담, 사용자 직접 INSERT/UPDATE/DELETE 차단
CREATE POLICY "audit_select_owner"
  ON public.job_posting_collaborator_audit
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.job_postings jp
      JOIN public.workspaces w ON w.id = jp.workspace_id
      WHERE jp.id = job_posting_collaborator_audit.job_posting_id
        AND w.owner_id = (SELECT auth.uid())
    )
  );
