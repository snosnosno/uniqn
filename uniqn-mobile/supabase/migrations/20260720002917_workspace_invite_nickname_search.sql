-- 멤버 초대 검색을 닉네임으로 통일 — 신규 RPC (additive)
--
-- 배경: "사람 찾아서 추가" 흐름이 3개인데 멤버 초대만 이메일 정확일치였다.
--   · 스태프 직접 추가   → search_users_by_nickname               (닉네임 prefix)
--   · 공고 협업자 추가   → search_collaborator_candidates_by_nickname (닉네임 prefix)
--   · 멤버 초대          → users 테이블 직접 쿼리 + 이메일 정확일치  ← 이것만 구식
--
--   사장이 상대방 이메일 주소를 정확히 알아야 하는 UX 부담도 다른 둘과 이질적이었다.
--
-- 왜 기존 RPC 를 재사용하지 않는가:
--   search_users_by_nickname 은 **전체 활성 사용자**를 돌려준다(스태프 검색용이라 당연).
--   그러나 워크스페이스 멤버는 구조적으로 employer/admin 전제다 — 초대 수락 화면이
--   (employer) 라우트라 staff 를 초대하면 수신자가 도달 불가한 dead-end 가 된다.
--   기존 lookupUserByEmail 이 role IN ('employer','admin') 으로 걸러온 이유가 이것이다.
--   그 필터를 잃지 않으려면 후보 집합이 다른 별도 RPC 가 필요하다.
--
-- 이메일을 반환하지 않는 이유:
--   완전일치 → prefix 검색으로 바꾸면 열거 표면이 생긴다. 여기서 email 을 함께 돌려주면
--   두 글자 조합 열거로 **가입자 이메일 명단**을 수집할 수 있다. 협업자 RPC 도 rate limit
--   개정(20260719061931) 때 같은 이유로 email 을 반환 목록에서 뺐다. 화면 식별은
--   닉네임 + 이름 + 아바타로 충분하다.
--
-- 하드닝(decisions/secdef-hardening): SECURITY DEFINER + search_path 고정 + anon REVOKE
--   + NULL fail-open 차단 + ILIKE 와일드카드 이스케이프 + 서버 rate limit.
--
-- VOLATILE 인 이유: rate limit 토큰 차감이라는 부작용이 있다. STABLE 로 두면 플래너가
--   호출을 접어 카운트가 조용히 누락될 수 있다(20260719061931 주석 참조).

CREATE OR REPLACE FUNCTION public.search_workspace_invite_candidates_by_nickname(
  p_workspace_id uuid,
  p_nickname text
)
  RETURNS TABLE(id uuid, name text, nickname text, photo_url text, photo_url_blurhash text)
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
  -- ① 인증 게이트 — NULL fail-open 차단
  v_caller_uid := (SELECT auth.uid());

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- ② 소유권 게이트 — 초대는 owner 전용(멤버 초대 화면 자체가 owner 전용 진입)
  --    IS NOT TRUE 로 비교해 NULL 이 통과하지 못하게 한다.
  SELECT EXISTS(
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.owner_id = v_caller_uid
      AND w.archived_at IS NULL
  ) INTO v_is_owner;

  IF v_is_owner IS NOT TRUE THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 팀 소유자만 초대할 수 있습니다';
  END IF;

  -- ③ 최소 2자 — 미달은 토큰을 소모시키지 않는다(정상 사용자의 오타 보호)
  v_query := btrim(COALESCE(p_nickname, ''));
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  -- ④ rate limit — 검색별 키 분리(한쪽이 다른 쪽을 소진시키지 않게)
  v_rate := public.check_user_rate_limit(
    v_caller_uid, 'search_workspace_invite_candidates', 20, 60
  );
  IF NOT COALESCE((v_rate ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SEARCH_RATE_LIMITED: 검색 요청이 너무 잦습니다';
  END IF;

  -- ⑤ 검색 — ILIKE 와일드카드 이스케이프(prefix, 대소문자 무시)
  v_escaped := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT u.id, u.name, u.nickname, u.photo_url, u.photo_url_blurhash
  FROM public.users u
  WHERE u.nickname IS NOT NULL
    AND u.nickname ILIKE v_escaped || '%' ESCAPE '\'
    -- 멤버는 employer/admin 전제 — staff 를 초대하면 수락 화면 도달 불가(dead-end)
    AND u.role IN ('employer', 'admin')
    AND u.is_active = true
    AND COALESCE(u.status, 'active') NOT IN ('deleted', 'deactivated')
    -- 자기 자신 제외(owner 는 이미 팀에 속해 있다)
    AND u.id <> v_caller_uid
    -- 이미 멤버인 사람 제외
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = p_workspace_id AND m.user_id = u.id
    )
    -- 대기 중 초대가 이미 있는 사람 제외(중복 초대 방지)
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_invitations i
      WHERE i.workspace_id = p_workspace_id
        AND i.invitee_user_id = u.id
        AND i.status = 'pending'
        AND (i.expires_at IS NULL OR i.expires_at > now())
    )
  ORDER BY u.nickname
  LIMIT 8;
END;
$$;

ALTER FUNCTION public.search_workspace_invite_candidates_by_nickname(p_workspace_id uuid, p_nickname text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.search_workspace_invite_candidates_by_nickname(p_workspace_id uuid, p_nickname text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_workspace_invite_candidates_by_nickname(p_workspace_id uuid, p_nickname text)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.search_workspace_invite_candidates_by_nickname(p_workspace_id uuid, p_nickname text)
  TO authenticated;

COMMENT ON FUNCTION public.search_workspace_invite_candidates_by_nickname(p_workspace_id uuid, p_nickname text) IS
  '팀 멤버 초대 후보 닉네임 prefix 검색(owner 전용, employer/admin 만, 이미 멤버·대기중 초대·본인 제외, ILIKE 최소 2자, LIMIT 8, 분당 20회). lookupUserByEmail(이메일 정확일치) 대체. email 은 열거 방어로 반환하지 않는다.';
