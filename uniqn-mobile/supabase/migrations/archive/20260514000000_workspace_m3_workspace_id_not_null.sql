-- 공고 워크스페이스 협업 편집 (PR #5 — M3 NOT NULL 전환)
-- PR #4 백필 후 jp_null_workspace=0 검증 완료 → NOT NULL 안전.
-- 사전 확인 (방어): NULL 잔여 시 트랜잭션 자동 rollback.

DO $$
DECLARE
  v_null_count integer;
BEGIN
  SELECT count(*) INTO v_null_count
  FROM public.job_postings WHERE workspace_id IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'M3_PRECONDITION_FAILED: % job_postings have NULL workspace_id', v_null_count;
  END IF;
END$$;

ALTER TABLE public.job_postings
  ALTER COLUMN workspace_id SET NOT NULL;

COMMENT ON COLUMN public.job_postings.workspace_id IS
  'NOT NULL 보장 (M3 — PR #5). RLS 가 workspace 멤버십으로 권한 강제.';
