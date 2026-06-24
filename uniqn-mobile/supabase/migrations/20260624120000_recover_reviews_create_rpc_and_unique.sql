-- 평점 복구: create_review RPC + (work_log_id, reviewer_type) UNIQUE
-- 배경: Firebase 잔재인 합성 PK({workLogId}_{reviewerType}) 설계가 uuid 스키마로
--       번역되지 않아 쓰기 경로(create_review RPC)가 부재 → reviews 0행.
-- SSOT 주의: 점수식은 src/types/review.ts BUBBLE_SCORE 와 일치해야 함.
--   INITIAL 50.0 / MIN 0 / MAX 100 / POSITIVE +1.0 / NEUTRAL 0 / NEGATIVE -1.0 / DECIMAL 1
-- ============================================================

-- 1) 멱등 제약: 한 근무·한 방향 1리뷰
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_work_log_reviewer_type_key UNIQUE (work_log_id, reviewer_type);

-- 2) create_review RPC
CREATE OR REPLACE FUNCTION public.create_review(
  p_work_log_id uuid,
  p_job_posting_id uuid,
  p_job_posting_title text,
  p_work_date text,
  p_reviewer_id uuid,
  p_reviewer_name text,
  p_reviewer_type text,
  p_reviewee_id uuid,
  p_reviewee_name text,
  p_sentiment public.review_sentiment,
  p_tags text[],
  p_comment text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_review_id uuid;
  v_change numeric;
  v_current jsonb;
  v_new_score numeric;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  -- 호출자 바인딩: 작성자는 본인만 (SECURITY DEFINER 가 RLS 우회하므로 수동 검사)
  IF auth.uid() IS DISTINCT FROM p_reviewer_id THEN
    RAISE EXCEPTION 'unauthorized_reviewer';
  END IF;

  IF p_reviewer_type NOT IN ('employer', 'staff') THEN
    RAISE EXCEPTION 'invalid_reviewer_type';
  END IF;

  -- 서버 권위: sentiment → 점수 변화량 (클라 delta 불신)
  v_change := CASE p_sentiment
    WHEN 'positive' THEN 1.0
    WHEN 'neutral'  THEN 0
    WHEN 'negative' THEN -1.0
  END;

  -- 멱등 INSERT (id 는 gen_random_uuid 기본값)
  INSERT INTO public.reviews (
    work_log_id, job_posting_id, job_posting_title, work_date,
    reviewer_id, reviewer_name, reviewer_type,
    reviewee_id, reviewee_name, sentiment, tags, comment, bubble_score_change
  ) VALUES (
    p_work_log_id, p_job_posting_id, p_job_posting_title, p_work_date,
    p_reviewer_id, p_reviewer_name, p_reviewer_type,
    p_reviewee_id, p_reviewee_name, p_sentiment, COALESCE(p_tags, '{}'), p_comment, v_change::int
  )
  ON CONFLICT (work_log_id, reviewer_type) DO NOTHING
  RETURNING id INTO v_review_id;

  -- 이미 존재 → 점수 미반영, 기존 id 반환(멱등)
  IF v_review_id IS NULL THEN
    SELECT id INTO v_review_id FROM public.reviews
    WHERE work_log_id = p_work_log_id AND reviewer_type = p_reviewer_type;
    RETURN v_review_id;
  END IF;

  -- 피평가자 bubble_score 원자 갱신 (camelCase jsonb, clamp 0..100)
  SELECT bubble_score INTO v_current FROM public.users WHERE id = p_reviewee_id FOR UPDATE;
  v_new_score := round(
    GREATEST(0, LEAST(100, COALESCE((v_current->>'score')::numeric, 50.0) + v_change)), 1);

  UPDATE public.users SET bubble_score = jsonb_build_object(
    'score', v_new_score,
    'totalReviewCount', COALESCE((v_current->>'totalReviewCount')::int, 0) + 1,
    'positiveCount', COALESCE((v_current->>'positiveCount')::int, 0) + (CASE WHEN p_sentiment = 'positive' THEN 1 ELSE 0 END),
    'neutralCount',  COALESCE((v_current->>'neutralCount')::int, 0)  + (CASE WHEN p_sentiment = 'neutral'  THEN 1 ELSE 0 END),
    'negativeCount', COALESCE((v_current->>'negativeCount')::int, 0) + (CASE WHEN p_sentiment = 'negative' THEN 1 ELSE 0 END),
    'lastUpdatedAt', v_now
  ) WHERE id = p_reviewee_id;

  RETURN v_review_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text) TO authenticated;

COMMENT ON FUNCTION public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text) IS
  '리뷰 작성 원자 RPC. auth.uid()=reviewer 검사 → reviews INSERT(ON CONFLICT (work_log_id,reviewer_type) DO NOTHING) → 피평가자 users.bubble_score 갱신. 멱등(재호출 시 기존 id 반환·점수 미반영). 점수식 SSOT=src/types/review.ts BUBBLE_SCORE.';
