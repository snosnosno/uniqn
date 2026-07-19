-- 닉네임 검색 RPC 서버측 rate limit — 열거(enumeration) 방어
--
-- 배경: 검색을 완전일치 → prefix(ILIKE 2자)로 바꾸면서 열거 표면이 생겼다.
--   구인자 계정을 확보한 공격자가 두 글자 조합을 자동 호출하면 가입자 닉네임 명단을
--   수집할 수 있다. 클라 방어(최소 2자·LIMIT)는 봇을 막지 못하므로 서버에서 제한한다.
--
-- 방어 순서(기존 게이트는 그대로 유지하고 그 뒤에 추가):
--   ① auth.uid() NULL 차단  ② 역할/소유권 게이트  ③ 최소 2자  ④ [신규] rate limit
--   → ③ 미달은 결과가 없으므로 토큰을 소모시키지 않는다(정상 사용자의 오타 보호).
--   → ② 이전에 두지 않는 이유: 무권한 호출은 이미 예외로 튕기며, 그 경로에서
--      rate_limits 쓰기를 유발하면 오히려 무인증 쓰기 표면이 된다.
--
-- 한도: 분당 20회. 두 검색 모두 **수동 제출 트리거**(검색 버튼·엔터)라 정상 사용자는
--   도달할 수 없고, 봇은 즉시 차단된다. 검색별로 키를 분리해 한쪽이 다른 쪽을
--   소진시키지 않게 한다.
--   ※ 협업자 검색은 원래 300ms debounce 타이핑 검색이었다 — 그 상태로 20회/분을 걸면
--     정상 사용자가 초대 도중 잠긴다. 그래서 CollaboratorSearch 를 스태프 검색과 동일한
--     명시 제출 방식으로 전환했다(같은 PR). 이 한도는 그 전환을 전제로 한다.
--
-- STABLE → VOLATILE 전환:
--   함수가 부작용(rate_limits 토큰 차감)을 갖게 되었으므로 VOLATILE 이 정확한 선언이다.
--   STABLE 로 두면 플래너가 호출을 접어(fold) 카운트가 누락될 수 있다.
--   ※ "STABLE 이면 중첩 DML 이 거부된다"는 것은 사실이 아니다 — PostgreSQL 의 read-only
--     강제는 함수 자신의 provolatile 기준이며 중첩 호출로 전파되지 않는다(로컬 실측 확인).
--     DML 은 check_rate_limit(VOLATILE) 안에 있으므로 STABLE 로도 "터지지는" 않는다.
--     즉 회귀 시 증상은 요란한 실패가 아니라 **조용한 카운트 누락**이다. 그래서 아래
--     pgTAP provolatile 가드가 더 중요하다.
--   단발 RPC 호출이라 플래너 최적화 손실은 무시 가능하다.
--
-- 권한 참고: check_user_rate_limit 은 authenticated 에 REVOKE 되어 있으나(직접 호출 차단),
--   이 두 RPC 는 SECURITY DEFINER(OWNER=postgres)이므로 내부 호출은 postgres 권한으로
--   실행되어 정상 동작한다. 직접 호출은 막힌 채 경유 호출만 허용되는 의도된 형태다.

-- ============================================================================
-- 1) 스태프 직접추가용 검색 — rate limit 추가 (RETURNS TABLE 불변 → REPLACE 가능)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_users_by_nickname(p_nickname text)
  RETURNS TABLE(id uuid, name text, nickname text, photo_url text, photo_url_blurhash text, region text)
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = '', pg_temp
  AS $$
DECLARE
  v_caller_uid uuid;
  v_query      text;
  v_escaped    text;
  v_rate       jsonb;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- 구인자(employer)·관리자(admin)만 검색 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_caller_uid
      AND u.role IN ('employer', 'admin')
      AND u.is_active = true
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 구인자만 사용할 수 있습니다';
  END IF;

  v_query := btrim(COALESCE(p_nickname, ''));
  -- 최소 2자 — 과도한 열거 방지
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  -- 실제 검색만 토큰을 소모한다(분당 20회)
  v_rate := public.check_user_rate_limit(v_caller_uid, 'search_users_by_nickname', 20, 60);
  IF NOT COALESCE((v_rate ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SEARCH_RATE_LIMITED: 검색 요청이 너무 잦습니다';
  END IF;

  -- ILIKE 와일드카드 이스케이프(prefix 매칭, 대소문자 무시)
  v_escaped := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT u.id, u.name, u.nickname, u.photo_url, u.photo_url_blurhash, u.region
  FROM public.users u
  WHERE u.is_active = true
    AND COALESCE(u.status, 'active') NOT IN ('deleted', 'deactivated')
    AND u.nickname IS NOT NULL
    AND u.nickname ILIKE v_escaped || '%' ESCAPE '\'
  ORDER BY u.nickname
  LIMIT 8;
END;
$$;

ALTER FUNCTION public.search_users_by_nickname(p_nickname text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.search_users_by_nickname(p_nickname text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_users_by_nickname(p_nickname text) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_users_by_nickname(p_nickname text) TO authenticated;

COMMENT ON FUNCTION public.search_users_by_nickname(p_nickname text) IS
  '닉네임 prefix 검색(구인자 전용, ILIKE 대소문자무시, 최소 2자, LIMIT 8, 분당 20회 rate limit). 스태프 직접 추가용.';

-- ============================================================================
-- 2) 협업자 초대용 검색 — rate limit 추가 (RETURNS TABLE 불변 → REPLACE 가능)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_collaborator_candidates_by_nickname(
  p_job_posting_id uuid,
  p_nickname_query text
)
  RETURNS TABLE(id uuid, name text, nickname text, photo_url text)
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = '', pg_temp
  AS $$
DECLARE
  v_caller_uid uuid;
  v_is_owner   boolean;
  v_query      text;
  v_escaped    text;
  v_rate       jsonb;
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

  -- 스태프 검색과 키를 분리한다(한쪽 소진이 다른 쪽을 막지 않도록)
  v_rate := public.check_user_rate_limit(v_caller_uid, 'search_collab_by_nickname', 20, 60);
  IF NOT COALESCE((v_rate ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SEARCH_RATE_LIMITED: 검색 요청이 너무 잦습니다';
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
  'workspace owner 의 collaborator 후보 닉네임 prefix 검색(ILIKE, 최소 2자, LIMIT 10, 분당 20회 rate limit). email 미반환(PII 하드닝) + status 제외 필터.';
