-- Keep communication mutations behind authenticated application flows only.
REVOKE ALL ON FUNCTION public.toggle_comment_reaction(text, uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_comment_reaction(text, uuid, uuid, text)
  TO authenticated;

-- Trigger helpers are never valid API entry points.
REVOKE ALL ON FUNCTION public.enqueue_schedule_board_sync_on_expiration()
  FROM PUBLIC, anon, authenticated;
