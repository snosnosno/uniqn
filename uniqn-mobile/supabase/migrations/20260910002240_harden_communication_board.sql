-- Communication surface hardening:
-- - only system-generated schedule posts remain in board_posts
-- - post votes are retired
-- - comments/reactions enforce caller, membership and one-level replies
-- - cron-driven posting expiration also refreshes schedule communication metadata

DELETE FROM public.notifications n
WHERE n.type IN ('board_comment', 'board_reply', 'board_mention', 'board_locked')
  AND COALESCE(n.data ->> 'postId', '') <> ''
  AND n.data ->> 'postId' NOT LIKE 'notice_%'
  AND NOT EXISTS (
    SELECT 1 FROM public.board_posts bp WHERE bp.id = n.data ->> 'postId'
  );

DELETE FROM public.board_posts
WHERE board_type IN ('free', 'tda', 'substitute');

DELETE FROM public.board_posts bp
USING public.job_postings jp
WHERE bp.linked_job_posting_id = jp.id
  AND bp.board_type = 'schedule'
  AND jp.status = 'container';

DROP FUNCTION IF EXISTS public.toggle_board_post_vote(text, uuid, text);
DROP TABLE IF EXISTS public.board_votes;

DROP POLICY IF EXISTS bp_insert ON public.board_posts;
DROP POLICY IF EXISTS bp_delete ON public.board_posts;
REVOKE INSERT, DELETE ON public.board_posts FROM anon, authenticated;
REVOKE UPDATE ON public.board_posts FROM authenticated;
GRANT UPDATE (status, is_locked, locked_by, locked_at, updated_at)
  ON public.board_posts TO authenticated;

DROP POLICY IF EXISTS bp_update ON public.board_posts;
CREATE POLICY bp_update ON public.board_posts
FOR UPDATE TO authenticated
USING (
  board_type = 'schedule'
  AND (
    author_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
)
WITH CHECK (
  board_type = 'schedule'
  AND source = 'board'
  AND visibility = 'participants_only'
  AND linked_job_posting_id IS NOT NULL
  AND (
    author_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
);

DROP POLICY IF EXISTS bm_insert ON public.board_memberships;
DROP POLICY IF EXISTS board_memberships_delete ON public.board_memberships;
REVOKE INSERT, UPDATE, DELETE ON public.board_memberships FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_board_comment_parent_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_post_id text;
  v_parent_parent_id uuid;
  v_parent_status text;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT post_id, parent_comment_id, status
    INTO v_parent_post_id, v_parent_parent_id, v_parent_status
  FROM public.board_comments
  WHERE id = NEW.parent_comment_id;

  IF NOT FOUND OR v_parent_status <> 'active' THEN
    RAISE EXCEPTION 'reply parent must be an active comment' USING ERRCODE = '23514';
  END IF;
  IF v_parent_post_id IS DISTINCT FROM NEW.post_id THEN
    RAISE EXCEPTION 'reply parent must belong to the same post' USING ERRCODE = '23514';
  END IF;
  IF v_parent_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'nested replies are not supported' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_board_comment_parent_integrity() FROM PUBLIC;

DROP TRIGGER IF EXISTS board_comment_parent_integrity ON public.board_comments;
CREATE TRIGGER board_comment_parent_integrity
BEFORE INSERT OR UPDATE OF parent_comment_id, post_id ON public.board_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_comment_parent_integrity();

DROP POLICY IF EXISTS bc_insert ON public.board_comments;
CREATE POLICY bc_insert ON public.board_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.board_posts bp
    WHERE bp.id = board_comments.post_id
      AND bp.board_type = 'schedule'
      AND bp.status = 'active'
      AND bp.is_locked = false
      AND (
        (SELECT public.is_admin())
        OR EXISTS (
          SELECT 1 FROM public.board_memberships bm
          WHERE bm.post_id = bp.id
            AND bm.user_id = (SELECT auth.uid())
            AND bm.can_read = true
            AND bm.can_comment = true
        )
      )
  )
);

DROP POLICY IF EXISTS bc_update ON public.board_comments;
CREATE POLICY bc_update ON public.board_comments
FOR UPDATE TO authenticated
USING (
  author_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
)
WITH CHECK (
  author_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS reaction_insert ON public.board_comment_reactions;
DROP POLICY IF EXISTS reaction_update ON public.board_comment_reactions;
DROP POLICY IF EXISTS reaction_delete ON public.board_comment_reactions;
REVOKE INSERT, UPDATE, DELETE ON public.board_comment_reactions FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.toggle_comment_reaction(uuid, uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.toggle_comment_reaction(
  p_post_id text,
  p_comment_id uuid,
  p_user_id uuid,
  p_reaction_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_type text;
  v_result_type text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: caller mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF p_reaction_type NOT IN ('thumbs_up', 'heart', 'laugh', 'surprised', 'sad', 'angry') THEN
    RAISE EXCEPTION 'invalid reaction type' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.board_comments bc
    JOIN public.board_posts bp ON bp.id = bc.post_id
    WHERE bc.id = p_comment_id
      AND bc.post_id = p_post_id
      AND bc.status = 'active'
      AND bp.board_type = 'schedule'
      AND bp.status = 'active'
      AND bp.is_locked = false
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.board_memberships bm
          WHERE bm.post_id = bp.id
            AND bm.user_id = p_user_id
            AND bm.can_read = true
            AND bm.can_comment = true
        )
      )
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: comment is not interactable' USING ERRCODE = 'P0001';
  END IF;

  SELECT type INTO v_existing_type
  FROM public.board_comment_reactions
  WHERE comment_id = p_comment_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_existing_type = p_reaction_type THEN
    DELETE FROM public.board_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = p_user_id;
    v_result_type := NULL;
  ELSIF v_existing_type IS NOT NULL THEN
    UPDATE public.board_comment_reactions
    SET type = p_reaction_type
    WHERE comment_id = p_comment_id AND user_id = p_user_id;
    v_result_type := p_reaction_type;
  ELSE
    INSERT INTO public.board_comment_reactions (post_id, comment_id, user_id, type)
    VALUES (p_post_id, p_comment_id, p_user_id, p_reaction_type);
    v_result_type := p_reaction_type;
  END IF;

  UPDATE public.board_comments bc
  SET reaction_counts = COALESCE((
    SELECT jsonb_object_agg(counts.type, counts.cnt)
    FROM (
      SELECT type, count(*)::int AS cnt
      FROM public.board_comment_reactions
      WHERE comment_id = p_comment_id
      GROUP BY type
    ) counts
  ), '{}'::jsonb),
  updated_at = now()
  WHERE bc.id = p_comment_id;

  RETURN jsonb_build_object('result_type', v_result_type);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_comment_reaction(text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_comment_reaction(text, uuid, uuid, text) TO authenticated;

-- Cron-driven status changes previously bypassed the application outbox.
CREATE OR REPLACE FUNCTION public.enqueue_schedule_board_sync_on_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IN ('active', 'capacity_full')
     AND NEW.status = 'closed'
     AND NEW.closed_reason IN ('expired', 'expired_by_work_date') THEN
    INSERT INTO public.schedule_board_sync_outbox (
      job_posting_id, action, payload, status, retry_count
    ) VALUES (
      NEW.id,
      'close',
      jsonb_build_object('source', 'database_expiration', 'closedReason', NEW.closed_reason),
      'pending',
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_schedule_board_sync_on_expiration() FROM PUBLIC;

DROP TRIGGER IF EXISTS job_posting_schedule_board_expiration_sync ON public.job_postings;
CREATE TRIGGER job_posting_schedule_board_expiration_sync
AFTER UPDATE OF status ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.enqueue_schedule_board_sync_on_expiration();

-- Keep the proven sync implementation, but prevent venue container rows from
-- becoming user-facing communication rooms.
ALTER FUNCTION public.sync_schedule_board(uuid) RENAME TO sync_schedule_board_legacy;
REVOKE ALL ON FUNCTION public.sync_schedule_board_legacy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_schedule_board_legacy(uuid) TO service_role;

CREATE FUNCTION public.sync_schedule_board(p_job_posting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_post_id text := 'schedule_' || p_job_posting_id::text;
BEGIN
  SELECT status::text INTO v_status
  FROM public.job_postings
  WHERE id = p_job_posting_id;

  IF v_status = 'container' THEN
    DELETE FROM public.board_posts WHERE id = v_post_id;
    RETURN jsonb_build_object(
      'success', true,
      'archived', true,
      'container', true,
      'job_posting_id', p_job_posting_id,
      'post_id', v_post_id
    );
  END IF;

  RETURN public.sync_schedule_board_legacy(p_job_posting_id);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_schedule_board(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_schedule_board(uuid) TO service_role;

-- Reconcile all current schedule posts without deleting conversations.
DO $$
DECLARE
  v_job_posting_id uuid;
BEGIN
  FOR v_job_posting_id IN
    SELECT id FROM public.job_postings WHERE status <> 'container'
  LOOP
    PERFORM public.sync_schedule_board(v_job_posting_id);
  END LOOP;
END;
$$;
