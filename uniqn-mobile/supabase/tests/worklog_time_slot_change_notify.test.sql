-- ============================================================
-- 출근 예정 시각(time_slot) 변경 알림 회귀 테스트
-- ============================================================
-- 목적: notify_on_work_log_update 의 Case 2-B 를 고정한다. 마이그레이션
--   20260731140000_notify_on_time_slot_change.sql 적용 후 실행.
--
-- 배경: Case 2 는 modification_history 길이 증가로만 발화하는데, time_slot 을 쓰는 유일한
--   경로(updateSlot)는 그 배열을 건드리지 않아 출근 예정 시각 변경이 무음으로 통과했다.
--
-- 시나리오:
--   T1. 시각 → 시각 변경 → 알림 1건 (무음 통과 회귀 방지 — 이게 핵심)
--   T2. 취소와 동시에 시각 변경 → Case 2-B 0건 (Case 1 이 이미 통지하므로 중복 금지)
--   T3. time_slot 을 안 건드리는 UPDATE → 0건 (모든 컬럼 UPDATE 에 트리거가 붙어 있어
--       가드가 없으면 메모만 고쳐도 알림이 나간다)
--   T4. application_id 가 NULL 이면 본문에 '취소를 요청' 문구가 없다
--       (직접 배치 스태프에겐 취소 요청 버튼이 구조적으로 없다 — ScheduleDetailModal 게이트)
--   T5. application_id 가 있고 status='scheduled' 면 취소 안내가 붙는다
--   T6. SECDEF search_path 에 pg_temp 보존 (CREATE OR REPLACE 가 proconfig 를 통째로
--       갈아치우므로, 20260711100000 의 일괄 하드닝이 되돌아가는지 직접 본다)
--
-- 하네스: notification_counter_insert_guard.test.sql 과 동일
--   (BEGIN/plan/finish/ROLLBACK, 마커 이메일 __sql_fixture_wtsc_*)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws uuid;
  v_job uuid;
  v_wl_plain uuid;
  v_wl_cancel uuid;
  v_wl_untouched uuid;
  v_wl_app uuid;
  v_app uuid;
  v_n int;
  v_body text;
  v_search_path text;
  v_title constant text := '출근 예정 시간 변경';
BEGIN
  -- seed
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wtsc_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"WTSC owner"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_wtsc_staff@test.local', '{"role":"staff"}'::jsonb, '{"name":"WTSC staff"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wtsc_owner@test.local', 'fixture owner', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_wtsc_staff@test.local', 'fixture staff', 'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (name, owner_id) VALUES ('__sql_fixture_wtsc_ws', v_owner)
    RETURNING id INTO v_ws;
  INSERT INTO public.job_postings (title, workspace_id, owner_id) VALUES ('__sql_fixture_wtsc_job', v_ws, v_owner)
    RETURNING id INTO v_job;
  INSERT INTO public.applications (applicant_id, job_posting_id, applicant_name)
    VALUES (v_staff, v_job, 'fixture staff') RETURNING id INTO v_app;

  INSERT INTO public.work_logs (staff_id, job_posting_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, '2026-08-01', '18:00', v_owner) RETURNING id INTO v_wl_plain;
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, '2026-08-02', '18:00', v_owner) RETURNING id INTO v_wl_cancel;
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, '2026-08-03', '18:00', v_owner) RETURNING id INTO v_wl_untouched;
  INSERT INTO public.work_logs (staff_id, job_posting_id, application_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, v_app, '2026-08-04', '18:00', v_owner) RETURNING id INTO v_wl_app;

  -- T1: 시각 → 시각
  UPDATE public.work_logs SET time_slot = '20:00', edited_by = v_owner WHERE id = v_wl_plain;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_staff AND title = v_title AND data->>'workLogId' = v_wl_plain::text;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'T1 fail: 출근 예정 시각 변경이 무음으로 통과 (알림 %건, 기대 1)', v_n;
  END IF;

  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND title = v_title AND data->>'workLogId' = v_wl_plain::text;
  IF v_body NOT LIKE '%18:00 → 20:00%' THEN
    RAISE EXCEPTION 'T1 fail: 이전값 병기 누락 (body=%)', v_body;
  END IF;

  -- T2: 취소 + 시각 동시 변경 → Case 2-B 침묵
  UPDATE public.work_logs SET status = 'cancelled', time_slot = '21:00' WHERE id = v_wl_cancel;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_staff AND title = v_title AND data->>'workLogId' = v_wl_cancel::text;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'T2 fail: 취소 통지와 중복 발송 (알림 %건, 기대 0)', v_n;
  END IF;

  -- T3: time_slot 무관 UPDATE → 침묵
  UPDATE public.work_logs SET notes = '메모만 변경' WHERE id = v_wl_untouched;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE recipient_id = v_staff AND title = v_title AND data->>'workLogId' = v_wl_untouched::text;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'T3 fail: time_slot 을 안 바꿨는데 발송 (알림 %건, 기대 0)', v_n;
  END IF;

  -- T4: application_id NULL → 취소 안내 없음 (v_wl_plain 재사용)
  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND title = v_title AND data->>'workLogId' = v_wl_plain::text;
  IF v_body LIKE '%취소를 요청%' THEN
    RAISE EXCEPTION 'T4 fail: 취소 버튼이 없는 직접 배치에 취소를 권함 (body=%)', v_body;
  END IF;

  -- T5: application_id 있음 + scheduled → 취소 안내 있음
  UPDATE public.work_logs SET time_slot = '20:00' WHERE id = v_wl_app;
  SELECT body INTO v_body FROM public.notifications
   WHERE recipient_id = v_staff AND title = v_title AND data->>'workLogId' = v_wl_app::text;
  IF v_body IS NULL OR v_body NOT LIKE '%취소를 요청%' THEN
    RAISE EXCEPTION 'T5 fail: 취소 요청 경로가 있는데 안내가 없음 (body=%)', COALESCE(v_body, '(알림 없음)');
  END IF;

  -- T6: SECDEF search_path 에 pg_temp 보존
  SELECT c INTO v_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
         unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
   WHERE n.nspname = 'public' AND p.proname = 'notify_on_work_log_update'
     AND c LIKE 'search_path=%';
  IF v_search_path IS NULL OR v_search_path NOT ILIKE '%pg_temp%' THEN
    RAISE EXCEPTION 'T6 fail: CREATE OR REPLACE 가 pg_temp 하드닝을 되돌림 (proconfig=%)',
      COALESCE(v_search_path, '(없음)');
  END IF;
END $$;

SELECT pass('Case 2-B: 출근 예정 시각 변경 알림 — 발화·중복금지·무관컬럼침묵·취소안내 조건부·pg_temp 보존');

SELECT * FROM finish();
ROLLBACK;
