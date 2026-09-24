-- ============================================================
-- 앱 내 채팅 S1 — 탈퇴 크론이 채팅 이력 때문에 죽지 않는다 (FK ON DELETE)
-- ============================================================
-- 설계 §4 "FK ON DELETE 가 탈퇴 크론의 생사를 가른다" · §14-8 R5
--   permanently_delete_user 는 `DELETE FROM public.users` 를 한다(20260807150000:132).
--   채팅 FK 하나라도 NO ACTION 이면 채팅 이력 있는 사용자는 **영원히** 탈퇴 실패하고,
--   EF 가 행 단위 예외를 삼켜 "매일 돌지만 처리 0" 이 무음으로 재현된다.
--   → 발신자·구직자·개설자 = SET NULL, 읽음 상태 = CASCADE, 방 → 공고 = CASCADE.
--
-- Red-Green: 아무 채팅 FK 하나를 NO ACTION 으로 바꾸면 F1 과 D1 이 23503 으로 실패해야 한다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(9);

-- ------------------------------------------------------------
-- F. 정적 — FK 삭제 규칙
-- ------------------------------------------------------------
SELECT is(
  (SELECT string_agg(conrelid::regclass::text || '.' || a.attname || '=' || confdeltype::text, ', '
                     ORDER BY conrelid::regclass::text, a.attname)
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid IN ('public.chat_conversations'::regclass, 'public.chat_messages'::regclass,
                         'public.chat_read_states'::regclass)),
  'chat_conversations.created_by=n, chat_conversations.job_posting_id=c, chat_conversations.seeker_id=n, '
  || 'chat_messages.conversation_id=c, chat_messages.sender_id=n, '
  || 'chat_read_states.conversation_id=c, chat_read_states.user_id=c',
  'F1 채팅 FK 7개 — 사람 참조는 SET NULL(n)/CASCADE(c), NO ACTION(a) 0');

-- ------------------------------------------------------------
-- D. 행동 — 채팅 이력 있는 구직자·구인자를 실제로 DELETE
-- ------------------------------------------------------------
SELECT jpc_chat_seed_guc();
-- 다른 FK(지원서·워크스페이스 등)에 묶이지 않은 새 사용자 2명
SELECT jpc_chat_put('gone_seeker', jpc_test_create_user('staff'));
SELECT jpc_chat_put('gone_editor', jpc_test_create_user('employer'));
INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
VALUES (jpc_chat_id('ws'), jpc_chat_id('gone_editor'), 'editor', now());

SELECT jpc_test_set_user(jpc_chat_id('gone_seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '탈퇴 예정 구직자', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('gone_editor'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '탈퇴 예정 editor', NULL, NULL, NULL, gen_random_uuid());
SELECT chat_mark_read(jpc_chat_id('conv'), (SELECT last_message_id FROM public.chat_conversations WHERE id = jpc_chat_id('conv')));
RESET ROLE;
SELECT jpc_test_clear_user();

SELECT is((SELECT count(*)::int FROM public.chat_read_states
            WHERE user_id IN (jpc_chat_id('gone_seeker'), jpc_chat_id('gone_editor'))),
  2, 'D0 대조군: 두 사람의 읽음 커서가 존재한다');

SELECT lives_ok($$ DELETE FROM public.users WHERE id = jpc_chat_id('gone_seeker') $$,
  'D1 채팅 이력 있는 구직자 DELETE 성공(탈퇴 크론 경로)');
SELECT ok((SELECT seeker_id IS NULL AND created_by IS NULL FROM public.chat_conversations WHERE id = jpc_chat_id('conv')),
  'D2 방은 남고 seeker_id · created_by 는 NULL');

-- 채팅과 무관한 FK 정리(탈퇴 RPC 가 하는 일) — employer 가입 트리거가 만든 기본 워크스페이스 포함
DELETE FROM public.workspace_members WHERE user_id = jpc_chat_id('gone_editor');
DELETE FROM public.workspaces WHERE owner_id = jpc_chat_id('gone_editor');
SELECT lives_ok($$ DELETE FROM public.users WHERE id = jpc_chat_id('gone_editor') $$,
  'D3 채팅 이력 있는 구인자 측 DELETE 성공');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv') AND sender_id IS NULL),
  2, 'D4 두 사람의 메시지는 남고 sender_id 만 NULL');
SELECT is((SELECT count(*)::int FROM public.chat_read_states
            WHERE user_id IN (jpc_chat_id('gone_seeker'), jpc_chat_id('gone_editor'))),
  0, 'D5 읽음 커서는 CASCADE 로 사라진다');

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', '계세요?', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_COUNTERPART_GONE%', 'D6 구직자가 탈퇴한 방에 구인자 측 전송 → CHAT_COUNTERPART_GONE');
RESET ROLE;

-- 공고 hard-delete(운영자 수동) 시 방·메시지도 함께 사라진다
SELECT jpc_test_clear_user();
SELECT jpc_test_force_delete_jp(jpc_chat_id('jp'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0,
  'D7 공고 hard-delete 시 방은 CASCADE(soft delete 인 cancelled 에서는 남는다 — gates 테스트 G10)');

SELECT * FROM finish();
ROLLBACK;
