-- 주간 배치 그리드 — M1(보안) 읽기 RPC 워크스페이스 재필터 (전체리뷰 적출)
--
-- 근본원인(M1): job_postings.venue_id 의 FK 는 job_postings(id) 만 가리키고 workspace 일치
--   제약이 없다(20260630000100). 따라서 타 워크스페이스 운영자가 자기 공고의 venue_id 를
--   '피해자 컨테이너 id' 로 박으면, 그 공고는 venue_span_posting_ids(피해자) 집합에 섞여
--   읽기 RPC 의 집계/슬롯에 '유령 행'으로 노출될 수 있다. 진입부 게이트(컨테이너 workspace
--   멤버)는 호출자만 검증할 뿐, 스팬 공고 각각의 workspace 를 재검증하지 않아 차단하지 못한다.
--
-- 조치: get_venue_grid_summary / get_venue_day_slots 의 스팬 필터를 venue_span 집합 ∩
--   "컨테이너와 동일 workspace(v_ws)" 로 재필터한다. 타 워크스페이스 공고가 venue_id 로
--   피해자 컨테이너를 가리켜도 jp.workspace_id = v_ws 조건에서 탈락 → 유령 행 차단.
--   본문 나머지·SECDEF·search_path('public','pg_temp')·진입부 게이트·REVOKE/GRANT 100% 보존.
--   멱등(CREATE OR REPLACE). 마이그 12종 본문 무수정, 신규 파일만 추가.

-- ① 월 그리드 요약: 스팬 ∩ 동일 workspace 재필터
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
  WHERE wl.job_posting_id IN (
      -- M1: venue 스팬 ∩ 동일 workspace (타 워크스페이스 유령행 차단)
      SELECT jp.id FROM public.job_postings jp
      WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
        AND jp.workspace_id = v_ws
    )
    AND wl.date >= p_from AND wl.date <= p_to
    AND wl.status NOT IN ('cancelled', 'no_show')
  GROUP BY wl.date;
END;
$function$;

-- ② 하루 슬롯 상세: 스팬 ∩ 동일 workspace 재필터
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
  WHERE wl.job_posting_id IN (
      -- M1: venue 스팬 ∩ 동일 workspace (타 워크스페이스 유령행 차단)
      SELECT jp.id FROM public.job_postings jp
      WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
        AND jp.workspace_id = v_ws
    )
    AND wl.date = p_date
    AND wl.status NOT IN ('cancelled', 'no_show')
  ORDER BY wl.time_slot NULLS LAST, wl.staff_name;
END;
$function$;

-- 권한: anon 차단(S2), 인증 사용자만(본문 게이트 재검증). 원본과 동일, 명시 재선언.
REVOKE ALL ON FUNCTION public.get_venue_grid_summary(uuid, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_venue_day_slots(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_venue_grid_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_day_slots(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.get_venue_grid_summary(uuid, text, text) IS
  '주간 그리드 월 요약: venue 스팬 ∩ 동일 workspace 날짜별 headcount + job_count (E1 SSOT 경유, SECDEF 게이트, M1 재필터).';
COMMENT ON FUNCTION public.get_venue_day_slots(uuid, text) IS
  '주간 그리드 하루 슬롯: venue 스팬 ∩ 동일 workspace 그 날 work_logs union (컨테이너+open 공고, M1 재필터).';
