-- ============================================================
-- board_comment_reactions 테이블 + 누락 RPC 추가
-- Supabase 이전 후 Playwright 테스트에서 발견된 누락 항목
-- ============================================================

-- 1. board_comment_reactions 테이블
CREATE TABLE IF NOT EXISTS public.board_comment_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  comment_id  uuid NOT NULL REFERENCES public.board_comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('thumbs_up','heart','laugh','surprised','sad','angry')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.board_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reaction_select" ON public.board_comment_reactions;
CREATE POLICY "reaction_select" ON public.board_comment_reactions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reaction_insert" ON public.board_comment_reactions;
CREATE POLICY "reaction_insert" ON public.board_comment_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reaction_update" ON public.board_comment_reactions;
CREATE POLICY "reaction_update" ON public.board_comment_reactions
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reaction_delete" ON public.board_comment_reactions;
CREATE POLICY "reaction_delete" ON public.board_comment_reactions
  FOR DELETE USING (user_id = auth.uid());

-- 2. increment_board_post_view_count RPC
-- Fix (2026-05-10): board_posts.id 는 base_schema 부터 text 타입.
-- check_function_bodies=on 환경 (CI fresh apply) 에서 text=uuid 비교
-- 검증 실패하던 SQLSTATE 42883 해결을 위해 ::text 캐스팅 추가.
-- 후속 migration 20260417123441 가 파라미터 자체를 text 로 재정의하므로
-- 본 캐스팅은 fresh apply 의 첫 단계에서만 의미 있으며 functional 동일.
CREATE OR REPLACE FUNCTION public.increment_board_post_view_count(p_post_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.board_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id::text;
$$;

-- 3. toggle_comment_reaction RPC
CREATE OR REPLACE FUNCTION public.toggle_comment_reaction(
  p_post_id       uuid,
  p_comment_id    uuid,
  p_user_id       uuid,
  p_reaction_type text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing_type text;
  v_result_type   text;
BEGIN
  SELECT type INTO v_existing_type
  FROM public.board_comment_reactions
  WHERE comment_id = p_comment_id AND user_id = p_user_id;

  IF v_existing_type IS NOT NULL THEN
    IF v_existing_type = p_reaction_type THEN
      -- 같은 타입 → 토글 해제
      DELETE FROM public.board_comment_reactions
      WHERE comment_id = p_comment_id AND user_id = p_user_id;

      UPDATE public.board_comments
      SET reaction_counts = jsonb_set(
        COALESCE(reaction_counts, '{}'),
        ARRAY[p_reaction_type],
        to_jsonb(GREATEST(0, COALESCE((reaction_counts->>p_reaction_type)::int, 0) - 1))
      )
      WHERE id = p_comment_id;

      v_result_type := NULL;
    ELSE
      -- 다른 타입 → 기존 감소 + 새 타입 증가
      UPDATE public.board_comment_reactions
      SET type = p_reaction_type
      WHERE comment_id = p_comment_id AND user_id = p_user_id;

      UPDATE public.board_comments
      SET reaction_counts = jsonb_set(
        jsonb_set(
          COALESCE(reaction_counts, '{}'),
          ARRAY[v_existing_type],
          to_jsonb(GREATEST(0, COALESCE((reaction_counts->>v_existing_type)::int, 0) - 1))
        ),
        ARRAY[p_reaction_type],
        to_jsonb(COALESCE((reaction_counts->>p_reaction_type)::int, 0) + 1)
      )
      WHERE id = p_comment_id;

      v_result_type := p_reaction_type;
    END IF;
  ELSE
    -- 신규 리액션 추가
    INSERT INTO public.board_comment_reactions (post_id, comment_id, user_id, type)
    VALUES (p_post_id, p_comment_id, p_user_id, p_reaction_type);

    UPDATE public.board_comments
    SET reaction_counts = jsonb_set(
      COALESCE(reaction_counts, '{}'),
      ARRAY[p_reaction_type],
      to_jsonb(COALESCE((reaction_counts->>p_reaction_type)::int, 0) + 1)
    )
    WHERE id = p_comment_id;

    v_result_type := p_reaction_type;
  END IF;

  RETURN jsonb_build_object('result_type', v_result_type);
END;
$$;
