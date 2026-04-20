-- Phase 2 ST-001: board_posts.comment_count denormalize drift fix (2026-04-20 QA)
-- 1) QA 검증 댓글 제거 (Phase 2 QA 부작용 cleanup)
DELETE FROM public.board_comments
WHERE post_id = 'e1111111-1111-4111-a111-111111111111'
  AND author_id = 'a1111111-1111-4111-a111-111111111111'
  AND body LIKE 'QA 검증%';

-- 2) 모든 board_posts.comment_count 실제 카운트로 재계산
UPDATE public.board_posts bp
SET comment_count = COALESCE((
  SELECT COUNT(*) FROM public.board_comments bc WHERE bc.post_id = bp.id
), 0);
