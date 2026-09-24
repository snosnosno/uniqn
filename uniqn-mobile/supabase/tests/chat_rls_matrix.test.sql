-- ============================================================
-- 앱 내 채팅 S1 — RLS 가시성 매트릭스 · 동적 해제 · NULL fail-open · 멤버십 탐문(L4)
-- ============================================================
-- 설계 §3-2 · §3-4 · §3-5 · §4-2 L4
--   구인자 측 = 공고 owner ∪ 워크스페이스 owner/editor ∪ manager 협업자. viewer·admin·제3자 제외.
--   방에 명부를 두지 않고 매번 헬퍼로 판정 → 협업자 해제가 **같은 트랜잭션 안에서 즉시** 반영.
--
-- 🔑 RLS 하 "0건" 단언은 같은 행이 **보이는 역할의 1건**과 짝을 이뤄야 의미가 있다
--    (wiki decisions/vacuous-verification 유형 2). 각 0 단언 위에 1 대조군이 있다.
-- Red-Green: chat_is_employer_side 의 is_posting_collaborator → is_posting_collaborator_any 로
--            바꾸면 M7(viewer 0) 이 1 로 실패해야 한다.
--
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(32);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();   -- 서버 다크 착지를 이 트랜잭션에서만 공개 ON 으로

-- 구직자(비지원)가 방을 열고 메시지 1건
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('conv'), 'text', '초보도 가능한가요?', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;

-- ------------------------------------------------------------
-- M. 가시성 매트릭스 — (방, 메시지) 행 수
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 1, 'M1 구직자 당사자: 방 1');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 1, 'M1 구직자 당사자: 메시지 1');
SELECT is((SELECT count(*)::int FROM public.chat_read_states WHERE conversation_id = jpc_chat_id('conv')), 1, 'M1 구직자 당사자: 본인 읽음 커서 1');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 1, 'M2 공고 owner(=ws owner): 방 1');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 1, 'M2 공고 owner: 메시지 1');
SELECT is((SELECT count(*)::int FROM public.chat_read_states WHERE conversation_id = jpc_chat_id('conv')), 0, 'M2 공고 owner: 남의(구직자) 읽음 커서는 0 — 본인 행만');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('editor'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 1, 'M3 ws editor: 방 1');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 1, 'M3 ws editor: 메시지 1');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 1, 'M4 manager 협업자: 방 1');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 1, 'M4 manager 협업자: 메시지 1');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0, 'M5 다른 구직자(이 공고 지원자): 남의 방 0');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 0, 'M5 다른 구직자: 남의 메시지 0');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0, 'M6 제3자: 방 0');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 0, 'M6 제3자: 메시지 0');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('viewer'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0, 'M7 viewer 협업자: 방 0 (D3 — 좁은 헬퍼)');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 0, 'M7 viewer 협업자: 메시지 0');
RESET ROLE;

SELECT jpc_test_set_user_with_role(jpc_chat_id('admin'), 'admin');
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0, 'M8 admin: 방 0 (원문 열람 불가 — 신고 스냅샷만, D3)');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 0, 'M8 admin: 메시지 0');
RESET ROLE;

SELECT jpc_test_set_anon();
SELECT is((SELECT count(*)::int FROM public.chat_conversations), 0, 'M9 anon: 방 0 (정책 TO authenticated)');
SELECT is((SELECT count(*)::int FROM public.chat_messages), 0, 'M9 anon: 메시지 0');
RESET ROLE;

-- ------------------------------------------------------------
-- D. 동적 해제 — 협업자 행을 지운 **같은 트랜잭션**에서 곧바로 0
-- ------------------------------------------------------------
DELETE FROM public.job_posting_collaborators
 WHERE job_posting_id = jpc_chat_id('jp') AND user_id = jpc_chat_id('manager');

SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0, 'D1 해제된 manager: 방 즉시 0');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('conv')), 0, 'D2 해제된 manager: 메시지 즉시 0');
RESET ROLE;

-- ------------------------------------------------------------
-- N. NULL fail-open — 탈퇴한 owner(owner_id NULL) · NULL 인자
-- ------------------------------------------------------------
UPDATE public.job_postings SET owner_id = NULL WHERE id = jpc_chat_id('jp');

SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT is(chat_is_employer_side(jpc_chat_id('jp'), jpc_chat_id('third')), false,
  'N1 owner_id NULL 공고에서 제3자 → false (NULL 이 아니라 false — NOT 게이트 fail-open 차단)');
SELECT is(chat_is_employer_side(NULL, jpc_chat_id('third')), false, 'N2 posting NULL → false');
SELECT is(chat_is_member(NULL, jpc_chat_id('third')), false, 'N3 conversation NULL → false');
SELECT is(chat_is_member(jpc_chat_id('conv'), NULL), false, 'N4 user NULL → false');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is(chat_is_employer_side(jpc_chat_id('jp'), jpc_chat_id('owner')), true,
  'N5 대조군: owner_id 가 비어도 ws owner 는 여전히 구인자 측(is_workspace_member)');
RESET ROLE;

-- ------------------------------------------------------------
-- L. 제3자 멤버십 탐문(L4) — 두 번째 인자는 호출자 본인이어야 한다
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is(chat_is_member(jpc_chat_id('conv'), jpc_chat_id('seeker')), true, 'L1 대조군: 본인 멤버십 조회는 true');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT is(chat_is_member(jpc_chat_id('conv'), jpc_chat_id('seeker')), false, 'L2 제3자가 남의 멤버십을 물으면 false');
SELECT is(chat_is_employer_side(jpc_chat_id('jp'), jpc_chat_id('editor')), false, 'L3 제3자가 남의 구인자 측 여부를 물으면 false');
RESET ROLE;

-- role claim 이 빠진 JWT(`{}`)는 신뢰 컨텍스트가 아니다(보안 L1 — 거부 목록이던 판정을 허용 목록으로)
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE authenticated;
SELECT is(chat_is_member(jpc_chat_id('conv'), jpc_chat_id('seeker')), false,
  'L4 claims `{}` + authenticated 롤 → 남의 멤버십 조회 false(모르는 컨텍스트는 닫힘)');
RESET ROLE;

-- ------------------------------------------------------------
-- R. 재귀 없음 — 헬퍼 경유 정책이 42P17 을 내지 않는다
-- ------------------------------------------------------------
SELECT lives_ok(
  $$ SELECT jpc_test_set_user(jpc_chat_id('editor'));
     SELECT count(*) FROM public.chat_conversations;
     SELECT count(*) FROM public.chat_messages;
     SELECT count(*) FROM public.chat_read_states; $$,
  'R1 authenticated 로 채팅 3테이블 SELECT — 재귀(42P17) 없음');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
