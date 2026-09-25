-- ============================================================
-- 앱 내 채팅 S1 — chat-media 버킷 · storage 정책 행동 관측 (마이그 20260925100000)
-- ============================================================
-- 설계 §3-5 storage 행 · §4 사진 흐름 · §4-2 H1·M6·L1·L5
--   · 경로 규약 '<방 id>/<발신자 uid>/<client_message_id>.<jpg|png|webp>' (소문자 uuid)
--   · INSERT = 방 멤버 AND 2세그먼트=본인 AND 상대 탈퇴 아님 AND 최근 10분 업로드 < 20
--   · SELECT = 내가 올린 것 OR (삭제 안 된 메시지가 참조하는 사진 AND 내가 그 방 멤버)
--     → 상대가 올렸지만 **보내지 않은** 사진은 목록·서명 URL 로도 못 본다(H1)
--
-- 🚨 storage 정책은 public 스키마 밖이라 parity 가드가 세지 않는다 → 여기서 행동으로 본다.
-- 🚨 용량·MIME 은 Storage API 계층에서만 적용된다 — SQL INSERT 로 "5MB 초과 거부"를 단언하면
--    항상 통과(공허). 그래서 storage.buckets 행을 **정확 일치**로 단언한다.
-- 🚨 버킷 조건 없는 PERMISSIVE 정책이 하나라도 생기면 OR 결합으로 chat-media 가 통째로 열린다
--    → L5 가드. (baseline 은 storage 정책 생성 실패를 삼킨다 — 이 마이그는 삼키지 않는다)
--
-- 🔒 (S4 보안 M1 — 마이그 20260925220000) 앱은 chat-media 에 직접 올리지 못한다. 업로드 = 접수함
--    chat-media-inbox(정책 chat_media_inbox_insert_member · 판정 chat_media_can_stage), 정화된 사본을
--    EF(service_role)가 chat-media 에 쓴다. 그래서 U 절의 업로드 단언은 전부 접수함을 겨누고,
--    R 절의 사진은 EF 가 쓴 것처럼 postgres 로 chat-media 에 넣는다.
--
-- Red-Green: chat_media_can_read 에서 "참조된 사진만" 조건을 빼면 R2 가 1 로 실패해야 한다.
--            chat_media_can_write 를 S1 본문으로 되돌리면 U0 이 성공으로 바뀌어 실패해야 한다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(32);

-- ------------------------------------------------------------
-- B. 버킷 · 정책 형상
-- ------------------------------------------------------------
SELECT is(
  (SELECT row(public, file_size_limit, allowed_mime_types)::text FROM storage.buckets WHERE id = 'chat-media'),
  '(f,1572864,"{image/jpeg,image/png,image/webp}")',
  'B1 chat-media = 비공개 · 1.5MB(1600px JPEG 재인코딩 기준) · jpeg/png/webp 만(SVG·GIF 제외)');

SELECT is(
  (SELECT string_agg(policyname || ':' || cmd || ':' || permissive || ':' || roles::text, ' | ' ORDER BY policyname)
     FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'chat\_media\_%'),
  'chat_media_inbox_insert_member:INSERT:PERMISSIVE:{authenticated} | chat_media_insert_member:INSERT:PERMISSIVE:{authenticated} | chat_media_select_member:SELECT:PERMISSIVE:{authenticated}',
  'B2 채팅 사진 정책은 접수함 INSERT · chat-media INSERT(함수가 false) · chat-media SELECT 3개뿐(UPDATE·DELETE 없음 = 정리는 service_role 만)');

SELECT is(
  (SELECT row(public, file_size_limit, allowed_mime_types)::text FROM storage.buckets WHERE id = 'chat-media-inbox'),
  '(f,1572864,{image/jpeg})',
  'B4 chat-media-inbox = 비공개 · 1.5MB · JPEG 만(앱은 항상 JPEG 로 재인코딩)');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND permissive = 'PERMISSIVE'
      AND coalesce(qual, '') || coalesce(with_check, '') !~ 'bucket_id = ''[^'']+''::text'),
  0, 'B3 버킷 리터럴 조건(bucket_id = ''…'') 없는 PERMISSIVE storage 정책 0 (L5 — `bucket_id IS NOT NULL` 같은 형태도 잡는다)');

-- ------------------------------------------------------------
-- 시드
-- ------------------------------------------------------------
SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();   -- 서버 다크 착지를 이 트랜잭션에서만 공개 ON 으로
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('conv_app', chat_open_conversation(jpc_chat_id('jp'), jpc_chat_id('applicant')));
RESET ROLE;
SELECT jpc_chat_put('cm1', gen_random_uuid());
SELECT set_config('chat.obj1', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm1')), true);

-- ------------------------------------------------------------
-- U. 업로드(INSERT) — 접수함(chat-media-inbox)
-- ------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', current_setting('chat.obj1')); $$,
  '42501', NULL, 'U0 🔒 멤버라도 chat-media 에 직접 올릴 수 없다(M1 — 정화 안 된 원본 차단)');
RESET ROLE;

SELECT lives_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media-inbox', current_setting('chat.obj1')); $$,
  'U1 멤버가 <방>/<나>/<id>.jpg 에 업로드 → 허용');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), gen_random_uuid())); $$,
  '42501', NULL, 'U2 남의 uid 경로 업로드 → 42501');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('third'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('third'), gen_random_uuid())); $$,
  '42501', NULL, 'U3 비멤버가 그 방 경로(본인 uid)에 업로드 → 42501');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('not-a-uuid/%s/%s.jpg', jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U4 1세그먼트가 uuid 가 아니면 캐스트 예외(22P02) 없이 RLS 거부');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', upper(format('%s/%s/%s', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())) || '.jpg'); $$,
  '42501', NULL, 'U5 대문자(비정규형) 경로 → 거부(L1 — purge 누락 방지)');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/x/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U6 3단 경로 → 거부(L1)');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.svg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U7 svg 등 허용 확장자 밖 → 거부');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.png', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U7b 접수함은 .jpg 만 — png 경로 거부(정화기는 JPEG 만 다룬다)');
RESET ROLE;

-- 상대 탈퇴 방에는 올릴 수 없다 / 대조군: 상대가 있는 방은 된다
SELECT jpc_test_clear_user();
UPDATE public.chat_conversations SET seeker_id = NULL WHERE id = jpc_chat_id('conv_app');
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('owner'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv_app'), jpc_chat_id('owner'), gen_random_uuid())); $$,
  '42501', NULL, 'U8 상대가 탈퇴한 방 → 업로드 거부');
RESET ROLE;
SELECT lives_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('owner'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), gen_random_uuid())); $$,
  'U9 대조군: 같은 사람이 상대가 있는 방에는 올린다');
RESET ROLE;

-- M6 — 최근 10분 업로드 20개 한도 (U1 로 이미 1개)
DO $$
BEGIN
  PERFORM jpc_test_set_user(jpc_chat_id('seeker'));
  FOR i IN 2..20 LOOP
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid()));
  END LOOP;
END $$;
RESET ROLE;
SELECT is((SELECT count(*)::int FROM storage.objects
            WHERE bucket_id = 'chat-media-inbox' AND name LIKE jpc_chat_id('conv') || '/' || jpc_chat_id('seeker') || '/%'),
  20, 'U10 대조군: 10분 안 20개까지는 올라간다');
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U11 21번째 → 거부(M6 — 무료 1GB 고갈 방어)');
RESET ROLE;

-- 하루 60장 누적 한도(보안 H-1) — 10분 창을 비운 뒤에도 24시간 합계로 막힌다
SELECT jpc_test_clear_user();
UPDATE storage.objects SET created_at = now() - interval '2 hours'
 WHERE bucket_id = 'chat-media-inbox' AND split_part(name, '/', 2) = jpc_chat_id('seeker')::text;
INSERT INTO storage.objects (bucket_id, name, created_at)
SELECT 'chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid()), now() - interval '1 hour'
  FROM generate_series(1, 40);
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U12 24시간 안 60장 → 10분 창이 비어도 거부');
RESET ROLE;
SELECT jpc_test_clear_user();
UPDATE storage.objects SET created_at = now() - interval '2 days'
 WHERE id = (SELECT id FROM storage.objects
              WHERE bucket_id = 'chat-media-inbox' AND split_part(name, '/', 2) = jpc_chat_id('seeker')::text
                AND name <> current_setting('chat.obj1')
              ORDER BY created_at LIMIT 1);
SELECT lives_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  'U13 대조군: 하나가 24시간 밖으로 나가 59장이 되면 다시 올라간다');
RESET ROLE;

-- ------------------------------------------------------------

-- 차단된 방(S4-1)에는 올릴 수 없다
SELECT jpc_test_clear_user();
UPDATE storage.objects SET created_at = now() - interval '3 days'
 WHERE bucket_id IN ('chat-media', 'chat-media-inbox') AND split_part(name, '/', 2) = jpc_chat_id('seeker')::text;
INSERT INTO public.chat_blocks (conversation_id, blocked_by_side) VALUES (jpc_chat_id('conv'), 'employer');
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U14 차단된 방 → 접수함 업로드 거부');
RESET ROLE;
SELECT jpc_test_clear_user();
DELETE FROM public.chat_blocks WHERE conversation_id = jpc_chat_id('conv');
SELECT lives_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  'U14b 대조군: 차단을 풀면 같은 업로드가 된다(U14 가 한도 탓이 아님)');
RESET ROLE;
SELECT jpc_test_clear_user();

-- 한도는 두 버킷 합산 — 정화돼 chat-media 로 옮겨진 사본도 센다(접수함에서 지워지므로)
INSERT INTO storage.objects (bucket_id, name)
SELECT 'chat-media', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())
  FROM generate_series(1, 20);
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('seeker'));
     INSERT INTO storage.objects (bucket_id, name)
     VALUES ('chat-media-inbox', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid())); $$,
  '42501', NULL, 'U15 최근 10분 chat-media 사본 20장 → 접수함 업로드 거부(두 버킷 합산)');
RESET ROLE;
SELECT jpc_test_clear_user();
-- storage.objects 는 SQL DELETE 가 트리거로 금지(Storage API 전용) — 한도 창 밖으로 밀어 정리한다
UPDATE storage.objects SET created_at = now() - interval '3 days'
 WHERE bucket_id = 'chat-media' AND split_part(name, '/', 2) = jpc_chat_id('seeker')::text;

-- R 절 준비: EF 가 정화해 chat-media 에 쓴 것처럼(service_role 경로) postgres 로 넣는다
INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', current_setting('chat.obj1'));

-- R. 읽기(SELECT = 목록·다운로드·서명 URL 의 전제)
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  1, 'R1 올린 본인은 아직 보내지 않은 사진도 본다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  0, 'R2 상대는 올렸지만 보내지 않은 사진을 못 본다(H1)');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('img_msg', (chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.obj1'), 800, 600, jpc_chat_id('cm1')) ->> 'messageId')::uuid);
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  1, 'R3 메시지로 보낸 뒤에는 상대(owner)가 본다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  1, 'R4 구인자 측 manager 도 본다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  0, 'R5 제3자는 못 본다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('viewer'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  0, 'R6 viewer 협업자는 못 본다');
RESET ROLE;

-- 삭제된 메시지의 사진은 더 이상 상대에게 보이지 않는다(H1). 두 상태를 따로 본다:
--   R7a deleted_at 만 찍히고 image_path 는 남은 상태(CHECK 가 허용) — deleted_at 조건이 막는다
--   R7b 익명화(image_path NULL) — 참조 자체가 사라진다
-- R7a 가 없으면 chat_media_can_read 의 `deleted_at IS NULL` 을 지워도 초록이다(DB 리뷰 L-7b)
SELECT jpc_test_clear_user();
UPDATE public.chat_messages SET deleted_at = now() WHERE id = jpc_chat_id('img_msg');
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  0, 'R7a 삭제 표시(deleted_at)만 된 사진도 상대가 못 본다');
RESET ROLE;
SELECT jpc_test_clear_user();
UPDATE public.chat_messages SET body = '', image_path = NULL WHERE id = jpc_chat_id('img_msg');
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.obj1')),
  0, 'R7b 익명화(image_path NULL)된 메시지의 사진도 상대가 못 본다');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is(chat_media_can_read('not-a-uuid/x/y.jpg'), false, 'R8 형식 틀린 경로는 예외 없이 false');
SELECT is(chat_media_can_read(NULL), false, 'R9 NULL 경로 → false');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
