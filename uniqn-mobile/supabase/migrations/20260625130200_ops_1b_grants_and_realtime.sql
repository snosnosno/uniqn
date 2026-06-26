-- OPS 1b — 신규 RPC 권한 + Realtime publication.
-- 패턴: 20260625120300_ops_1a_grants_and_realtime.sql.
DO $$
DECLARE rec record;
  names text[] := ARRAY['ops_add_table','ops_set_table_lock','ops_set_table_priority',
    'ops_close_table','ops_assign_seat','ops_move_seat','ops_free_seat','ops_redraw_waitlist_fill'];
BEGIN
  FOR rec IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
                   AND schemaname='public' AND tablename='ops_tables') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_tables;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
                   AND schemaname='public' AND tablename='ops_seats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_seats;
  END IF;
END $$;
