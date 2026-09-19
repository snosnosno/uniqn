-- Normalize legacy pin metadata before enforcing the invariant on every update.
ALTER TABLE public.board_comments DISABLE TRIGGER board_comment_update_scope;

UPDATE public.board_comments
SET is_pinned = false,
    pinned_at = NULL,
    pinned_by = NULL,
    updated_at = now()
WHERE is_pinned IS NULL
   OR (
     status IS DISTINCT FROM 'active'
     AND (is_pinned IS DISTINCT FROM false OR pinned_at IS NOT NULL OR pinned_by IS NOT NULL)
   )
   OR (is_pinned = true AND (pinned_at IS NULL OR pinned_by IS NULL))
   OR (is_pinned = false AND (pinned_at IS NOT NULL OR pinned_by IS NOT NULL));

ALTER TABLE public.board_comments ENABLE TRIGGER board_comment_update_scope;

CREATE OR REPLACE FUNCTION public.enforce_board_comment_pin_invariants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_pinned IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: comment pin state is required'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' AND NEW.is_pinned = true THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: inactive comments cannot be pinned'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_pinned = true
     AND (NEW.pinned_at IS NULL OR NEW.pinned_by IS NULL) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: pinned comments require pin metadata'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_pinned = false
     AND (NEW.pinned_at IS NOT NULL OR NEW.pinned_by IS NOT NULL) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: unpinned comments cannot retain pin metadata'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_board_comment_pin_invariants() FROM PUBLIC;

DROP TRIGGER IF EXISTS board_comment_pin_invariants ON public.board_comments;
CREATE TRIGGER board_comment_pin_invariants
BEFORE INSERT OR UPDATE OF status, is_pinned, pinned_at, pinned_by
ON public.board_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_comment_pin_invariants();
