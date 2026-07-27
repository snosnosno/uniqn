-- ============================================================
-- 공고 자동 마감 파이프라인 회귀 가드 (2026-07-27, 마이그 20260727000000)
-- ============================================================
-- 배경: `last_work_date` 에 값을 쓰는 코드가 레포에 0곳이라 자동 마감 크론이
--   몇 달간 매일 0건을 처리하며 조용히 죽어 있었다(2026-07-26 적발). 스키마·크론·
--   인덱스는 전부 갖춰져 있었고 **writer 만 없었다**. 같은 형태의 재발을 잡는다.
--
-- 시나리오:
--   S1. work_dates INSERT → last_work_date 자동 기록 (writer 존재 가드 — 원 사고)
--   S2. work_dates UPDATE → last_work_date 추종
--   S3. 컷오프 지난 공고 → fn_expire_by_last_work_date() → closed + 건수 기록
--   S4. 자동 마감 → applied 지원 rejected(system:auto_close) + 거절 알림 미발송
--   S5. 수동 마감(manual) → applied 지원 불변 (reopen 가능성 보존)
--   S6. fixed + fixed_config NULL + 생성 8일 경과 → fn_expire_fixed_postings_batch() → closed
--       (writer 부재분 fallback — 이게 없으면 어떤 경로로도 마감되지 않는다)
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_pac_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();

  v_jp_s1 uuid := gen_random_uuid();
  v_jp_s3 uuid := gen_random_uuid();
  v_jp_s4 uuid := gen_random_uuid();
  v_jp_s5 uuid := gen_random_uuid();
  v_jp_s6 uuid := gen_random_uuid();
  v_app_s4 uuid := gen_random_uuid();
  v_app_s5 uuid := gen_random_uuid();

  v_lwd date;
  v_status text;
  v_app_status text;
  v_processed_by text;
  v_closed_reason text;
  v_log_before int;
  v_log_after int;
  v_notif_count int;
  v_cutoff date;

  v_sched jsonb := jsonb_build_object('kind','dated','requirements', jsonb_build_array(
    jsonb_build_object('date','2026-07-01','timeSlots', jsonb_build_array(
      jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
        jsonb_build_object('role','dealer','count',1)))))));
BEGIN
  -- 0. seed users + workspace
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id, '__sql_fixture_pac_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"PAC_OWNER"}'::jsonb, now(), now()),
    (v_staff_id, '__sql_fixture_pac_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"PAC_STAFF"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_pac_ws', v_owner_id, now(), now());

  -- 컷오프 = KST 오늘 - 2일 (fn_expire_by_last_work_date 와 동일 계산)
  v_cutoff := ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date;

  -- ============================================================
  -- S1. work_dates INSERT → last_work_date 자동 기록 (writer 가드)
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, work_dates, created_at, updated_at)
  VALUES (v_jp_s1, v_owner_id, v_workspace_id, '__sql_fixture: pac s1', 1, 0, 'active', v_sched,
          ARRAY['2026-07-01','2026-07-05','2026-07-03'], now(), now());

  SELECT last_work_date INTO v_lwd FROM public.job_postings WHERE id = v_jp_s1;
  IF v_lwd IS NULL THEN
    RAISE EXCEPTION 'S1: last_work_date writer 부재 — work_dates 를 넣었는데 NULL 이다 (원 사고 재발)';
  END IF;
  IF v_lwd <> DATE '2026-07-05' THEN
    RAISE EXCEPTION 'S1: last_work_date expected 2026-07-05 (최대값), got %', v_lwd;
  END IF;

  -- ============================================================
  -- S2. work_dates UPDATE → last_work_date 추종
  -- ============================================================
  UPDATE public.job_postings SET work_dates = ARRAY['2026-08-10','2026-08-02'] WHERE id = v_jp_s1;
  SELECT last_work_date INTO v_lwd FROM public.job_postings WHERE id = v_jp_s1;
  IF v_lwd <> DATE '2026-08-10' THEN
    RAISE EXCEPTION 'S2: work_dates 갱신 후 last_work_date expected 2026-08-10, got %', v_lwd;
  END IF;

  -- ============================================================
  -- S3. 컷오프 지난 공고 → 날짜 크론이 마감 + 처리 건수 기록
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, schedule, work_dates, created_at, updated_at)
  VALUES (v_jp_s3, v_owner_id, v_workspace_id, '__sql_fixture: pac s3', 1, 0, 'active', 'regular', v_sched,
          ARRAY[(v_cutoff - 1)::text], now(), now());

  SELECT count(*)::int INTO v_log_before
  FROM public.action_logs WHERE action = 'cron.expire_by_last_work_date';

  PERFORM public.fn_expire_by_last_work_date();

  SELECT status::text, closed_reason INTO v_status, v_closed_reason
  FROM public.job_postings WHERE id = v_jp_s3;
  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'S3: 컷오프 지난 공고가 안 닫혔다 — status=%', v_status;
  END IF;
  IF v_closed_reason <> 'expired_by_work_date' THEN
    RAISE EXCEPTION 'S3: closed_reason expected expired_by_work_date, got %', v_closed_reason;
  END IF;

  SELECT count(*)::int INTO v_log_after
  FROM public.action_logs WHERE action = 'cron.expire_by_last_work_date';
  IF v_log_after <> v_log_before + 1 THEN
    RAISE EXCEPTION 'S3: 처리 건수 기록 누락 — action_logs 델타 % (expected 1)', v_log_after - v_log_before;
  END IF;

  -- ============================================================
  -- S4. 자동 마감 → 미확정 지원 종결 + 거절 알림 미발송
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, schedule, work_dates, created_at, updated_at)
  VALUES (v_jp_s4, v_owner_id, v_workspace_id, '__sql_fixture: pac s4', 1, 0, 'active', 'regular', v_sched,
          ARRAY[(v_cutoff - 1)::text], now(), now());

  INSERT INTO public.applications (id, applicant_id, job_posting_id, status, applicant_name, created_at, updated_at)
  VALUES (v_app_s4, v_staff_id, v_jp_s4, 'applied', 'PAC_STAFF', now(), now());

  PERFORM public.fn_expire_by_last_work_date();

  SELECT status::text, processed_by INTO v_app_status, v_processed_by
  FROM public.applications WHERE id = v_app_s4;
  IF v_app_status <> 'rejected' THEN
    RAISE EXCEPTION 'S4: 자동 마감 후에도 지원이 대기중 — status=%', v_app_status;
  END IF;
  IF v_processed_by <> 'system:auto_close' THEN
    RAISE EXCEPTION 'S4: processed_by expected system:auto_close, got %', COALESCE(v_processed_by, '(null)');
  END IF;

  SELECT count(*)::int INTO v_notif_count
  FROM public.notifications
  WHERE recipient_id = v_staff_id AND type = 'application_rejected';
  IF v_notif_count <> 0 THEN
    RAISE EXCEPTION 'S4: 시스템 자동 거절인데 거절 알림이 나갔다 — % 건 (job_closed 와 중복)', v_notif_count;
  END IF;

  -- ============================================================
  -- S5. 수동 마감 → 지원 불변 (reopen 가능성 보존)
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, schedule, work_dates, created_at, updated_at)
  VALUES (v_jp_s5, v_owner_id, v_workspace_id, '__sql_fixture: pac s5', 1, 0, 'active', 'regular', v_sched,
          ARRAY['2026-09-01'], now(), now());

  INSERT INTO public.applications (id, applicant_id, job_posting_id, status, applicant_name, created_at, updated_at)
  VALUES (v_app_s5, v_staff_id, v_jp_s5, 'applied', 'PAC_STAFF', now(), now());

  UPDATE public.job_postings
  SET status = 'closed', closed_at = now(), closed_reason = 'manual', updated_at = now()
  WHERE id = v_jp_s5;

  SELECT status::text INTO v_app_status FROM public.applications WHERE id = v_app_s5;
  IF v_app_status <> 'applied' THEN
    RAISE EXCEPTION 'S5: 수동 마감이 지원을 종결시켰다 — status=% (reopen 경로 파괴)', v_app_status;
  END IF;

  -- ============================================================
  -- S6. fixed + fixed_config NULL + 생성 8일 경과 → fallback 마감
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, posting_type, schedule, created_at, updated_at)
  VALUES (v_jp_s6, v_owner_id, v_workspace_id, '__sql_fixture: pac s6', 1, 0, 'active', 'fixed', v_sched,
          now() - interval '8 days', now() - interval '8 days');

  PERFORM public.fn_expire_fixed_postings_batch();

  SELECT status::text, closed_reason INTO v_status, v_closed_reason
  FROM public.job_postings WHERE id = v_jp_s6;
  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'S6: expiresAt 없는 고정 공고가 안 닫혔다 — status=% (영구 미마감 사각지대)', v_status;
  END IF;
  IF v_closed_reason <> 'expired' THEN
    RAISE EXCEPTION 'S6: closed_reason expected expired, got %', v_closed_reason;
  END IF;

  -- ============================================================
  -- S7. 공고 제목 수정 → 지원자에게 '공고 수정' 알림
  --
  -- `text[] || 'literal'` 타입 해석 오류로 이 알림은 한 번도 나가지 못했다
  -- (prod job_updated 누적 0건). EXCEPTION 핸들러가 삼켜 조용히 사라졌다.
  -- ============================================================
  UPDATE public.job_postings SET title = '__sql_fixture: pac s5 (수정)' WHERE id = v_jp_s5;

  SELECT count(*)::int INTO v_notif_count
  FROM public.notifications
  WHERE recipient_id = v_staff_id AND type = 'job_updated';
  IF v_notif_count <> 1 THEN
    RAISE EXCEPTION 'S7: 공고 수정 알림 expected 1건, got % (배열 리터럴 오류 재발?)', v_notif_count;
  END IF;

  -- ============================================================
  -- S8. capacity_full 자동 전이는 '공고 수정' 알림을 만들지 않는다
  --
  -- status 를 변경필드 목록에 넣으면 좌석이 찼다 빌 때마다 지원자 전원에게
  -- 알림이 나간다(알림 폭탄). 전용 알림이 있는 cancelled/closed 와 달리
  -- capacity_full 전이는 통지 대상이 아니다.
  -- ============================================================
  UPDATE public.job_postings SET status = 'capacity_full', updated_at = now() WHERE id = v_jp_s5;

  SELECT count(*)::int INTO v_notif_count
  FROM public.notifications
  WHERE recipient_id = v_staff_id AND type = 'job_updated';
  IF v_notif_count <> 1 THEN
    RAISE EXCEPTION 'S8: capacity_full 전이가 수정 알림을 발생시켰다 — 누적 % 건 (expected 1)', v_notif_count;
  END IF;

  -- Cleanup (역순)
  DELETE FROM public.applications WHERE job_posting_id IN (v_jp_s4, v_jp_s5);
  DELETE FROM public.notifications WHERE recipient_id IN (v_owner_id, v_staff_id);
  DELETE FROM public.job_postings WHERE id IN (v_jp_s1, v_jp_s3, v_jp_s4, v_jp_s5, v_jp_s6);
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_staff_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id);
END $$;

SELECT pass('POSTING_AUTO_CLOSE_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
