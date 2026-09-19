-- ============================================================
-- 근무표 하루 슬롯 조회에 실적(출퇴근)·정산상태·날짜를 싣는다
--
-- 설계: docs/planning/2026-08-06-work-time-editing-unification-design.md §5-1
--
-- ── 왜 ────────────────────────────────────────────────────
--   `get_venue_day_slots` 가 예정(time_slot)만 돌려주기 때문에 근무표 화면(VenueDayPanel)은
--   실적을 편집하려면 `useConfirmedStaff(venueId)` 로 **컨테이너 직속 인원만** 따로 해소해야 했다.
--   그 결과 공고 스팬 슬롯에서는 실적 편집 입구가 아예 사라진다(`isContainer` 게이트).
--   게이트는 원인이 아니라 **결과**다 — 읽기 RPC 가 값을 실어 오면 게이트가 필요 없어진다.
--
-- ── 무엇을 ────────────────────────────────────────────────
--   반환 열 **끝에만** 4개 추가: check_in_ts / check_out_ts / payroll_status / date
--   🔴 기존 13열의 순서·이름·타입은 그대로다. 구 클라이언트는 신규 열을 무시하면 그만이고,
--      순서를 흔들면 위치로 읽는 소비자가 조용히 어긋난다.
--
-- ── 🔴 왜 CREATE OR REPLACE 가 아니라 DROP + CREATE 인가 ────
--   `RETURNS TABLE` 에 열을 더하는 건 반환 타입 변경이라 REPLACE 가 거부한다:
--     ERROR: cannot change return type of existing function
--     HINT:  Use DROP FUNCTION get_venue_day_slots(uuid,text) first.
--   🔴 DROP 은 PostgreSQL 기본값인 **PUBLIC EXECUTE 를 되살린다**. SECDEF 함수에서 이건
--      실제 보안 퇴행이므로(익명이 워크스페이스 데이터를 읽는다) 아래에서 즉시 회수한다.
--      복원 목표 ACL = postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres
--      (PUBLIC 몫 `=X/postgres` 와 anon 이 **없어야** 한다 — 회귀 가드는
--       supabase/tests/work_schedule_read_rpcs.test.sql 에 있다.)
--
-- ── 보존해야 하는 성질(베이스 = prod 실측 정의, 레포 정본은
--    20260710000002_baseline_schema_from_prod.sql:3101) ──────
--   · 파라미터 이름 `p_venue` / `p_date` — 클라가 이름으로 호출한다(PostgREST named args).
--   · STABLE · SECURITY DEFINER
--   · search_path = 'public', 'pg_temp'  (🔴 'extensions' 를 끼워 넣지 말 것. 현행값 유지)
--   · 인증 게이트 → 컨테이너 조회 → 워크스페이스 멤버십 게이트
--   · M1 재필터(venue 스팬 ∩ 동일 workspace) — 타 워크스페이스 유령행 차단
--   · 소프트 취소 필터 `status NOT IN ('cancelled','no_show')`
-- ============================================================

DROP FUNCTION public.get_venue_day_slots(uuid, text);

CREATE FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text)
RETURNS TABLE(
  -- ── 기존 13열 (순서·이름·타입 변경 금지) ──────────────────
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
  notes text,
  -- ── 신규 4열 (반드시 끝에) ────────────────────────────────
  check_in_ts timestamp with time zone,
  check_out_ts timestamp with time zone,
  payroll_status text,
  date text
)
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
    wl.notes,
    -- 실적: 미기록이면 null 그대로 내보낸다(0시로 뭉개면 "안 찍었다"가 사라진다).
    wl.check_in_ts,
    wl.check_out_ts,
    -- payroll_status 는 enum 이라 반환 타입(text)에 맞춰 캐스트한다.
    wl.payroll_status::text,
    -- 시트가 'HH:mm' 을 timestamptz 로 조립할 때 쓰는 기준 날짜(YYYY-MM-DD).
    wl.date
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
$$;

ALTER FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text) OWNER TO postgres;

COMMENT ON FUNCTION public.get_venue_day_slots(uuid, text) IS
  '주간 그리드 하루 슬롯: venue 스팬 ∩ 동일 workspace 그 날 work_logs union (컨테이너+open 공고, M1 재필터). '
  '실적(check_in_ts/check_out_ts)·정산상태·날짜를 함께 실어 근무표가 컨테이너 직속 여부와 무관하게 시간 편집 시트를 연다.';

-- 🔴 DROP 이 되살린 PUBLIC EXECUTE 회수 — 이 두 줄이 빠지면 anon 이 SECDEF 를 호출한다.
REVOKE ALL ON FUNCTION public.get_venue_day_slots(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_day_slots(uuid, text) TO authenticated, service_role;
