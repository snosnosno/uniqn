-- Communication screens are authenticated; anonymous callers must not inflate views.
REVOKE ALL ON FUNCTION public.increment_board_post_view_count(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_board_post_view_count(text)
  TO authenticated;
