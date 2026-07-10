-- ============================================================
-- 2026-07-10 board 투표/리액션 토글 호출자 바인딩 회귀 가드
--   (마이그 20260710000100)
-- 검증:
--   1) 위조 호출(caller uid <> p_user_id, 비admin) → PERMISSION_DENIED
--   2) 미인증(auth.uid() NULL) → PERMISSION_DENIED
--   3) 구조: 함수 정의에 호출자 바인딩 가드 존재
-- 가드가 본문 최상단이라 위조/미인증 경로는 테이블 접근 전에 raise → 시드 불필요.
-- auth.uid() 는 request.jwt.claims 로 시뮬레이션. 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(6);

-- ── 1) toggle_board_post_vote 위조 차단 ─────────────────────────────────────
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub','11111111-1111-1111-1111-111111111111',
                     'app_metadata', jsonb_build_object('role','staff'))::text, true);
SELECT throws_ok(
  $$ SELECT public.toggle_board_post_vote('any-post-id',
       '22222222-2222-2222-2222-222222222222'::uuid, 'like') $$,
  NULL, 'PERMISSION_DENIED: 호출자 인증 불일치',
  'toggle_board_post_vote blocks caller<>p_user_id forgery');

-- 미인증 → PERMISSION_DENIED
SELECT set_config('request.jwt.claims', '', true);
SELECT throws_ok(
  $$ SELECT public.toggle_board_post_vote('any-post-id',
       '22222222-2222-2222-2222-222222222222'::uuid, 'like') $$,
  NULL, 'PERMISSION_DENIED: 호출자 인증 불일치',
  'toggle_board_post_vote blocks anon (NULL auth.uid)');

-- ── 2) toggle_comment_reaction 위조 차단 ────────────────────────────────────
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub','11111111-1111-1111-1111-111111111111',
                     'app_metadata', jsonb_build_object('role','staff'))::text, true);
SELECT throws_ok(
  $$ SELECT public.toggle_comment_reaction(
       '33333333-3333-3333-3333-333333333333'::uuid,
       '44444444-4444-4444-4444-444444444444'::uuid,
       '22222222-2222-2222-2222-222222222222'::uuid, 'like') $$,
  NULL, 'PERMISSION_DENIED: 호출자 인증 불일치',
  'toggle_comment_reaction blocks caller<>p_user_id forgery');

SELECT set_config('request.jwt.claims', '', true);
SELECT throws_ok(
  $$ SELECT public.toggle_comment_reaction(
       '33333333-3333-3333-3333-333333333333'::uuid,
       '44444444-4444-4444-4444-444444444444'::uuid,
       '22222222-2222-2222-2222-222222222222'::uuid, 'like') $$,
  NULL, 'PERMISSION_DENIED: 호출자 인증 불일치',
  'toggle_comment_reaction blocks anon (NULL auth.uid)');

-- ── 3) 구조 회귀 가드: 가드 관용구가 정의에 존재 ────────────────────────────
SELECT ok(
  pg_get_functiondef('public.toggle_board_post_vote(text, uuid, text)'::regprocedure)
    LIKE '%auth.uid() IS DISTINCT FROM p_user_id%',
  'toggle_board_post_vote definition contains caller-binding guard');
SELECT ok(
  pg_get_functiondef('public.toggle_comment_reaction(uuid, uuid, uuid, text)'::regprocedure)
    LIKE '%auth.uid() IS DISTINCT FROM p_user_id%',
  'toggle_comment_reaction definition contains caller-binding guard');

SELECT * FROM finish();
ROLLBACK;
