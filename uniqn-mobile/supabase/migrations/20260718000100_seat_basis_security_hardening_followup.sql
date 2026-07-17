-- ============================================================
-- 좌석 기준 인원카운트 통일 — 후속 보안 하드닝 (독립 리뷰 P1·P2)
-- 리뷰 핸드오프: docs/planning/2026-07-17-seat-basis-review-handoff.md
-- 선행: 20260718000000_seat_basis_filled_total_positions.sql
--
-- P1 [HIGH·신규 노출] work_logs.job_posting_id 재지정 → 교차 테넌트 filled 오염 차단.
--    seat 델타 트리거(fn_sync_filled_positions_seat)가 NEW.job_posting_id 를 신뢰한다.
--    그런데 wl_update 정책이 WITH CHECK 부재(USING 재사용) + owner_id 만 안 바꾸면 통과 +
--    protect_work_log_payroll_columns 가 employer 즉시 RETURN NEW → 인증 employer 가 raw REST
--    PATCH 로 자기 work_log 의 job_posting_id 를 피해자 공고로 재지정 가능. seat 트리거가 그 값을
--    소비해 피해자 filled 를 오염(반복 시 조기 capacity_full → 피해자 모집 차단). baseline 엔
--    work_logs→filled 트리거가 없어 무해했으므로 이 노출은 seat 트리거 도입이 여는 신규 표면.
--    → work_logs.job_posting_id 를 불변으로 고정(합법 재부모화 경로 없음: add/confirm=INSERT,
--      cancel/remove=DELETE). 미래 재부모화 기능 필요 시 SECDEF RPC 로 명시 경유.
--
-- P2 [MED·기존 fail-open 정합] confirm_application owner_id bare 비교 → COALESCE fail-closed.
--    형제 3종(add_direct_staff/remove_direct_staff/cancel_application_atomically)은 이미
--    COALESCE(owner=caller,false). confirm 만 누락 → 고아 공고(owner_id NULL, ON DELETE SET NULL)
--    에서 NOT(NULL OR false...)=NULL → RAISE 미발화 → 인가 통과. 이 함수는 20260718000000 에서
--    이미 재작성됐으므로 동일 본문 + 1줄(COALESCE)만 교정해 CREATE OR REPLACE.
-- ============================================================

-- ------------------------------------------------------------
-- P1) work_logs.job_posting_id 불변 가드 (BEFORE UPDATE OF job_posting_id)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_work_logs_pin_posting_id()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NEW.job_posting_id IS DISTINCT FROM OLD.job_posting_id THEN
    RAISE EXCEPTION 'WORK_LOG_POSTING_IMMUTABLE: work_logs.job_posting_id 는 변경할 수 없습니다 (교차 테넌트 filled 오염 차단)'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_work_logs_pin_posting_id() IS
  'work_logs.job_posting_id 불변 고정. seat 델타 트리거(fn_sync_filled_positions_seat)가 신뢰하는 부모 FK 재지정(교차 테넌트 filled 오염)을 차단. 합법 재부모화 경로는 존재하지 않음.';
DROP TRIGGER IF EXISTS tr_work_logs_pin_posting_id ON public.work_logs;
CREATE TRIGGER tr_work_logs_pin_posting_id
  BEFORE UPDATE OF job_posting_id ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_work_logs_pin_posting_id();

-- ------------------------------------------------------------
-- P2) confirm_application: owner_id COALESCE fail-closed (형제 3종과 정합)
--     20260718000000 본문 그대로 + 인가 IF 의 owner 비교 1줄만 COALESCE 로 교정.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb, p_original_application jsonb DEFAULT NULL::jsonb, p_confirmation_history jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text, p_is_fixed_posting boolean DEFAULT false, p_assignments_v3 jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_app record; v_job record; v_work_log_ids uuid[] := '{}'; v_wl_id uuid; v_assignment jsonb;
  v_now timestamptz := now(); v_existing int; v_capacity int; v_rec record; v_is_fixed boolean;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_owner_id AND is_active = true) THEN
    RAISE EXCEPTION 'ACCOUNT_DISABLED: owner account is disabled (%)', p_owner_id;
  END IF;

  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND: %', p_application_id; END IF;
  IF v_app.status != 'applied' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 현재 상태 %, applied만 확정 가능', v_app.status;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_app.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_app.job_posting_id; END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';

  -- [P2] owner_id NULL(고아 공고) fail-closed — COALESCE 로 NULL→false (형제 RPC 3종과 정합).
  IF NOT (COALESCE(v_job.owner_id = p_owner_id, false) OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
    OR public.is_posting_collaborator(v_job.id, p_owner_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음';
  END IF;

  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_rec IN
      SELECT (a->>'date') AS a_date, public._posting_slot_key(a->>'timeSlot') AS slot_key,
        public._posting_role_key(a->>'role', a->>'customRole') AS role_key, COUNT(*)::int AS requested
      FROM jsonb_array_elements(p_assignments) a GROUP BY 1, 2, 3
    LOOP
      SELECT COUNT(*) INTO v_existing FROM work_logs wl
      WHERE wl.job_posting_id = v_app.job_posting_id AND wl.date = v_rec.a_date
        AND public._posting_slot_key(wl.time_slot) = v_rec.slot_key
        AND public._posting_role_key(wl.role::text, wl.custom_role) = v_rec.role_key
        AND wl.status NOT IN ('cancelled', 'no_show');

      SELECT COALESCE(MAX((r->>'count')::int), 0) INTO v_capacity
      FROM jsonb_array_elements(COALESCE(v_job.schedule->'requirements', '[]'::jsonb)) req
      CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
      CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
      WHERE COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date
        AND (CASE
              WHEN COALESCE((ts->>'isTimeToBeAnnounced')::boolean, false) THEN '미정'
              WHEN COALESCE(ts->>'startTime', ts->>'time') IS NOT NULL
                THEN public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
              WHEN v_is_fixed THEN 'NEGOTIABLE'
              ELSE public._posting_slot_key(COALESCE(ts->>'startTime', ts->>'time'))
            END) = v_rec.slot_key
        AND public._posting_role_key(r->>'role', r->>'customRole') = v_rec.role_key;

      -- [관측] capacity=0 = 정원가드 우회(슬롯/역할/날짜 미매칭). 좌석 기준 스펙 리스크 추적용 로그.
      IF v_capacity = 0 THEN
        RAISE LOG 'capacity=0 match: posting=% date=% slot=% role=%',
          v_app.job_posting_id, v_rec.a_date, v_rec.slot_key, v_rec.role_key;
      END IF;

      IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
        RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
          v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(p_assignments) > 0 THEN
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO work_logs (
        staff_id, job_posting_id, application_id, assignment_group_id, date, time_slot,
        staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
        role, custom_role, owner_id, status, is_fixed_posting, created_at, updated_at
      ) VALUES (
        v_app.applicant_id, v_app.job_posting_id, p_application_id,
        v_assignment->>'groupId', v_assignment->>'date', v_assignment->>'timeSlot',
        v_app.applicant_name, v_app.applicant_nickname, v_app.applicant_photo_url, v_app.applicant_photo_url_blurhash,
        COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
        v_assignment->>'customRole', p_owner_id, 'scheduled', v_is_fixed, v_now, v_now
      ) RETURNING id INTO v_wl_id;
      v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
    END LOOP;
  END IF;

  UPDATE applications SET
    status = 'confirmed', assignments = COALESCE(p_assignments_v3, assignments),
    original_application = COALESCE(p_original_application, original_application),
    confirmation_history = p_confirmation_history, confirmed_at = v_now,
    processed_by = p_owner_id::text, processed_at = v_now, notes = COALESCE(p_notes, notes), updated_at = v_now
  WHERE id = p_application_id;

  RETURN jsonb_build_object('applicationId', p_application_id, 'workLogIds', to_jsonb(v_work_log_ids),
    'assignmentCount', jsonb_array_length(p_assignments));
END;
$$;
COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) IS
  '지원서 확정 RPC. work_logs=flat 전개, filled 는 seat 트리거가 좌석 단위(+N) 자동 반영. 슬롯 정원가드 유지. owner_id NULL fail-closed(COALESCE, 형제 3종 정합).';
