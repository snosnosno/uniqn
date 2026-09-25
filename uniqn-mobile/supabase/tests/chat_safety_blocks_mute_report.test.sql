-- ============================================================
-- 앱 내 채팅 S4-1 — 차단 · 뮤트 · 신고 스냅샷 (마이그 20260925210000)
-- ============================================================
-- 계획: docs/planning/2026-09-25-chat-s4-safety-plan.md · 설계 §7 · §14-5 · D3·D10·D12
--
-- Red-Green 대상
--   · chat_send_message 의 차단 게이트(⑤-c) 제거 → K5·K6·K7 이 성공으로 바뀌어 실패
--   · chat_unblock 의 "막은 쪽만" 조건 제거 → K11·K14 가 성공으로 바뀌어 실패
--   · 스냅샷을 클라 값으로 채우면(없음 — RPC 가 본문을 받지 않는다) R3 이 DB 본문과 달라 실패
--   · 증거 테이블에 정책을 하나라도 열면 H1·H3·H3b 가 실패
--   · chat_media_can_read 의 관리자 절에서 "신고 증거" 조건 제거 → R13 이 1 로 실패
--
-- ⚠️ chat_blocks.created_by 컬럼 비노출은 여기서 단언하지 않는다 — 픽스처 jpc_helpers.sql 의
--    블랭킷 GRANT 가 컬럼 권한까지 덮어 항상 "보임"이 된다(공허 — wiki vacuous-verification 6).
--    마이그 끝 DO $verify$ 가 적용 시점에 확인한다.
-- ⚠️ notifications 를 세기 전 RESET ROLE + jpc_test_clear_user (RLS 로 0 이 되는 거짓 실패 방지).
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(62);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();   -- 서버 다크 착지를 이 트랜잭션에서만 공개 ON 으로

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '안녕하세요', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '네 반갑습니다', NULL, NULL, NULL, gen_random_uuid());
SELECT jpc_chat_put('conv_app', chat_open_conversation(jpc_chat_id('jp'), jpc_chat_id('applicant')));
SELECT chat_send_message(jpc_chat_id('conv_app'), 'text', '지원 감사합니다', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;

-- ------------------------------------------------------------
-- G. 권한 — SECDEF 4규칙
-- ------------------------------------------------------------
CREATE TEMP TABLE s4_fns (sig text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO s4_fns VALUES
  ('public.chat_set_muted(uuid,boolean)'), ('public.chat_block(uuid)'),
  ('public.chat_unblock(uuid)'), ('public.chat_report_message(uuid,text,text)');
GRANT SELECT ON s4_fns TO PUBLIC;

SELECT is((SELECT count(*)::int FROM s4_fns WHERE to_regprocedure(sig) IS NOT NULL), 4,
  'G1 신규 RPC 4개가 존재한다');
SELECT is((SELECT coalesce(string_agg(sig, ', '), '') FROM s4_fns
            WHERE has_function_privilege('anon', to_regprocedure(sig), 'EXECUTE')), '',
  'G2 anon 은 어느 것도 실행할 수 없다');
SELECT is((SELECT coalesce(string_agg(sig, ', '), '') FROM s4_fns
            WHERE NOT has_function_privilege('authenticated', to_regprocedure(sig), 'EXECUTE')), '',
  'G3 authenticated 는 4개 모두 실행한다(서버 다크와 무관하게 안전 기능은 켜져 있다)');
SELECT is((SELECT coalesce(string_agg(p.proname, ', '), '') FROM s4_fns f
             JOIN pg_proc p ON p.oid = to_regprocedure(f.sig)
            WHERE NOT p.prosecdef OR p.provolatile <> 'v'
               OR NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
                               WHERE c LIKE 'search_path=%' AND c ILIKE '%pg_temp%')), '',
  'G4 4개 모두 SECDEF · VOLATILE(신고는 rate limit) · search_path 에 pg_temp');

-- ------------------------------------------------------------
-- K. 차단 — 방 단위 · 양방향 · 막은 쪽만 해제 · 읽기·지원 무영향
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_block(jpc_chat_id('conv')) $$, 'PERMISSION_DENIED%', 'K1 제3자는 차단할 수 없다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('viewer'));
SELECT throws_like($$ SELECT chat_block(jpc_chat_id('conv')) $$, 'PERMISSION_DENIED%', 'K2 viewer 협업자는 차단할 수 없다(D3)');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT lives_ok($$ SELECT chat_block(jpc_chat_id('conv')) $$, 'K3 구직자가 방을 차단한다');
RESET ROLE;
SELECT is((SELECT blocked_by_side FROM public.chat_blocks WHERE conversation_id = jpc_chat_id('conv')),
  'seeker', 'K4 차단 행 = 구직자 쪽');

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'x', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_BLOCKED%', 'K5 막은 쪽(구직자)도 보낼 수 없다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'x', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_BLOCKED%', 'K6 막힌 쪽(owner)은 보낼 수 없다 — 양방향');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'x', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_BLOCKED%', 'K7 같은 쪽 manager 도 보낼 수 없다');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 2,
  'K8 차단 뒤에도 이전 대화는 읽힌다');
SELECT is((SELECT blocked FROM chat_list_conversations() WHERE conversation_id = jpc_chat_id('conv')), true,
  'K9 목록 blocked = true(S1 의 고정 false 가 실값으로)');
SELECT is((SELECT count(*)::int FROM public.chat_blocks WHERE conversation_id = jpc_chat_id('conv')), 1,
  'K9b 멤버는 차단 행을 본다(안내·해제 버튼 판단)');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT is((SELECT count(*)::int FROM public.chat_blocks), 0, 'K9c 제3자는 차단 행을 못 본다');
RESET ROLE;

-- 구인자 쪽이 지원자 방을 막아도 지원서는 그대로(근무·지원 무영향)
SELECT jpc_test_clear_user();
SELECT set_config('chat.app_status', (SELECT status::text FROM public.applications
   WHERE job_posting_id = jpc_chat_id('jp') AND applicant_id = jpc_chat_id('applicant') LIMIT 1), true);
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT lives_ok($$ SELECT chat_block(jpc_chat_id('conv_app')) $$, 'K10a owner 가 지원자 방을 차단한다');
RESET ROLE;
SELECT is((SELECT status::text FROM public.applications
            WHERE job_posting_id = jpc_chat_id('jp') AND applicant_id = jpc_chat_id('applicant') LIMIT 1),
  current_setting('chat.app_status'), 'K10 차단해도 지원 상태는 바뀌지 않는다');

SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT throws_like($$ SELECT chat_unblock(jpc_chat_id('conv_app')) $$,
  'PERMISSION_DENIED: 상대가 차단한%', 'K11 막힌 쪽(지원자)은 해제할 수 없다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT lives_ok($$ SELECT chat_unblock(jpc_chat_id('conv_app')) $$,
  'K12 구인자 쪽 해제는 쪽 단위 — owner 가 막은 것을 manager 가 푼다');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.chat_blocks WHERE conversation_id = jpc_chat_id('conv_app')), 0,
  'K12b 해제 후 차단 행 없음');

-- 쪽별 차단(보안 리뷰 M1): 한쪽이 먼저 막아도 다른 쪽 차단은 따로 남는다.
-- 공격 재현 — 가해자(구직자)가 먼저 막고, 피해자(owner)가 막고, 가해자가 자기 것을 풀어도 여전히 막혀야 한다.
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT lives_ok($$ SELECT chat_block(jpc_chat_id('conv')) $$, 'K13 이미 구직자가 막은 방을 owner 도 차단한다');
RESET ROLE;
SELECT is((SELECT string_agg(blocked_by_side, ',' ORDER BY blocked_by_side) FROM public.chat_blocks
            WHERE conversation_id = jpc_chat_id('conv')),
  'employer,seeker', 'K13b 쪽별로 1행씩 — owner 의 차단이 무시(no-op)되지 않는다');
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT lives_ok($$ SELECT chat_unblock(jpc_chat_id('conv')) $$, 'K14 구직자는 자기 차단만 푼다');
SELECT throws_like($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', 'x', NULL, NULL, NULL, gen_random_uuid()) $$,
  'CHAT_BLOCKED%', 'K14b 구직자가 자기 것을 풀어도 owner 의 차단이 남아 보낼 수 없다(M1 공격 봉쇄)');
SELECT throws_like($$ SELECT chat_unblock(jpc_chat_id('conv')) $$,
  'PERMISSION_DENIED: 상대가 차단한%', 'K14c 남은 건 상대 차단 — 구직자는 해제할 수 없다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT lives_ok($$ SELECT chat_unblock(jpc_chat_id('conv')) $$, 'K15 owner 가 자기 차단을 푼다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT lives_ok($$ SELECT chat_send_message(jpc_chat_id('conv'), 'text', '다시 대화', NULL, NULL, NULL, gen_random_uuid()) $$,
  'K16 대조군: 양쪽 다 풀리면 다시 보낸다');
RESET ROLE;

-- ------------------------------------------------------------
-- M. 뮤트 — 내 수신 알림만 끈다(같은 메시지의 다른 수신자는 대조군)
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_set_muted(jpc_chat_id('conv'), true) $$, 'PERMISSION_DENIED%', 'M1 제3자는 뮤트할 수 없다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_set_muted(jpc_chat_id('conv'), NULL) $$, 'INVALID_INPUT%', 'M2 값 NULL → 거부');
SELECT lives_ok($$ SELECT chat_set_muted(jpc_chat_id('conv'), true) $$, 'M3 owner 가 방 알림을 끈다');
RESET ROLE;
SELECT is((SELECT muted_until FROM public.chat_read_states
            WHERE conversation_id = jpc_chat_id('conv') AND user_id = jpc_chat_id('owner')),
  'infinity'::timestamptz, 'M4 muted_until = infinity');

SELECT jpc_test_clear_user();
DELETE FROM public.notifications WHERE type = 'chat_message';
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '뮤트 중 메시지', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_clear_user();
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE type = 'chat_message' AND recipient_id = jpc_chat_id('manager')), 1,
  'M5 대조군: 같은 메시지로 뮤트 안 한 manager 는 알림을 받는다');
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE type = 'chat_message' AND recipient_id = jpc_chat_id('owner')), 0,
  'M6 뮤트한 owner 는 알림 0');

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT chat_set_muted(jpc_chat_id('conv'), false);
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '뮤트 해제 후', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_clear_user();
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE type = 'chat_message' AND recipient_id = jpc_chat_id('owner')), 1,
  'M7 켜면 다시 받는다');

-- ------------------------------------------------------------
-- R. 신고 — 스냅샷은 RPC 가 DB 에서 채운다 · 관리자는 스냅샷·증거 사진만
-- ------------------------------------------------------------
-- 신고 메시지 앞에 12개를 쌓아 스냅샷이 직전 10개로 잘리는지 본다
DO $$
BEGIN
  PERFORM jpc_test_set_user(jpc_chat_id('owner'));
  FOR i IN 1..12 LOOP
    PERFORM chat_send_message(jpc_chat_id('conv'), 'text', format('앞선 메시지 %s', i), NULL, NULL, NULL, gen_random_uuid());
  END LOOP;
  PERFORM jpc_chat_put('m_bad', (chat_send_message(jpc_chat_id('conv'), 'text', '문제의 욕설 메시지', NULL, NULL, NULL, gen_random_uuid()) ->> 'messageId')::uuid);
END $$;
RESET ROLE;

-- 사진 메시지(증거 사진) + 신고되지 않은 사진
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('cm_img', gen_random_uuid());
SELECT jpc_chat_put('cm_img2', gen_random_uuid());
SELECT set_config('chat.img', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_img')), true);
SELECT set_config('chat.img2', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_img2')), true);
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('chat-media', current_setting('chat.img')), ('chat-media', current_setting('chat.img2'));
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('m_img', (chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.img'), 800, 600, jpc_chat_id('cm_img')) ->> 'messageId')::uuid);
SELECT chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.img2'), 800, 600, jpc_chat_id('cm_img2'));
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('rep1', chat_report_message(jpc_chat_id('m_bad'), 'abuse', '반복해서 욕을 해요'));
RESET ROLE;
SELECT jpc_test_clear_user();
SELECT is(
  (SELECT row(type, reporter_type, reporter_id = jpc_chat_id('seeker'), target_id = jpc_chat_id('owner'),
              job_posting_id = jpc_chat_id('jp'), severity::text, status)::text
     FROM public.reports WHERE id = jpc_chat_id('rep1')),
  '(inappropriate_behavior,employee,t,t,t,medium,pending)',
  'R1 신고 행 — 대상 = 메시지 발신자 · 공고 · 구직자=employee · 욕설=medium');
SELECT is(
  (SELECT (snapshot ->> 'reportedMessageId')::uuid = jpc_chat_id('m_bad')
          AND snapshot ->> 'source' = 'chat' AND snapshot ->> 'reason' = 'abuse'
          AND reported_message_id = jpc_chat_id('m_bad') AND reporter_id = jpc_chat_id('seeker')
     FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep1')),
  true, 'R2 스냅샷 머리 — source·reason·reportedMessageId');
SELECT is(
  (SELECT (snapshot -> 'messages' -> -1 ->> 'body')
     FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep1')),
  (SELECT body FROM public.chat_messages WHERE id = jpc_chat_id('m_bad')),
  'R3 스냅샷 마지막 = 신고 메시지, 본문은 DB 값 그대로');
SELECT is(
  (SELECT jsonb_array_length(snapshot -> 'messages') FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep1')),
  11, 'R4 스냅샷 = 신고 메시지 + 직전 10개');
SELECT is(
  (SELECT (snapshot -> 'messages' -> 0 ->> 'body') FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep1')),
  '앞선 메시지 3', 'R4b 가장 오래된 것은 직전 10개의 첫째(12개 중 3번째) — 오래된 → 최신 순');
SELECT is(
  (SELECT description FROM public.reports WHERE id = jpc_chat_id('rep1')),
  E'[채팅 신고] 욕설·비하\n반복해서 욕을 해요', 'R5 설명 = 사유 라벨 + 신고자 설명');

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT throws_like($$ SELECT chat_report_message(jpc_chat_id('m_bad'), 'spam') $$,
  'DUPLICATE_REPORT%', 'R6 같은 메시지 재신고 → 거부');
SELECT throws_like(
  $$ SELECT chat_report_message((SELECT id FROM public.chat_messages
                                  WHERE conversation_id = jpc_chat_id('conv') AND sender_id = jpc_chat_id('seeker') LIMIT 1), 'abuse') $$,
  'PERMISSION_DENIED%', 'R7 내 메시지는 신고할 수 없다');
SELECT throws_like($$ SELECT chat_report_message(jpc_chat_id('m_img'), 'hate') $$,
  'INVALID_INPUT%', 'R8 모르는 사유 → 거부');
SELECT throws_like($$ SELECT chat_report_message(jpc_chat_id('m_img'), 'other', repeat('가', 501)) $$,
  'INVALID_INPUT%', 'R9 설명 501자 → 거부');
SELECT throws_like($$ SELECT chat_report_message(jpc_chat_id('m_img'), 'other', '<script>alert(1)</script>') $$,
  'XSS pattern detected%', 'R10 설명의 XSS 패턴은 reports 트리거가 거부');
SELECT jpc_chat_put('rep_img', chat_report_message(jpc_chat_id('m_img'), 'sexual'));
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT throws_like($$ SELECT chat_report_message(jpc_chat_id('m_bad'), 'abuse') $$,
  'PERMISSION_DENIED%', 'R11 같은 쪽(owner) 메시지는 manager 가 신고할 수 없다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_report_message(jpc_chat_id('m_bad'), 'abuse') $$,
  'PERMISSION_DENIED%', 'R12 제3자는 신고할 수 없다(존재 여부도 같은 코드)');
RESET ROLE;

SELECT jpc_test_clear_user();
SELECT is(
  (SELECT r.severity::text || ':' || (e.snapshot -> 'imagePaths' ? current_setting('chat.img'))::text
     FROM public.reports r JOIN public.chat_report_evidence e ON e.report_id = r.id
    WHERE r.id = jpc_chat_id('rep_img')),
  'high:true', 'R13a 사진 신고 — 음란=high · 증거 경로가 imagePaths 에');

-- 관리자: 원문 0행 · 신고 증거 사진만 읽는다
SELECT jpc_test_set_user_with_role(jpc_chat_id('admin'), 'admin');
SELECT is((SELECT count(*)::int FROM public.chat_messages), 0, 'R14 관리자는 채팅 원문을 볼 수 없다(D3)');
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.img')),
  1, 'R15 관리자는 신고 증거 사진은 읽는다');
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.img2')),
  0, 'R16 관리자도 신고되지 않은 사진은 못 읽는다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'chat-media' AND name = current_setting('chat.img')),
  0, 'R17 관리자가 아니면 신고 증거라도 못 읽는다');
RESET ROLE;

-- ------------------------------------------------------------
-- H. 스냅샷 위조 차단(보안 리뷰 H1) · 전송 모양 제한(LOW-1) · 중복 신고 최종 판정(LOW-5)
-- ------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('third'));
     INSERT INTO public.chat_report_evidence (report_id, reporter_id, reported_message_id, snapshot)
     VALUES (jpc_chat_id('rep1'), jpc_chat_id('third'), gen_random_uuid(),
             jsonb_build_object('source', 'chat', 'imagePaths', jsonb_build_array(current_setting('chat.img2')))); $$,
  '42501', NULL, 'H1 클라이언트는 증거 테이블에 쓸 수 없다(RLS 정책 0 — 가짜 증거·관리자 열람 확대·삭제 예외 남용 차단)');
RESET ROLE;
SELECT lives_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('third'));
     INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name,
                                 job_posting_id, description)
     VALUES ('other', 'employee', jpc_chat_id('third'), 'x', jpc_chat_id('owner'), 'y', jpc_chat_id('jp'), '일반 신고'); $$,
  'H2 대조군: 기존 직접 신고 경로(reports 권한)는 그대로 — S4 는 reports 권한을 바꾸지 않는다');
RESET ROLE;
SELECT jpc_test_set_user_with_role(jpc_chat_id('admin'), 'admin');
SELECT is((SELECT count(*)::int FROM public.chat_report_evidence), 0,
  'H3 관리자도 증거 테이블을 직접 읽지 못한다(RPC 로만 — 쓰기·수정 경로 없음)');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is((SELECT count(*)::int FROM public.chat_report_evidence), 0,
  'H3b 신고자 본인도 직접 읽지 못한다(탈퇴자 원문 잔존 차단 — D5)');
RESET ROLE;
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('cm_png', gen_random_uuid());
INSERT INTO storage.objects (bucket_id, name)
VALUES ('chat-media', format('%s/%s/%s.png', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_png')));
SELECT jpc_chat_put('cm_big', gen_random_uuid());
SELECT set_config('chat.big', format('%s/%s/%s.jpg', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_big')), true);
INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', current_setting('chat.big'));
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '',
       format('%s/%s/%s.png', jpc_chat_id('conv'), jpc_chat_id('owner'), jpc_chat_id('cm_png')), 800, 600, jpc_chat_id('cm_png')) $$,
  'CHAT_IMAGE_INVALID%', 'H4 .png 경로는 정화 EF 가 만들지 않는 모양 → 거부(LOW-1)');
SELECT throws_like(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.big'), 2049, 600, jpc_chat_id('cm_big')) $$,
  'CHAT_IMAGE_INVALID%', 'H5 가로 2049 → 거부(정화기 상한 2048 과 일치)');
SELECT lives_ok(
  $$ SELECT chat_send_message(jpc_chat_id('conv'), 'image', '', current_setting('chat.big'), 2048, 600, jpc_chat_id('cm_big')) $$,
  'H5b 대조군: 같은 사진을 2048 로 보내면 성공(H5 가 경로 불일치 탓이 아님)');
RESET ROLE;
SELECT is(
  (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'chat_report_evidence_once'),
  'CREATE UNIQUE INDEX chat_report_evidence_once ON public.chat_report_evidence USING btree (reporter_id, reported_message_id)',
  'H6 같은 신고자·같은 메시지 유니크 인덱스(동시 재신고 경합의 최종 판정)');

-- 관리자 스냅샷 조회 RPC(DB 리뷰 M1 — 증거 테이블은 deny-all)
SELECT jpc_test_set_user_with_role(jpc_chat_id('admin'), 'admin');
SELECT is(admin_get_report_evidence(jpc_chat_id('rep1')) ->> 'reportedMessageId', jpc_chat_id('m_bad')::text,
  'H7 관리자는 RPC 로 스냅샷을 받는다');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT throws_like($$ SELECT admin_get_report_evidence(jpc_chat_id('rep1')) $$,
  'PERMISSION_DENIED%', 'H8 신고자 본인도 RPC 로 스냅샷을 읽을 수 없다(탈퇴자 원문 잔존 차단 — D5)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
