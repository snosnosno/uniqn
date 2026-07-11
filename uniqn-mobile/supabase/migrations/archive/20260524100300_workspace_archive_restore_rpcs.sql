-- 워크스페이스 아카이브 / 복원 RPC (owner 전용, SECURITY DEFINER, 멱등)
-- 패턴: 기존 remove_workspace_member RPC 와 동일 (auth → owner 검증 → 멱등 → 작업)

-- 1. archive_workspace — owner 가 아카이브. 진행공고(active/approved/pending) 있으면 차단.
CREATE OR REPLACE FUNCTION public.archive_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_active_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, archived_at INTO v_owner_id, v_archived_at
  FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 이미 아카이브됨 → 멱등 return
  IF v_archived_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- 진행 중 공고 차단 (active / approved / pending)
  SELECT count(*)::int INTO v_active_count
  FROM public.job_postings
  WHERE workspace_id = p_workspace_id
    AND status IN ('active', 'approved', 'pending');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'WORKSPACE_HAS_ACTIVE_POSTINGS:%', v_active_count USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspaces SET archived_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_workspace(uuid) TO authenticated;

-- 2. restore_workspace — owner 가 복원. 활성 워크스페이스 cap(10) 재검사.
CREATE OR REPLACE FUNCTION public.restore_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_active_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, archived_at INTO v_owner_id, v_archived_at
  FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 이미 활성 → 멱등 return
  IF v_archived_at IS NULL THEN
    RETURN;
  END IF;

  -- cap 재검사 — 활성 워크스페이스 10개 이상이면 차단
  SELECT count(*)::int INTO v_active_count
  FROM public.workspaces
  WHERE owner_id = v_caller_id AND archived_at IS NULL;

  IF v_active_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspaces SET archived_at = NULL WHERE id = p_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_workspace(uuid) TO authenticated;

COMMENT ON FUNCTION public.archive_workspace(uuid) IS
  '워크스페이스 소프트 삭제. owner 전용. 진행공고(active/approved/pending) 있으면 WORKSPACE_HAS_ACTIVE_POSTINGS:N 차단. 멱등. 2026-05-24.';
COMMENT ON FUNCTION public.restore_workspace(uuid) IS
  '워크스페이스 복원. owner 전용. 활성 cap(10) 재검사. 멱등. 2026-05-24.';
