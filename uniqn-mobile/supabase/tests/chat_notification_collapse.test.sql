-- ============================================================
-- 앱 내 채팅 S1 — 알림 수신자 · 방 단위 collapse · EF 호출 수 · 카운터 (마이그 20260925100000)
-- 09-26 QA(마이그 20260926120000): 5분 흡수 제거 → 메시지마다 푸시, 알림함은 방당 1행 유지
-- ============================================================
-- 설계 §6 · §4-2 M3·M4 · D4(미리보기 60자 · 사진 "사진을 보냈어요" · category application)
--
-- 🚨 EF 호출 수를 net 큐로 세지 않는다
--    로컬엔 vault 시크릿이 없어 trigger_send_push_notification 이 net.http_post **전에** 반환한다
--    → net 큐는 항상 0 = 공허한 검증. 대신 테스트 안에 **스파이 STATEMENT 트리거**
--    (REFERENCING NEW TABLE)를 달아 그 문장의 new_rows 행 수 = EF 에 넘길 id 수를 기록한다.
--    실제 트리거와 같은 transition table 을 보므로 "연속 메시지도 EF 에 id 가 넘어간다"를 고정한다.
--    모든 0 단언 앞에 같은 스파이가 ≥1 을 기록한 대조군이 있다.
-- 🚨 notifications 를 세기 전 RESET ROLE — authenticated 면 RLS 로 남의 알림이 0 으로 보인다.
--
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(26);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();   -- 서버 다크 착지를 이 트랜잭션에서만 공개 ON 으로

-- 스파이: 알림 INSERT 문장마다 new_rows 중 chat_message 행 수를 기록
CREATE TABLE public.jpc_chat_spy (seq bigserial PRIMARY KEY, n int NOT NULL);
CREATE FUNCTION public.jpc_chat_spy_fn() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.jpc_chat_spy (n) SELECT count(*) FROM new_rows WHERE type = 'chat_message';
  RETURN NULL;
END $$;
CREATE TRIGGER jpc_chat_spy AFTER INSERT ON public.notifications
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.jpc_chat_spy_fn();

CREATE FUNCTION pg_temp.unread(p_user uuid, p_conv uuid) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = p_user AND type = 'chat_message' AND is_read = false
     AND data ->> 'conversationId' = p_conv::text $$;
CREATE FUNCTION pg_temp.counter(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT coalesce((SELECT unread_count FROM public.notification_counters WHERE user_id = p_user), 0) $$;
CREATE FUNCTION pg_temp.spy_last() RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.jpc_chat_spy)::text || ':' ||
         coalesce((SELECT n FROM public.jpc_chat_spy ORDER BY seq DESC LIMIT 1), -1)::text $$;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
RESET ROLE;
SELECT set_config('chat.c0', pg_temp.counter(jpc_chat_id('owner'))::text, true);

-- ------------------------------------------------------------
-- 1. 첫 메시지 — 수신자 = 구인자 측 − 보낸 사람, viewer 제외, owner=ws owner 중복 제거(M3)
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('m1', (chat_send_message(jpc_chat_id('conv'), 'text', 'first message', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
RESET ROLE;

SELECT is(pg_temp.unread(jpc_chat_id('owner'), jpc_chat_id('conv')), 1, 'N1 owner(=ws owner) 1행 — 중복 수신자여도 전송 성공(M3, 21000 없음)');
SELECT is(pg_temp.unread(jpc_chat_id('editor'), jpc_chat_id('conv')) || '/' || pg_temp.unread(jpc_chat_id('manager'), jpc_chat_id('conv')),
  '1/1', 'N2 ws editor · manager 협업자 각 1행');
SELECT is(pg_temp.unread(jpc_chat_id('viewer'), jpc_chat_id('conv')) || '/' || pg_temp.unread(jpc_chat_id('seeker'), jpc_chat_id('conv')),
  '0/0', 'N3 viewer · 보낸 사람 본인은 0 (N1·N2 가 대조군)');
SELECT is(pg_temp.spy_last(), '1:3', 'N4 대조군: 첫 메시지 문장의 new_rows = 수신자 3 → EF 1회에 id 3개');
SELECT is(
  (SELECT title || '|' || category::text || '|' || link || '|' || body || '|' || priority
     FROM public.notifications WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message'),
  '새 채팅 문의|application|/chat/' || jpc_chat_id('conv') || '|first message|normal',
  'N5 첫 문의 알림 형식: 제목 "새 채팅 문의" · category application · link /chat/{id} · 미리보기');
SELECT is(
  (SELECT data FROM public.notifications WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message'),
  jsonb_build_object('conversationId', jpc_chat_id('conv'), 'jobPostingId', jpc_chat_id('jp'),
                     'senderId', jpc_chat_id('seeker'), 'messageId', jpc_chat_id('m1')),
  'N6 data = {conversationId, jobPostingId, senderId, messageId}');
SELECT is(pg_temp.counter(jpc_chat_id('owner')), current_setting('chat.c0')::int + 1, 'N7 owner 배지 카운터 +1');

-- ------------------------------------------------------------
-- 2. 곧바로 온 두 번째 — 1행 유지 · 미리보기 교체 · **푸시 다시 1회** · 카운터 불변 (09-26)
-- ------------------------------------------------------------
SELECT jpc_chat_put('first_row', (SELECT id FROM public.notifications WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message' AND is_read = false));
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'second message', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT is(pg_temp.unread(jpc_chat_id('owner'), jpc_chat_id('conv')), 1, 'N8 곧바로 온 두 번째 메시지 — 미읽음 알림은 여전히 방당 1행');
SELECT ok(
  (SELECT body = 'second message' AND id <> jpc_chat_id('first_row') FROM public.notifications
    WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message' AND is_read = false),
  'N9 이전 행은 지워지고 최신 미리보기를 가진 새 행으로 교체');
SELECT is(pg_temp.spy_last(), '2:3', 'N10 두 번째 문장도 new_rows 3 → EF 에 id 3개(메시지마다 푸시)');
SELECT is(pg_temp.counter(jpc_chat_id('owner')), current_setting('chat.c0')::int + 1, 'N11 카운터 순증 0 (삭제 −1 · 삽입 +1)');

-- ------------------------------------------------------------
-- 3. 오래된 미읽음도 같은 규칙(옛 행 삭제 + 새 행). 다른 타입 알림은 보존
-- ------------------------------------------------------------
INSERT INTO public.notifications (recipient_id, type, category, title, body, data, created_at)
VALUES (jpc_chat_id('owner'), 'posting_announcement', 'job', '공지', '공지 본문',
        jsonb_build_object('conversationId', jpc_chat_id('conv')), now() - interval '6 minutes');
UPDATE public.notifications SET created_at = now() - interval '6 minutes'
 WHERE type = 'chat_message' AND data ->> 'conversationId' = jpc_chat_id('conv')::text;
SELECT jpc_chat_put('old_row', (SELECT id FROM public.notifications WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message'));
SELECT set_config('chat.c1', pg_temp.counter(jpc_chat_id('owner'))::text, true);

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'third message', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT ok(
  pg_temp.unread(jpc_chat_id('owner'), jpc_chat_id('conv')) = 1
  AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = jpc_chat_id('old_row')),
  'N12 6분 지난 미읽음 행은 지워지고 새 행 1개로 교체');
SELECT is(pg_temp.spy_last(), '4:3', 'N13 교체 문장은 다시 new_rows 3 → 새 푸시 1회');
SELECT is(pg_temp.counter(jpc_chat_id('owner')), current_setting('chat.c1')::int, 'N14 카운터 순증 0 (삭제 −1 · 삽입 +1)');
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE recipient_id = jpc_chat_id('owner') AND type = 'posting_announcement' AND is_read = false),
  1, 'N15 타입 격리: 같은 수신자의 6분 지난 미읽음 posting_announcement 는 보존');

-- ------------------------------------------------------------
-- 4. 구인자 측이 보내면 구직자 1명만 — 다른 구인자 측 멤버는 부르지 않는다
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'owner reply', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT is(
  (SELECT title || '|' || body FROM public.notifications
    WHERE recipient_id = jpc_chat_id('seeker') AND type = 'chat_message' AND is_read = false),
  '사장닉|owner reply', 'N16 구직자 알림: 제목=공고 작성자 닉네임(09-26 — 업장명 아님) · 미리보기');
SELECT is((SELECT body FROM public.notifications
            WHERE recipient_id = jpc_chat_id('editor') AND type = 'chat_message' AND is_read = false),
  'third message', 'N17 구인자 측 발신은 같은 편(editor) 알림을 건드리지 않는다');

-- ------------------------------------------------------------
-- 5. 미리보기 규칙 — 사진 · 60자
-- ------------------------------------------------------------
SELECT jpc_chat_put('cm_img', gen_random_uuid());
INSERT INTO storage.objects (bucket_id, name)
VALUES ('chat-media', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_img')));
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'image', '캡션도 있음',
  format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('seeker'), jpc_chat_id('cm_img')), 1600, 1200, jpc_chat_id('cm_img'));
RESET ROLE;
SELECT is((SELECT body FROM public.notifications WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message' AND is_read = false),
  '사진을 보냈어요', 'N18 사진 메시지 알림 본문은 항상 "사진을 보냈어요"(이미지 URL 미탑재)');

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', repeat('가', 100), NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT is((SELECT char_length(body) FROM public.notifications WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message' AND is_read = false),
  60, 'N19 미리보기는 60자로 자른다(D4)');

-- ------------------------------------------------------------
-- 6. 읽음은 내 알림만 (M4) — editor 가 읽어도 owner 배지는 그대로
-- ------------------------------------------------------------
SELECT set_config('chat.c_editor', pg_temp.counter(jpc_chat_id('editor'))::text, true);
SELECT jpc_test_set_user(jpc_chat_id('editor'));
SELECT chat_mark_read(jpc_chat_id('conv'), (SELECT last_message_id FROM public.chat_conversations WHERE id = jpc_chat_id('conv')));
RESET ROLE;
SELECT is(pg_temp.unread(jpc_chat_id('editor'), jpc_chat_id('conv')), 0, 'N20 읽은 사람(editor)의 방 알림은 읽음 처리');
SELECT is(pg_temp.unread(jpc_chat_id('owner'), jpc_chat_id('conv')), 1, 'N21 다른 구인자 측(owner)의 알림은 그대로(M4)');
SELECT is(pg_temp.counter(jpc_chat_id('editor')), current_setting('chat.c_editor')::int - 1, 'N22 editor 카운터 −1(기존 decrement 트리거)');

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'after read', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT ok(
  (SELECT count(*) = 1 AND bool_and(title LIKE '구직자%') FROM public.notifications
    WHERE recipient_id = jpc_chat_id('editor') AND type = 'chat_message' AND is_read = false),
  'N23 읽은 뒤 온 메시지는 즉시 새 알림(제목=구직자 표시 이름, 첫 문의 아님)');

-- ------------------------------------------------------------
-- 7. 뮤트 — muted_until 이 미래면 INSERT 단계에서 제외
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT jpc_chat_put('conv2', chat_open_conversation(jpc_chat_id('jp')));
RESET ROLE;
INSERT INTO public.chat_read_states (conversation_id, user_id, muted_until)
VALUES (jpc_chat_id('conv2'), jpc_chat_id('editor'), now() + interval '1 day');
SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT chat_send_message(jpc_chat_id('conv2'), 'text', '지원자 문의', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT is(pg_temp.unread(jpc_chat_id('editor'), jpc_chat_id('conv2')), 0, 'N24 이 방을 뮤트한 editor 는 알림 0');
SELECT is(pg_temp.unread(jpc_chat_id('owner'), jpc_chat_id('conv2')), 1, 'N25 대조군: 뮤트 안 한 owner 는 1');
SELECT is(pg_temp.spy_last(), (SELECT count(*) FROM public.jpc_chat_spy)::text || ':2', 'N26 뮤트 제외 후 new_rows 2(owner·manager)');

SELECT * FROM finish();
ROLLBACK;
