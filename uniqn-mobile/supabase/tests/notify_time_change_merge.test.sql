-- ============================================================
-- notify_on_work_log_update — 예정 + 실적을 한 번에 바꿔도 알림은 1통 (병합 가드)
-- ============================================================
-- 목적: Case 2(이력 기반 근무 시간 변경)와 Case 2-B(출근 예정 time_slot 변경)의
--   **상호작용**을 고정한다. 마이그레이션 20260806120000_notify_merge_time_change.sql
--   적용 후 실행.
--
-- 배경: 두 Case 는 독립 IF 이고 사이에 early return 이 없다(RETURN NEW 는 함수 말미).
--   근무 시간 편집 통일 이후 update_work_log_slot 이 예정(time_slot)과
--   실적(check_in_ts + modification_history)을 **한 UPDATE** 로 바꾸므로, 병합 가드가
--   없으면 저장 한 번에 스태프 폰으로 schedule_change 알림이 2통 간다.
--
-- 시나리오:
--   T1. 예정만 변경          → schedule_change 1건 (Case 2-B 단독 — 기존 동작 회귀 방지)
--   T2. 실적(이력)만 변경     → schedule_change 1건 (Case 2 단독 — 기존 동작 회귀 방지)
--   T3. 🔴 예정+실적 동시     → schedule_change **1건** (병합 가드의 핵심)
--   T4. 그 1통 본문에 바뀐 출근 예정 시각이 담긴다 (Case 2-B 를 지우는 게 아니라 흡수한다)
--   T5. 그 1통 본문에 이력 기반 시작 시각 문구도 그대로 남는다 (Case 2 정보 무손실)
--   T6. 병합된 1통에도 취소 안내가 보존된다 (Case 2-B 가 붙였을 문구를 잃지 않는다)
--   T7. 취소와 동시에 바뀌면 병합 문구가 붙지 않는다
--       (Case 2-B 는 원래 status='cancelled' 에서 침묵한다 — Case 1 이 이미 통지)
--
-- 🔗 형제 파일 분담 — notify_work_log_contract.test.sql:28-31 의 "세 번째 파일을 만들지 말 것"
--   주의를 알고도 새 파일로 둔다. 그 분담은 **Case 2-B 단독 축**을 두 파일로 가른 것인데,
--   이 파일이 보는 것은 Case 2 ↔ Case 2-B 를 잇는 **병합 축**이라 어느 쪽에도 속하지 않는다.
--     · worklog_time_slot_change_notify.test.sql — Case 2-B 발화 조건(T1 발화·T2 취소 중복금지·
--       T3 무관컬럼 침묵·T4/T5 취소 안내 조건부·T6 pg_temp)
--     · notify_work_log_contract.test.sql        — 취소 힌트 억제 축(M3) + Case 3-B(M5)
--   병합 축이 아닌 새 단언은 여기 넣지 말고 위 두 파일 중 맞는 쪽으로 보낼 것.
--
-- 하네스: worklog_time_slot_change_notify.test.sql 과 동일
--   (BEGIN/plan/finish/ROLLBACK, 마커 이메일 __sql_fixture_ntcm_*)
-- ⚠️ 알림 개수는 반드시 `type = 'schedule_change'` 로 좁혀 센다. T3 이 실제 저장 경로를
--    본떠 check_in_ts 도 함께 쓰는데, 그러면 tr_notify_work_log_checkinout 이
--    'work_log_check_in' 알림을 따로 넣는다 — 그건 이 축과 무관하다.
-- ============================================================

BEGIN;
SELECT plan(7);

-- ─── 시드 ───
DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws uuid;
  v_job uuid;
  v_app uuid;
  v_wl uuid;
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_ntcm_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"NTCM owner"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_ntcm_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"NTCM staff"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_ntcm_owner@test.local', 'fixture owner', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_ntcm_staff@test.local', 'fixture staff', 'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (name, owner_id) VALUES ('__sql_fixture_ntcm_ws', v_owner)
    RETURNING id INTO v_ws;
  INSERT INTO public.job_postings (title, workspace_id, owner_id) VALUES ('__sql_fixture_ntcm_job', v_ws, v_owner)
    RETURNING id INTO v_job;
  INSERT INTO public.applications (applicant_id, job_posting_id, applicant_name)
    VALUES (v_staff, v_job, 'fixture staff') RETURNING id INTO v_app;
  -- ⚠️ applications 는 (job_posting_id, applicant_id) 유니크라 같은 스태프·같은 공고로
  --    두 번째 지원서를 만들 수 없다. T7 은 취소 안내를 보지 않으므로 application_id 없이 둔다.

  PERFORM set_config('ntcm.staff', v_staff::text, true);
  PERFORM set_config('ntcm.owner', v_owner::text, true);

  -- T1 대상: 예정만 변경
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, '2026-08-10', '18:00', v_owner) RETURNING id INTO v_wl;
  PERFORM set_config('ntcm.wl_a', v_wl::text, true);

  -- T2 대상: 실적(이력)만 변경
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, '2026-08-11', '18:00', v_owner) RETURNING id INTO v_wl;
  PERFORM set_config('ntcm.wl_b', v_wl::text, true);

  -- T3~T6 대상: 예정+실적 동시 변경 (취소 안내 조건을 만족시키려 application_id 를 붙인다)
  INSERT INTO public.work_logs (staff_id, job_posting_id, application_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, v_app, '2026-08-12', '18:00', v_owner) RETURNING id INTO v_wl;
  PERFORM set_config('ntcm.wl_c', v_wl::text, true);

  -- T7 대상: 취소와 동시에 예정+실적 변경
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, time_slot, owner_id)
    VALUES (v_staff, v_job, '2026-08-13', '18:00', v_owner) RETURNING id INTO v_wl;
  PERFORM set_config('ntcm.wl_d', v_wl::text, true);
END $$;

-- ─── T1: 예정만 변경 ───
UPDATE public.work_logs
   SET time_slot = '19:00', edited_by = current_setting('ntcm.owner')::uuid
 WHERE id = current_setting('ntcm.wl_a')::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_a')),
  1,
  'T1 예정(time_slot)만 바꾸면 근무 변경 알림 1통'
);

-- ─── T2: 실적(이력)만 변경 ───
UPDATE public.work_logs
   SET check_in_ts = '2026-08-11T10:00:00Z',
       modification_history = '[{"previousStartTime":"18:00","newStartTime":"10:00"}]'::jsonb
 WHERE id = current_setting('ntcm.wl_b')::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_b')),
  1,
  'T2 실적(modification_history)만 바꾸면 근무 변경 알림 1통'
);

-- ─── T3~T6: 예정 + 실적 동시 변경 (통일 편집 시트의 저장 한 번을 본뜬 UPDATE) ───
UPDATE public.work_logs
   SET time_slot = '20:00',
       check_in_ts = '2026-08-12T11:00:00Z',
       modification_history = '[{"previousStartTime":"18:00","newStartTime":"11:00"}]'::jsonb,
       edited_by = current_setting('ntcm.owner')::uuid
 WHERE id = current_setting('ntcm.wl_c')::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_c')),
  1,
  'T3 예정+실적을 한 UPDATE 로 바꿔도 근무 변경 알림은 1통 (병합 가드)'
);

SELECT ok(
  (SELECT bool_and(body LIKE '%18:00 → 20:00%') FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_c')),
  'T4 병합된 1통 본문에 바뀐 출근 예정 시각이 담긴다'
);

SELECT ok(
  (SELECT bool_and(body LIKE '%18:00 -> 11:00%') FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_c')),
  'T5 병합된 1통 본문에 이력 기반 시작 시각 문구도 그대로 남는다'
);

SELECT ok(
  (SELECT bool_and(body LIKE '%취소를 요청%') FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_c')),
  'T6 병합돼도 취소 안내가 보존된다 (Case 2-B 가 붙였을 문구를 잃지 않는다)'
);

-- ─── T7: 취소와 동시에 예정+실적 변경 ───
UPDATE public.work_logs
   SET status = 'cancelled',
       time_slot = '21:00',
       modification_history = '[{"previousStartTime":"18:00","newStartTime":"12:00"}]'::jsonb
 WHERE id = current_setting('ntcm.wl_d')::uuid;

SELECT ok(
  (SELECT NOT bool_or(body LIKE '%출근 예정%') FROM public.notifications
    WHERE recipient_id = current_setting('ntcm.staff')::uuid
      AND type = 'schedule_change'
      AND data->>'workLogId' = current_setting('ntcm.wl_d')),
  'T7 취소와 동시면 병합 문구를 붙이지 않는다 (Case 1 이 이미 통지 — Case 2-B 침묵 규칙 유지)'
);

SELECT * FROM finish();
ROLLBACK;
