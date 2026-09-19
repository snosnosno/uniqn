-- ============================================================
-- ops_resolve_staff_work_logs — ops 스태프 ↔ work_logs 근태 행 해석기 (ops 결함 ⑦-2)
--
-- 설계 근거: docs/planning/2026-08-08-ops-attendance-writeback-design.md
--
-- ── 이 함수가 없으면 무엇이 깨지는가 ────────────────────────
-- ops 콘솔에서 근태를 기록하려면 "이 스태프의 오늘 work_log 가 어느 행인가" 를 알아야 한다.
-- 순진한 답은 `ops_staff.source_work_log_id` 다. 그런데 그것은 **틀린 행을 가리킬 수 있다**:
-- import 는 `DISTINCT ON (wl.staff_id) ORDER BY wl.staff_id, wl.date DESC`(baseline:6964,6971)
-- 로 **스태프당 최신 날짜 1건**만 붙들고, `ops_staff_tournament_id_staff_id_key
-- UNIQUE(tournament_id, staff_id)`(baseline:11087)가 그 1:1 을 고정한다. 다일 공고에서
-- 8/10 대회를 운영하는데 8/12 행에 출근 시각이 박힌다.
-- → 그래서 해석 키는 `source_work_log_id` 가 아니라 **(job_posting_id, staff_id, event_date)** 다.
--
-- ── 왜 평범한 SELECT 가 아니라 SECDEF 인가 ──────────────────
-- 🔴 RLS 테이블의 "0건" 은 "행이 없다" 가 아니라 **"안 보인다"** 일 수 있고, 에러도 경고도
--    뜨지 않는다. ops 축 권한자가 공고 축 권한이 없으면 평범한 조회는 조용히 빈 결과를 주고
--    화면은 "근무 기록 없음" 이라는 **거짓 안내**를 띄운다. definer 로 실측한 뒤
--    `write_allowed=false`(권한 없음)와 `not_linked`(행 없음)를 **구분해서** 돌려줘야 한다.
--
-- ── 🔴 권한 축이 두 개다 (완화 금지) ────────────────────────
-- 입장 판정 = `is_ops_member`(baseline:3543-3561) — 대회 owner **또는** 연결공고 workspace 멤버.
-- 쓰기 판정 = **공고 축** — `update_work_log_slot`(20260808120000:335-345)의 술어를 그대로 재현한다.
-- 두 축은 일치하지 않는다: 대회 owner 이지만 공고 워크스페이스 밖인 사용자가 실재한다.
-- 🔴 "ops 멤버면 통과" 로 합치면 정산 권한 경계가 무너진다. 그래서 `write_allowed` 를
--    별도 컬럼으로 돌려준다 — 서버 쓰기 가드는 어차피 `update_work_log_slot` 이 재검증하므로
--    이 값의 용도는 **화면이 미리 알아 버튼을 숨기는 것**뿐이다(권한의 근거가 아니다).
--
-- ── 이 함수는 쓰지 않는다 ───────────────────────────────────
-- STABLE 읽기 전용이다. 근태 쓰기는 **기존 `update_work_log_slot`** 이 단독으로 맡는다.
-- 🔴 ops 훅에서 `supabase.from('work_logs').update({check_in_ts})` 를 쓰면 **통과한다** —
--    `work_logs_payroll_direct_write_block`(20260805120000:90-97)의 판별식은 payroll 4컬럼
--    변경 여부만 보고 `check_in_ts`/`check_out_ts` 는 판별 대상이 아니며, RLS `wl_update` 는
--    employer 직접 PATCH 를 허용한다. 감사·이력·알림·정산동결을 전부 우회한 잘못된 구현이
--    조용히 성공한다. **반드시 RPC 경유.**
--
-- ── reason 코드 (fail-closed — 애매하면 아무것도 안 한다) ───
--   ok            : 유일 행 해석됨, 쓰기 가능
--   no_event_date : ops_tournaments.event_date IS NULL (컬럼이 nullable 이다 — baseline:10407)
--   no_posting    : 대회에 공고가 연결되지 않음
--   not_linked    : 해당 날짜에 대응 work_log 없음 (수동 추가 스태프 등)
--   cancelled     : 후보가 있으나 전부 취소/노쇼 — 소프트 취소 필터(baseline:6969) 재현
--   ambiguous     : 같은 (공고, 스태프, 날짜)에 살아있는 행이 2건 이상
--   settled       : 해석은 됐으나 payroll_status='completed' — 쓰면 ALREADY_SETTLED
--
-- 🔴 `ambiguous` 를 자동 해소하지 않는다. `work_logs` 에 (job_posting_id, staff_id, date)
--    **UNIQUE 제약이 없다**(실측) — 같은 날 복수 시간대가 적법하다. 임의로 1건을 고르면
--    절반의 확률로 틀린 행에 시간이 박히므로 거부하고 사람에게 넘긴다.
--
-- 🔴 취소/노쇼 행을 후보에서 제외하는 것이 **함정 7 의 유일한 방어선**이다.
--    `update_work_log_slot` 은 `status IN (...)` 에서만 상태를 파생시키지만
--    `check_in_ts`/`check_out_ts` **컬럼 자체는 status 와 무관하게 써진다**(:499 UPDATE).
--    ⚠️ 그렇다고 서버 RPC 에 거부 가드를 넣으면 안 된다 —
--    `work_log_slot_attendance_rpc.test.sql:220-231` 이 "노쇼에 기록 보정" 을 **의도적으로
--    핀**하고 있어 기존 계약이 깨진다(PR#420 과 동형의 사고). 방어는 여기서만 한다.
--
-- 형식 규율: 함수 1개 신설 → 파리티 함수 206 → 207, 정책 111 불변(테이블·RLS 미변경).
--            parity_baseline_guard.test.sql 의 **마커(:155)와 단언 리터럴(:176) 을 동시 갱신**.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ops_resolve_staff_work_logs(
  p_tournament_id uuid,
  p_actor_id      uuid
)
RETURNS TABLE (
  ops_staff_id   uuid,
  staff_id       uuid,
  staff_name     text,
  work_log_id    uuid,
  wl_status      text,
  payroll_status text,
  check_in_ts    timestamp with time zone,
  check_out_ts   timestamp with time zone,
  write_allowed  boolean,
  reason         text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_t           RECORD;
  v_posting_id  uuid;
  v_date_text   text;
  v_posting_axis boolean := false;
BEGIN
  -- 액터 위조 차단 — import(baseline:6942-6944) 와 동일 관례.
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 입장 판정(ops 축). 쓰기 판정은 아래 공고 축이 따로 한다 — 합치지 말 것.
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  v_posting_id := v_t.job_posting_id;

  -- 쓰기 축 = `update_work_log_slot`(20260808120000:335-345) 술어의 공고 부분.
  -- 행별 `owner_id = actor` 갈래는 아래 쿼리에서 행마다 OR 로 붙인다(그쪽도 원본 술어의 일부다).
  IF v_posting_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = v_posting_id
        AND (COALESCE(public.is_workspace_member(jp.workspace_id, p_actor_id), false)
          OR COALESCE(public.is_posting_collaborator(jp.id, p_actor_id), false))
    ) INTO v_posting_axis;
  END IF;

  -- `work_logs.date` 는 **text** 다(baseline:3863). date 컬럼과 직접 비교하면 안 되므로
  -- 클라 `opsEventDate.ts` 의 형식 계약(YYYY-MM-DD)으로 정규화해서 맞춘다.
  v_date_text := to_char(v_t.event_date, 'YYYY-MM-DD');

  RETURN QUERY
  WITH cand AS (
    -- 후보 = 같은 (공고, 스태프, 운영일). 취소/노쇼 포함해서 일단 센다 —
    -- 전부 취소인 경우를 `not_linked` 와 구분해 `cancelled` 로 알려주기 위해서다.
    SELECT os.id AS os_id,
           wl.id AS wl_id,
           wl.status::text  AS wl_st,
           wl.payroll_status::text AS pay_st,
           wl.check_in_ts   AS ci,
           wl.check_out_ts  AS co,
           wl.owner_id      AS wl_owner,
           (wl.status NOT IN ('cancelled','no_show')) AS is_live
    FROM public.ops_staff os
    JOIN public.work_logs wl
      ON wl.staff_id = os.staff_id
     AND wl.job_posting_id = v_posting_id
     AND wl.date = v_date_text
    WHERE os.tournament_id = p_tournament_id
      AND v_posting_id IS NOT NULL
      AND v_date_text IS NOT NULL
  ), agg AS (
    SELECT os_id,
           count(*) FILTER (WHERE is_live) AS live_n,
           count(*)                        AS all_n,
           -- 살아있는 행이 정확히 1건일 때만 그 행을 집는다. 2건 이상이면 아래에서
           -- `ambiguous` 로 떨어지므로 여기서 고른 값은 쓰이지 않는다.
           (array_agg(wl_id      ORDER BY wl_id) FILTER (WHERE is_live))[1] AS wl_id,
           (array_agg(wl_st      ORDER BY wl_id) FILTER (WHERE is_live))[1] AS wl_st,
           (array_agg(pay_st     ORDER BY wl_id) FILTER (WHERE is_live))[1] AS pay_st,
           (array_agg(ci         ORDER BY wl_id) FILTER (WHERE is_live))[1] AS ci,
           (array_agg(co         ORDER BY wl_id) FILTER (WHERE is_live))[1] AS co,
           (array_agg(wl_owner   ORDER BY wl_id) FILTER (WHERE is_live))[1] AS wl_owner
    FROM cand
    GROUP BY os_id
  )
  SELECT
    os.id,
    os.staff_id,
    os.staff_name,
    CASE WHEN COALESCE(a.live_n, 0) = 1 THEN a.wl_id   ELSE NULL END,
    CASE WHEN COALESCE(a.live_n, 0) = 1 THEN a.wl_st   ELSE NULL END,
    CASE WHEN COALESCE(a.live_n, 0) = 1 THEN a.pay_st  ELSE NULL END,
    CASE WHEN COALESCE(a.live_n, 0) = 1 THEN a.ci      ELSE NULL END,
    CASE WHEN COALESCE(a.live_n, 0) = 1 THEN a.co      ELSE NULL END,
    -- 행 단위 쓰기 축: 공고 축 OR 그 work_log 의 owner. 해석 실패 행은 false —
    -- 쓸 대상이 없으면 권한을 주장하지 않는다.
    CASE WHEN COALESCE(a.live_n, 0) = 1
         THEN (v_posting_axis OR COALESCE(a.wl_owner = p_actor_id, false))
         ELSE false END,
    -- 우선순위: 대회 단위 결손 → 행 단위 결손 → 정산 동결 → ok
    CASE
      WHEN v_posting_id IS NULL             THEN 'no_posting'
      WHEN v_t.event_date IS NULL           THEN 'no_event_date'
      WHEN COALESCE(a.live_n, 0) > 1        THEN 'ambiguous'
      WHEN COALESCE(a.live_n, 0) = 0
           AND COALESCE(a.all_n, 0) > 0     THEN 'cancelled'
      WHEN COALESCE(a.live_n, 0) = 0        THEN 'not_linked'
      WHEN a.pay_st = 'completed'           THEN 'settled'
      ELSE 'ok'
    END
  FROM public.ops_staff os
  LEFT JOIN agg a ON a.os_id = os.id
  WHERE os.tournament_id = p_tournament_id
  ORDER BY os.staff_name, os.id;
END;
$$;

ALTER FUNCTION public.ops_resolve_staff_work_logs(uuid, uuid) OWNER TO postgres;

-- prod 하드닝 관례(20260731090000) 정합 — anon 배제, authenticated 만 실행.
REVOKE ALL ON FUNCTION public.ops_resolve_staff_work_logs(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_resolve_staff_work_logs(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_resolve_staff_work_logs(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_resolve_staff_work_logs(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.ops_resolve_staff_work_logs(uuid, uuid) IS
  'ops 스태프 ↔ work_logs 근태 행 해석기(결함 ⑦-2). 읽기 전용 — 쓰기는 update_work_log_slot 단독. '
  '해석 키는 source_work_log_id 가 아니라 (job_posting_id, staff_id, event_date) 다: import 의 '
  'DISTINCT ON 이 스태프당 최신 1건만 붙들어 다일 공고에서 틀린 날짜 행을 가리킨다. '
  'SECDEF 인 이유는 RLS 의 "0건" 이 "안 보인다" 일 수 있어 권한없음(write_allowed=false)과 '
  '행없음(not_linked)을 구분할 수 없기 때문이다. write_allowed 는 ops 축이 아니라 공고 축으로 '
  '판정한다 — 두 축은 불일치하며 합치면 정산 권한 경계가 무너진다(화면 힌트 전용, 실제 가드는 RPC). '
  'ambiguous 는 자동 해소하지 않는다 — work_logs 에 (공고,스태프,날짜) UNIQUE 가 없어 임의 선택은 오답 위험. '
  '취소/노쇼 제외가 함정 7(취소 행에 시각만 박힘)의 유일한 방어선이다.';
