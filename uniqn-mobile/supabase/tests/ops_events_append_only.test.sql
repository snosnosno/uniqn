-- ops_events append-only(트리거) + Realtime publication 포함/제외.
BEGIN;
SELECT plan(5);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.event_id', s.event_id::text, true);
END $$;

-- 직접 UPDATE / DELETE 는 BEFORE 트리거가 RAISE (postgres 권한이어도 차단).
SELECT throws_ok(
  $$ UPDATE public.ops_events SET actor_device = 'hack' WHERE id = (current_setting('ops.event_id'))::uuid $$,
  'P0001', NULL, 'direct UPDATE on ops_events blocked (append-only)');
SELECT throws_ok(
  $$ DELETE FROM public.ops_events WHERE id = (current_setting('ops.event_id'))::uuid $$,
  'P0001', NULL, 'direct DELETE on ops_events blocked (append-only)');

-- Realtime publication: ops_events 제외, 대회/참가자 포함.
SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ops_events'),
  'ops_events NOT in supabase_realtime publication');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ops_tournaments'),
  'ops_tournaments in supabase_realtime publication');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ops_participants'),
  'ops_participants in supabase_realtime publication');

SELECT * FROM finish();
ROLLBACK;
