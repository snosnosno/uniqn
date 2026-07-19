-- 닉네임 검색 통일 — 신규 RPC 2종 (additive)
--
-- 배경: 전화번호 검색(search_users_by_phone)이 저장 포맷(E.164 +82…) vs 입력 포맷(010…)
--       불일치로 사실상 100% 실패. 협업자 검색은 이메일 prefix. 두 검색을 닉네임 prefix로 통일한다.
--       닉네임은 profile-setup 필수 입력(실사용자 100% 보유) + UNIQUE 제약 + 카드에 이미 공개.
--
-- 이 마이그는 additive(신규 함수 생성)만 수행한다.
-- 기존 search_users_by_phone / search_users_for_collaborator_invite 는 라이브 클라 보호를 위해
-- 존치하며, OTA 확산 후 별도 마이그(DROP)로 제거한다. (repo↔prod 파리티 유지)
--
-- 하드닝(decisions/secdef-hardening): SECURITY DEFINER + search_path 고정 + anon REVOKE
--   + NULL fail-open 차단(auth.uid() IS NULL 예외) + ILIKE 와일드카드 이스케이프.

-- ============================================================================
-- 1) 스태프 직접추가용 — 닉네임 prefix 검색 (구인자 전용)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_users_by_nickname(p_nickname text)
  RETURNS TABLE(id uuid, name text, nickname text, photo_url text, photo_url_blurhash text, region text)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = '', pg_temp
  AS $$
DECLARE
  v_caller_uid uuid;
  v_query      text;
  v_escaped    text;
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
  '닉네임 prefix 검색(구인자 전용, ILIKE 대소문자무시, 최소 2자, LIMIT 8). 스태프 직접 추가용. search_users_by_phone 대체.';

-- ============================================================================
-- 2) 협업자 초대용 — 닉네임 prefix 검색 (workspace owner 전용)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_collaborator_candidates_by_nickname(
  p_job_posting_id uuid,
  p_nickname_query text
)
  RETURNS TABLE(id uuid, email text, name text, nickname text, photo_url text)
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
  SELECT u.id, u.email, u.name, u.nickname, u.photo_url
  FROM public.users u
  WHERE u.nickname IS NOT NULL
    AND u.nickname ILIKE v_escaped || '%' ESCAPE '\'
    AND coalesce(u.is_active, true) = true
  ORDER BY u.nickname
  LIMIT 10;
END;
$$;

ALTER FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) TO authenticated;

COMMENT ON FUNCTION public.search_collaborator_candidates_by_nickname(p_job_posting_id uuid, p_nickname_query text) IS
  'workspace owner 의 collaborator 후보 닉네임 prefix 검색(ILIKE, 최소 2자, LIMIT 10). search_users_for_collaborator_invite(이메일) 대체.';
