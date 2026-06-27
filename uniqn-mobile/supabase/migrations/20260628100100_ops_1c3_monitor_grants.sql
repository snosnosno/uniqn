-- 라이브 운영(ops) 1c-3 — 모니터 RPC 권한.
-- · ops_rotate_monitor_token: 운영자 전용 → REVOKE PUBLIC/anon, GRANT authenticated/service_role.
-- · ops_get_monitor_snapshot: **공개 전광판 → anon GRANT**(§3 비-PII 화이트리스트 투영).
--   ⚠️ §0.5 B8: SECDEF + anon GRANT 라 advisor `anon_security_definer_function_executable` WARN 불가피.
--      반환값이 화이트리스트 투영(참가자 PII·토큰 미포함)이라 RLS 우회가 유출로 이어지지 않음 → 수용.
--      Phase 2 prod 게이트 = "신규 ERROR 0 + anon-executable SECDEF = ops_get_monitor_snapshot 만(화이트리스트)".

-- 운영자 전용: 회전 RPC
REVOKE EXECUTE ON FUNCTION public.ops_rotate_monitor_token(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ops_rotate_monitor_token(uuid, uuid, boolean) TO authenticated, service_role;

-- 공개 전광판: 스냅샷 RPC (anon 허용 — 화이트리스트 투영)
REVOKE EXECUTE ON FUNCTION public.ops_get_monitor_snapshot(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ops_get_monitor_snapshot(text) TO anon, authenticated, service_role;
