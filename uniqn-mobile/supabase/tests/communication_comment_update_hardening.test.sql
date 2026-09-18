-- ============================================================
-- ⚠️ 컬럼 단위 GRANT 는 이 스택에서 단언할 수 없다 (2026-09-18 실증)
--
--   마이그 20260910123555 는
--     REVOKE UPDATE ON board_comments FROM anon, authenticated;
--     GRANT  UPDATE (body, mentioned_user_ids, image_attachments,
--                    status, is_pinned, pinned_at, pinned_by) TO authenticated;
--   로 컬럼 단위 하드닝을 걸지만, pgTAP 하네스(`npm run test:db:helpers`)가
--   마이그 **뒤에** `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`
--   를 실행한다(supabase/fixtures/jpc_helpers.sql · ops_helpers.sql).
--   그래서 로컬·CI 에서는 테이블 단위 UPDATE 가 되살아나
--   `has_column_privilege('authenticated', …, 'post_id', 'UPDATE')` 이 항상 true 다.
--
--   픽스처의 블랭킷 GRANT 는 의도된 설계다(RLS 를 실제 보안경계로 두고 RLS 매트릭스
--   테스트를 CLI 버전과 무관하게 결정적으로 만들기 위함 — wiki decisions/test-db-grants).
--   그리고 픽스처에서 하드닝을 되살리면 이 단언은 **픽스처를 단언**하는 tautology 가 된다.
--   `REVOKE UPDATE ON TABLE` 은 컬럼 단위 GRANT 까지 함께 회수하므로(2026-09-18 실측:
--   REVOKE 후 body=false) 부분 복구도 불가능하다.
--
--   → 따라서 GRANT 계약은 prod 실측으로 검증하고(픽스처 주석의 anon write 회수와 같은
--     선례), 여기서는 **같은 계약을 실제로 지키는 층인 트리거**를 행동으로 단언한다.
--     트리거는 이 스택에서 비공허하게 검증되고, 계약 위반 시 실패한다.
-- ============================================================

BEGIN;
SELECT plan(13);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d1000000-0000-4000-8000-000000000001', '__ccuh_owner@test.local',  '{"role":"employer"}', '{}', now(), now()),
  ('d1000000-0000-4000-8000-000000000002', '__ccuh_author@test.local', '{"role":"staff"}', '{}', now(), now()),
  ('d1000000-0000-4000-8000-000000000003', '__ccuh_other@test.local',  '{"role":"staff"}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
VALUES
  ('d1000000-0000-4000-8000-000000000001', '__ccuh_owner@test.local',  'owner',  'employer', true, now(), now()),
  ('d1000000-0000-4000-8000-000000000002', '__ccuh_author@test.local', 'author', 'staff',    true, now(), now()),
  ('d1000000-0000-4000-8000-000000000003', '__ccuh_other@test.local',  'other',  'staff',    true, now(), now())
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

INSERT INTO public.workspaces (id, name, owner_id)
VALUES ('d1000000-0000-4000-8000-000000000010', '__ccuh_ws', 'd1000000-0000-4000-8000-000000000001');

INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status)
VALUES ('d1000000-0000-4000-8000-000000000020', '__ccuh_job',
        'd1000000-0000-4000-8000-000000000010', 'd1000000-0000-4000-8000-000000000001', 'active');

INSERT INTO public.board_posts
  (id, board_type, title, body, author_id, author_name, author_role, visibility,
   linked_job_posting_id, is_auto_created, status, is_locked)
VALUES
  ('schedule_d1000000-0000-4000-8000-000000000020', 'schedule', '__ccuh_room', 'body',
   'd1000000-0000-4000-8000-000000000001', 'owner', 'employer', 'participants_only',
   'd1000000-0000-4000-8000-000000000020', true, 'active', false),
  ('schedule_d1000000-0000-4000-8000-000000000021', 'schedule', '__ccuh_other_room', 'body',
   'd1000000-0000-4000-8000-000000000003', 'other', 'staff', 'participants_only',
   NULL, true, 'active', false);

INSERT INTO public.board_memberships
  (user_id, post_id, job_posting_id, role, can_read, can_comment, author_id)
VALUES
  ('d1000000-0000-4000-8000-000000000002',
   'schedule_d1000000-0000-4000-8000-000000000020',
   'd1000000-0000-4000-8000-000000000020', 'confirmed', true, true,
   'd1000000-0000-4000-8000-000000000001');

INSERT INTO public.board_comments
  (id, post_id, body, author_id, author_name, author_role, status)
VALUES
  ('d1000000-0000-4000-8000-000000000030',
   'schedule_d1000000-0000-4000-8000-000000000020', 'original',
   'd1000000-0000-4000-8000-000000000002', 'author', 'staff', 'active');

SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', 'd1000000-0000-4000-8000-000000000002',
                     'role', 'authenticated',
                     'app_metadata', jsonb_build_object('role', 'staff'))::text, true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ UPDATE public.board_comments SET body = 'edited' WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  'an active member can edit their own comment');

-- 위 헤더 참조 — GRANT 단언을 대신하는 행동 단언 2종.
SELECT throws_ok(
  $$ UPDATE public.board_comments SET post_id = 'schedule_d1000000-0000-4000-8000-000000000021'
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: immutable comment fields cannot be changed',
  'an author cannot re-route their comment to another post');

SELECT throws_ok(
  $$ UPDATE public.board_comments SET author_role = 'employer'
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: immutable comment fields cannot be changed',
  'an author cannot spoof their comment identity');

SELECT throws_ok(
  $$ UPDATE public.board_comments SET is_pinned = true, pinned_by = 'd1000000-0000-4000-8000-000000000002'
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: authors cannot moderate comments',
  'an author cannot pin their own comment');

SELECT throws_ok(
  $$ UPDATE public.board_comments SET status = 'deleted', body = 'rewritten while deleting',
       image_attachments = '[]'::jsonb, mentioned_user_ids = '{}'::text[],
       is_pinned = false, pinned_at = NULL, pinned_by = NULL
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: invalid comment status transition',
  'an author cannot rewrite content while deleting a comment');

RESET ROLE;
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', 'd1000000-0000-4000-8000-000000000001',
                     'role', 'authenticated',
                     'app_metadata', jsonb_build_object('role', 'employer'))::text, true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ UPDATE public.board_comments
     SET is_pinned = true, pinned_at = now(), pinned_by = 'd1000000-0000-4000-8000-000000000001'
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  'the schedule owner can moderate a participant comment');

SELECT throws_ok(
  $$ UPDATE public.board_comments SET pinned_at = NULL
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: pinned comments require pin metadata',
  'a pinned comment cannot lose required metadata');

SELECT lives_ok(
  $$ UPDATE public.board_comments
     SET is_pinned = false, pinned_at = NULL, pinned_by = NULL
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  'the schedule owner can consistently unpin a comment');

SELECT throws_ok(
  $$ UPDATE public.board_comments SET pinned_at = now()
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: unpinned comments cannot retain pin metadata',
  'an unpinned comment cannot retain pin metadata');

SELECT throws_ok(
  $$ UPDATE public.board_comments SET body = 'owner rewrite'
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: post authors cannot edit comment content',
  'the schedule owner cannot rewrite participant comment content');

SELECT lives_ok(
  $$ UPDATE public.board_comments
     SET status = 'hidden', body = '관리자에 의해 숨김된 댓글입니다.',
         image_attachments = '[]'::jsonb, mentioned_user_ids = '{}'::text[],
         is_pinned = false, pinned_at = NULL, pinned_by = NULL
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  'the schedule owner can hide a participant comment consistently');

SELECT throws_ok(
  $$ UPDATE public.board_comments
     SET is_pinned = true, pinned_at = now(), pinned_by = 'd1000000-0000-4000-8000-000000000001'
     WHERE id = 'd1000000-0000-4000-8000-000000000030' $$,
  '42501', 'PERMISSION_DENIED: inactive comments cannot be pinned',
  'the schedule owner cannot repin a hidden comment');

RESET ROLE;

SELECT is(
  (SELECT count(*)::int
   FROM public.notifications n
   WHERE n.type IN ('board_comment', 'board_reply', 'board_mention', 'board_locked')
     AND COALESCE(n.data ->> 'postId', '') <> ''
     AND n.data ->> 'postId' NOT LIKE 'notice_%'
     AND NOT EXISTS (
       SELECT 1 FROM public.board_posts bp WHERE bp.id = n.data ->> 'postId'
     )),
  0,
  'retired communication notifications do not point to missing posts');

SELECT * FROM finish();
ROLLBACK;
