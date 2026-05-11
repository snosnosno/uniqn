-- P0 review fix: searchByEmail RLS bypass via SECURITY DEFINER RPC
--
-- 발견: users_select RLS 가 (auth.uid()=id OR admin) 만 허용 → workspace owner 가
--       다른 사용자를 이메일로 검색 불가 (.from('users').ilike 가 빈 결과 반환)
--
-- 해결: SECURITY DEFINER 함수 — workspace owner 검증 후 검색 결과 반환
-- 보안 가드:
-- 1. 호출자가 p_job_posting_id 의 workspace owner 인지 검증 (외부 enumeration 차단)
-- 2. 이메일 prefix 검색 시 와일드카드 (%, _, \) 이스케이프 (3자 최소 우회 차단)
-- 3. 최대 10건 반환 (DoS 완화)
-- 4. anon REVOKE — 미인증 호출 차단

CREATE OR REPLACE FUNCTION public.search_users_for_collaborator_invite(
  p_job_posting_id uuid,
  p_email_query    text
)
RETURNS TABLE (
  id        uuid,
  email     text,
  name      text,
  nickname  text,
  photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_caller_uid uuid;
  v_is_owner   boolean;
  v_escaped    text;
BEGIN
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- 호출자가 해당 공고의 workspace owner 인지 검증
  -- (외부 사용자 enumeration 차단 — 무작위 공고 ID 추측해도 검색 불가)
  SELECT EXISTS(
    SELECT 1 FROM public.job_postings jp
    JOIN public.workspaces w ON w.id = jp.workspace_id
    WHERE jp.id = p_job_posting_id AND w.owner_id = v_caller_uid
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'permission denied: workspace owner required'
      USING ERRCODE = '42501';
  END IF;

  -- 빈/짧은 쿼리는 거부 (UI 가드와 별개로 server-side 강제)
  IF p_email_query IS NULL OR length(trim(p_email_query)) < 3 THEN
    RETURN;
  END IF;

  -- ILIKE 와일드카드 이스케이프: % _ \ → \% \_ \\
  -- replace 순서 중요: 백슬래시 먼저 처리해야 후속 이스케이프가 망가지지 않음
  v_escaped := replace(replace(replace(trim(p_email_query), '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT u.id, u.email, u.name, u.nickname, u.photo_url
  FROM public.users u
  WHERE u.email ILIKE v_escaped || '%' ESCAPE '\'
    AND coalesce(u.is_active, true) = true
  LIMIT 10;
END;
$$;

COMMENT ON FUNCTION public.search_users_for_collaborator_invite IS
  'workspace owner 의 collaborator 후보 검색 — RLS bypass + 와일드카드 이스케이프 + 최대 10건';

GRANT EXECUTE ON FUNCTION public.search_users_for_collaborator_invite(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_users_for_collaborator_invite(uuid, text) FROM PUBLIC, anon;
