-- ops 테이블 SELECT-only RLS: owner/workspace 멤버는 보이고 outsider 는 0.
BEGIN;
SELECT plan(7);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

-- owner: 대회/참가자/이벤트 모두 보임
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tournament_id'))::uuid), 1, 'owner sees own tournament');
SELECT is((SELECT count(*)::int FROM public.ops_participants WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 1, 'owner sees participants');
SELECT is((SELECT count(*)::int FROM public.ops_events WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 1, 'owner sees events');

-- workspace 멤버: 연결 공고 워크스페이스 멤버라 보임 (is_ops_member -> is_workspace_member)
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tournament_id'))::uuid), 1, 'workspace member sees tournament');
SELECT is((SELECT count(*)::int FROM public.ops_participants WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 1, 'workspace member sees participants');

-- outsider: 아무것도 안 보임
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_tournaments WHERE id = (current_setting('ops.tournament_id'))::uuid), 0, 'outsider sees no tournament');
SELECT is((SELECT count(*)::int FROM public.ops_events WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid), 0, 'outsider sees no events');

SELECT * FROM finish();
ROLLBACK;
