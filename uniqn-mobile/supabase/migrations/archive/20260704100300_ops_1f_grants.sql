-- OPS 1f M4 — 신규/재생성 RPC 권한. 패턴: 20260630120200_ops_1d_grants.sql.
-- bust v2 는 DROP→CREATE 라 재GRANT 필수. create/update/스냅샷 2종은 CREATE OR REPLACE(시그니처
-- 불변)라 기존 GRANT 보존 — 목록 불포함. anon-executable SECDEF ops = monitor/player 2개 불변 계약.
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_bust_participant',
    'ops_undo_bust',
    'ops_correct_participant_prize'
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
    RAISE NOTICE 'ops 1f rpc hardened: %', rec.sig;
  END LOOP;
END $$;
