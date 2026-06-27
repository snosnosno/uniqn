-- 라이브 운영(ops) 1c — 클럭/블라인드 RPC 권한 하드닝 + 트리거함수 REVOKE + Realtime publication.
-- 패턴: 20260625120300_ops_1a_grants_and_realtime.sql (이름기반 DO 루프),
--       20260625120400_ops_1a_revoke_trigger_fn_execute.sql (트리거 함수 REVOKE),
--       20260509020000_workspace_members_realtime_publication.sql (ALTER PUBLICATION).
-- pitfall_supabase_new_function_anon_default_grant: public 신규 함수는 anon/authenticated EXECUTE
--   자동부여 → 변이 RPC 는 anon REVOKE, SECDEF 트리거 함수는 anon+authenticated REVOKE 필수.

-- ─── 1. 클럭/블라인드 변이 RPC: REVOKE PUBLIC/anon, GRANT authenticated/service_role ───
-- (이름 기반 — oid::regprocedure 로 모든 오버로드 정확 처리.)
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'ops_set_blind_levels',
    'ops_clock_start',
    'ops_clock_pause',
    'ops_clock_set_level',
    'ops_clock_adjust'
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
    RAISE NOTICE 'ops 1c rpc hardened: %', rec.sig;
  END LOOP;
END $$;

-- ─── 2. 트리거 함수 3종: REVOKE PUBLIC/anon/authenticated (트리거 메커니즘 호출 → 직접 EXECUTE 불요).
--      SECDEF + RETURNS trigger/void 라 미회수 시 get_advisors anon_security_definer_function_executable WARN.
--      멱등 — 권한 없으면 REVOKE no-op. ───
REVOKE EXECUTE ON FUNCTION public.fn_ops_recompute_live_stats(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_ops_live_stats_recompute_trigger()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_ops_init_derived_rows()               FROM PUBLIC, anon, authenticated;

-- ─── 3. Realtime publication: ops_blind_levels·ops_clock·ops_live_stats 추가(멱등) ───
-- REPLICA IDENTITY: ops_clock·ops_live_stats 는 PK=tournament_id 라 DEFAULT 로 충분.
-- ops_blind_levels 는 Realtime DELETE 비의존(mutation onSuccess invalidate) → DEFAULT 유지.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public' AND tablename = 'ops_blind_levels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_blind_levels;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public' AND tablename = 'ops_clock') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_clock;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public' AND tablename = 'ops_live_stats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_live_stats;
  END IF;
END $$;
