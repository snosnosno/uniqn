-- Follow-up hardening for the communication-board migration.
-- Keep direct client updates compatible with the current repository operations,
-- while preventing authors from moving/spoofing/pinning their own comments.

CREATE OR REPLACE FUNCTION public.enforce_board_comment_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean := public.is_admin();
  v_is_comment_author boolean := OLD.author_id = auth.uid();
  v_is_post_author boolean;
  v_can_edit_content boolean;
  v_content_changed boolean;
  v_moderation_changed boolean;
BEGIN
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT
    bp.author_id = auth.uid(),
    bp.status = 'active'
      AND bp.is_locked = false
      AND (
        bp.author_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.board_memberships bm
          WHERE bm.post_id = bp.id
            AND bm.user_id = auth.uid()
            AND bm.can_read = true
            AND bm.can_comment = true
        )
      )
  INTO v_is_post_author, v_can_edit_content
  FROM public.board_posts bp
  WHERE bp.id = OLD.post_id
    AND bp.board_type = 'schedule';

  IF NOT COALESCE(v_is_comment_author, false)
     AND NOT COALESCE(v_is_post_author, false) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: comment update is not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.post_id IS DISTINCT FROM OLD.post_id
     OR NEW.parent_comment_id IS DISTINCT FROM OLD.parent_comment_id
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.author_name IS DISTINCT FROM OLD.author_name
     OR NEW.author_role IS DISTINCT FROM OLD.author_role
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.reaction_counts IS DISTINCT FROM OLD.reaction_counts THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: immutable comment fields cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  v_content_changed := NEW.body IS DISTINCT FROM OLD.body
    OR NEW.image_attachments IS DISTINCT FROM OLD.image_attachments
    OR NEW.mentioned_user_ids IS DISTINCT FROM OLD.mentioned_user_ids;
  v_moderation_changed := NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
    OR NEW.pinned_at IS DISTINCT FROM OLD.pinned_at
    OR NEW.pinned_by IS DISTINCT FROM OLD.pinned_by;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       OLD.status = 'active'
       AND NEW.status IN ('hidden', 'deleted')
       AND NEW.body = CASE NEW.status
         WHEN 'hidden' THEN '관리자에 의해 숨김된 댓글입니다.'
         ELSE '삭제된 댓글입니다.'
       END
       AND NEW.image_attachments = '[]'::jsonb
       AND NEW.mentioned_user_ids = '{}'::text[]
       AND NEW.is_pinned = false
       AND NEW.pinned_at IS NULL
       AND NEW.pinned_by IS NULL
     ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: invalid comment status transition'
      USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE(v_is_post_author, false) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status <> 'deleted' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: authors may only delete active comments'
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_content_changed AND NOT COALESCE(v_can_edit_content, false) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: comment is not editable'
        USING ERRCODE = '42501';
    END IF;

    IF v_moderation_changed AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: authors cannot moderate comments'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT v_is_comment_author AND v_content_changed THEN
      IF NOT (
        OLD.status = 'active'
        AND NEW.status IN ('hidden', 'deleted')
        AND NEW.body = CASE NEW.status
          WHEN 'hidden' THEN '관리자에 의해 숨김된 댓글입니다.'
          ELSE '삭제된 댓글입니다.'
        END
        AND NEW.image_attachments = '[]'::jsonb
        AND NEW.mentioned_user_ids = '{}'::text[]
        AND NEW.is_pinned = false
        AND NEW.pinned_at IS NULL
        AND NEW.pinned_by IS NULL
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: post authors cannot edit comment content'
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_is_comment_author
          AND v_content_changed
          AND NEW.status IS NOT DISTINCT FROM OLD.status
          AND NOT COALESCE(v_can_edit_content, false) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: comment is not editable'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.pinned_by IS NOT NULL AND NEW.pinned_by IS DISTINCT FROM auth.uid()::text THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: pinned_by must match the caller'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_board_comment_update_scope() FROM PUBLIC;

DROP TRIGGER IF EXISTS board_comment_update_scope ON public.board_comments;
CREATE TRIGGER board_comment_update_scope
BEFORE UPDATE ON public.board_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_comment_update_scope();

REVOKE UPDATE ON public.board_comments FROM anon, authenticated;
GRANT UPDATE (
  body, mentioned_user_ids, image_attachments,
  status, is_pinned, pinned_at, pinned_by, updated_at
) ON public.board_comments TO authenticated;

DROP POLICY IF EXISTS bc_update ON public.board_comments;
CREATE POLICY bc_update ON public.board_comments
FOR UPDATE TO authenticated
USING (
  (SELECT public.is_admin())
  OR author_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.board_posts bp
    WHERE bp.id = board_comments.post_id
      AND bp.board_type = 'schedule'
      AND bp.author_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  (SELECT public.is_admin())
  OR author_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.board_posts bp
    WHERE bp.id = board_comments.post_id
      AND bp.board_type = 'schedule'
      AND bp.author_id = (SELECT auth.uid())
  )
);

-- The earlier cleanup ran before retiring community posts, so notifications for
-- rows that existed at that moment survived. Remove the now-orphaned links.
DELETE FROM public.notifications n
WHERE n.type IN ('board_comment', 'board_reply', 'board_mention', 'board_locked')
  AND COALESCE(n.data ->> 'postId', '') <> ''
  AND n.data ->> 'postId' NOT LIKE 'notice_%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.board_posts bp
    WHERE bp.id = n.data ->> 'postId'
  );
