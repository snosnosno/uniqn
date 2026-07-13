-- OPS 1a 후속 — 트리거 헬퍼 함수 EXECUTE REVOKE (anon 노출 0 충족)
-- 배경: fn_ops_set_updated_at / fn_ops_events_append_only 는 SECURITY DEFINER + RETURNS trigger.
--   public 신규 함수는 PUBLIC(anon/authenticated 포함) EXECUTE 기본부여 → get_advisors 가
--   anon_security_definer_function_executable WARN 으로 적발(1a 검증 acceptance: anon 노출 0).
-- 트리거 함수는 트리거 메커니즘이 호출(직접 EXECUTE 권한 검사 없음)하므로 REVOKE 해도 트리거 정상 동작.
-- 베이스라인 일치: fn_workspaces_set_updated_at = (postgres | service_role) — 동일 상태로 정렬.
-- pitfall_supabase_new_function_anon_default_grant: 신규 public 함수는 anon REVOKE 명시 필수.
-- 멱등 — 권한 없으면 REVOKE no-op.

REVOKE EXECUTE ON FUNCTION public.fn_ops_set_updated_at()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_ops_events_append_only() FROM PUBLIC, anon, authenticated;
