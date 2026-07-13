-- 공고 워크스페이스 협업 편집 (M1.8) — 신규 SECURITY DEFINER 함수 anon 노출 차단
-- supabase advisors security lint(0028_anon_security_definer_function_executable) 해소
-- 트리거 함수 2개는 외부 RPC 호출 자체를 차단, is_workspace_member는 anon만 차단

-- 1. 트리거 전용 함수 — RPC로 부를 일 없으므로 PUBLIC/anon/authenticated 모두 EXECUTE 회수
REVOKE EXECUTE ON FUNCTION public.fn_workspaces_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_workspace_member_count() FROM PUBLIC, anon, authenticated;

-- 2. is_workspace_member — RLS 평가 시 authenticated 가 호출, anon 만 차단
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
-- (authenticated GRANT 는 M1.4 에서 부여됨)
