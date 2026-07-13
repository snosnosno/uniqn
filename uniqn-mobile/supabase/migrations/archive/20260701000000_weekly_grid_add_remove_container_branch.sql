-- 주간 배치 그리드 — Phase 3 ② add/remove_direct_staff 컨테이너 카운터 분기 (R1/E7)
--
-- 배경: 토대 마이그(20260629000000) 의 add/remove_direct_staff 는 person-basis 로
--   filled_positions(+stats 캐시) 를 직접 ±1 하고 active↔capacity_full 을 미러링한다.
--   컨테이너(status='container') 는 filled_positions 를 절대 쓰지 않는다(read-time COUNT, §6).
--   chk_container_no_filled CHECK 가 컨테이너 filled<>0 을 차단하므로, 컨테이너에 직접배치하면
--   filled+1 이 CHECK 위반으로 fail-closed 된다. → 컨테이너일 때 해당 회계 블록만 SKIP.
--
-- 불변식:
--   R1: 컨테이너는 filled_positions 미사용 → add 의 filled+1/capacity_full 미러 SKIP.
--   E7: remove 도 대칭으로 filled-1/capacity_full→active 복귀 SKIP(비대칭 금지).
--   컨테이너에 스태프 추가/제거 자체는 허용(거부 아님). work_log INSERT/DELETE·중복가드·반환 유지.
--   MAX_CAPACITY 가드는 schedule.requirements 만 읽으므로 softTargets 분리된 컨테이너엔 inert.
--
-- 멱등: CREATE OR REPLACE. 기존 권한/SECDEF 속성 보존(아래 REVOKE/GRANT 재확인).
-- ⚠️ 본문은 라이브 정의(=20260629000000, ebf5642d2 2차 리뷰 반영분)와 100% 동일하며
--    오직 회계 블록의 진입 조건에 `AND v_job.status <> 'container'` 만 추가했다.
-- 🔒 S3 하드닝: search_path 를 'public' → 'public','extensions','pg_temp' 로 교정.
--    토대(20260629000000)는 pg_temp 미지정이라 PG 가 TEMP 스키마를 relation 검색 시 최우선으로
--    조회 → 인증 사용자가 동명 TEMP(job_postings/work_logs)로 권한게이트(미수식 참조)를 마스킹할
--    수 있었다. pg_temp 를 후행 명시하면 public 이 먼저 검색돼 마스킹이 무력화된다(S3 불변식 충족).

-- ───────────────────────────────────────────────────────────────────────────
-- add_direct_staff: 컨테이너면 person-basis filled+1/capacity_full 미러 SKIP
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_direct_staff(
  p_job_posting_id uuid,
  p_staff_id uuid,
  p_assignments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
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
  WHERE id = p_staff_id
    AND is_active = true
    -- 탈퇴/탈퇴유예 계정에는 근무 배정 금지(검색 필터와 정합)
    AND COALESCE(status, 'active') NOT IN ('deleted', 'deactivated');
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
  -- R1: 컨테이너(status='container')는 filled_positions 미사용(read-time COUNT) → 회계/캐시/전이 SKIP.
  --     chk_container_no_filled CHECK 가 컨테이너 filled<>0 을 차단하므로 SKIP 누락 시 fail-closed 된다.
  IF v_already = 0 AND v_job.status <> 'container'::posting_status THEN
    UPDATE job_postings SET
      filled_positions = filled_positions + 1,
      stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(COALESCE((stats->>'filledPositions')::int, 0) + 1)
      ),
      updated_at = v_now
    WHERE id = p_job_posting_id;

    -- M2 정합: 정원 도달 시 active→capacity_full 자동 전이.
    -- fn_update_job_posting_stats 트리거는 applications 전용이라 직접추가에는 발화하지 않으므로
    -- 위 filled +1 직후(갱신된 값 기준) 별도 statement 로 동일 전이를 수동 미러링한다.
    UPDATE job_postings SET
      status = 'capacity_full'::posting_status,
      updated_at = v_now
    WHERE id = p_job_posting_id
      AND status = 'active'
      AND total_positions > 0
      AND filled_positions >= total_positions;
  END IF;

  RETURN jsonb_build_object(
    'jobPostingId', p_job_posting_id,
    'staffId', p_staff_id,
    'workLogIds', to_jsonb(v_work_log_ids)
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- remove_direct_staff: 컨테이너면 person-basis filled-1/capacity_full→active SKIP (E7 대칭)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_direct_staff(p_work_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
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

  -- person-basis: 더 이상 남은 배정이 없을 때만 -1 + 빈자리 재개방
  -- E7: 컨테이너(status='container')는 add 와 대칭으로 filled-1/재개방 미러를 SKIP(비대칭 금지).
  IF v_remaining = 0 AND v_job.status <> 'container'::posting_status THEN
    UPDATE job_postings SET
      filled_positions = GREATEST(filled_positions - 1, 0),
      stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(GREATEST(COALESCE((stats->>'filledPositions')::int, 0) - 1, 0))
      ),
      updated_at = v_now
    WHERE id = v_wl.job_posting_id;

    -- M3 정합: 빈자리 발생 시 재개방. 위 filled -1 직후(갱신된 값 기준) 별도 statement.
    --   capacity_full + filled<total            → active (자동 재노출)
    --   closed(수동) + filled<total             → active
    --   closed(expired/expired_by_work_date)    → 유지 (cron 만료 의도 보존)
    UPDATE job_postings SET
      status = 'active'::posting_status,
      updated_at = v_now
    WHERE id = v_wl.job_posting_id
      AND filled_positions < total_positions
      AND (
        status = 'capacity_full'
        OR (
          status = 'closed'
          AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date')
        )
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'workLogId', p_work_log_id,
    'staffRemoved', v_remaining = 0
  );
END;
$function$;

-- 권한 재확인(멱등): 미인증(anon) 차단, 인증 사용자만(행위자/권한은 본문 재검증).
REVOKE ALL ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.remove_direct_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_direct_staff(uuid) TO authenticated;

COMMENT ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) IS
  '지원서 없이 스태프(work_logs) 직접 추가. 정원가드 + person-basis filled +1(컨테이너는 R1 SKIP) + active→capacity_full 전이.';
COMMENT ON FUNCTION public.remove_direct_staff(uuid) IS
  '직접추가 스태프(application_id NULL) 삭제 + person-basis filled -1(컨테이너는 E7 대칭 SKIP) + capacity_full/closed→active 재개방.';
