-- 공고 워크스페이스 협업 편집 (M1.3) — member_count 동기화 trigger
-- Pattern: denormalized counter trigger (memory: pitfall_denormalized_counter_drift, EJ-001/ST-001 표준)
-- INSERT/DELETE 시 workspaces.member_count 자동 ±1, GREATEST(0, ...) 가드

CREATE OR REPLACE FUNCTION public.fn_sync_workspace_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.workspaces
      SET member_count = member_count + 1,
          updated_at = now()
      WHERE id = NEW.workspace_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.workspaces
      SET member_count = GREATEST(member_count - 1, 0),
          updated_at = now()
      WHERE id = OLD.workspace_id;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_sync_workspace_member_count IS
  'workspace_members INSERT/DELETE 시 workspaces.member_count ±1. owner 제외 editor 수.';

DROP TRIGGER IF EXISTS trg_sync_workspace_member_count ON public.workspace_members;
CREATE TRIGGER trg_sync_workspace_member_count
  AFTER INSERT OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_workspace_member_count();
