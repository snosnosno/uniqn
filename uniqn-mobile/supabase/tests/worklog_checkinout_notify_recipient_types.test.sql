-- =============================================================================
-- 출퇴근 알림 수신자별 타입 분리 회귀 가드 (감사 A3, 마이그 20260807160000)
-- =============================================================================
-- 사용법: npx supabase test db supabase/tests/worklog_checkinout_notify_recipient_types.test.sql --local
--   ⚠️ 헬퍼 선행 필수: npm run test:db:helpers
--
-- 배경 — 이 가드가 없어서 실제로 뚫렸다:
--   2026-04-17 원설계는 수신자별로 타입을 나눠 보냈다(check_in_confirmed / staff_checked_in).
--   그런데 2026-04-21 의 timestamptz 전환 리팩터(문서상 목표가 "비파괴")가 이 넷을
--   work_log_check_in / work_log_check_out 두 종으로 **조용히 합쳐 버렸다.**
--   타입이 곧 딥링크 방향 판별자였기 때문에, 합쳐진 순간
--     ① 클라 enum 미등록 → '출퇴근' 카테고리 탭에서 알림 증발
--     ② 푸시 카테고리 게이트 fail-open → 꺼도 계속 발송
--     ③ 구인자가 자기 공고의 '구직자용' 상세로 착지
--   가 동시에 발생했고 **2026-08-07 전체 감사까지 108일간 아무도 몰랐다.**
--   테스트가 없으면 리팩터는 계약을 조용히 먹는다.
--
-- 불변식:
--   ① 스태프 수신분 = check_in_confirmed / check_out_confirmed, link '/schedule/{workLogId}'
--   ② 구인자 수신분 = staff_checked_in / staff_checked_out, link '/employer/applicants/{jobPostingId}'
--   ③ 합쳐진 레거시 값(work_log_check_*)은 더 이상 발송되지 않는다
-- =============================================================================

BEGIN;
SELECT plan(3);

DO $$
DECLARE
  v_staff uuid; v_owner uuid;
  v_ws uuid := gen_random_uuid();
  v_jp uuid := gen_random_uuid();
  v_wl uuid := gen_random_uuid();
BEGIN
  v_staff := jpc_test_create_user('staff');
  v_owner := jpc_test_create_user('employer');
  INSERT INTO public.workspaces (id, name, owner_id, member_count)
  VALUES (v_ws, '출퇴근 알림 가드 ws', v_owner, 1);
  INSERT INTO public.job_postings (id, owner_id, title, status, location, description, workspace_id)
  VALUES (v_jp, v_owner, '출퇴근 알림 가드 공고', 'active', '{"address":"서울"}'::jsonb, '설명', v_ws);
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, status, role)
  VALUES (v_wl, v_staff, v_jp, current_date, 'scheduled', 'dealer');

  -- 실제 출근/퇴근 전환을 태운다(트리거 경로를 우회하지 않는다).
  UPDATE public.work_logs SET check_in_ts  = now() WHERE id = v_wl;
  UPDATE public.work_logs SET check_out_ts = now() WHERE id = v_wl;

  PERFORM set_config('wl.id', v_wl::text, true);
  PERFORM set_config('wl.jp', v_jp::text, true);
  PERFORM set_config('wl.staff', v_staff::text, true);
  PERFORM set_config('wl.owner', v_owner::text, true);
END $$;

-- ─── (1) 스태프 수신분: 본인 확인 타입 + 스케줄 상세 링크 ───
SELECT is(
  (SELECT string_agg(type || '@' || link, ' | ' ORDER BY type)
     FROM public.notifications
    WHERE recipient_id = (current_setting('wl.staff'))::uuid
      AND data->>'workLogId' = current_setting('wl.id')
      AND type LIKE 'check_%'),
  format('check_in_confirmed@/schedule/%s | check_out_confirmed@/schedule/%s',
         current_setting('wl.id'), current_setting('wl.id')),
  '스태프는 check_in/out_confirmed 를 /schedule/{workLogId} 링크로 받는다');

-- ─── (2) 구인자 수신분: 스태프 관찰 타입 + 구인자 화면 링크 ───
-- '/jobs/{id}' 로 되돌아가면 구직자용 공고 상세에 착지한다 — 그게 감사가 잡은 증상이다.
SELECT is(
  (SELECT string_agg(type || '@' || link, ' | ' ORDER BY type)
     FROM public.notifications
    WHERE recipient_id = (current_setting('wl.owner'))::uuid
      AND data->>'workLogId' = current_setting('wl.id')
      AND type LIKE 'staff_check%'),
  format('staff_checked_in@/employer/applicants/%s | staff_checked_out@/employer/applicants/%s',
         current_setting('wl.jp'), current_setting('wl.jp')),
  '구인자는 staff_checked_in/out 을 /employer/applicants/{jobPostingId} 링크로 받는다');

-- ─── (3) 합쳐진 레거시 값은 더 이상 발송되지 않는다 ───
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE data->>'workLogId' = current_setting('wl.id')
      AND type IN ('work_log_check_in', 'work_log_check_out')),
  0,
  'work_log_check_in/out 은 발송되지 않는다(수신자 미구분 = 라우팅 판별자 소멸)');

SELECT * FROM finish();
ROLLBACK;
