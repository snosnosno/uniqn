-- 스태프 직접 추가(앱 가입자 검색) — confirm_application 회계 미러링
--
-- 배경: 스태프(work_logs)는 지원→확정(confirm_application) 경로로만 생성됐다.
--   현장에서는 사장이 아는 가입자를 지원 절차 없이 직접 투입하는 경우가 많아,
--   스태프관리 화면에서 직접 추가할 수 있게 한다.
--
-- 안전성 핵심:
--   1) confirm_application 과 동일한 정원 가드(_posting_slot_key/_posting_role_key) 적용.
--   2) filled_positions/stats.filledPositions 는 person-basis 로 RPC 가 직접 ±1.
--      (지원서가 없어 applications.status 트리거가 발화하지 않으므로 수동 갱신 필수.)
--   3) 직접추가분(application_id IS NULL)은 전용 삭제 RPC로만 제거(확정취소 경로와 분리).
--   4) 행위자는 auth.uid() 바인딩, 사용자 검색은 전화 정확일치 + 구인자 전용(열거 방지).

-- ───────────────────────────────────────────────────────────────────────────
-- 1) 전화번호 정확 일치 사용자 검색 (구인자/관리자 전용, 최소 필드만 반환)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_users_by_phone(p_phone text)
RETURNS TABLE (
  id uuid,
  name text,
  nickname text,
  phone text,
  photo_url text,
  photo_url_blurhash text,
  region text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- 구인자/관리자만 사용자 검색 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('employer', 'admin') AND u.is_active = true
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 구인자만 사용할 수 있습니다';
  END IF;

  -- 숫자만 정규화 후 정확 일치(하이픈/공백 차이 흡수). 열거 방지: 9자리 미만은 결과 없음.
  v_norm := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_norm) < 9 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.nickname, u.phone, u.photo_url, u.photo_url_blurhash, u.region
  FROM public.users u
  WHERE u.is_active = true
    AND regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = v_norm
  LIMIT 5;
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) 스태프 직접 추가 (지원서 없이 work_logs 생성 + 정원가드 + person-basis filled +1)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_direct_staff(
  p_job_posting_id uuid,
  p_staff_id uuid,
  p_assignments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_already int;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF jsonb_array_length(COALESCE(p_assignments, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 배정(날짜/역할) 정보가 필요합니다';
  END IF;

  -- 대상 스태프(가입자) 검증 + 프로필 스냅샷
  SELECT id, name, nickname, photo_url, photo_url_blurhash
    INTO v_staff
  FROM public.users
  WHERE id = p_staff_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 대상 사용자를 찾을 수 없습니다 (%)', p_staff_id;
  END IF;

  -- 공고 잠금 + 관리 권한
  SELECT * INTO v_job FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', p_job_posting_id;
  END IF;
  IF NOT (
    v_job.owner_id = v_owner
    OR public.is_workspace_member(v_job.workspace_id, v_owner)
    OR public.is_posting_collaborator(v_job.id, v_owner)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한이 없습니다';
  END IF;

  v_is_fixed := (v_job.schedule->>'kind') = 'fixed';

  -- 정원 가드(confirm_application 동치): 스케줄에 정의된 슬롯이면 정원 초과를 차단.
  -- 스케줄 외 날짜/슬롯은 v_capacity=0 → 제한 없음(수동 추가 취지에 부합).
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

  -- person-basis 증가 판단: 추가 전 이 스태프의 활성 work_log 존재 여부.
  SELECT COUNT(*) INTO v_already
  FROM work_logs wl
  WHERE wl.job_posting_id = p_job_posting_id
    AND wl.staff_id = p_staff_id
    AND wl.status NOT IN ('cancelled', 'no_show');

  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    -- 동일 (staff, date, slot, role) 중복 배정 차단
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

  -- person-basis filled_positions: 이 스태프가 새로 합류한 경우에만 +1.
  -- (지원서 트리거가 없으므로 confirm_application 의 SP3 이전 수동 갱신을 재현.)
  IF v_already = 0 THEN
    UPDATE job_postings SET
      filled_positions = filled_positions + 1,
      stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)
      ),
      updated_at = v_now
    WHERE id = p_job_posting_id;
  END IF;

  RETURN jsonb_build_object(
    'jobPostingId', p_job_posting_id,
    'staffId', p_staff_id,
    'workLogIds', to_jsonb(v_work_log_ids)
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) 직접 추가 스태프 삭제 (application_id IS NULL 한정 + person-basis filled -1)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_direct_staff(p_work_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- 직접추가분만 이 경로로 삭제(지원서 연동분은 확정취소 경로 사용)
  IF v_wl.application_id IS NOT NULL THEN
    RAISE EXCEPTION 'NOT_DIRECT_STAFF: 지원서 연동 스태프는 확정 취소로 처리해야 합니다';
  END IF;

  -- 출근 이후는 삭제 불가(정산 보호)
  IF v_wl.status IN ('checked_in', 'checked_out', 'completed') THEN
    RAISE EXCEPTION 'STAFF_ALREADY_CHECKED_IN: 출근 처리된 스태프는 삭제할 수 없습니다';
  END IF;

  SELECT * INTO v_job FROM job_postings WHERE id = v_wl.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_wl.job_posting_id;
  END IF;
  IF NOT (
    v_job.owner_id = v_owner
    OR public.is_workspace_member(v_job.workspace_id, v_owner)
    OR public.is_posting_collaborator(v_job.id, v_owner)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한이 없습니다';
  END IF;

  DELETE FROM work_logs WHERE id = p_work_log_id;

  -- 이 스태프의 남은 활성 work_log 수
  SELECT COUNT(*) INTO v_remaining
  FROM work_logs wl
  WHERE wl.job_posting_id = v_wl.job_posting_id
    AND wl.staff_id = v_wl.staff_id
    AND wl.status NOT IN ('cancelled', 'no_show');

  -- person-basis: 더 이상 남은 배정이 없을 때만 -1 + closed→active 재개방
  IF v_remaining = 0 THEN
    UPDATE job_postings SET
      filled_positions = GREATEST(filled_positions - 1, 0),
      stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(GREATEST(COALESCE((stats->>'filledPositions')::int, 0) - 1, 0))
      ),
      status = CASE
        WHEN status = 'closed' AND GREATEST(filled_positions - 1, 0) < total_positions
          THEN 'active'::posting_status
        ELSE status
      END,
      updated_at = v_now
    WHERE id = v_wl.job_posting_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'workLogId', p_work_log_id,
    'staffRemoved', v_remaining = 0
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 권한: 미인증(anon) 차단, 인증 사용자만 실행. (행위자/권한은 본문에서 재검증)
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.search_users_by_phone(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.remove_direct_staff(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.search_users_by_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_direct_staff(uuid) TO authenticated;

COMMENT ON FUNCTION public.search_users_by_phone(text) IS
  '전화 정확일치 사용자 검색(구인자 전용, 열거 방지). 스태프 직접 추가용.';
COMMENT ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) IS
  '지원서 없이 스태프(work_logs) 직접 추가. confirm_application 정원가드 동치 + person-basis filled +1.';
COMMENT ON FUNCTION public.remove_direct_staff(uuid) IS
  '직접추가 스태프(application_id NULL) 삭제 + person-basis filled -1 + closed→active 재개방.';
