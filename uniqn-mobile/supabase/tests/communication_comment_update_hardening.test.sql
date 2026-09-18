-- ============================================================
-- ⚠️ 컬럼 단위 GRANT 는 `has_column_privilege` 로 단언할 수 없다 — `attacl` 로 단언한다
--    (2026-09-18 실증)
--
--   마이그 20260910123555 는
--     REVOKE UPDATE ON board_comments FROM anon, authenticated;
--     GRANT  UPDATE (body, mentioned_user_ids, image_attachments,
--                    status, is_pinned, pinned_at, pinned_by, updated_at) TO authenticated;
--   로 컬럼 단위 하드닝을 건다. 그런데 pgTAP 하네스(`npm run test:db:helpers`)가
--   마이그 **뒤에** `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`
--   를 실행한다(supabase/fixtures/jpc_helpers.sql:48 · ops_helpers.sql:10).
--   그래서 테이블 단위 UPDATE 가 되살아나
--   `has_column_privilege('authenticated', …, 'post_id', 'UPDATE')` 이 **항상 true** 다.
--   픽스처의 블랭킷 GRANT 는 의도된 설계이므로(RLS 를 실제 보안경계로 두고 RLS 매트릭스
--   테스트를 CLI 버전과 무관하게 결정적으로 만든다 — wiki decisions/test-db-grants)
--   픽스처를 고쳐 풀 문제가 아니다. 그리고 픽스처 뒤에서 하드닝을 되살리는 것도 답이 아니다:
--     · `REVOKE UPDATE ON TABLE` 은 컬럼 단위 GRANT 까지 함께 회수한다
--       (실측: REVOKE 후 body=false) → 부분 복구 불가
--     · 테스트가 마이그와 같은 REVOKE+GRANT 를 다시 실행한 뒤 단언하면, 그것은
--       **테스트 자신의 문장을 단언**하는 tautology 다. 마이그가 post_id 를 열어도 통과한다.
--
--   🔑 해법: 두 ACL 은 **서로 다른 카탈로그**에 산다.
--     · 테이블 단위 GRANT → `pg_class.relacl`   ← 픽스처가 덮는 곳
--     · 컬럼 단위 GRANT   → `pg_attribute.attacl` ← 마이그만 쓰는 곳, 픽스처가 못 덮는다
--   실측(픽스처 적용 후 상태): 화이트리스트 8컬럼만 `{authenticated=w/postgres}` 이고
--   post_id · author_role · author_id · id 는 attacl 이 NULL 이다.
--   따라서 `attacl` 을 단언하면 픽스처와 무관하게 마이그의 화이트리스트를 **비공허하게**
--   검증할 수 있다. 화이트리스트가 넓어지면 이 단언이 깨진다.
--
--   아래는 두 층을 모두 단언한다: GRANT 화이트리스트(attacl) + 같은 계약을 런타임에
--   지키는 트리거(행동).
-- ============================================================

BEGIN;
SELECT plan(15);

-- GRANT 층 — 마이그 20260910123555 의 컬럼 화이트리스트가 그대로인지.
-- `attacl` 을 보므로 픽스처의 테이블 단위 블랭킷 GRANT 에 오염되지 않는다.
SELECT is(
  (SELECT COALESCE(string_agg(a.attname, ',' ORDER BY a.attname), '(없음)')
   FROM pg_attribute a
   CROSS JOIN LATERAL aclexplode(a.attacl) x
   WHERE a.attrelid = 'public.board_comments'::regclass
     AND a.attnum > 0 AND NOT a.attisdropped
     AND x.grantee = 'authenticated'::regrole
     AND x.privilege_type = 'UPDATE'),
  -- 정본 = 마이그 20260910123555 의 `GRANT UPDATE (...) TO authenticated` 8컬럼
  'body,image_attachments,is_pinned,mentioned_user_ids,pinned_at,pinned_by,status,updated_at',
  'authenticated 의 컬럼 단위 UPDATE 화이트리스트가 마이그 계약과 정확히 일치(라우팅·신원 컬럼 부재)');

SELECT is(
  (SELECT count(*)::int
   FROM pg_attribute a
   CROSS JOIN LATERAL aclexplode(a.attacl) x
   WHERE a.attrelid = 'public.board_comments'::regclass
     AND a.attnum > 0 AND NOT a.attisdropped
     AND x.grantee = 'anon'::regrole),
  0,
  'anon 에게는 board_comments 컬럼 단위 권한이 하나도 없다');

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
