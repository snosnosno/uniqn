-- ============================================================
-- 앱 내 채팅 S5-b — 보존 purge · 고아 사진 · 신고 증거 만료 (마이그 20260926100000)
-- ============================================================
-- 설계 §14-6 S5-b · D5(마지막 메시지 후 1년) · D12(신고 처리 후 1년)
--
-- 경계는 clock_timestamp() 기준으로 심는다(고정 과거 상수 하한은 공허 — wiki vacuous-verification 7):
--   old   = 1년 + 1분 전(지워져야)   · fresh = 1년 − 1분 전(남아야) — 함수와 같은 interval '1 year'
-- Red-Green: 함수의 보존 기간을 364일로 줄이면 P4(fresh 유지)가 실패 · 증거 제외를 빼면 P7 실패
--            · dry-run 분기를 빼면 D2(아무것도 안 바뀜)가 실패
-- ⚠️ storage.objects 는 SQL DELETE 금지(Storage API 전용) — 큐 적재만 단언한다.
-- 안전: BEGIN/ROLLBACK. 선행: npm run test:db:helpers
-- ============================================================
BEGIN;
SELECT plan(20);

SELECT jpc_chat_seed_guc();
SELECT jpc_chat_simulate_on();

-- 방 2개: old(구직자 seeker) · fresh(지원자 applicant)
SELECT jpc_test_set_user(jpc_chat_id('seeker'));
SELECT jpc_chat_put('old', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('old'), 'text', '1년 넘은 대화', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT jpc_chat_put('fresh', chat_open_conversation(jpc_chat_id('jp')));
SELECT chat_send_message(jpc_chat_id('fresh'), 'text', '1년 안 된 대화', NULL, NULL, NULL, gen_random_uuid());
RESET ROLE;

-- 사진 — EF 가 쓴 것처럼 postgres 로. 이름은 GUC 로 보관
SELECT jpc_test_clear_user();
SELECT jpc_chat_put('cm_old', gen_random_uuid());
SELECT jpc_chat_put('cm_ev', gen_random_uuid());
SELECT jpc_chat_put('cm_fresh', gen_random_uuid());
SELECT set_config('chat.p_old',   format('%s/%s/%s.jpg', jpc_chat_id('old'), jpc_chat_id('seeker'), jpc_chat_id('cm_old')), true);
SELECT set_config('chat.p_ev',    format('%s/%s/%s.jpg', jpc_chat_id('old'), jpc_chat_id('seeker'), jpc_chat_id('cm_ev')), true);
SELECT set_config('chat.p_fresh', format('%s/%s/%s.jpg', jpc_chat_id('fresh'), jpc_chat_id('applicant'), jpc_chat_id('cm_fresh')), true);
SELECT set_config('chat.p_orphan_old', format('%s/%s/%s.jpg', jpc_chat_id('fresh'), jpc_chat_id('applicant'), gen_random_uuid()), true);
SELECT set_config('chat.p_orphan_new', format('%s/%s/%s.jpg', jpc_chat_id('fresh'), jpc_chat_id('applicant'), gen_random_uuid()), true);
SELECT set_config('chat.p_inbox_old',  format('%s/%s/%s.jpg', jpc_chat_id('fresh'), jpc_chat_id('applicant'), gen_random_uuid()), true);
SELECT set_config('chat.p_inbox_new',  format('%s/%s/%s.jpg', jpc_chat_id('fresh'), jpc_chat_id('applicant'), gen_random_uuid()), true);
SELECT set_config('chat.p_expired_ev', format('%s/%s/%s.jpg', jpc_chat_id('fresh'), jpc_chat_id('applicant'), gen_random_uuid()), true);
INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
  ('chat-media', current_setting('chat.p_old'), now() - interval '400 days'),
  ('chat-media', current_setting('chat.p_ev'), now() - interval '400 days'),
  ('chat-media', current_setting('chat.p_fresh'), now() - interval '300 days'),
  ('chat-media', current_setting('chat.p_orphan_old'), now() - interval '25 hours'),
  ('chat-media', current_setting('chat.p_orphan_new'), now() - interval '1 hour'),
  ('chat-media-inbox', current_setting('chat.p_inbox_old'), now() - interval '25 hours'),
  ('chat-media-inbox', current_setting('chat.p_inbox_new'), now() - interval '1 hour'),
  ('chat-media', current_setting('chat.p_expired_ev'), now() - interval '500 days');

SELECT jpc_test_set_user(jpc_chat_id('seeker'));
-- 증거 사진을 먼저 보낸다 — 스냅샷은 직전 문맥 사진까지 봉인하므로 p_old 는 그 뒤에 보내야 봉인 밖이다
SELECT jpc_chat_put('m_ev', (chat_send_message(jpc_chat_id('old'), 'image', '', current_setting('chat.p_ev'), 800, 600, jpc_chat_id('cm_ev')) ->> 'messageId')::uuid);
SELECT chat_send_message(jpc_chat_id('old'), 'image', '', current_setting('chat.p_old'), 800, 600, jpc_chat_id('cm_old'));
RESET ROLE;
SELECT jpc_test_set_user(jpc_chat_id('applicant'));
SELECT chat_send_message(jpc_chat_id('fresh'), 'image', '', current_setting('chat.p_fresh'), 800, 600, jpc_chat_id('cm_fresh'));
RESET ROLE;

-- 봉인 중인 신고(증거 = old 방 사진) · 처리 후 1년 지난 신고(증거 = 참조 없는 사진)
SELECT jpc_test_set_user(jpc_chat_id('owner'));
SELECT jpc_chat_put('rep_live', chat_report_message(jpc_chat_id('m_ev'), 'sexual'));
RESET ROLE;
SELECT jpc_test_clear_user();
INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name,
                            job_posting_id, description, status, reviewed_at)
VALUES ('inappropriate_behavior', 'employer', jpc_chat_id('owner'), 'owner', jpc_chat_id('applicant'), 'x',
        jpc_chat_id('jp'), '[채팅 신고] 기타', 'resolved', clock_timestamp() - interval '1 year' - interval '1 day')
RETURNING jpc_chat_put('rep_old', id);
INSERT INTO public.chat_report_evidence (report_id, reporter_id, reported_message_id, snapshot)
VALUES (jpc_chat_id('rep_old'), jpc_chat_id('owner'), gen_random_uuid(),
        jsonb_build_object('source', 'chat', 'imagePaths', jsonb_build_array(current_setting('chat.p_expired_ev'))));
-- 처리되지 않았지만 생성 후 2년이 넘은 신고(영구 보존 금지 — 2년 상한)
INSERT INTO public.reports (type, reporter_type, reporter_id, reporter_name, target_id, target_name,
                            job_posting_id, description, status, created_at)
VALUES ('inappropriate_behavior', 'employer', jpc_chat_id('owner'), 'owner', jpc_chat_id('applicant'), 'x',
        jpc_chat_id('jp'), '[채팅 신고] 기타', 'pending', clock_timestamp() - interval '2 years' - interval '1 day')
RETURNING jpc_chat_put('rep_stale', id);
INSERT INTO public.chat_report_evidence (report_id, reporter_id, reported_message_id, snapshot)
VALUES (jpc_chat_id('rep_stale'), jpc_chat_id('owner'), gen_random_uuid(),
        jsonb_build_object('source', 'chat', 'imagePaths', jsonb_build_array()));

-- 경계 심기: old = 1년 + 1분 전 · fresh = 1년 − 1분 전
UPDATE public.chat_conversations SET last_message_at = clock_timestamp() - interval '1 year' - interval '1 minute'
 WHERE id = jpc_chat_id('old');
UPDATE public.chat_conversations SET last_message_at = clock_timestamp() - interval '1 year' + interval '1 minute'
 WHERE id = jpc_chat_id('fresh');

-- ------------------------------------------------------------
-- 권한 · 크론
-- ------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.chat_purge_expired(boolean)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.chat_purge_expired(boolean)', 'EXECUTE'),
  'G1 클라이언트 롤은 purge 를 실행할 수 없다');
SELECT is((SELECT schedule || ' | ' || btrim(command) FROM cron.job WHERE jobname = 'chat-retention-purge'),
  '53 16 * * * | SELECT public.chat_purge_expired();',
  'G2 크론: 매일 UTC 16:53(KST 01:53) — process-scheduled-deletions(UTC 17:13) 20분 전');

-- ------------------------------------------------------------
-- D. dry-run — 건수만, 아무것도 바꾸지 않는다
-- ------------------------------------------------------------
SELECT is(
  (SELECT r - 'dryRun' FROM (SELECT chat_purge_expired(true) AS r) x),
  jsonb_build_object('conversations', 1, 'messages', 3, 'notifications',
                     (SELECT count(*)::int FROM public.notifications
                       WHERE type = 'chat_message' AND data ->> 'conversationId' = jpc_chat_id('old')::text),
                     'evidenceSnapshots', 2,
                     'media', jsonb_build_object('retentionPurge', 1, 'orphan', 2)),
  'D1 dry-run 건수: 방 1 · 메시지 3 · 증거 만료 2(처리 후 1년·미처리 2년) · 사진(만료 방 1 = 봉인 증거 제외, 고아 2 = 24시간 지난 chat-media·접수함)');
SELECT is(
  row((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('old')),
      (SELECT count(*)::int FROM public.chat_media_deletion_queue),
      (SELECT count(*)::int FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep_old')))::text,
  '(1,0,1)', 'D2 dry-run 뒤: old 방 그대로 · 큐 0 · 증거 스냅샷 그대로(행 비교 — 합산은 서로 상쇄될 수 있다)');

-- ------------------------------------------------------------
-- P. 실제 실행
-- ------------------------------------------------------------
SELECT lives_ok($$ SELECT chat_purge_expired() $$, 'P1 purge 실행');
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('old')), 0,
  'P2 1년 + 1분 지난 방은 지워진다');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('old')), 0,
  'P3 그 방 메시지도(FK CASCADE)');
SELECT is((SELECT count(*)::int FROM public.chat_conversations WHERE id = jpc_chat_id('fresh')), 1,
  'P4 1년 − 1분인 방은 남는다(경계)');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE conversation_id = jpc_chat_id('fresh')), 2,
  'P4b 그 방 메시지도 그대로');
SELECT is((SELECT count(*)::int FROM public.notifications
            WHERE type = 'chat_message' AND data ->> 'conversationId' = jpc_chat_id('old')::text), 0,
  'P5 지운 방의 채팅 알림(미리보기 사본)도 지워진다');

SELECT is((SELECT reason FROM public.chat_media_deletion_queue WHERE object_name = current_setting('chat.p_old')),
  'retention_purge', 'P6 지운 방의 사진 → 큐(retention_purge)');
SELECT is((SELECT count(*)::int FROM public.chat_media_deletion_queue WHERE object_name = current_setting('chat.p_ev')),
  0, 'P7 봉인 중인 신고 증거 사진은 방이 지워져도 남긴다(D12)');
SELECT is((SELECT reason FROM public.chat_media_deletion_queue WHERE object_name = current_setting('chat.p_orphan_old')),
  'orphan', 'P8 어느 메시지도 가리키지 않는 25시간 된 사진 → 고아');
SELECT is((SELECT reason FROM public.chat_media_deletion_queue
            WHERE bucket_id = 'chat-media-inbox' AND object_name = current_setting('chat.p_inbox_old')),
  'orphan', 'P9 정화 안 된 채 25시간 된 접수함 사진 → 고아');
SELECT is((SELECT count(*)::int FROM public.chat_media_deletion_queue
            WHERE object_name IN (current_setting('chat.p_orphan_new'), current_setting('chat.p_inbox_new'),
                                  current_setting('chat.p_fresh'))),
  0, 'P10 1시간 된 고아 후보(업로드 직후 전송 중일 수 있다)와 살아 있는 방 사진은 남긴다');

SELECT is((SELECT count(*)::int FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep_old')), 0,
  'P11 처리 후 1년 지난 신고 증거 스냅샷은 지운다(D12) — 신고 행 자체는 남는다');
SELECT is((SELECT reason FROM public.chat_media_deletion_queue WHERE object_name = current_setting('chat.p_expired_ev')),
  'orphan', 'P12 봉인이 풀린 증거 사진은 같은 실행에서 고아로 큐에 들어간다');
SELECT is((SELECT count(*)::int FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep_stale')), 0,
  'P11b 처리 안 된 신고라도 생성 후 2년이 지나면 스냅샷을 지운다');
SELECT is(row((SELECT count(*)::int FROM public.chat_report_evidence WHERE report_id = jpc_chat_id('rep_live')),
              (SELECT count(*)::int FROM public.reports WHERE id IN (jpc_chat_id('rep_old'), jpc_chat_id('rep_stale'))))::text,
  '(1,2)', 'P13 대조군: 처리 전 신고 스냅샷은 그대로(1) · 만료된 두 신고의 행 자체는 남는다(2)');

SELECT is((chat_purge_expired() -> 'conversations')::int, 0, 'P14 두 번째 실행은 할 일이 없다(멱등)');

SELECT * FROM finish();
ROLLBACK;
