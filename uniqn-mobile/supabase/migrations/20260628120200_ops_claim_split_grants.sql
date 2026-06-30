-- 라이브 운영(ops) claim 토큰 분리 — 권한.
-- player_view = anon(공개 읽기, §B8 화이트리스트). issue/claim = authed(auth.uid 바인딩).
-- 구 함수는 T2에서 DROP되어 권한 자동 소멸.

REVOKE EXECUTE ON FUNCTION public.ops_get_player_view(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ops_get_player_view(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_issue_player_credentials(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_issue_player_credentials(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_claim_participant(text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_claim_participant(text, text, uuid) TO authenticated, service_role;
