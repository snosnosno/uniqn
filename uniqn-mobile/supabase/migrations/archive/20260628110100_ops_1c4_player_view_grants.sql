-- 라이브 운영(ops) 1c-4 — 플레이어뷰 RPC 권한.
-- · ops_get_player_view: 공개 플레이어뷰 → anon GRANT(§5.3 본인 안전필드 화이트리스트 투영).
--   ⚠️ §0.5 B8: SECDEF + anon GRANT 라 advisor anon_security_definer_function_executable WARN 불가피(수용).
--   Phase 3 prod 게이트 = "신규 ERROR 0 + anon-executable SECDEF = ops_get_player_view 만 추가(화이트리스트)".
-- · ops_issue_claim_token: 운영자 전용 → authed.
-- · ops_claim_participant: 플레이어 본인 바인딩(로그인 필요) → authed(anon 아님 — auth.uid 바인딩).

REVOKE EXECUTE ON FUNCTION public.ops_get_player_view(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ops_get_player_view(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_issue_claim_token(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_issue_claim_token(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_claim_participant(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_claim_participant(text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ops_unclaim_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_unclaim_participant(uuid, uuid) TO authenticated, service_role;
