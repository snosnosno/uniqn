-- ============================================================
-- 좌석(seat) 기준 인원카운트 통일 (2026-07-17 설계)
-- total = Σ(날짜×슬롯×역할 count) · filled = 활성 work_logs 행 수(좌석 단위)
-- 전이 단일 지점 = job_postings BEFORE 트리거
-- 설계: docs/superpowers/specs/2026-07-17-seat-basis-posting-count-design.md
--
-- [사전 확인 — Step 1 grep 결과 / 커밋 근거]
--   · job_postings BEFORE 트리거: job_postings_updated_at / job_postings_xss_check /
--     tr_fixed_posting_expired / trg_enforce_jp_status_transition(UPDATE OF status) /
--     trg_tournament_approval_authority — 신규 tr_job_postings_recalc_capacity 와 이름 충돌 없음.
--     신규 트리거는 이름 알파벳 순서상 tr_fixed_posting_expired 뒤·trg_* 앞에 발화(무해).
--   · baseline 이후 filled_positions 쓰기 경로 2곳(모두 본 마이그에서 재작성):
--       - 20260711020000_cancel_application_employer_initiates.sql → cancel_application_atomically
--       - 20260717093000_grid_order_sheet_security_hardening.sql   → add_direct_staff / remove_direct_staff
--     ⇒ 함수 원문은 baseline 이 아니라 위 최신 마이그에서 복사해 diff 적용.
--   · fn_update_job_posting_stats / confirm_application 최신본 = baseline.
-- ============================================================

-- ------------------------------------------------------------
-- 1) 좌석합 계산 함수 (클라 calculateTotalPositionsFromSchedule 동치)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._total_positions_from_schedule(p_schedule jsonb)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM(GREATEST(COALESCE((r->>'count')::int, (r->>'headcount')::int, 0), 0)), 0)::int
  FROM jsonb_array_elements(COALESCE(p_schedule->'requirements', '[]'::jsonb)) req
  CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
  CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
  WHERE COALESCE(NULLIF(btrim(r->>'role'), ''), NULLIF(btrim(r->>'name'), '')) IS NOT NULL;
$$;
COMMENT ON FUNCTION public._total_positions_from_schedule(jsonb) IS
  '좌석 기준 정원: 모든 날짜×슬롯×역할 count 총합. 클라 calculateTotalPositionsFromSchedule 동치(빈 role 스킵·음수 0).';
REVOKE ALL ON FUNCTION public._total_positions_from_schedule(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._total_positions_from_schedule(jsonb) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2) BEFORE 트리거: total 재계산 + capacity 전이 단일 지점
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_recalc_total_and_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'container'::posting_status THEN
    NEW.total_positions := 0;
    RETURN NEW;  -- filled 는 chk_container_no_filled CHECK + seat 트리거 SKIP 이 보장
  END IF;

  IF TG_OP = 'INSERT' OR NEW.schedule IS DISTINCT FROM OLD.schedule THEN
    NEW.total_positions := public._total_positions_from_schedule(NEW.schedule);
  END IF;

  -- capacity_full <-> active 전이 (다른 상태는 불변; closed 재개는 RPC 소관)
  IF NEW.status = 'active'::posting_status
     AND NEW.total_positions > 0
     AND NEW.filled_positions >= NEW.total_positions THEN
    NEW.status := 'capacity_full'::posting_status;
  ELSIF NEW.status = 'capacity_full'::posting_status
     AND NEW.filled_positions < NEW.total_positions THEN
    NEW.status := 'active'::posting_status;
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_recalc_total_and_capacity() IS
  '좌석 기준 total 재계산 + capacity_full↔active 전이 단일 지점(BEFORE INSERT/UPDATE). 컨테이너는 total=0.';
DROP TRIGGER IF EXISTS tr_job_postings_recalc_capacity ON public.job_postings;
CREATE TRIGGER tr_job_postings_recalc_capacity
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_total_and_capacity();

-- ------------------------------------------------------------
-- 3) work_logs 좌석 델타 트리거 (filled 만 담당 — 전이는 2 가 자동 수행)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_filled_positions_seat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_delta int := 0;
  v_job_posting_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_job_posting_id := NEW.job_posting_id;
    IF NEW.status::text NOT IN ('cancelled', 'no_show') THEN v_delta := 1; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_job_posting_id := OLD.job_posting_id;
    IF OLD.status::text NOT IN ('cancelled', 'no_show') THEN v_delta := -1; END IF;
  ELSE  -- UPDATE OF status
    v_job_posting_id := NEW.job_posting_id;
    v_delta := (CASE WHEN NEW.status::text NOT IN ('cancelled','no_show') THEN 1 ELSE 0 END)
             - (CASE WHEN OLD.status::text NOT IN ('cancelled','no_show') THEN 1 ELSE 0 END);
  END IF;

  IF v_delta = 0 OR v_job_posting_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.job_postings SET
    filled_positions = GREATEST(0, filled_positions + v_delta),
    stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{filledPositions}',
      to_jsonb(GREATEST(0, COALESCE((stats->>'filledPositions')::int, 0) + v_delta))),
    updated_at = now()
  WHERE id = v_job_posting_id
    AND status <> 'container'::posting_status;

  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.fn_sync_filled_positions_seat() IS
  '활성 work_logs 좌석 수를 job_postings.filled_positions 에 델타 반영(컨테이너 SKIP). 전이는 BEFORE 트리거 자동.';
REVOKE ALL ON FUNCTION public.fn_sync_filled_positions_seat() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS tr_work_logs_seat_filled ON public.work_logs;
CREATE TRIGGER tr_work_logs_seat_filled
  AFTER INSERT OR DELETE OR UPDATE OF status ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_filled_positions_seat();

-- ------------------------------------------------------------
-- 4) fn_update_job_posting_stats: filled/전이 제거, 사람 지표 4종만 유지
--    (baseline 원문에서 v_filled_* 선언·계산·SET·M2 전이 UPDATE 전부 제거,
--     얼리리턴 조건의 v_filled_delta 항 제거)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_job_posting_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_counted_statuses TEXT[] := ARRAY['applied','confirmed','cancellation_pending'];
  v_old_counted BOOLEAN; v_new_counted BOOLEAN;
  v_total_delta INT := 0; v_active_delta INT := 0; v_confirmed_delta INT := 0; v_cp_delta INT := 0;
  v_job_posting_id UUID;
BEGIN
  v_job_posting_id := COALESCE(NEW.job_posting_id, OLD.job_posting_id);
  IF v_job_posting_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := 1;
      IF NEW.status::text = 'applied' THEN v_active_delta := 1;
      ELSIF NEW.status::text = 'confirmed' THEN v_confirmed_delta := 1;
      ELSIF NEW.status::text = 'cancellation_pending' THEN v_cp_delta := 1;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status::text = ANY(v_counted_statuses) THEN
      v_total_delta := -1;
      IF OLD.status::text = 'applied' THEN v_active_delta := -1;
      ELSIF OLD.status::text = 'confirmed' THEN v_confirmed_delta := -1;
      ELSIF OLD.status::text = 'cancellation_pending' THEN v_cp_delta := -1;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status::text = NEW.status::text THEN RETURN NULL; END IF;

    v_old_counted := OLD.status::text = ANY(v_counted_statuses);
    v_new_counted := NEW.status::text = ANY(v_counted_statuses);
    IF v_old_counted AND NOT v_new_counted THEN v_total_delta := -1;
    ELSIF NOT v_old_counted AND v_new_counted THEN v_total_delta := 1;
    END IF;

    IF OLD.status::text = 'applied' AND NEW.status::text <> 'applied' THEN v_active_delta := -1;
    ELSIF NEW.status::text = 'applied' AND OLD.status::text <> 'applied' THEN v_active_delta := 1;
    END IF;

    IF OLD.status::text = 'confirmed' AND NEW.status::text <> 'confirmed' THEN v_confirmed_delta := -1;
    ELSIF NEW.status::text = 'confirmed' AND OLD.status::text <> 'confirmed' THEN v_confirmed_delta := 1;
    END IF;

    IF OLD.status::text = 'cancellation_pending' AND NEW.status::text <> 'cancellation_pending' THEN v_cp_delta := -1;
    ELSIF NEW.status::text = 'cancellation_pending' AND OLD.status::text <> 'cancellation_pending' THEN v_cp_delta := 1;
    END IF;
  END IF;

  IF v_total_delta = 0 AND v_active_delta = 0 AND v_confirmed_delta = 0 AND v_cp_delta = 0 THEN
    RETURN NULL;
  END IF;

  -- filled_positions / capacity 전이는 좌석 트리거(fn_sync_filled_positions_seat)와
  -- BEFORE 트리거(fn_recalc_total_and_capacity)로 이관 — 여기서는 사람 지표 4종만 갱신.
  UPDATE public.job_postings
  SET stats = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{totalApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'totalApplicants')::int, 0) + v_total_delta))),
        '{activeApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'activeApplicants')::int, 0) + v_active_delta))),
        '{confirmedApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'confirmedApplicants')::int, 0) + v_confirmed_delta))),
        '{cancellationPendingApplicants}', to_jsonb(GREATEST(0, COALESCE((stats->>'cancellationPendingApplicants')::int, 0) + v_cp_delta)))
  WHERE id = v_job_posting_id;

  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.fn_update_job_posting_stats() IS
  '지원서 상태 변화 → 사람 지표(total/active/confirmed/cancellationPending) 미러만 갱신. filled/전이는 좌석 트리거 소관(좌석 기준 전환).';

-- ------------------------------------------------------------
-- 5) add_direct_staff: 사람단위 게이트 제거 (20260717093000 원문에서
--    v_already 선언·카운트·filled+1/capacity_full 블록 삭제. 정원가드·중복가드·INSERT 루프 유지)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_direct_staff(p_job_posting_id uuid, p_staff_id uuid, p_assignments jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_job record;
  v_staff record;
  v_is_fixed boolean;
  v_work_log_ids uuid[] := '{}';
  v_wl_id uuid;
  v_assignment jsonb;
  v_now timestamptz := now();
  v_existing int;
  v_capacity int;
  v_rec record;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF jsonb_array_length(COALESCE(p_assignments, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 배정(날짜/역할) 정보가 필요합니다';
  END IF;

  SELECT id, name, nickname, photo_url, photo_url_blurhash
    INTO v_staff
  FROM public.users
  WHERE id = p_staff_id
    AND is_active = true
    AND COALESCE(status, 'active') NOT IN ('deleted', 'deactivated');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 대상 사용자를 찾을 수 없습니다 (%)', p_staff_id;
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', p_job_posting_id;
  END IF;
  IF NOT (
    COALESCE(v_job.owner_id = v_owner, false)
    OR public.is_workspace_member(v_job.workspace_id, v_owner)
    OR public.is_posting_collaborator(v_job.id, v_owner)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한이 없습니다';
  END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';

  FOR v_rec IN
    SELECT
      (a->>'date') AS a_date,
      public._posting_slot_key(a->>'timeSlot') AS slot_key,
      public._posting_role_key(a->>'role', a->>'customRole') AS role_key,
      COUNT(*)::int AS requested
    FROM jsonb_array_elements(p_assignments) a
    GROUP BY 1, 2, 3
  LOOP
    SELECT COUNT(*) INTO v_existing
    FROM work_logs wl
    WHERE wl.job_posting_id = p_job_posting_id
      AND wl.date = v_rec.a_date
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

    IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN
      RAISE EXCEPTION 'MAX_CAPACITY_REACHED: role=% date=% slot=% (% / %)',
        v_rec.role_key, v_rec.a_date, v_rec.slot_key, v_existing + v_rec.requested, v_capacity;
    END IF;
  END LOOP;

  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    IF EXISTS (
      SELECT 1 FROM work_logs wl
      WHERE wl.job_posting_id = p_job_posting_id
        AND wl.staff_id = p_staff_id
        AND wl.date = (v_assignment->>'date')
        AND public._posting_slot_key(wl.time_slot)
            = public._posting_slot_key(v_assignment->>'timeSlot')
        AND public._posting_role_key(wl.role::text, wl.custom_role)
            = public._posting_role_key(v_assignment->>'role', v_assignment->>'customRole')
        AND wl.status NOT IN ('cancelled', 'no_show')
    ) THEN
      RAISE EXCEPTION 'DUPLICATE_ASSIGNMENT: 이미 추가된 스태프/일정입니다';
    END IF;

    INSERT INTO work_logs (
      staff_id, job_posting_id, application_id,
      date, time_slot,
      staff_name, staff_nickname, staff_photo_url, staff_photo_url_blurhash,
      role, custom_role, owner_id,
      status, is_fixed_posting, notes,
      created_at, updated_at
    ) VALUES (
      p_staff_id, p_job_posting_id, NULL,
      v_assignment->>'date', v_assignment->>'timeSlot',
      v_staff.name, v_staff.nickname, v_staff.photo_url, v_staff.photo_url_blurhash,
      COALESCE((v_assignment->>'role')::staff_role, 'staff'::staff_role),
      v_assignment->>'customRole', v_owner,
      'scheduled', v_is_fixed, v_assignment->>'notes',
      v_now, v_now
    ) RETURNING id INTO v_wl_id;
    v_work_log_ids := array_append(v_work_log_ids, v_wl_id);
  END LOOP;

  -- filled 는 seat 트리거가 좌석 단위(+N) 자동 반영(컨테이너 SKIP). capacity_full 전이도 BEFORE 트리거 자동.
  RETURN jsonb_build_object(
    'jobPostingId', p_job_posting_id,
    'staffId', p_staff_id,
    'workLogIds', to_jsonb(v_work_log_ids)
  );
END;
$$;
COMMENT ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) IS
  '지원서 없이 스태프(work_logs) 직접 추가. 정원가드 유지. filled 는 seat 트리거가 좌석 단위 자동 반영(컨테이너 SKIP).';

-- ------------------------------------------------------------
-- 6) remove_direct_staff: 사람단위 -1/전이 제거 (20260717093000 원문에서
--    filled_positions -1 UPDATE 와 capacity_full 재개 분기 삭제. closed(비만료) 재개만 유지.
--    v_remaining 은 staffRemoved 반환값용으로 유지)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_direct_staff(p_work_log_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_wl record;
  v_job record;
  v_now timestamptz := now();
  v_remaining int;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  SELECT * INTO v_wl FROM work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;

  IF v_wl.application_id IS NOT NULL THEN
    RAISE EXCEPTION 'NOT_DIRECT_STAFF: 지원서 연동 스태프는 확정 취소로 처리해야 합니다';
  END IF;

  IF v_wl.status IN ('checked_in', 'checked_out', 'completed') THEN
    RAISE EXCEPTION 'STAFF_ALREADY_CHECKED_IN: 출근 처리된 스태프는 삭제할 수 없습니다';
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_wl.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_wl.job_posting_id;
  END IF;
  IF NOT (
    COALESCE(v_job.owner_id = v_owner, false)
    OR public.is_workspace_member(v_job.workspace_id, v_owner)
    OR public.is_posting_collaborator(v_job.id, v_owner)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한이 없습니다';
  END IF;

  -- 좌석 감소를 먼저 반영(seat 트리거 발화 → filled -1, capacity_full→active 는 BEFORE 트리거 자동)
  DELETE FROM work_logs WHERE id = p_work_log_id;

  -- staffRemoved 반환용: 같은 스태프의 잔여 활성 배정 수
  SELECT COUNT(*) INTO v_remaining
  FROM work_logs wl
  WHERE wl.job_posting_id = v_wl.job_posting_id
    AND wl.staff_id = v_wl.staff_id
    AND wl.status NOT IN ('cancelled', 'no_show');

  -- capacity_full → active 는 seat 트리거 자동. closed(비만료) 재개만 명시 처리.
  UPDATE job_postings SET
    status = 'active'::posting_status,
    updated_at = v_now
  WHERE id = v_wl.job_posting_id
    AND filled_positions < total_positions
    AND status = 'closed'
    AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date');

  RETURN jsonb_build_object(
    'success', true,
    'workLogId', p_work_log_id,
    'staffRemoved', v_remaining = 0
  );
END;
$$;
COMMENT ON FUNCTION public.remove_direct_staff(uuid) IS
  '직접 추가 스태프(work_logs) 삭제. filled 는 seat 트리거가 좌석 단위 자동 감소(컨테이너 SKIP). closed(비만료) 재개만 RPC 소관.';

-- ------------------------------------------------------------
-- 7) cancel_application_atomically: DELETE-먼저 재배열 (20260711020000 원문에서
--    기존 [status CASE UPDATE → v_new_filled 읽기 → DELETE] 를
--    [DELETE → closed 재개 UPDATE → v_new_filled 읽기] 로 교체.
--    좌석 감소가 먼저 반영돼 반환 new_filled_positions·재개 판정이 최신값을 본다)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_application_atomically(
  p_application_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_cancel_reason text DEFAULT NULL::text,
  p_rejection_reason text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_application applications%ROWTYPE; v_job_posting job_postings%ROWTYPE;
  v_active_confirmation_entry jsonb; v_active_confirmation_index int;
  v_confirmation_history jsonb := '[]'::jsonb; v_deleted_work_log_count int := 0;
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_now_ts timestamptz := now(); v_assignment_count int := 0; v_new_filled int;
  v_new_status text; v_updated_cancellation_request jsonb;
BEGIN
  -- [보안] 호출자 바인딩: p_actor_id 는 호출자 본인(또는 admin)이어야 함.
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_application FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'application_not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_disabled'); END IF;

  -- 멱등 처리
  IF p_actor_type = 'staff_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'employer_initiates' AND v_application.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;
  IF p_actor_type = 'staff_approves_cancel_request' AND v_application.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true); END IF;

  -- 상태 전제 검증
  IF p_actor_type IN ('staff_initiates', 'employer_initiates') THEN
    IF v_application.status != 'confirmed' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_cancellation'); END IF;
  ELSIF p_actor_type = 'staff_approves_cancel_request' THEN
    IF v_application.status != 'cancellation_pending' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_approval'); END IF;
    IF (v_application.cancellation_request->>'status') != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'cancellation_request_not_pending'); END IF;
  ELSE RETURN jsonb_build_object('success', false, 'error', 'invalid_actor_type'); END IF;

  SELECT * INTO v_job_posting FROM job_postings WHERE id = v_application.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  -- 행위자별 인가 (owner_id nullable → COALESCE fail-closed 유지)
  IF p_actor_type IN ('staff_approves_cancel_request', 'employer_initiates') THEN
    IF NOT (COALESCE(v_job_posting.owner_id = p_actor_id, false) OR public.is_workspace_member(v_job_posting.workspace_id, p_actor_id)
      OR public.is_posting_collaborator(v_job_posting.id, p_actor_id) OR public.is_admin()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  ELSIF p_actor_type = 'staff_initiates' THEN
    IF v_application.applicant_id != p_actor_id THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM work_logs WHERE application_id = p_application_id AND status IN ('checked_in', 'checked_out')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_already_checked_in'); END IF;

  v_confirmation_history := COALESCE(v_application.confirmation_history, '[]'::jsonb);
  SELECT value, ordinality - 1 INTO v_active_confirmation_entry, v_active_confirmation_index
  FROM jsonb_array_elements(v_confirmation_history) WITH ORDINALITY WHERE (value->>'cancelled_at') IS NULL LIMIT 1;
  IF v_active_confirmation_entry IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_active_confirmation'); END IF;
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_at'], to_jsonb(v_now));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancelled_by'], to_jsonb(p_actor_id));
  v_confirmation_history := jsonb_set(v_confirmation_history, ARRAY[v_active_confirmation_index::text, 'cancellation_reason'], COALESCE(to_jsonb(p_cancel_reason), 'null'::jsonb));

  -- 전이 결과 상태: 본인 취소·구인자 해제는 applied 복귀, 취소요청 승인은 cancelled
  IF p_actor_type IN ('staff_initiates', 'employer_initiates') THEN v_new_status := 'applied';
  ELSE v_new_status := 'cancelled';
    v_updated_cancellation_request := v_application.cancellation_request || jsonb_build_object('status', 'approved', 'reviewed_at', v_now, 'reviewed_by', p_actor_id);
  END IF;

  UPDATE applications SET status = v_new_status::application_status, confirmation_history = v_confirmation_history,
    cancellation_request = COALESCE(v_updated_cancellation_request, cancellation_request), cancelled_at = v_now_ts, updated_at = v_now_ts
  WHERE id = p_application_id;

  -- 구인자 확정해제는 스태프에게 직접 통지
  IF p_actor_type = 'employer_initiates' THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_application.applicant_id,
        'confirmation_cancelled',
        '확정 취소',
        format('%s 확정이 취소되었습니다.',
          CASE WHEN v_job_posting.title IS NULL OR v_job_posting.title = '' THEN '해당 공고'
               ELSE format('''%s''', v_job_posting.title) END),
        '/schedule',
        jsonb_build_object(
          'applicationId', v_application.id,
          'jobPostingId', v_application.job_posting_id,
          'jobPostingTitle', COALESCE(v_job_posting.title, ''),
          'senderId', p_actor_id
        ),
        'high'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[cancel_application_atomically] employer notify failed for % — %', p_application_id, SQLERRM;
    END;
  END IF;

  SELECT COUNT(*)::int INTO v_assignment_count FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;

  -- [좌석 기준 재배열] 좌석 감소를 먼저 반영(seat 트리거 발화 → filled -N,
  -- capacity_full→active 는 BEFORE 트리거 자동). 이후 재개 판정·반환값이 최신 filled 를 본다.
  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;
  -- closed(비만료) 재개만 명시 처리 (만료 closed 는 유지).
  UPDATE job_postings SET status = 'active'::posting_status, updated_at = v_now_ts
  WHERE id = v_job_posting.id
    AND filled_positions < total_positions
    AND status = 'closed'
    AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date');
  SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;

  RETURN jsonb_build_object('success', true, 'application_id', p_application_id, 'new_status', v_new_status,
    'assignment_count', v_assignment_count, 'new_filled_positions', v_new_filled,
    'deleted_work_log_count', v_deleted_work_log_count, 'cancelled_at', v_now);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 8) confirm_application: 동작 무변경 + capacity=0 가드 우회 관측 로그 1줄 추가
--    (스펙 리스크: 슬롯/역할/날짜가 schedule 에 없으면 v_capacity=0 → 정원가드 스킵).
--    baseline 원문 그대로 + v_capacity=0 케이스 RAISE LOG.
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

  IF NOT (v_job.owner_id = p_owner_id OR public.is_workspace_member(v_job.workspace_id, p_owner_id)
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
  '지원서 확정 RPC. work_logs=flat 전개, filled 는 seat 트리거가 좌석 단위(+N) 자동 반영. 슬롯 정원가드 유지.';

-- ------------------------------------------------------------
-- 9) 백필 (트리거 설치 후 같은 트랜잭션): 컨테이너 제외 전 공고 total/filled 재계산.
--    BEFORE 트리거가 이 UPDATE 에서 capacity_full/active 를 자동 재평가.
-- ------------------------------------------------------------
UPDATE public.job_postings jp SET
  total_positions = public._total_positions_from_schedule(jp.schedule),
  filled_positions = COALESCE(w.cnt, 0),
  stats = jsonb_set(COALESCE(jp.stats, '{}'::jsonb), '{filledPositions}', to_jsonb(COALESCE(w.cnt, 0))),
  updated_at = now()
FROM public.job_postings p
LEFT JOIN (
  SELECT job_posting_id, COUNT(*)::int AS cnt
  FROM public.work_logs
  WHERE status::text NOT IN ('cancelled', 'no_show')
  GROUP BY job_posting_id
) w ON w.job_posting_id = p.id
WHERE jp.id = p.id
  AND jp.status <> 'container'::posting_status;

-- 취소 RPC COMMENT 갱신 (person basis → seat basis)
COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '지원 취소 원자 RPC. work_logs DELETE → seat 트리거 좌석 감소 → 재개판정·반환 순(재배열). closed(비만료) 재개만 RPC 소관.';
