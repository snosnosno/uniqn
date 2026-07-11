-- 2026-07-10 보안 하드닝 (P0, IDOR): board 투표/리액션 토글 호출자 바인딩
--
-- 배경(prod 라이브 감사 실측, 2026-07-10):
--  * toggle_board_post_vote / toggle_comment_reaction 는 SECURITY DEFINER 이며
--    p_user_id 를 클라이언트가 통제한다. 본문에 auth.uid() 검증이 전혀 없어
--    인증된 임의 사용자가 타인의 p_user_id 로 투표/리액션을 위조·삭제·조작할 수 있다
--    (IDOR: board_votes/board_comment_reactions 위조 + like/dislike/reaction_counts 조작).
--  * 정상 클라이언트(src/repositories/supabase/BoardRepository.ts)는 자기 세션 uid 를
--    p_user_id 로 넘기므로, 아래 가드(호출자 uid 와 p_user_id 일치 강제)로 회귀 없음.
--
-- 수정: 프로젝트 표준 호출자 바인딩 관용구(ops_* 40여 함수와 동일)를 본문 맨 앞에 추가.
--   IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT is_admin())
--   THEN RAISE 'PERMISSION_DENIED: 호출자 인증 불일치'.
--   가드가 최상단이라 미인증/위조 호출은 테이블 접근 전에 즉시 차단된다.
--
-- 파리티 참고: toggle_board_post_vote 는 레포 마이그에 CREATE 가 없던 prod-only 함수였고
--   toggle_comment_reaction 은 본문 드리프트 상태였다. 본 마이그가 prod 현행 본문 + 가드로
--   재정의하여 레포↔prod 정합화도 겸한다(정의 출처 = 2026-07-10 prod pg_get_functiondef).
--
-- 검증: pgTAP 회귀(위조 호출 → PERMISSION_DENIED throws_ok). 시그니처·반환·SECDEF 불변.

CREATE OR REPLACE FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_type text;
  v_result_type   text;
BEGIN
  -- [보안] 호출자 바인딩: p_user_id 는 호출자 본인(또는 admin) 이어야 한다.
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  IF p_vote_type NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION 'invalid vote type: %', p_vote_type USING ERRCODE = '22023';
  END IF;

  SELECT type INTO v_existing_type
  FROM public.board_votes
  WHERE post_id = p_post_id AND user_id = p_user_id;

  IF v_existing_type IS NOT NULL THEN
    IF v_existing_type = p_vote_type THEN
      -- 같은 타입 재클릭 → 토글 해제
      DELETE FROM public.board_votes
      WHERE post_id = p_post_id AND user_id = p_user_id;

      IF p_vote_type = 'like' THEN
        UPDATE public.board_posts
        SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1),
            updated_at = now()
        WHERE id = p_post_id;
      ELSE
        UPDATE public.board_posts
        SET dislike_count = GREATEST(0, COALESCE(dislike_count, 0) - 1),
            updated_at = now()
        WHERE id = p_post_id;
      END IF;

      v_result_type := NULL;
    ELSE
      -- 다른 타입 → 전환 (기존 -1, 새 +1)
      UPDATE public.board_votes
      SET type = p_vote_type
      WHERE post_id = p_post_id AND user_id = p_user_id;

      IF p_vote_type = 'like' THEN
        UPDATE public.board_posts
        SET like_count     = COALESCE(like_count, 0) + 1,
            dislike_count  = GREATEST(0, COALESCE(dislike_count, 0) - 1),
            updated_at     = now()
        WHERE id = p_post_id;
      ELSE
        UPDATE public.board_posts
        SET dislike_count  = COALESCE(dislike_count, 0) + 1,
            like_count     = GREATEST(0, COALESCE(like_count, 0) - 1),
            updated_at     = now()
        WHERE id = p_post_id;
      END IF;

      v_result_type := p_vote_type;
    END IF;
  ELSE
    -- 신규 투표
    INSERT INTO public.board_votes (post_id, user_id, type)
    VALUES (p_post_id, p_user_id, p_vote_type);

    IF p_vote_type = 'like' THEN
      UPDATE public.board_posts
      SET like_count = COALESCE(like_count, 0) + 1,
          updated_at = now()
      WHERE id = p_post_id;
    ELSE
      UPDATE public.board_posts
      SET dislike_count = COALESCE(dislike_count, 0) + 1,
          updated_at    = now()
      WHERE id = p_post_id;
    END IF;

    v_result_type := p_vote_type;
  END IF;

  RETURN jsonb_build_object('result_type', v_result_type);
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_type text;
  v_result_type   text;
BEGIN
  -- [보안] 호출자 바인딩: p_user_id 는 호출자 본인(또는 admin) 이어야 한다.
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 기존 리액션 조회
  SELECT type INTO v_existing_type
  FROM public.board_comment_reactions
  WHERE comment_id = p_comment_id AND user_id = p_user_id;

  IF v_existing_type IS NOT NULL THEN
    IF v_existing_type = p_reaction_type THEN
      -- 같은 타입 → 토글 해제
      DELETE FROM public.board_comment_reactions
      WHERE comment_id = p_comment_id AND user_id = p_user_id;

      -- reaction_counts 감소
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
$function$;

-- 권한: SECDEF 이므로 anon 제외, authenticated/service_role 유지(기존 정책 명시 재확인).
REVOKE EXECUTE ON FUNCTION public.toggle_board_post_vote(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_board_post_vote(text, uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_comment_reaction(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_comment_reaction(uuid, uuid, uuid, text) TO authenticated, service_role;
