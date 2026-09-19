-- ============================================================================
-- S3-3 · 지원자 노쇼 이력 집계 (배치 RPC)
-- ============================================================================
-- 사장은 지원자를 확정하기 전에 "이 사람이 실제로 올까"를 알고 싶다. 지금은 알 방법이 없어
-- 확정해 놓고 당일 아침에야 안 온 걸 안다 — 그때는 메울 방법이 없다.
--
-- 🔴 이 기능은 사람에 대한 부정적 지표다. 설계를 좁히는 것이 기능 자체보다 중요하다.
--   ① **횟수만 돌려준다.** 어느 업장이었는지·언제였는지·사유가 무엇이었는지 일절 반환하지 않는다.
--      "어디서 펑크냈나"까지 보이면 그건 이력 확인이 아니라 뒷조사가 된다.
--   ② **180일 창.** 오래된 이력은 잊는다. 사람은 바뀌고, 2년 전 한 번이 영구 낙인이 되면
--      이 지표는 사람을 배제하는 도구가 된다.
--   ③ **이 공고 지원자만.** p_staff_ids 를 그대로 믿지 않고 `applications` 로 교차 검증한다.
--      아니면 아무 uuid나 넣어 임의 사용자의 노쇼 이력을 캐낼 수 있다(열거 공격).
--   ④ **권한 게이트.** 공고를 관리할 수 있는 사람만 부를 수 있다.
--
-- 왜 RPC 인가:
--   `work_logs` 의 RLS(wl_select)는 staff 본인 / owner / 워크스페이스 멤버·협업자 공고로 좁혀져
--   있다. 즉 클라이언트는 **다른 구인자 소속의 work_logs 를 아예 볼 수 없다** — 노쇼 이력은
--   정의상 '다른 공고에서의 기록'이므로 클라 직접 조회로는 계산이 불가능하다.
--
-- 판정축:
--   `status = 'no_show' OR no_show_at IS NOT NULL`
--   앱이 노쇼를 읽는 축과 같다(src/services/work/confirmedStaffService.ts:44).
--   정본 경로(markAsNoShow)는 두 컬럼을 함께 쓰지만, 한쪽만 남은 행이 있어도 세도록 OR 로 둔다.
--   여기서는 '놓치지 않는 것'이 맞다 — 세는 대상이 이미 일어난 사건이기 때문이다.
-- ============================================================================

-- 이력 조회는 (staff_id, 노쇼여부) 로 들어간다. 부분 인덱스로 노쇼 행만 담아 작게 유지한다.
CREATE INDEX IF NOT EXISTS work_logs_no_show_by_staff_idx
  ON public.work_logs (staff_id, date)
  WHERE status = 'no_show' OR no_show_at IS NOT NULL;

COMMENT ON INDEX public.work_logs_no_show_by_staff_idx IS
  'S3-3 지원자 노쇼 이력 집계용. 부분 인덱스라 노쇼가 아닌 대다수 행의 쓰기 비용에 영향이 없다.';

CREATE OR REPLACE FUNCTION public.get_applicant_no_show_counts(
  p_job_posting_id uuid,
  p_staff_ids uuid[]
)
RETURNS TABLE (staff_id uuid, no_show_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_owner_id     uuid;
  v_workspace_id uuid;
  v_found        boolean;
  -- 180일 창. work_logs.date 는 'YYYY-MM-DD' text 라 사전순 비교가 곧 날짜순 비교다.
  v_since text := to_char(
    ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '180 days')::date, 'YYYY-MM-DD');
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_job_posting_id IS NULL OR p_staff_ids IS NULL OR array_length(p_staff_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT jp.owner_id, jp.workspace_id, true
    INTO v_owner_id, v_workspace_id, v_found
    FROM public.job_postings jp
   WHERE jp.id = p_job_posting_id;

  IF NOT COALESCE(v_found, false) THEN
    RAISE EXCEPTION 'NOT_FOUND: 공고를 찾을 수 없습니다';
  END IF;

  -- 권한 축은 기존 RPC(add_direct_staff 등)와 같게 유지한다 — 여기만 다르면
  -- "지원자는 보이는데 노쇼 이력만 안 보이는" 앞뒤 안 맞는 화면이 된다.
  IF NOT (
       v_owner_id = v_caller
    OR public.is_workspace_member(v_workspace_id, v_caller)
    OR public.is_posting_collaborator(p_job_posting_id, v_caller)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 이 공고의 지원자를 볼 권한이 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    a.applicant_id,
    COUNT(wl.id)::integer
  FROM public.applications a
  LEFT JOIN public.work_logs wl
    ON  wl.staff_id = a.applicant_id
    AND (wl.status = 'no_show' OR wl.no_show_at IS NOT NULL)
    AND wl.date >= v_since
  -- 🔒 p_staff_ids 를 그대로 쓰지 않고 이 공고의 지원자로 교차 제한한다(열거 방지).
  WHERE a.job_posting_id = p_job_posting_id
    AND a.applicant_id = ANY(p_staff_ids)
  GROUP BY a.applicant_id;
END;
$$;

COMMENT ON FUNCTION public.get_applicant_no_show_counts(uuid, uuid[]) IS
  'S3-3: 특정 공고 지원자들의 최근 180일 노쇼 횟수를 배치로 반환한다. '
  '횟수만 반환하며 업장·날짜·사유는 노출하지 않는다(낙인 방지). '
  '공고 관리 권한자만 호출 가능하고, 요청한 staff_id 중 실제 지원자만 집계한다.';

REVOKE ALL ON FUNCTION public.get_applicant_no_show_counts(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_applicant_no_show_counts(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_applicant_no_show_counts(uuid, uuid[]) TO authenticated;
