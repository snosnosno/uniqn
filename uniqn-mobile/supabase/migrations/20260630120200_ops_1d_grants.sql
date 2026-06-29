-- OPS 1d M3 — 신규 RPC 권한. 패턴: 20260625120300_ops_1a_grants_and_realtime.sql.
-- pitfall_supabase_new_function_anon_default_grant: 변이 RPC 는 anon 명시 REVOKE 필수.
-- ops_prizes Realtime 미등록(상금 구조는 mutation onSuccess 무효화로 충분). participants 는 1a 등록됨.
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_bust_participant',
    'ops_reenter_participant',
    'ops_set_prize_structure'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
    RAISE NOTICE 'ops 1d rpc hardened: %', rec.sig;
  END LOOP;
END $$;
