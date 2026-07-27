-- ============================================================
-- 근무표 — ① 빼기를 소프트 취소로 전환(취소 알림 복구) ② 부족 인원에서 죽은 공고 배제
-- ============================================================
-- 설계: docs/planning/2026-07-27-work-schedule-audit-roadmap.md (P0-2 / P0-7)
--
-- ── ① remove_direct_staff: 하드 DELETE → status='cancelled'
-- 배경: work_logs 에는 DELETE 트리거가 하나도 없다(알림 트리거는 전부 AFTER INSERT/UPDATE).
--   그래서 사장이 근무표에서 인원을 빼면 **스태프에게 통보가 0건**이었고, 스태프는 그대로
--   출근했다. 삭제된 행은 근거도 남지 않아 분쟁 시 확인할 방법도 없었다.
-- 결정: 행을 지우지 말고 status 를 'cancelled' 로 바꾼다. 아래 6개 의존성을 실측 확인했고
--   전부 이미 소프트 취소와 호환된다 — 즉 트리거·필터를 새로 만들 필요가 없다.
--   (1) fn_sync_filled_positions_seat: UPDATE OF status 분기에서 cancelled 는 delta -1 로
--       DELETE 분기와 동일하다 → filled_positions 회계 무변경.
--   (2) notify_on_work_log_update Case1: OLD.status IS DISTINCT FROM NEW.status AND
--       NEW.status='cancelled' → 'schedule_cancelled' 알림이 스태프에게 자동 발화한다.
--   (3) get_venue_day_slots / get_venue_grid_summary: 이미 status NOT IN
--       ('cancelled','no_show') 로 거른다 → 취소 행이 근무표에 다시 나타나지 않는다.
--   (4) add_direct_staff 정원·중복 가드: 같은 필터를 쓰므로 뺐던 사람을 다시 넣을 수 있다.
--   (5) work_logs 에는 PK 외 UNIQUE 인덱스가 없다 → 취소 행이 재삽입을 막지 않는다.
--   (6) protect_work_log_payroll_columns: payroll 컬럼만 막고 status 변경은 employer/admin
--       에게 허용된다.
-- 부수 이득: 되돌리기(status 복원)의 기반이 생기고, 취소 이력이 보존된다.
--
-- ── ② get_venue_grid_summary: required CTE 에 jp.status 필터 추가
-- 배경: required 집계에 공고 status 조건이 아예 없어 **마감·취소·만료·거절된 공고의 좌석이
--   영구히 필요 인원에 산입**됐다. 손쓸 수 없는 부족분이 상시 빨간 뱃지로 남아 부족 신호
--   전체의 신뢰를 무너뜨린다(운영자가 뱃지를 무시하게 되는 것이 진짜 피해).
-- 결정: 명백히 죽은 상태만 배제하는 제외 목록을 쓴다. active·capacity_full·approved 는
--   그대로 산입(capacity_full 은 좌석이 실제로 채워진 상태라 headcount 와 짝을 이룬다).
--   승인 거절 대회 배제(20260719100000)는 status 로 안 잡히므로 기존 조건을 그대로 둔다.
--
-- 둘 다 반환 타입·시그니처 무변경 → CREATE OR REPLACE (멱등).
-- ============================================================

-- ============================================================
-- ① remove_direct_staff — 소프트 취소
-- ============================================================
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

  -- 이미 취소된 행이면 멱등 성공으로 끝낸다. 다시 UPDATE 하면 status 가 안 바뀌어
  -- 알림도 안 나가고 회계도 그대로라 무해하지만, 중복 호출을 명시적으로 흡수한다.
  IF v_wl.status = 'cancelled' THEN
    SELECT COUNT(*) INTO v_remaining
    FROM work_logs wl
    WHERE wl.job_posting_id = v_wl.job_posting_id
      AND wl.staff_id = v_wl.staff_id
      AND wl.status NOT IN ('cancelled', 'no_show');

    RETURN jsonb_build_object(
      'success', true,
      'workLogId', p_work_log_id,
      'staffRemoved', v_remaining = 0
    );
  END IF;

  -- 하드 DELETE 대신 소프트 취소. 좌석 감소는 종전과 동일하게 seat 트리거가 처리하고
  -- (UPDATE OF status 분기의 delta -1), 스태프 취소 알림은 notify_on_work_log_update
  -- Case1 이 같은 UPDATE 에서 발화한다. 삭제였을 때는 둘 다 일어나지 않았다.
  UPDATE public.work_logs
     SET status = 'cancelled',
         updated_at = v_now
   WHERE id = p_work_log_id;

  -- staffRemoved 반환용: 같은 스태프의 잔여 활성 배정 수(방금 취소한 행은 제외된다)
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

-- CREATE OR REPLACE 는 기존 권한을 보존하지만, 드리프트 방어로 재선언한다(멱등).
ALTER FUNCTION public.remove_direct_staff(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.remove_direct_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_direct_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_direct_staff(uuid) TO service_role;
COMMENT ON FUNCTION public.remove_direct_staff(uuid) IS
  '직접 배치 인원 빼기 — 하드 DELETE 가 아니라 status=cancelled 소프트 취소(2026-07-27). 좌석 -1 은 seat 트리거, 스태프 취소 알림은 notify_on_work_log_update Case1 이 같은 UPDATE 에서 처리한다. 이미 cancelled 면 멱등 성공.';

-- ============================================================
-- ② get_venue_grid_summary — required CTE 에 공고 status 필터
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text)
  RETURNS TABLE(d text, headcount integer, job_count integer, required_count integer)
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $$
DECLARE
  v_ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  SELECT jp.workspace_id INTO v_ws FROM public.job_postings jp WHERE jp.id = p_venue AND jp.status = 'container';
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;
  IF NOT (public.is_workspace_member(v_ws, auth.uid()) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  RETURN QUERY
  WITH span AS (
    -- M1: venue 스팬 ∩ 동일 workspace (타 워크스페이스 유령행 차단)
    SELECT jp.id
    FROM public.job_postings jp
    WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
      AND jp.workspace_id = v_ws
  ),
  staffed AS (
    SELECT
      wl.date AS d,
      COUNT(*)::int AS headcount,
      COUNT(DISTINCT wl.job_posting_id) FILTER (WHERE wl.job_posting_id <> p_venue)::int AS job_count
    FROM public.work_logs wl
    WHERE wl.job_posting_id IN (SELECT id FROM span)
      AND wl.date >= p_from AND wl.date <= p_to
      AND wl.status NOT IN ('cancelled', 'no_show')
    GROUP BY wl.date
  ),
  required AS (
    SELECT
      (req->>'date') AS d,
      -- seat-basis SSOT(_total_positions_from_schedule)와 동일한 좌석 합산식
      SUM(GREATEST(COALESCE((r->>'count')::int, (r->>'headcount')::int, 0), 0))::int AS required_count
    FROM public.job_postings jp
    JOIN span ON span.id = jp.id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule->'requirements', '[]'::jsonb)) req
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
    WHERE jp.id <> p_venue                       -- 컨테이너 자신 제외(이중 계상 방지)
      AND req->>'date' IS NOT NULL               -- dated only (fixed 제외)
      AND (req->>'date') >= p_from AND (req->>'date') <= p_to
      -- 빈 role 스킵(SSOT 동일): role/name 둘 다 비면 좌석 아님
      AND COALESCE(NULLIF(btrim(r->>'role'), ''), NULLIF(btrim(r->>'name'), '')) IS NOT NULL
      -- 죽은 공고 배제(2026-07-27): 마감·취소·만료·거절·미발행 공고의 좌석은 더 이상
      -- 채울 수 없거나 아직 모집 중이 아니므로 필요 인원이 아니다. 이 필터가 없으면
      -- 손쓸 수 없는 부족분이 영구히 빨간 뱃지로 남아 부족 신호 전체가 무시된다.
      -- active·capacity_full·approved 는 산입 유지 — capacity_full 은 좌석이 실제로
      -- 채워진 상태라 headcount 와 짝을 이룬다(부족 0 으로 정확히 상쇄).
      AND jp.status NOT IN ('closed', 'cancelled', 'expired', 'rejected', 'draft', 'pending')
      -- 승인 거절 대회 배제: 열리지 않을 대회가 영구 부족분으로 남지 않게 한다.
      -- 대회 status 는 'active' 고정이라 위 status 필터로는 잡히지 않는다.
      -- COALESCE 필수: tournament_config 가 NULL 이면 3값 논리로 NOT(true AND NULL)=NULL
      -- 이 되어 거절되지 않은 대회까지 조용히 배제된다(과소집계).
      AND NOT (jp.posting_type = 'tournament'
               AND COALESCE(jp.tournament_config->>'approvalStatus', '') = 'rejected')
    GROUP BY (req->>'date')
  )
  SELECT
    COALESCE(s.d, rq.d)                AS d,
    COALESCE(s.headcount, 0)           AS headcount,
    COALESCE(s.job_count, 0)           AS job_count,
    COALESCE(rq.required_count, 0)     AS required_count
  FROM staffed s
  FULL OUTER JOIN required rq ON s.d = rq.d;
END;
$$;

ALTER FUNCTION public.get_venue_grid_summary(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '근무표 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count + required_count(requirements Σ count, dated only, 죽은 공고·승인 거절 대회 배제). E1 SSOT, SECDEF 게이트, M1 재필터.';
