-- ops_reseat_participants grants: anon REVOKE, authenticated/service_role GRANT
-- 패턴: 20260630120200_ops_1d_grants.sql (DO 루프 방식)
-- ⚠️pitfall_supabase_new_function_anon_default_grant: 변이 RPC는 anon 명시 REVOKE 필수.
-- monitor/player 2개(anon-executable 허용)가 아닌 변이 RPC이므로 anon 완전 차단.
DO $$
DECLARE
  fn text := 'public.ops_reseat_participants(uuid, uuid, jsonb, text)';
BEGIN
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  RAISE NOTICE 'ops reseat rpc hardened: %', fn;
END $$;
