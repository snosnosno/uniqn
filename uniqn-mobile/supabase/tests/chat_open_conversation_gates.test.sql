-- ============================================================
-- 앱 내 채팅 S1 — chat_open_conversation 게이트 (마이그 20260925100000)
-- ============================================================
-- 설계 §2(당근식 개설) · §4 RPC 표 · §4-2 M1·M2·M5·L6
--   · 로그인한 누구나(구인자 측 본인 제외) — 지원 안 해도 문의 가능
--   · 한 번이라도 공개된 공고만(first_published_at) — 초안에서 곧장 삭제된 공고는 존재 자체를 숨긴다
--   · 구인자 측이 먼저 여는 상대는 **이 공고 지원자**뿐
--   · 제3자가 p_seeker_id 로 남의 명의 방을 만들 수 없다(M2)
--   · 새 방 하루 20개(구직자 쪽), 기존 방 재진입은 세지 않는다
--
-- Red-Green: 구인자 개설의 "지원자" 검사를 지우면 O14 가 성공으로 바뀌어 실패해야 한다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(32);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();   -- 서버 다크 착지를 이 트랜잭션에서만 공개 ON 으로

-- 상태별 공고 (INSERT 시점 status — 전이 트리거는 UPDATE 전용)
SELECT jpc_chat_put('jp_draft',     jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'draft'));
SELECT jpc_chat_put('jp_pending',   jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'pending'));
SELECT jpc_chat_put('jp_rejected',  jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'rejected'));
SELECT jpc_chat_put('jp_container', jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'container'));
SELECT jpc_chat_put('jp_closed',    jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'closed'));
-- 공개됐다가 삭제(soft cancelled) vs 초안에서 곧장 삭제
SELECT jpc_chat_put('jp_pub_cancel',   jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'active'));
UPDATE public.job_postings SET status = 'cancelled' WHERE id = jpc_chat_id('jp_pub_cancel');
SELECT jpc_chat_put('jp_draft_cancel', jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'draft'));
UPDATE public.job_postings SET status = 'cancelled' WHERE id = jpc_chat_id('jp_draft_cancel');

-- ------------------------------------------------------------
-- F. first_published_at 트리거 (§4-2 M1)
-- ------------------------------------------------------------
SELECT ok((SELECT first_published_at IS NOT NULL FROM public.job_postings WHERE id = jpc_chat_id('jp')),
  'F1 active 로 생성된 공고는 first_published_at 이 기록된다');
SELECT ok((SELECT first_published_at IS NULL FROM public.job_postings WHERE id = jpc_chat_id('jp_draft')),
  'F2 draft 공고는 first_published_at 이 NULL');
UPDATE public.job_postings SET first_published_at = now() WHERE id = jpc_chat_id('jp_draft');
SELECT ok((SELECT first_published_at IS NULL FROM public.job_postings WHERE id = jpc_chat_id('jp_draft')),
  'F3 직접 UPDATE 로 first_published_at 을 심을 수 없다(트리거가 되돌린다)');
SELECT ok((SELECT first_published_at IS NOT NULL FROM public.job_postings WHERE id = jpc_chat_id('jp_pub_cancel')),
  'F4 공개 후 삭제된 공고는 기록이 남는다');

-- 마이그 이전부터 공개 상태였던 레거시 행(first_published_at NULL)이 공개 밖으로 나가는 경로 —
-- 백필 대신 트리거의 OLD.status 분기가 기록한다(DB 리뷰 L-7a: 이 분기를 지워도 F1~F4 는 초록)
ALTER TABLE public.job_postings DISABLE TRIGGER trg_jp_first_published_at;
SELECT jpc_chat_put('jp_legacy', jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'closed'));
ALTER TABLE public.job_postings ENABLE TRIGGER trg_jp_first_published_at;
UPDATE public.job_postings SET status = 'cancelled' WHERE id = jpc_chat_id('jp_legacy');
SELECT ok((SELECT first_published_at IS NOT NULL FROM public.job_postings WHERE id = jpc_chat_id('jp_legacy')),
  'F5 레거시 공개 행(기록 NULL)이 삭제되면 그 순간 기록된다(OLD.status 분기)');

-- ------------------------------------------------------------
-- O. 개설 — 구직자 쪽
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv', chat_open_conversation(jpc_chat_id('jp')));
SELECT isnt(jpc_chat_id('conv'), NULL, 'O1 지원 안 한 구직자도 방을 연다(당근식)');
SELECT is(chat_open_conversation(jpc_chat_id('jp')), jpc_chat_id('conv'), 'O2 같은 공고 재호출 → 같은 방 id');

SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp_draft')) $$,     'CHAT_POSTING_UNAVAILABLE%', 'O3 draft 공고 → CHAT_POSTING_UNAVAILABLE');
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp_pending')) $$,   'CHAT_POSTING_UNAVAILABLE%', 'O4 pending 공고 → CHAT_POSTING_UNAVAILABLE');
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp_rejected')) $$,  'CHAT_POSTING_UNAVAILABLE%', 'O5 rejected 공고 → CHAT_POSTING_UNAVAILABLE');
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp_container')) $$, 'CHAT_POSTING_UNAVAILABLE%', 'O6 container 공고 → CHAT_POSTING_UNAVAILABLE');
SELECT throws_like($$ SELECT chat_open_conversation(gen_random_uuid()) $$,           'CHAT_POSTING_UNAVAILABLE%', 'O7 없는 공고 id → 같은 코드(존재 oracle 차단)');
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp_draft_cancel')) $$, 'CHAT_POSTING_UNAVAILABLE%', 'O8 초안에서 곧장 삭제된 공고 → 같은 코드(M1)');
SELECT isnt(chat_open_conversation(jpc_chat_id('jp_closed')), NULL, 'O9 마감(closed) 공고에도 방을 연다');
SELECT isnt(chat_open_conversation(jpc_chat_id('jp_pub_cancel')), NULL, 'O10 공개 후 삭제된 공고에도 방을 연다');
RESET ROLE;

-- 자기 공고 문의 금지 (구인자 측이 구직자 모드로 호출)
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp')) $$, 'PERMISSION_DENIED%', 'O11 owner 가 자기 공고에 문의 → 거부');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('manager'));
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp')) $$, 'PERMISSION_DENIED%', 'O12 manager 가 담당 공고에 문의 → 거부');
RESET ROLE;

-- ------------------------------------------------------------
-- E. 개설 — 구인자 쪽(상대 지정)
-- ------------------------------------------------------------
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('conv_app', chat_open_conversation(jpc_chat_id('jp'), jpc_chat_id('applicant')));
SELECT ok(
  (SELECT seeker_id = jpc_chat_id('applicant') AND created_by = jpc_chat_id('owner')
     FROM public.chat_conversations WHERE id = jpc_chat_id('conv_app')),
  'O13 구인자 측이 이 공고 지원자에게 방을 연다(seeker=지원자, created_by=owner)');
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp'), jpc_chat_id('third')) $$,
  'PERMISSION_DENIED%', 'O14 구인자 측이 비지원자에게 먼저 여는 것은 거부(스팸 차단)');
RESET ROLE;

SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT is(chat_open_conversation(jpc_chat_id('jp')), jpc_chat_id('conv_app'), 'O15 지원자가 열면 구인자가 연 같은 방으로 들어온다');
RESET ROLE;

-- M2 — 제3자가 남의 명의로 방 생성. 피해자는 **이 공고 지원자**여야 한다: 비지원자를 고르면
-- 뒤의 "지원자에게만" 검사가 대신 막아 M2 줄을 지워도 초록이 된다(DB 리뷰 M-4). 메시지 본문까지
-- 맞춰 어느 게이트가 막았는지 특정한다.
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('jp_m2', jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'active'));
INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
VALUES (jpc_chat_id('jp_m2'), jpc_chat_id('applicant'), 'm2 victim', 'applied', now(), now());
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp_m2'), jpc_chat_id('applicant')) $$,
  'PERMISSION_DENIED: 채팅방을 열 권한%', 'O16 제3자가 p_seeker_id 에 실제 지원자 uid → M2 게이트가 거부');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE job_posting_id = jpc_chat_id('jp_m2')), 0,
  'O17 피해자(지원자) 명의 방이 생기지 않았다');

-- L6 — 정지 사용자
UPDATE public.users SET status = 'suspended' WHERE id = jpc_chat_id('third');
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp')) $$, 'PERMISSION_DENIED%', 'O18 정지(suspended) 사용자는 방을 열 수 없다(L6)');
RESET ROLE;
UPDATE public.users SET status = 'active' WHERE id = jpc_chat_id('third');

-- uid NULL (신뢰 컨텍스트 — JWT 없음)
SELECT jpc_test_clear_user();
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('jp')) $$, 'PERMISSION_DENIED%', 'O19 auth.uid() NULL → 거부');

-- ------------------------------------------------------------
-- S. 표시 이름 스냅샷 (M5 — 닉네임 없으면 실명 대신 중립 표시)
-- ------------------------------------------------------------
SELECT ok(
  (SELECT seeker_display_name LIKE '구직자%' AND position('실명노출금지' IN seeker_display_name) = 0
     FROM public.chat_conversations WHERE id = jpc_chat_id('conv')),
  'S1 닉네임 없는 구직자는 "구직자…" 중립 표시(실명 미노출)');
SELECT is((SELECT seeker_display_name FROM public.chat_conversations WHERE id = jpc_chat_id('conv_app')), '지원자닉',
  'S2 닉네임 있으면 닉네임');
SELECT is((SELECT employer_display_name || ' / ' || posting_title FROM public.chat_conversations WHERE id = jpc_chat_id('conv')),
  '사장닉 / jpc test posting', 'S3 구인자 쪽 이름 = 공고 작성자 닉네임(09-26 — 업장명 아님) · 공고 제목 스냅샷');

-- 메시지 없는 방은 구인자 측에 보이지 않는다(구직자가 "채팅하기"만 누른 흔적 — 보안 L3)
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 0,
  'S4 메시지 없는 방: 구인자 측 raw SELECT 0');
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('conv')), 1,
  'S5 대조군: 연 구직자 본인은 1');
RESET ROLE;

-- 작성자 닉네임이 없으면 공고 제목(09-26). XSS 패턴 업장명은 이제 원천이 아니다(보안 L2 유지)
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('ws_x', gen_random_uuid());
INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
VALUES (jpc_chat_id('ws_x'), '<script>alert(1)</script>', jpc_chat_id('owner'), now(), now());
SELECT jpc_chat_put('jp_x', jpc_chat_posting(jpc_chat_id('ws_x'), jpc_chat_id('owner'), 'active'));
UPDATE public.users SET nickname = NULL WHERE id = jpc_chat_id('owner');
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('conv_x', chat_open_conversation(jpc_chat_id('jp_x')));
RESET ROLE;
SELECT is((SELECT employer_display_name FROM public.chat_conversations WHERE id = jpc_chat_id('conv_x')), 'jpc chat posting active',
  'S6 작성자 닉네임이 없으면 공고 제목(XSS 패턴 업장명·실명 owner_name 은 쓰이지 않는다)');
UPDATE public.users SET nickname = '사장닉' WHERE id = jpc_chat_id('owner');

-- ------------------------------------------------------------
-- R. 새 방 하루 20개 — 21번째 신규는 거부, 기존 방 재진입은 세지 않는다
-- ------------------------------------------------------------
DO $$
BEGIN
  FOR i IN 1..21 LOOP
    PERFORM jpc_chat_put('rl' || i, jpc_chat_posting(jpc_chat_id('ws'), jpc_chat_id('owner'), 'active'));
  END LOOP;
  PERFORM jpc_test_set_user(jpc_chat_id('third'));
  FOR i IN 1..20 LOOP
    PERFORM chat_open_conversation(jpc_chat_id('rl' || i));
  END LOOP;
END $$;
SELECT jpc_test_set_user(jpc_chat_id('third'));
SELECT throws_like($$ SELECT chat_open_conversation(jpc_chat_id('rl21')) $$, 'CHAT_OPEN_LIMITED%', 'R1 하루 21번째 새 방 → CHAT_OPEN_LIMITED');
SELECT lives_ok($$ SELECT chat_open_conversation(jpc_chat_id('rl1')) $$, 'R2 이미 있는 방 재진입은 한도와 무관');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
