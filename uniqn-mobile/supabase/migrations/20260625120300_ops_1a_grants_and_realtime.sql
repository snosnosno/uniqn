-- OPS 1a — RPC 권한(REVOKE anon / GRANT authenticated,service_role) + Realtime publication.
-- 패턴: 20260621090000_harden_anon_rpc_revoke_and_delete_guard.sql (이름기반 DO 루프),
--       20260509020000_workspace_members_realtime_publication.sql (ALTER PUBLICATION).
-- pitfall_supabase_new_function_anon_default_grant: public 신규 함수는 anon/authenticated
--   EXECUTE 자동부여 → 변이 RPC 는 anon 명시 REVOKE 필수.

-- 이름 기반 REVOKE/GRANT: 정확한 시그니처(oid::regprocedure)로 모든 오버로드 처리.
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_create_tournament',
    'ops_update_tournament',
    'ops_set_tournament_status',
    'ops_register_participant',
    'ops_add_rebuy',
    'ops_add_addon',
    'ops_toggle_registration'
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
    RAISE NOTICE 'ops rpc hardened: %', rec.sig;
  END LOOP;
END $$;

-- Realtime: ops_tournaments + ops_participants 만 publication 에 추가 (ops_events 는 제외).
-- 멱등: 이미 등록돼 있으면 skip (재적용/CLI 드리프트 안전).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'ops_tournaments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_tournaments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'ops_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_participants;
  END IF;
END $$;
