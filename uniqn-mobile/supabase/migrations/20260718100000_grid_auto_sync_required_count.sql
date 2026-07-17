-- ============================================================
-- grid-auto-sync Task 1 — get_venue_grid_summary 에 required_count 파생 추가
-- ============================================================
-- required_count = venue 스팬 공고(동일 workspace) requirements 의 날짜별 Σ count.
--   · 좌석 규약: 날짜×슬롯×역할 count 총합(SUM), dated only(req.date IS NOT NULL).
--   · 컨테이너 자신(jp.id = p_venue) 제외 → 이중 계상 방지.
--   · 읽기 시점 파생(수요 테이블/트리거 없음). weekly_grid_enabled OFF 라 호출 0 → 적용 안전.
-- 반환 타입 변경(3열→4열)이므로 DROP+CREATE. ACL·SECDEF 하드닝 유지.
-- 설계: docs/superpowers/specs/2026-07-18-grid-auto-sync-design.md §4.2
-- ============================================================
DROP FUNCTION IF EXISTS public.get_venue_grid_summary(uuid, text, text);

CREATE FUNCTION public.get_venue_grid_summary(p_venue uuid, p_from text, p_to text)
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
      SUM((r->>'count')::int)::int AS required_count
    FROM public.job_postings jp
    JOIN span ON span.id = jp.id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule->'requirements', '[]'::jsonb)) req
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
    WHERE jp.id <> p_venue                       -- 컨테이너 자신 제외(이중 계상 방지)
      AND req->>'date' IS NOT NULL               -- dated only (fixed 제외)
      AND (req->>'date') >= p_from AND (req->>'date') <= p_to
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
-- Supabase 기본권한(ALTER DEFAULT PRIVILEGES ... GRANT ON FUNCTIONS TO anon)이 신규
-- public 함수에 anon EXECUTE 를 자동 부여하므로 PUBLIC 만으론 부족 → anon 명시 회수.
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '주간 그리드 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count + required_count(requirements Σ count, dated only). E1 SSOT, SECDEF 게이트, M1 재필터.';
