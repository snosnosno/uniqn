-- ============================================================
-- 앱 내 채팅 S1 — 전송 · 사진 · 멱등 · 시간 순서 · rate limit · 나가기 · 읽음
-- ============================================================
-- 설계 §4 RPC 표(chat_send_message ①~⑪ · mark_read · hide · list · unread) · §4-2 L1·L3·L6
--
-- Red-Green 대상
--   · 사진 경로 접두사 검사 제거 → I1(남의 uid 경로) 이 성공으로 바뀌어 실패
--   · 멱등 충돌 시 sender 확인 제거 → P3 가 성공으로 바뀌어 실패
--   · created_at 을 now() 로 → T1(엄격 증가) 실패
--   · rate limit 호출 제거 → K1(31번째) 실패
--
-- 🚨 postgres 컨텍스트에서 공고 status 를 바꾸기 전에는 jpc_test_clear_user() — 남은 JWT 가
--    enforce_jp_status_transition 의 권한 검사에 걸린다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(37);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();   -- 서버 다크 착지를 이 트랜잭션에서만 공개 ON 으로

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('conv_app', chat_open_conversation(jpc_chat_id('jp'), jpc_chat_id('applicant')));
RESET ROLE;

-- ------------------------------------------------------------
-- G. 전송 게이트
-- ------------------------------------------------------------
SELECT jpc_test_clear_user();
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'hi', NULL, NULL, NULL, gen_random_uuid()) $$,
  'PERMISSION_DENIED%', 'G1 auth.uid() NULL → 거부');

SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'hi', NULL, NULL, NULL, gen_random_uuid()) $$,
  'PERMISSION_DENIED%', 'G2 비멤버 → 거부');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('viewer'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'hi', NULL, NULL, NULL, gen_random_uuid()) $$,
  'PERMISSION_DENIED%', 'G3 viewer 협업자 → 거부(D3)');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', '   ', NULL, NULL, NULL, gen_random_uuid()) $$,
  'INVALID_INPUT%', 'G4 공백뿐인 본문 → 거부');
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', repeat('가', 1001), NULL, NULL, NULL, gen_random_uuid()) $$,
  'INVALID_INPUT%', 'G5 1001자 → 거부');
SELECT lives_ok($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', repeat('가', 1000), NULL, NULL, NULL, gen_random_uuid()) $$,
  'G6 1000자 → 허용(경계)');
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'hi', NULL, NULL, NULL, NULL) $$,
  'INVALID_INPUT%', 'G7 client_message_id NULL → 거부');
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'system', 'hi', NULL, NULL, NULL, gen_random_uuid()) $$,
  'INVALID_INPUT%', 'G8 kind=system 은 클라가 보낼 수 없다');
RESET ROLE;

SELECT jpc_test_clear_user();
UPDATE public.job_postings SET status = 'closed' WHERE id = jpc_chat_id('jp');
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT lives_ok($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', '마감됐나요?', NULL, NULL, NULL, gen_random_uuid()) $$,
  'G9 마감된 공고에서도 전송(기간 무제한 — D2)');
RESET ROLE;
SELECT jpc_test_clear_user();
UPDATE public.job_postings SET status = 'cancelled' WHERE id = jpc_chat_id('jp');
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT lives_ok($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', '삭제됐네요', NULL, NULL, NULL, gen_random_uuid()) $$,
  'G10 삭제(soft cancelled)된 공고에서도 전송');
RESET ROLE;

-- ------------------------------------------------------------
-- I. 사진 — 경로 = <방>/<호출자>/<client_message_id>.<ext> 완전 일치 + 객체 실재
-- ------------------------------------------------------------
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('cm_other', gen_random_uuid());
SELECT jpc_chat_put('cm_missing', gen_random_uuid());
SELECT jpc_chat_put('cm_ok', gen_random_uuid());
SELECT jpc_chat_put('cm_upper', gen_random_uuid());
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('chat-media', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_other'))),
  ('chat-media', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_ok'))),
  ('chat-media', upper(format('%s/%s/%s', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_upper'))) || '.jpg'),
  ('boards',     format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_missing')));

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT throws_like(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '',
       format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_other')), 800, 600, jpc_chat_id('cm_other')) $$,
  'CHAT_IMAGE_INVALID%', 'I1 남의 uid 경로의 사진을 내 메시지로 → 거부(사칭 차단)');
SELECT throws_like(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '',
       format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_missing')), 800, 600, jpc_chat_id('cm_missing')) $$,
  'CHAT_IMAGE_INVALID%', 'I2 chat-media 에 실재하지 않는 객체(다른 버킷 동명 파일) → 거부(L2)');
SELECT throws_like(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '',
       upper(format('%s/%s/%s', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_upper'))) || '.jpg', 800, 600, jpc_chat_id('cm_upper')) $$,
  'CHAT_IMAGE_INVALID%', 'I3 비정규형(대문자) 경로 → 거부(L1)');
SELECT throws_like(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '',
       format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_ok')), 0, 600, jpc_chat_id('cm_ok')) $$,
  'CHAT_IMAGE_INVALID%', 'I4 가로 0 → 거부(L3)');
SELECT lives_ok(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '',
       format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_ok')), 800, 600, jpc_chat_id('cm_ok')) $$,
  'I5 대조군: 정상 경로 + 실재 객체 → 성공');
RESET ROLE;

-- ------------------------------------------------------------
-- P. 멱등 — 같은 client id 재전송은 1행, 다른 발신자의 같은 id 는 거부
-- ------------------------------------------------------------
SELECT jpc_chat_put('cm_dup', gen_random_uuid());
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('msg_dup', (chat_send_message(jpc_chat_id('conv'), 'text', 'dup-first', NULL, NULL, NULL, jpc_chat_id('cm_dup')) ->> 'messageId')::uuid);
SELECT is(
  (chat_send_message(jpc_chat_id('conv'), 'text', 'dup-second', NULL, NULL, NULL, jpc_chat_id('cm_dup')) ->> 'deduped'),
  'true', 'P1 같은 client id 재전송 → deduped=true');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE client_message_id = jpc_chat_id('cm_dup')), 1, 'P2 행은 1개뿐');
SELECT is((SELECT body FROM public.notifications
            WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message' AND is_read = false
              AND data ->> 'conversationId' = jpc_chat_id('conv')::text),
  'dup-first', 'P3 재전송은 알림을 건드리지 않는다(미리보기 불변)');
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'x', NULL, NULL, NULL, jpc_chat_id('cm_dup')) $$,
  'INVALID_INPUT%', 'P4 다른 발신자가 같은 client id → 거부(남의 메시지 id 탈취 차단)');
RESET ROLE;

-- ------------------------------------------------------------
-- T. 시간 순서 — 한 트랜잭션 안 연속 전송도 created_at 이 엄격히 증가
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('t1', (chat_send_message(jpc_chat_id('conv'), 'text', 't1', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
SELECT jpc_chat_put('t2', (chat_send_message(jpc_chat_id('conv'), 'text', 't2', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
RESET ROLE;
SELECT ok(
  (SELECT created_at FROM public.chat_messages WHERE id = jpc_chat_id('t2'))
    > (SELECT created_at FROM public.chat_messages WHERE id = jpc_chat_id('t1')),
  'T1 같은 트랜잭션 연속 전송의 created_at 이 엄격 증가(now() 면 동일값)');

-- ------------------------------------------------------------
-- H. 나가기 · 목록
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is(
  (SELECT my_side || ' / ' || counterpart_name FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')),
  'seeker / 사장닉', 'H1 구직자 목록: 내 쪽=seeker · 상대=공고 작성자 닉네임');
RESET ROLE;
SELECT set_config('chat.msgcount', (SELECT count(*)::text FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), true);

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_hide_conversation(jpc_chat_id('conv'));
SELECT is((SELECT count(*)::int FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')), 0,
  'H2 나간 방은 내 목록에서 빠진다');
RESET ROLE;
SELECT is((SELECT count(*)::text FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')),
  current_setting('chat.msgcount'), 'H3 나가기는 방·메시지를 지우지 않는다');

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('m_owner', (chat_send_message(jpc_chat_id('conv'), 'text', '네 가능합니다', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
SELECT ok(
  (SELECT my_side = 'employer' AND counterpart_name LIKE '구직자%' FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')),
  'H4 구인자 목록: 내 쪽=employer · 상대=구직자 표시 이름');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is(
  (SELECT unread_count || ' / ' || last_message_preview FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')),
  '1 / 네 가능합니다', 'H5 상대가 새 메시지를 보내면 다시 나타난다(미읽음 1 · 미리보기)');

-- 구인자 측 발신자 표시(M5 대칭) — editor 는 닉네임 없음, 실명 'jpc test'
SELECT jpc_test_set_user(jpc_chat_id('editor'));
SELECT jpc_chat_put('m_editor', (chat_send_message(jpc_chat_id('conv'), 'text', '담당자 답변', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
RESET ROLE;
SELECT is((SELECT sender_display_name FROM public.chat_messages WHERE id = jpc_chat_id('m_editor')), 'jpc test posting 담당자',
  'H6 닉네임 없는 구인자 측 발신자는 실명이 아니라 "<공고 제목> 담당자"(09-26 — 업장명 아님)');
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('m_owner', (chat_send_message(jpc_chat_id('conv'), 'text', '다시 확인드려요', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));

-- ------------------------------------------------------------
-- R. 읽음 커서
-- ------------------------------------------------------------
SELECT chat_mark_read(jpc_chat_id('conv'), jpc_chat_id('m_owner'));
SELECT is((SELECT unread_count FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')), 0,
  'R1 최신까지 읽으면 미읽음 0');
SELECT chat_mark_read(jpc_chat_id('conv'), jpc_chat_id('t1'));
SELECT is((SELECT last_read_message_id FROM public.chat_read_states
            WHERE conversation_id = jpc_chat_id('conv') AND user_id = jpc_chat_id('seeker')),
  jpc_chat_id('m_owner'), 'R2 과거 메시지 id 로 읽음 처리해도 커서가 역행하지 않는다');
SELECT throws_like($$ SELECT chat_mark_read(jpc_chat_id('conv_app'), jpc_chat_id('m_owner')) $$,
  'PERMISSION_DENIED%', 'R3 내 방이 아니면 읽음 처리 거부');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_mark_read(jpc_chat_id('conv_app'), jpc_chat_id('m_owner')) $$,
  'INVALID_INPUT%', 'R4 다른 방의 메시지 id 로 읽음 처리 → 거부');
RESET ROLE;

-- 99 캡 — 구인자 측 메시지 120건을 직접 적재(발신 rate limit 우회용 신뢰 컨텍스트)
SELECT jpc_test_clear_user();
INSERT INTO public.chat_messages (conversation_id, sender_id, sender_side, sender_display_name, kind, body, client_message_id, created_at)
SELECT jpc_chat_id('conv'), jpc_chat_id('owner'), 'employer', '사장닉', 'text', 'bulk ' || g, gen_random_uuid(), clock_timestamp()
  FROM generate_series(1, 120) g;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is(chat_unread_total(), 99, 'R5 chat_unread_total 은 99 에서 캡');
SELECT is((SELECT unread_count FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')), 99,
  'R6 방 목록의 unread_count 도 99 캡');
RESET ROLE;

-- ------------------------------------------------------------
-- K. 전송 rate limit — 분당 30, 31번째 거부
-- ------------------------------------------------------------
DO $$
BEGIN
  PERFORM jpc_test_set_user(jpc_chat_id('applicant'));
  FOR i IN 1..30 LOOP
    PERFORM chat_send_message(jpc_chat_id('conv_app'), 'text', 'rl ' || i, NULL, NULL, NULL, gen_random_uuid());
  END LOOP;
END $$;
SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv_app'), 'text', 'rl 31', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_RATE_LIMITED%', 'K1 60초 안 31번째 전송 → CHAT_RATE_LIMITED');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.chat_messages
            WHERE conversation_id = jpc_chat_id('conv_app') AND sender_id = jpc_chat_id('applicant')),
  30, 'K2 대조군: 앞선 30건은 모두 저장됐다');

-- ------------------------------------------------------------
-- C. 상대 탈퇴(seeker_id NULL) — 구인자 측 전송 차단
-- ------------------------------------------------------------
SELECT jpc_test_clear_user();
UPDATE public.chat_conversations SET seeker_id = NULL WHERE id = jpc_chat_id('conv_app');
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv_app'), 'text', '계세요?', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_COUNTERPART_GONE%', 'C1 상대(구직자)가 탈퇴한 방 → CHAT_COUNTERPART_GONE');
SELECT lives_ok($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', '대조군', NULL, NULL, NULL, gen_random_uuid()) $$,
  'C2 대조군: 상대가 있는 방은 같은 사람이 보낼 수 있다');
RESET ROLE;

-- ------------------------------------------------------------
-- L6. 정지 사용자 전송 차단
-- ------------------------------------------------------------
SELECT jpc_test_clear_user();
UPDATE public.users SET status = 'suspended' WHERE id = jpc_chat_id('seeker');
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'x', NULL, NULL, NULL, gen_random_uuid()) $$,
  'PERMISSION_DENIED%', 'L6 정지(suspended) 사용자는 전송할 수 없다');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
