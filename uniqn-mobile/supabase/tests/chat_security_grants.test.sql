-- ============================================================
-- 앱 내 채팅 S1 — 함수 권한 · 테이블 쓰기 차단 · 구조 가드 (마이그 20260925100000)
-- ============================================================
-- 설계: docs/planning/2026-09-24-in-app-chat-design.md §4 · §4-2 · §14-2
--
-- 고정하려는 계약
--   A. 신규 함수 12개 — SECDEF 4규칙(wiki decisions/secdef-hardening)
--      · 호출 함수 11개: anon EXECUTE 없음 · service_role 있음 · SECDEF · pg_temp
--      · 🔒 서버 다크 착지: open·send 는 authenticated 도 실행 불가(공개 ON 마이그 전까지),
--        나머지 9개(RLS·storage 헬퍼, 읽기, 방이 없으면 무해한 읽음/나가기)는 authenticated 가능
--      · 트리거 함수 1개: PUBLIC·anon·authenticated 전부 회수(규칙 4)
--      · volatility: rate limit 을 부르는 open/send 와 쓰기 RPC 는 VOLATILE
--        (STABLE 이면 플래너가 접어 카운트가 조용히 누락 — 20260719061931:25-27)
--   B. 채팅 테이블 3개는 RPC 전용 쓰기 — RLS on + 정책은 SELECT 1개씩뿐
--   C. 본문 구조 — 전송 RPC 는 잠금을 잡은 **뒤** clock_timestamp() 로 시각을 찍는다
--
-- 🚨 테이블 GRANT 를 relacl 로 단언하지 않는 이유(설계 §14-2 대비 조정)
--    픽스처 jpc_helpers.sql 이 마이그 **뒤에** `GRANT ALL ON ALL TABLES … TO anon,
--    authenticated` 를 실행해 pg_class.relacl 자체를 덮는다. relacl 단언은 로컬·CI 에서
--    항상 "ALL 보유"를 보게 되어 실패할 수 없다(wiki decisions/vacuous-verification 유형 6).
--    그래서 실제 보안 경계인 **RLS 정책 형상 + authenticated 의 직접 쓰기 실행 결과**로 단언한다.
--    마이그의 REVOKE/GRANT 는 prod 방어 심층(prod 실측으로 확인 — PR 본문).
--
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(25);

CREATE TEMP TABLE chat_fns (sig text PRIMARY KEY, vol "char") ON COMMIT DROP;
INSERT INTO chat_fns VALUES
  ('public.chat_is_employer_side(uuid,uuid)',                                  's'),
  ('public.chat_is_member(uuid,uuid)',                                         's'),
  ('public.chat_my_conversation_ids()',                                        's'),
  ('public.chat_media_can_read(text)',                                         's'),
  ('public.chat_media_can_write(text)',                                        's'),
  ('public.chat_open_conversation(uuid,uuid)',                                 'v'),
  ('public.chat_send_message(uuid,text,text,text,integer,integer,uuid)',       'v'),
  ('public.chat_mark_read(uuid,uuid)',                                         'v'),
  ('public.chat_hide_conversation(uuid)',                                      'v'),
  ('public.chat_list_conversations(integer,timestamp with time zone)',        's'),
  ('public.chat_unread_total()',                                               's');
GRANT SELECT ON chat_fns TO PUBLIC;

-- ------------------------------------------------------------
-- A. 함수 권한
-- ------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM chat_fns WHERE to_regprocedure(sig) IS NOT NULL),
  11, 'A1 호출 함수 11개가 모두 존재한다');

SELECT ok(
  to_regprocedure('public.fn_job_posting_first_published()') IS NOT NULL,
  'A2 트리거 함수 fn_job_posting_first_published() 가 존재한다');

SELECT is(
  (SELECT coalesce(string_agg(sig, ', ' ORDER BY sig), '') FROM chat_fns
    WHERE has_function_privilege('anon', to_regprocedure(sig), 'EXECUTE')),
  '', 'A3 anon 은 어떤 채팅 함수도 실행할 수 없다(SECDEF 규칙 1)');

SELECT is(
  (SELECT coalesce(string_agg(sig, ', ' ORDER BY sig), '') FROM chat_fns
    WHERE NOT has_function_privilege('authenticated', to_regprocedure(sig), 'EXECUTE')),
  'public.chat_open_conversation(uuid,uuid), public.chat_send_message(uuid,text,text,text,integer,integer,uuid)',
  'A4 authenticated 가 실행 못 하는 것은 쓰기 진입점 open·send 둘뿐(나머지 9개는 RLS·읽기에 필요)');

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.chat_open_conversation(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chat_send_message(uuid,text,text,text,integer,integer,uuid)', 'EXECUTE'),
  'A4b 🔒 서버 다크 착지 — 공개 ON 전에는 인증 사용자도 방을 열거나 보낼 수 없다(보안 리뷰 H-2)');

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(gen_random_uuid());
     SELECT public.chat_open_conversation(gen_random_uuid()); $$,
  '42501', NULL, 'A4c 다크 상태에서 authenticated 의 개설 호출은 권한 오류(행동 확인)');
RESET ROLE;

SELECT is(
  (SELECT coalesce(string_agg(sig, ', ' ORDER BY sig), '') FROM chat_fns
    WHERE NOT has_function_privilege('service_role', to_regprocedure(sig), 'EXECUTE')),
  '', 'A5 service_role 은 채팅 함수 11개를 모두 실행할 수 있다');

SELECT is(
  (SELECT coalesce(string_agg(sig, ', ' ORDER BY sig), '') FROM chat_fns f
     JOIN pg_proc p ON p.oid = to_regprocedure(f.sig)
    WHERE NOT p.prosecdef),
  '', 'A6 호출 함수 11개는 전부 SECURITY DEFINER');

SELECT is(
  (SELECT coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '')
     FROM pg_proc p
    WHERE p.oid IN (SELECT to_regprocedure(sig) FROM chat_fns
                    UNION ALL SELECT to_regprocedure('public.fn_job_posting_first_published()'))
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
                       WHERE c LIKE 'search_path=%' AND c ILIKE '%pg_temp%')),
  '', 'A7 신규 함수 12개 모두 search_path 에 pg_temp 가 고정돼 있다');

SELECT is(
  (SELECT coalesce(string_agg(sig || '=' || p.provolatile::text, ', ' ORDER BY sig), '') FROM chat_fns f
     JOIN pg_proc p ON p.oid = to_regprocedure(f.sig)
    WHERE p.provolatile <> f.vol),
  '', 'A8 volatility — open/send/mark_read/hide 는 VOLATILE, 읽기·헬퍼는 STABLE');

SELECT ok(
  NOT has_function_privilege('anon', 'public.fn_job_posting_first_published()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.fn_job_posting_first_published()', 'EXECUTE'),
  'A9 트리거 함수는 anon·authenticated 가 실행할 수 없다(SECDEF 규칙 4 — 두 축 모두)');

SELECT is(
  (SELECT count(*)::int FROM pg_proc p, aclexplode(p.proacl) a
    WHERE p.oid = 'public.fn_job_posting_first_published()'::regprocedure AND a.grantee = 0),
  0, 'A10 트리거 함수의 PUBLIC EXECUTE 가 회수돼 있다(proacl 에 grantee=0 없음)');

-- ------------------------------------------------------------
-- B. 테이블 — RPC 전용 쓰기
-- ------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM pg_class
    WHERE oid IN ('public.chat_conversations'::regclass, 'public.chat_messages'::regclass,
                  'public.chat_read_states'::regclass)
      AND relrowsecurity),
  3, 'B1 채팅 테이블 3개 모두 RLS 가 켜져 있다');

SELECT is(
  (SELECT string_agg(tablename || ':' || cmd || ':' || roles::text || ':' || permissive, ' | ' ORDER BY tablename)
     FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'chat\_%'),
  'chat_conversations:SELECT:{authenticated}:PERMISSIVE | chat_messages:SELECT:{authenticated}:PERMISSIVE | chat_read_states:SELECT:{authenticated}:PERMISSIVE',
  'B2 채팅 정책은 테이블당 SELECT 1개 · TO authenticated 뿐(쓰기 정책 0 = RPC 전용)');

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(gen_random_uuid());
     INSERT INTO public.chat_conversations (job_posting_id, seeker_display_name, employer_display_name, posting_title)
     VALUES (gen_random_uuid(), 'x', 'x', 'x'); $$,
  '42501', NULL, 'B3 authenticated 의 chat_conversations 직접 INSERT 는 RLS 로 거부');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(gen_random_uuid());
     INSERT INTO public.chat_messages (conversation_id, sender_side, sender_display_name, body, client_message_id, created_at)
     VALUES (gen_random_uuid(), 'seeker', 'x', 'hi', gen_random_uuid(), now()); $$,
  '42501', NULL, 'B4 authenticated 의 chat_messages 직접 INSERT 는 RLS 로 거부(사칭 차단)');
RESET ROLE;

SELECT throws_ok(
  $$ SELECT jpc_test_set_user(gen_random_uuid());
     INSERT INTO public.chat_read_states (conversation_id, user_id) VALUES (gen_random_uuid(), gen_random_uuid()); $$,
  '42501', NULL, 'B5 authenticated 의 chat_read_states 직접 INSERT 는 RLS 로 거부');
RESET ROLE;

-- ------------------------------------------------------------
-- C. 구조
-- ------------------------------------------------------------
SELECT ok(
  (SELECT position('pg_advisory_xact_lock' IN prosrc) > 0
      AND position('pg_advisory_xact_lock' IN prosrc) < position('clock_timestamp()' IN prosrc)
     FROM pg_proc WHERE oid = to_regprocedure('public.chat_send_message(uuid,text,text,text,integer,integer,uuid)')),
  'C1 chat_send_message 는 advisory lock 을 잡은 뒤 clock_timestamp() 로 시각을 찍는다(읽음 누락 방지)');

SELECT ok(
  (SELECT prosrc LIKE '%check_user_rate_limit(%''chat_send'', 30, 60)%'
     FROM pg_proc WHERE oid = to_regprocedure('public.chat_send_message(uuid,text,text,text,integer,integer,uuid)'))
  AND
  (SELECT prosrc LIKE '%check_user_rate_limit(%''chat_open'', 20, 86400)%'
     FROM pg_proc WHERE oid = to_regprocedure('public.chat_open_conversation(uuid,uuid)')),
  'C2 본문에 rate limit 호출이 남아 있다(선언 VOLATILE 만으로는 삭제 회귀를 못 잡는다)');

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'),
  'C3 chat_messages 가 supabase_realtime publication 에 등록돼 있다');

SELECT is(
  (SELECT pg_get_triggerdef(oid) FROM pg_trigger
    WHERE tgrelid = 'public.chat_messages'::regclass AND tgname = 'chat_messages_xss_check'),
  'CREATE TRIGGER chat_messages_xss_check BEFORE INSERT OR UPDATE OF body ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION check_xss_fields(''body'')',
  'C4 XSS 트리거는 body 변경에만 — 탈퇴 FK SET NULL 연쇄 UPDATE 에서 과거 본문을 재검사하지 않는다');

SELECT is(
  (SELECT pg_get_indexdef(indexrelid) FROM pg_index
    WHERE indexrelid = to_regclass('public.notifications_chat_unread_collapse')),
  'CREATE UNIQUE INDEX notifications_chat_unread_collapse ON public.notifications USING btree (recipient_id, ((data ->> ''conversationId''::text))) WHERE ((type = ''chat_message''::text) AND (is_read = false))',
  'C5 방·수신자당 미읽음 채팅 알림 1행 유니크 인덱스(collapse)');

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger
           WHERE tgrelid = 'public.job_postings'::regclass
             AND tgname = 'trg_jp_first_published_at'
             AND tgfoid = 'public.fn_job_posting_first_published()'::regprocedure),
  'C6 job_postings 에 first_published_at 기록 트리거가 걸려 있다(§4-2 M1)');

SELECT throws_ok(
  $$ INSERT INTO public.chat_messages (conversation_id, sender_side, sender_display_name, kind, body, client_message_id, created_at)
     VALUES (gen_random_uuid(), 'seeker', 'x', 'text', '<script>alert(1)</script>', gen_random_uuid(), now()) $$,
  'P0001', NULL, 'C7 XSS 패턴 본문은 트리거가 거부한다(FK 검사 전 BEFORE 트리거)');

SELECT ok(
  (SELECT r.rolsuper OR r.rolbypassrls FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.oid = 'public.chat_media_can_write(text)'::regprocedure),
  'C8 업로드 한도 카운트의 전제 — 소유자가 RLS 를 우회한다(빠지면 카운트 0 = 한도가 조용히 꺼짐)');

SELECT * FROM finish();
ROLLBACK;
