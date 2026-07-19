-- 협업자 검색 하드닝(리뷰 반영) — search_collaborator_candidates_by_nickname 재생성
--
-- [P2 보안] 공개·UNIQUE 값인 nickname 을 키로 비공개 PII(email)를 반환하던 것을 제거.
--   닉네임+이름+사진이 이미 disambiguation 을 담당하므로 email 은 중복이며, 공개 키 기반
--   email 하베스팅 벡터를 차단한다. RETURNS TABLE 변경(email 컬럼 제거)이라 DROP+CREATE.
-- [P3 DB] status 필터 정합 — 스태프 검색(search_users_by_nickname)과 동일하게
--   탈퇴 대기/삭제(deactivated/deleted) 유저를 후보에서 제외.

DROP FUNCTION IF EXISTS public.search_collaborator_candidates_by_nickname(uuid, text);

CREATE FUNCTION public.search_collaborator_candidates_by_nickname(
  p_job_posting_id uuid,
  p_nickname_query text
)
  RETURNS TABLE(id uuid, name text, nickname text, photo_url text)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = '', pg_temp
  AS $$
DECLARE
  v_caller_uid uuid;
  v_is_owner   boolean;
  v_query      text;
  v_escaped    text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.job_postings jp
    JOIN public.workspaces w ON w.id = jp.workspace_id
    WHERE jp.id = p_job_posting_id AND w.owner_id = v_caller_uid
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'permission denied: workspace owner required' USING ERRCODE = '42501';
  END IF;

  v_query := btrim(COALESCE(p_nickname_query, ''));
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  v_escaped := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT u.id, u.name, u.nickname, u.photo_url
  FROM public.users u
  WHERE u.nickname IS NOT NULL
    AND u.nickname ILIKE v_escaped || '%' ESCAPE '\'
    AND coalesce(u.is_active, true) = true
    AND COALESCE(u.status, 'active') NOT IN ('deleted', 'deactivated')
  ORDER BY u.nickname
  LIMIT 10;
END;
$$;

ALTER FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) TO authenticated;

COMMENT ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) IS
  'workspace owner 의 collaborator 후보 닉네임 prefix 검색(ILIKE, 최소 2자, LIMIT 10). email 미반환(PII 하드닝) + status 제외 필터. search_users_for_collaborator_invite(이메일) 대체.';
