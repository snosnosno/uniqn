-- ST-001 regression fix (FIX WINDOW 2E, 2026-04-21)
-- 2A의 일회성 reconcile 이후 새 댓글로 comment_count 드리프트 재발 (post e2222222).
-- AFTER INSERT/UPDATE(post_id)/DELETE trigger로 board_posts.comment_count 자동 유지.

CREATE OR REPLACE FUNCTION public.fn_board_comment_count_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.board_posts
       SET comment_count = COALESCE(comment_count, 0) + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.board_posts
       SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.post_id IS DISTINCT FROM OLD.post_id THEN
    UPDATE public.board_posts
       SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
     WHERE id = OLD.post_id;
    UPDATE public.board_posts
       SET comment_count = COALESCE(comment_count, 0) + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_board_comment_count_sync ON public.board_comments;

CREATE TRIGGER tr_board_comment_count_sync
AFTER INSERT OR DELETE OR UPDATE OF post_id ON public.board_comments
FOR EACH ROW
EXECUTE FUNCTION public.fn_board_comment_count_sync();

-- 현재 드리프트 row들 재동기화
UPDATE public.board_posts bp
SET comment_count = COALESCE((
  SELECT COUNT(*) FROM public.board_comments bc WHERE bc.post_id = bp.id
), 0)
WHERE comment_count IS DISTINCT FROM (
  SELECT COUNT(*) FROM public.board_comments bc WHERE bc.post_id = bp.id
);
