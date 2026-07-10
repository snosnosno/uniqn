-- ============================================================
-- 2026-07-10 감사 후속 ③ 회귀 가드 (마이그 20260710020000)
--   1~3) sync_schedule_board 는 service_role 전용 (anon/authenticated EXECUTE 0)
--   4)   board_comments_select_all 블랭킷 정책 부재
--
-- 4)는 20260710000300 의 bc_select 하드닝이 **실제로 유효한지**를 검사한다.
-- bc_select 의 모양만 보는 테스트는 base_schema 의 `USING (true)` 블랭킷이 남아 있어도
-- 통과한다(PERMISSIVE OR 합산 → true). 두 단언이 함께 있어야 누수가 없음이 증명된다.
--
-- 로컬 존재 전제: sync_schedule_board = 20260414120400, board_comments = base_schema.
-- 둘 다 저장소에 CREATE 가 있으므로 존재가드 skip(=vacuous pass)이 필요없다.
-- 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(4);

-- 1) authenticated EXECUTE 회수 — 20260621090000 일괄 GRANT 부작용 되돌림
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sync_schedule_board'
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0,
  'sync_schedule_board 는 authenticated EXECUTE 가 없다(outbox processor 전용)'
);

-- 2) anon EXECUTE 없음 (20260621090000 이 이미 회수, 재확인)
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sync_schedule_board'
     AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'sync_schedule_board 는 anon EXECUTE 가 없다'
);

-- 3) service_role 유지 — Edge Function `sync-schedule-board-outbox` 경로 무회귀
SELECT ok(
  (SELECT bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE'))
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sync_schedule_board'),
  'sync_schedule_board 는 service_role EXECUTE 를 유지한다(cron→edge sync 경로 정상)'
);

-- 4) board_comments 블랭킷 SELECT 정책 부재 — 이게 있으면 bc_select 하드닝이 무효가 된다
SELECT is(
  (SELECT count(*)::int FROM pg_policy
   WHERE polrelid = 'public.board_comments'::regclass
     AND polname = 'board_comments_select_all'),
  0,
  'board_comments_select_all USING(true) 블랭킷이 제거되어 bc_select 하드닝이 실효한다'
);

SELECT * FROM finish();
ROLLBACK;
