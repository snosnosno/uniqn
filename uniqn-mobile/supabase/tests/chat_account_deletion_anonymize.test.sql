-- ============================================================
-- 앱 내 채팅 S4-3 — 탈퇴 익명화(D5) + 사진 삭제 큐(M7) (마이그 20260925230000)
-- ============================================================
-- 계획: docs/planning/2026-09-25-chat-s4-safety-plan.md "탈퇴 익명화" · 설계 §4-2 M7 · D5·D12
--
-- 고정하려는 계약
--   ① 탈퇴자 발신 메시지 = 본문·사진 삭제 + '[탈퇴한 사용자]' (sender_id 는 FK SET NULL)
--   ② 탈퇴자가 구직자인 방의 이름 스냅샷 익명화
--   ③ 상대가 받은 채팅 알림 미리보기 비움 · 구직자 이름 제목 → '[탈퇴한 사용자]'
--   ④ 탈퇴자 사진(chat-media·접수함) → 삭제 큐. **신고 증거 사진은 제외**(D12)
--   ⑤ 상대(owner) 메시지·신고 스냅샷은 그대로(대조군)
--
-- Red-Green: 익명화 UPDATE(②-메시지) 제거 → A4·A5 실패 · 증거 제외 조건 제거 → A3 실패
-- ⚠️ storage.objects 는 SQL DELETE 가 트리거로 금지 — 큐에 적재만 하고 파일 삭제는 EF 몫이다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(14);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '첫 문의 — 연락처 010-1234-5678', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;

-- 사진 4장 — EF 가 쓴 것처럼 postgres 로
--   img_a  : 신고 메시지 **앞**에 보낸 사진 → 스냅샷 문맥에 들어가 증거가 된다(큐 제외)
--   img_ev : 신고된 사진(증거, 큐 제외)
--   img_af : 신고 **뒤**에 보낸 사진 → 스냅샷 밖(큐 적재 대조군)
--   img_in : 접수함에 남은 사진(큐 적재)
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('cm_a', gen_random_uuid());
SELECT jpc_chat_put('cm_ev', gen_random_uuid());
SELECT set_config('chat.img_a',  format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_a')), true);
SELECT set_config('chat.img_ev', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_ev')), true);
SELECT set_config('chat.img_in', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), gen_random_uuid()), true);
SELECT jpc_chat_put('cm_af', gen_random_uuid());
SELECT set_config('chat.img_af', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_af')), true);
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('chat-media', current_setting('chat.img_a')),
  ('chat-media', current_setting('chat.img_ev')),
  ('chat-media', current_setting('chat.img_af')),
  ('chat-media-inbox', current_setting('chat.img_in'));

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.img_a'), 800, 600, jpc_chat_id('cm_a'));
SELECT jpc_chat_put('m_ev', (chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.img_ev'), 800, 600, jpc_chat_id('cm_ev')) ->> 'messageId')::uuid);
RESET ROLE;

-- owner: 답장 · 읽음(다음 구직자 메시지가 새 알림 행 = 제목이 구직자 이름) · 증거 사진 신고
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'owner 답장 — 보존돼야 한다', NULL, NULL, NULL, gen_random_uuid());
SELECT chat_mark_read(jpc_chat_id('conv'), jpc_chat_id('m_ev'));
SELECT jpc_chat_put('rep', chat_report_message(jpc_chat_id('m_ev'), 'sexual'));
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '두 번째 알림 행을 만드는 메시지', NULL, NULL, NULL, gen_random_uuid());
SELECT chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.img_af'), 800, 600, jpc_chat_id('cm_af'));
RESET ROLE;

SELECT jpc_test_clear_user();
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'chat_message' AND recipient_id = jpc_chat_id('owner') AND data ->> 'senderId' = jpc_chat_id('seeker')::text
      AND body <> ''),
  2, 'A0 대조군: 탈퇴 전 owner 는 구직자발 채팅 알림 2행(미리보기 있음)을 갖고 있다');

-- 본인 탈퇴(가드 [2] 본인 경로)
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT lives_ok($$ SELECT public.permanently_delete_user(jpc_chat_id('seeker')) $$,
  'A1 채팅 이력(메시지·사진·신고 대상)이 있어도 탈퇴가 끝까지 성공한다');
RESET ROLE;
SELECT jpc_test_clear_user();

-- ④ 삭제 큐
SELECT is(
  (SELECT string_agg(bucket_id || ':' || (object_name = current_setting('chat.img_af'))::text
                                 || (object_name = current_setting('chat.img_in'))::text || ':' || reason,
                     ' | ' ORDER BY bucket_id)
     FROM public.chat_media_deletion_queue),
  'chat-media:truefalse:account_deleted | chat-media-inbox:falsetrue:account_deleted',
  'A2 신고 뒤에 보낸 사진과 접수함 사진이 삭제 큐에 — reason=account_deleted');
SELECT is(
  (SELECT count(*)::int FROM public.chat_media_deletion_queue
    WHERE object_name IN (current_setting('chat.img_ev'), current_setting('chat.img_a'))),
  0, 'A3 신고 증거 사진(신고된 사진 + 스냅샷 문맥 사진)은 큐에 넣지 않는다(D12 — 처리 후 1년 보존)');

-- ① 메시지 익명화
SELECT is(
  (SELECT count(*)::int FROM public.chat_messages
    WHERE conversation_id = jpc_chat_id('conv') AND sender_side = 'seeker'),
  5, 'A4a 대조군: 구직자 메시지 5개는 행으로 남는다(삭제가 아니라 익명화)');
SELECT is(
  (SELECT count(*)::int FROM public.chat_messages
    WHERE conversation_id = jpc_chat_id('conv') AND sender_side = 'seeker'
      AND body = '' AND image_path IS NULL AND image_width IS NULL AND deleted_at IS NOT NULL
      AND sender_display_name = '[탈퇴한 사용자]' AND sender_id IS NULL),
  5, 'A4 구직자 메시지 5개 모두 본문·사진 삭제 · [탈퇴한 사용자] · sender_id NULL');
SELECT is(
  (SELECT count(*)::int FROM public.chat_messages
    WHERE conversation_id = jpc_chat_id('conv') AND (body LIKE '%010-1234-5678%' OR image_path IS NOT NULL)
      AND sender_side = 'seeker'),
  0, 'A5 연락처가 든 본문·사진 경로가 남지 않는다');
SELECT is(
  (SELECT body FROM public.chat_messages
    WHERE conversation_id = jpc_chat_id('conv') AND sender_side = 'employer'),
  'owner 답장 — 보존돼야 한다', 'A6 대조군: 상대(owner) 메시지는 그대로');

-- ② 방
SELECT is(
  (SELECT seeker_display_name || ':' || (seeker_id IS NULL)::text FROM public.chat_conversations WHERE id = jpc_chat_id('conv')),
  '[탈퇴한 사용자]:true', 'A7 방의 구직자 이름 익명화 · seeker_id NULL(FK SET NULL)');

-- ③ 상대가 받은 알림
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'chat_message' AND recipient_id = jpc_chat_id('owner') AND data ->> 'senderId' = jpc_chat_id('seeker')::text
      AND body <> ''),
  0, 'A8 owner 가 받은 구직자발 알림 미리보기가 모두 비었다(D4 사본 제거)');
SELECT is(
  (SELECT string_agg(title, ' | ' ORDER BY created_at) FROM public.notifications
    WHERE type = 'chat_message' AND recipient_id = jpc_chat_id('owner') AND data ->> 'senderId' = jpc_chat_id('seeker')::text),
  '새 채팅 문의 | [탈퇴한 사용자]', 'A9 제목: "새 채팅 문의"는 유지, 구직자 이름 제목은 [탈퇴한 사용자]');

-- ⑤ 신고 증거(D12)
SELECT is(
  (SELECT snapshot -> 'imagePaths' ? current_setting('chat.img_ev') FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep')),
  true, 'A10 신고 스냅샷의 증거 경로는 탈퇴 뒤에도 남는다');

-- 권한 불변(CREATE OR REPLACE — DROP+CREATE 였다면 anon 이 부활)
SELECT ok(NOT has_function_privilege('anon', 'public.permanently_delete_user(uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.permanently_delete_user(uuid)', 'EXECUTE'),
  'A11 anon 실행 불가 · authenticated 실행 가능 유지');
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_media_deletion_queue'),
  0, 'A12 삭제 큐는 정책 0(deny-all — EF 전용)');

SELECT * FROM finish();
ROLLBACK;
