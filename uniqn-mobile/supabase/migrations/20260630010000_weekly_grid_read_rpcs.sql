-- 주간 배치 그리드 — Phase 2 읽기 RPC (venue 스팬 집계, SECDEF + 워크스페이스 게이트)
--
-- 둘 다 venue_span_posting_ids(SSOT)를 경유해 E1 발산을 막는다. SECDEF + 게이트인 이유:
--   work_logs RLS(wl_select)가 운영자에게 허용되긴 하나, 집계 정확성을 RLS 우연에 의존시키지 않고
--   "venue 워크스페이스 멤버/admin" 게이트로 명시 보장(get_or_create_venue_container 와 동일 원칙).

-- ① 월 그리드 요약: 날짜별 headcount(배치 인원) + job_count(그날 work_log 보유 open 공고 수)
CREATE OR REPLACE FUNCTION public.get_venue_grid_summary(
  p_venue uuid,
  p_from text,
  p_to text
)
RETURNS TABLE(d text, headcount integer, job_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  SELECT
    wl.date AS d,
    COUNT(*)::int AS headcount,
    COUNT(DISTINCT wl.job_posting_id) FILTER (WHERE wl.job_posting_id <> p_venue)::int AS job_count
  FROM public.work_logs wl
  WHERE wl.job_posting_id IN (SELECT public.venue_span_posting_ids(p_venue))
    AND wl.date >= p_from AND wl.date <= p_to
    AND wl.status NOT IN ('cancelled', 'no_show')
  GROUP BY wl.date;
END;
$function$;

-- ② 하루 슬롯 상세: 그 날 venue 스팬의 work_logs(배치 스태프) 목록(컨테이너+open 공고 union)
CREATE OR REPLACE FUNCTION public.get_venue_day_slots(
  p_venue uuid,
  p_date text
)
RETURNS TABLE(
  work_log_id uuid,
  staff_id uuid,
  staff_name text,
  staff_nickname text,
  staff_photo_url text,
  role text,
  custom_role text,
  time_slot text,
  status text,
  job_posting_id uuid,
  is_container boolean,
  color text,
  notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  SELECT
    wl.id,
    wl.staff_id,
    wl.staff_name,
    wl.staff_nickname,
    wl.staff_photo_url,
    wl.role::text,
    wl.custom_role,
    wl.time_slot,
    wl.status::text,
    wl.job_posting_id,
    (wl.job_posting_id = p_venue) AS is_container,
    wl.color,
    wl.notes
  FROM public.work_logs wl
  WHERE wl.job_posting_id IN (SELECT public.venue_span_posting_ids(p_venue))
    AND wl.date = p_date
    AND wl.status NOT IN ('cancelled', 'no_show')
  ORDER BY wl.time_slot NULLS LAST, wl.staff_name;
END;
$function$;

-- 권한: anon 차단(S2), 인증 사용자만(본문 게이트 재검증)
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_venue_day_slots(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_day_slots(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '주간 그리드 월 요약: venue 스팬 날짜별 headcount + job_count (E1 SSOT 경유, SECDEF 게이트).';
COMMENT ON FUNCTION public.get_venue_day_slots(uuid, text) IS
  '주간 그리드 하루 슬롯: venue 스팬 그 날 work_logs union (컨테이너+open 공고).';
