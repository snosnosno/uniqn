-- 공고 워크스페이스 협업 편집 (PR #2 — RPC 레이어)
-- atomic invitation lifecycle: invite / accept / reject / revoke / expire / remove_member
-- 모두 SECURITY DEFINER + 명시적 권한 체크 + idempotent

-- ============================================================
-- 1. invite_workspace_member — owner 가 사용자 초대
-- ============================================================
CREATE OR REPLACE FUNCTION public.invite_workspace_member(
  p_workspace_id uuid,
  p_invitee_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
  v_caller_id uuid := auth.uid();
  v_invitation_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF v_caller_id = p_invitee_user_id THEN
    RAISE EXCEPTION 'SELF_INVITE_FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = p_workspace_id FOR SHARE;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_invitee_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  IF v_owner_id = p_invitee_user_id THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.workspace_invitations (workspace_id, invitee_user_id, invited_by)
    VALUES (p_workspace_id, p_invitee_user_id, v_caller_id)
    RETURNING id INTO v_invitation_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_INVITED' USING ERRCODE = 'P0001';
  END;

  RETURN v_invitation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invite_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_workspace_member(uuid, uuid) TO authenticated;

-- ============================================================
-- 2. accept_workspace_invitation — invitee 가 수락 (CRITICAL race-safe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(
  p_invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inv record;
  v_already_member boolean;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.invitee_user_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_inv.workspace_id AND user_id = v_caller_id
  ) INTO v_already_member;

  IF v_inv.status = 'accepted' AND v_already_member THEN
    RETURN jsonb_build_object(
      'invitationId', v_inv.id,
      'workspaceId', v_inv.workspace_id,
      'idempotent', true
    );
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'INVITATION_%', upper(v_inv.status) USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.workspace_invitations
      SET status = 'expired', responded_at = now()
      WHERE id = p_invitation_id;
    RAISE EXCEPTION 'INVITATION_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, invited_by, role)
  VALUES (v_inv.workspace_id, v_caller_id, v_inv.invited_by, v_inv.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invitations
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'invitationId', v_inv.id,
    'workspaceId', v_inv.workspace_id,
    'idempotent', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid) TO authenticated;

-- ============================================================
-- 3. reject_workspace_invitation
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_workspace_invitation(
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inv record;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.invitee_user_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_inv.status = 'rejected' THEN
    RETURN;
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'INVITATION_%', upper(v_inv.status) USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspace_invitations
    SET status = 'rejected', responded_at = now()
    WHERE id = p_invitation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_workspace_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_workspace_invitation(uuid) TO authenticated;

-- ============================================================
-- 4. revoke_workspace_invitation
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_workspace_invitation(
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_inv record;
  v_owner_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = v_inv.workspace_id;
  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN;
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'INVITATION_%', upper(v_inv.status) USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspace_invitations
    SET status = 'revoked', responded_at = now()
    WHERE id = p_invitation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_workspace_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invitation(uuid) TO authenticated;

-- ============================================================
-- 5. remove_workspace_member
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = p_workspace_id FOR SHARE;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_owner_id THEN
    RAISE EXCEPTION 'CANNOT_REMOVE_OWNER' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;

-- ============================================================
-- 6. expire_pending_workspace_invitations — pg_cron 일 1회 호출
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_pending_workspace_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.workspace_invitations
      SET status = 'expired', responded_at = now()
      WHERE status = 'pending' AND expires_at < now()
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_pending_workspace_invitations() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.expire_pending_workspace_invitations IS 'pg_cron 일 1회 호출 — pending 초대 만료 처리. 알림 없음 (D3).';
