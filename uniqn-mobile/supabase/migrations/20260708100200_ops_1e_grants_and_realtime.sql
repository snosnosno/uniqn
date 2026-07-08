-- OPS 1e M3 — 신규 RPC 5종 권한 + ops_staff Realtime publication.
-- 패턴: 20260625130200_ops_1b_grants_and_realtime.sql(REGPROCEDURE 루프)
--      + 20260630120200_ops_1d_grants.sql(RAISE NOTICE 로깅) 혼합.
-- pitfall_supabase_new_function_anon_default_grant: 신규 SECDEF 함수는 기본적으로 PUBLIC EXECUTE 를
--   상속하고 anon 도 PUBLIC 의 일부라 자동 상속됨 — 변이 RPC 는 anon 명시 REVOKE 필수.
-- anon-executable SECDEF ops = monitor/player 2개 불변 계약(ops_1f_grants.sql 계승) — 이 마이그로
--   신규 5종을 REVOKE 하여 그 불변을 회복한다(ops_staff_security.test.sql:11 카탈로그 카운트 단언).
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_set_tournament_posting',
    'ops_import_staff_from_posting',
    'ops_add_staff',
    'ops_remove_staff',
    'ops_assign_table_staff'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
    RAISE NOTICE 'ops 1e rpc hardened: %', rec.sig;
  END LOOP;
END $$;

-- Realtime 등록 — 멱등 가드 필수(적대검증 SEC-3: bare ADD는 db:reset 재적용/드리프트 시 42710).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops_staff'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_staff;
  END IF;
END $$;
