-- ============================================================
-- Fix: increment_board_post_view_count 파라미터 타입 text로 변경
--
-- 원인: board_posts.id 컬럼은 text 타입이며, 스케줄 게시판 글은
--   'schedule_<uuid>' 형태의 composite id로 저장됨. 기존 RPC는
--   파라미터를 uuid로 선언해 prefix가 붙은 id 전달 시 400 Bad Request
--   발생 (Postgres가 UUID 파싱 실패).
--
-- 해결: board_posts.id와 동일한 text 타입으로 RPC 재정의. uuid 문자열은
--   text로 암묵적 호환되므로 일반 UUID id 게시글에도 영향 없음.
-- ============================================================

DROP FUNCTION IF EXISTS public.increment_board_post_view_count(uuid);

CREATE OR REPLACE FUNCTION public.increment_board_post_view_count(p_post_id text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.board_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id;
$$;
