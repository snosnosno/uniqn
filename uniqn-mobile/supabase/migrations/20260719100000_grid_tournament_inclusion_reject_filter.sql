-- ============================================================
-- 근무표 대회 포함 — 승인 거절 대회를 required_count 에서 배제
-- ============================================================
-- 배경: 대회가 지점(venue)에 연결될 수 있게 되면서, 기존 required CTE 가
--   tournament_config->>'approvalStatus' 를 보지 않는 점이 결함으로 활성화된다.
--   관리자가 거절한 대회(열리지 않을 대회)의 좌석이 필요 인원에 영구 산입되어
--   근무표에 영원히 채울 수 없는 부족분이 남는다.
-- 결정: pending·approved 는 산입(승인 병목 가시화 = 계획 정보), rejected 만 배제.
--   대회의 job_postings.status 는 생성 시 'active' 고정이고 승인 상태는 별도
--   JSONB 컬럼에 살기 때문에, status 필터로는 잡을 수 없다.
-- 반환 타입 무변경 → CREATE OR REPLACE. 시그니처·ACL·SECDEF 하드닝 그대로 유지.
-- 설계: docs/superpowers/specs/2026-07-19-grid-tournament-inclusion-design.md §4
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
      -- 승인 거절 대회 배제: 열리지 않을 대회가 영구 부족분으로 남지 않게 한다.
      -- 대회 status 는 'active' 고정이라 status 필터로는 잡히지 않는다.
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

-- CREATE OR REPLACE 는 기존 권한을 보존하지만, 드리프트 방어로 재선언한다(멱등).
ALTER FUNCTION public.get_venue_grid_summary(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '주간 그리드 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count + required_count(requirements Σ count, dated only, 승인 거절 대회 배제). E1 SSOT, SECDEF 게이트, M1 재필터.';
