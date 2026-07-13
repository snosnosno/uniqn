-- 공고 워크스페이스 협업 편집 (PR #2) — 초대 시 인앱 알림 INSERT
-- workspace_invitations INSERT (status='pending') 시 notifications 에 row 추가.
-- 푸시 발송은 기존 notifications-push trigger 가 자동 처리.

CREATE OR REPLACE FUNCTION public.notify_on_workspace_invitation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_name text;
  v_inviter_name text;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = NEW.workspace_id;
  SELECT COALESCE(name, '알 수 없음') INTO v_inviter_name FROM public.users WHERE id = NEW.invited_by;

  v_workspace_name := COALESCE(v_workspace_name, '워크스페이스');
  v_inviter_name := COALESCE(v_inviter_name, '알 수 없음');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  VALUES (
    NEW.invitee_user_id,
    'workspace_invitation',
    format('%s님이 워크스페이스에 초대했어요', v_inviter_name),
    format('%s · 편집자 권한', v_workspace_name),
    format('/workspace/invitations'),
    jsonb_build_object(
      'invitationId', NEW.id,
      'workspaceId', NEW.workspace_id,
      'workspaceName', v_workspace_name,
      'inviterName', v_inviter_name,
      'senderId', NEW.invited_by
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_workspace_invitation_insert] failed for invitation % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_invitation_notify_insert ON public.workspace_invitations;
CREATE TRIGGER workspace_invitation_notify_insert
AFTER INSERT ON public.workspace_invitations
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_workspace_invitation_insert();

REVOKE EXECUTE ON FUNCTION public.notify_on_workspace_invitation_insert() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.notify_on_workspace_invitation_insert IS '워크스페이스 초대 발송 시 invitee 에게 인앱 알림 INSERT (push 발송은 기존 trigger 가 처리).';
