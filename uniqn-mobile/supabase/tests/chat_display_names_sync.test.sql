-- ============================================================
-- 앱 내 채팅 — 표시 이름 규칙 · 닉네임 동기화 (마이그 20260926120000, 09-26 실기기 QA)
-- ============================================================
-- 고정하려는 계약
--   · 구인자 쪽 이름 = 공고 작성자 닉네임 → 없으면 공고 제목(업장명 '내 팀' 이 보이던 문제)
--   · 닉네임이 바뀌면 그 사람의 방 이름 · 보낸 메시지 이름이 따라 바뀐다
--     (방 생성 때 한 번 찍고 끝나 '구직자 c333' 이 남던 문제)
--   · 닉네임 없는 구직자는 중립 표시 '구직자 xxxx' (M5 — 실명 미노출)
--   · XSS 패턴 이름은 쓰지 않는다(보안 L2 — users.nickname 은 자체 XSS 트리거가 먼저 막는다)
--   · 본인이 authenticated 로 닉네임을 바꿔도 동기화된다 — 채팅 테이블엔 UPDATE 정책이 없으므로
--     트리거가 SECDEF 가 아니면 0행 갱신으로 **조용히** 실패한다(D6 이 그 경로)
--
-- 🚨 이름을 읽기 전 RESET ROLE — authenticated 면 RLS 로 남의 방이 안 보여 NULL 비교가 된다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(17);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();

CREATE FUNCTION pg_temp.conv_names(p_conv uuid) RETURNS text LANGUAGE sql AS $$
  SELECT seeker_display_name || ' / ' || employer_display_name
    FROM public.chat_conversations WHERE id = p_conv $$;
CREATE FUNCTION pg_temp.sender_names(p_conv uuid, p_sender uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(DISTINCT sender_display_name, ',')
    FROM public.chat_messages WHERE conversation_id = p_conv AND sender_id = p_sender $$;

-- 방 2개: seeker(닉네임 없음) · applicant('지원자닉') — 둘 다 owner('사장닉') 의 공고
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '문의드려요', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT jpc_chat_put('conv_app', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('conv_app'), 'text', '지원자 문의', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '네', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;

-- ------------------------------------------------------------
-- 1. 초기 이름
-- ------------------------------------------------------------
SELECT ok(
  (SELECT seeker_display_name ~ '^구직자 [0-9a-f]{4}$' AND employer_display_name = '사장닉'
     FROM public.chat_conversations WHERE id = jpc_chat_id('conv')),
  'D1 닉네임 없는 구직자 = "구직자 xxxx" · 구인자 쪽 = 작성자 닉네임');
SELECT ok(
  pg_temp.sender_names(jpc_chat_id('conv'), jpc_chat_id('seeker')) ~ '^구직자 [0-9a-f]{4}$',
  'D2 구직자 메시지 발신자 이름도 같은 중립 표시');

-- ------------------------------------------------------------
-- 2. 구직자가 닉네임을 정하면 방·메시지가 따라 바뀐다
-- ------------------------------------------------------------
UPDATE public.users SET nickname = '새닉' WHERE id = jpc_chat_id('seeker');
SELECT is(pg_temp.conv_names(jpc_chat_id('conv')), '새닉 / 사장닉', 'D3 방의 구직자 이름 = 새 닉네임');
SELECT is(pg_temp.sender_names(jpc_chat_id('conv'), jpc_chat_id('seeker')), '새닉', 'D4 이미 보낸 메시지 이름도 새 닉네임');
SELECT is(pg_temp.conv_names(jpc_chat_id('conv_app')), '지원자닉 / 사장닉', 'D5 대조군: 다른 사람의 방은 그대로');

-- ------------------------------------------------------------
-- 3. 본인이 authenticated 로 바꿔도 동기화(SECDEF 트리거)
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
UPDATE public.users SET nickname = '본인변경' WHERE id = jpc_chat_id('seeker');
RESET ROLE;
SELECT is((SELECT nickname FROM public.users WHERE id = jpc_chat_id('seeker')), '본인변경',
  'D6a 대조군: 본인 닉네임 UPDATE 자체는 반영됐다');
SELECT is(pg_temp.conv_names(jpc_chat_id('conv')) || ' | ' || pg_temp.sender_names(jpc_chat_id('conv'), jpc_chat_id('seeker')),
  '본인변경 / 사장닉 | 본인변경', 'D6 본인이 바꾼 닉네임도 방·메시지에 반영(정책 없는 테이블을 SECDEF 로 갱신)');

-- ------------------------------------------------------------
-- 4. 작성자 닉네임 변경 · 삭제 → 공고 제목 폴백
-- ------------------------------------------------------------
UPDATE public.users SET nickname = '사장새닉' WHERE id = jpc_chat_id('owner');
SELECT is(pg_temp.conv_names(jpc_chat_id('conv')) || ' | ' || pg_temp.sender_names(jpc_chat_id('conv'), jpc_chat_id('owner')),
  '본인변경 / 사장새닉 | 사장새닉', 'D7 작성자 닉네임 변경 → 방 이름 · 작성자 메시지 이름');
UPDATE public.users SET nickname = NULL WHERE id = jpc_chat_id('owner');
SELECT is(pg_temp.conv_names(jpc_chat_id('conv_app')) || ' | ' || pg_temp.sender_names(jpc_chat_id('conv'), jpc_chat_id('owner')),
  '지원자닉 / jpc test posting | jpc test posting 담당자',
  'D8 작성자 닉네임이 없으면 공고 제목 · 메시지는 "<공고 제목> 담당자"(실명 아님)');

-- ------------------------------------------------------------
-- 5. 닉네임 삭제 · XSS → 중립 표시
-- ------------------------------------------------------------
UPDATE public.users SET nickname = '   ' WHERE id = jpc_chat_id('seeker');
SELECT ok(pg_temp.conv_names(jpc_chat_id('conv')) ~ '^구직자 [0-9a-f]{4} / ',
  'D9 공백 닉네임 → 다시 중립 표시(실명 "실명노출금지" 아님)');
-- users.nickname 은 자체 XSS 트리거가 저장을 거부한다 → 헬퍼는 방어 심층. 헬퍼를 직접 본다
SELECT ok(
  public.chat_safe_display_name('<script>alert(1)</script>') IS NULL
  AND public.chat_safe_display_name('  ') IS NULL
  AND public.chat_safe_display_name(' 스노 ') = '스노',
  'D10 이름 헬퍼: XSS 패턴·공백은 NULL, 정상 이름은 trim');

-- ------------------------------------------------------------
-- 6. 이름 변경 뒤 알림 제목도 새 이름
-- ------------------------------------------------------------
UPDATE public.users SET nickname = '알림닉' WHERE id = jpc_chat_id('seeker');
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '이름 바꿨어요', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT is((SELECT title FROM public.notifications
            WHERE recipient_id = jpc_chat_id('owner') AND type = 'chat_message' AND is_read = false
              AND data ->> 'conversationId' = jpc_chat_id('conv')::text),
  '알림닉', 'D11 다음 푸시 제목 = 바뀐 닉네임');

-- ------------------------------------------------------------
-- 7. 권한 — 서버 전용
-- ------------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.fn_chat_sync_nickname()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.fn_chat_conversation_names()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.chat_safe_display_name(text)', 'EXECUTE'),
  'D12 이름 함수 3종은 클라이언트 역할이 실행할 수 없다(SECDEF 규칙 1·4)');
SELECT ok(
  (SELECT bool_and(p.prosecdef AND p.proconfig::text LIKE '%pg_temp%')
     FROM pg_proc p WHERE p.oid IN ('public.fn_chat_sync_nickname()'::regprocedure,
                                    'public.fn_chat_conversation_names()'::regprocedure)),
  'D13 트리거 함수 2종은 SECDEF + search_path 에 pg_temp');

-- ------------------------------------------------------------
-- 8. 작성자 탈퇴 → 방 이름·구직자 알림 제목에서 닉네임 제거 (DB 리뷰 HIGH)
--    구인자 쪽 이름이 개인 닉네임이 됐으므로 탈퇴 익명화 대상이다
-- ------------------------------------------------------------
UPDATE public.users SET nickname = '탈퇴할사장' WHERE id = jpc_chat_id('owner');
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '사장 답장', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = jpc_chat_id('seeker') AND type = 'chat_message' AND title = '탈퇴할사장'),
  1, 'D14a 대조군: 탈퇴 전 구직자 알림 제목 = 작성자 닉네임');

-- permanently_delete_user 의 공고 단계와 같은 문장(20260925230000:115-118). 함수 전체는 워크스페이스
-- 소유자 FK(workspaces_owner_id_fkey)가 users DELETE 를 막아 이 픽스처(owner = ws owner)로는 끝까지 못 간다
UPDATE public.job_postings SET
  status = 'closed', closed_at = now(), closed_reason = 'owner_deleted', owner_id = NULL, updated_at = now()
WHERE owner_id = jpc_chat_id('owner') AND status = 'active';
UPDATE public.job_postings SET owner_id = NULL, updated_at = now() WHERE owner_id = jpc_chat_id('owner');
SELECT is((SELECT count(*)::int FROM public.job_postings WHERE id = jpc_chat_id('jp') AND owner_id IS NULL), 1,
  'D14b 대조군: 공고 작성자가 비워졌다(탈퇴 함수의 공고 단계)');
SELECT is(
  (SELECT employer_display_name FROM public.chat_conversations WHERE id = jpc_chat_id('conv'))
  || ' | ' ||
  (SELECT count(*)::text FROM public.notifications
    WHERE recipient_id = jpc_chat_id('seeker') AND type = 'chat_message' AND title = '탈퇴할사장'),
  'jpc test posting | 0',
  'D14 작성자 탈퇴 뒤 방 이름 = 공고 제목, 구직자 알림 제목에 탈퇴자 닉네임 0건');

SELECT * FROM finish();
ROLLBACK;
