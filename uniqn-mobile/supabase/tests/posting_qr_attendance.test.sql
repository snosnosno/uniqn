-- 공고별 고정 QR 자동 판별·다중 날짜·15분 정합성 회귀
BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_workspace uuid := gen_random_uuid();
  v_posting uuid := gen_random_uuid();
  v_app uuid := gen_random_uuid();
  v_first uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_today text := to_char(clock_timestamp() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');
  v_slot text := to_char(clock_timestamp() AT TIME ZONE 'Asia/Seoul', 'HH24:MI');
  v_result jsonb;
  v_selection_token uuid;
  v_initial_scanned_at timestamptz;
  -- QR 스캔은 스태프가, 픽스처 조작·관리자 수정은 소유자가 한다.
  -- `protect_work_log_payroll_columns` 는 app_metadata.role ∈ (admin, employer) 만
  -- payroll 파생 컬럼 변경을 허용한다. 시각을 바꾸면 payroll_amount 가 재계산되므로
  -- **시각을 건드리는 모든 구문**은 소유자 컨텍스트에서 실행해야 한다.
  c_staff_jwt text;
  c_owner_jwt text;
BEGIN
  c_staff_jwt := json_build_object('sub', v_staff, 'role', 'authenticated',
                   'app_metadata', json_build_object('role', 'staff'))::text;
  c_owner_jwt := json_build_object('sub', v_owner, 'role', 'authenticated',
                   'app_metadata', json_build_object('role', 'employer'))::text;
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_posting_qr_owner@test.local', '{"role":"employer"}', '{"name":"OWNER"}', now(), now()),
    (v_staff, '__sql_fixture_posting_qr_staff@test.local', '{"role":"staff"}', '{"name":"STAFF"}', now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_posting_qr_owner@test.local', 'OWNER', 'employer', true, now(), now()),
    (v_staff, '__sql_fixture_posting_qr_staff@test.local', 'STAFF', 'staff', true, now(), now())
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace, '__sql_fixture_posting_qr_ws', v_owner, now(), now());
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  ) VALUES (v_posting, v_owner, v_workspace, '__sql_fixture: posting qr', 5, 2, 'active', now(), now());
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at
  ) VALUES (v_app, v_posting, v_staff, 'STAFF', 'confirmed', now(), now());
  INSERT INTO public.work_logs (
    id, application_id, assignment_group_id, staff_id, job_posting_id, date,
    status, role, time_slot, is_fixed_posting, payroll_status, created_at, updated_at
  ) VALUES
    (v_first, v_app, 'a', v_staff, v_posting, v_today, 'scheduled', 'staff', v_slot, false, 'pending', now(), now()),
    (v_second, v_app, 'b', v_staff, v_posting, v_today, 'scheduled', 'staff', v_slot, false, 'pending', now(), now());

  PERFORM set_config('request.jwt.claims', c_staff_jwt, true);

  -- 후보가 둘이면 임의 처리하지 않는다.
  v_result := public.process_posting_qr_attendance(v_posting, v_staff, NULL);
  IF v_result->>'error' <> 'selection_required'
     OR jsonb_array_length(v_result->'candidates') <> 2 THEN
    RAISE EXCEPTION 'selection contract failed: %', v_result;
  END IF;
  v_selection_token := (v_result->>'selection_token')::uuid;
  SELECT scanned_at INTO v_initial_scanned_at
  FROM public.qr_attendance_selections WHERE token = v_selection_token;

  -- 선택한 행만 출근하며 서버 원본/15분 적용 시각이 함께 남는다.
  v_result := public.process_posting_qr_attendance(
    v_posting, v_staff, v_first, v_selection_token
  );
  IF NOT (v_result->>'success')::boolean OR v_result->>'action' <> 'checkIn' THEN
    RAISE EXCEPTION 'selected check-in failed: %', v_result;
  END IF;
  IF (v_result->>'scanned_at')::timestamptz IS DISTINCT FROM v_initial_scanned_at THEN
    RAISE EXCEPTION 'initial server scan timestamp was not preserved: %', v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.work_logs
    WHERE id = v_first
      AND check_in_scanned_at IS NOT NULL
      AND mod(extract(epoch FROM check_in_ts)::bigint, 900) = 0
  ) THEN
    RAISE EXCEPTION 'raw/applied check-in invariant failed';
  END IF;

  -- nullable payroll_status is still unsettled and must remain QR-eligible.
  --
  -- ⚠️ status 만 'checked_out' 으로 올리면 `work_logs_status_timestamp_consistency` 가
  --    거부한다 — 그 CHECK 는 checked_out/completed 에 check_in_ts·check_out_ts 를 **둘 다**
  --    요구한다. 이 테스트는 그 제약보다 오래됐고, 제약이 생긴 뒤로 여기서 죽어
  --    단언에 한 번도 도달하지 못했다(계획 1개 중 0개 실행 = Bad plan).
  --    퇴근 시각을 함께 세운다. `work_logs_checkout_after_checkin` 가드가 요구하는
  --    "퇴근 > 출근"도 만족해야 하므로 출근에 간격을 더한다.
  PERFORM set_config('request.jwt.claims', c_owner_jwt, true);
  UPDATE public.work_logs
  SET status = 'checked_out',
      check_out_ts = check_in_ts + interval '4 hours'
  WHERE id = v_first;
  UPDATE public.work_logs
  SET payroll_status = NULL
  WHERE id = v_second;
  PERFORM set_config('request.jwt.claims', c_staff_jwt, true);

  v_result := public.process_posting_qr_attendance(v_posting, v_staff, NULL, NULL);
  IF NOT (v_result->>'success')::boolean
     OR v_result->>'work_log_id' <> v_second::text THEN
    RAISE EXCEPTION 'nullable payroll status was excluded: %', v_result;
  END IF;

  -- A pre-existing invalid row must permit unrelated repairs/settlement updates.
  PERFORM set_config('request.jwt.claims', c_owner_jwt, true);
  ALTER TABLE public.work_logs DISABLE TRIGGER work_logs_checkout_after_checkin;
  UPDATE public.work_logs SET check_out_ts = check_in_ts WHERE id = v_first;
  ALTER TABLE public.work_logs ENABLE TRIGGER work_logs_checkout_after_checkin;
  UPDATE public.work_logs SET notes = 'legacy row remains editable' WHERE id = v_first;
  PERFORM set_config('request.jwt.claims', c_staff_jwt, true);

  -- 같은 적용 슬롯에서 즉시 퇴근하면 0시간 기록 대신 차단한다.
  --
  -- 🔴 2026-09-15 조사 결과 — **이 단언은 현재 코드로 도달할 수 없다. 제품 결정이 필요하다.**
  --    퇴근 후보 조건은 `v_scanned_at BETWEEN check_in_ts AND check_in_ts + 16h` 인데,
  --    20260909135618 이 넣은 15분 정규화가 `check_in_ts` 를 **올림(ceil)** 한다.
  --    그래서 출근 직후 check_in_ts 는 최대 15분 **미래**고, 그 동안 스캔 시각이 구간
  --    아래로 떨어져 후보가 0이 된다 → `checkout_too_early` 가 아니라
  --    `no_eligible_work_log` 가 나온다.
  --
  --    막히는 것 자체는 맞다(0시간 기록은 생기지 않는다). 문제는 **막히는 이유가 다르게
  --    보인다**는 것이다 — 스태프는 "방금 찍었으니 잠시 후 퇴근하세요" 대신 "해당 근무가
  --    없습니다" 를 본다. 출근 직후 최대 15분간 그렇다.
  --
  --    둘 중 하나를 정해야 한다:
  --      (a) 후보 구간의 하한을 `check_in_ts` 가 아니라 원본 스캔 시각
  --          (`check_in_scanned_at`)으로 둔다 → 기존 `checkout_too_early` 가 살아난다
  --      (b) 올림 정규화를 유지하고, 이 구간의 안내 문구를 별도 에러로 분리한다
  --    코드를 고치기 전에는 이 단언을 통과시킬 수 없고, 통과시키려고 기대값을
  --    `no_eligible_work_log` 로 바꾸면 **UX 결함을 계약으로 굳히는 것**이라 하지 않는다.
  v_result := public.process_posting_qr_attendance(v_posting, v_staff, NULL);
  IF v_result->>'error' <> 'checkout_too_early' THEN
    RAISE EXCEPTION 'zero-duration checkout was not blocked: %', v_result;
  END IF;

  -- 관리자 수정과 같은 일반 시각 변경도 15분 정규화 후 duration을 재계산한다.
  --
  -- ⚠️ 여기부터는 **소유자(employer) 컨텍스트**여야 한다. 위까지는 스태프 JWT 로 QR 을
  --    태웠는데, 시각을 바꾸면 payroll 재계산이 따라붙어 `protect_work_log_payroll_columns`
  --    가 staff 를 막는다(staff_cannot_modify_payroll_fields). 주석이 말하는 '관리자 수정'을
  --    실제 역할로도 맞춘다 — 가드는 app_metadata.role ∈ (admin, employer) 만 통과시킨다.
  PERFORM set_config('request.jwt.claims', c_owner_jwt, true);

  UPDATE public.work_logs
  SET check_in_ts = now() - interval '1 hour 1 minute',
      check_out_ts = now()
  WHERE id = v_first;
  IF NOT EXISTS (
    SELECT 1 FROM public.work_logs
    WHERE id = v_first
      AND mod(extract(epoch FROM check_in_ts)::bigint, 900) = 0
      AND mod(extract(epoch FROM check_out_ts)::bigint, 900) = 0
      AND work_duration = round((extract(epoch FROM (check_out_ts - check_in_ts)) / 3600)::numeric, 2)
  ) THEN
    RAISE EXCEPTION 'quarter-hour/duration recompute invariant failed';
  END IF;

  DELETE FROM public.work_logs WHERE id IN (v_first, v_second);
  DELETE FROM public.applications WHERE id = v_app;
  DELETE FROM public.job_postings WHERE id = v_posting;
  DELETE FROM public.workspaces WHERE owner_id = v_owner;
  DELETE FROM auth.users WHERE id IN (v_owner, v_staff);
END $$;

SELECT pass('POSTING_QR_ATTENDANCE_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
