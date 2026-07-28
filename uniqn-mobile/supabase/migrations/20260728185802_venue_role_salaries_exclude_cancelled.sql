-- uniqn-mobile/supabase/migrations/20260728185802_venue_role_salaries_exclude_cancelled.sql
-- get_my_venue_role_salaries: 취소·노쇼 배정을 노출 근거에서 제외 (2026-07-28)
--
-- 문제: 이 RPC 의 EXISTS 는 work_logs 를 staff_id 로만 걸러 status 를 보지 않는다.
--   20260724130000 신설 당시에는 정확했다 — 그때 배치 해제 경로(remove_direct_staff)가
--   하드 DELETE 였으므로 "행이 있다 == 지금 배치돼 있다"가 성립했다.
--   20260727112025(#357)가 그 경로를 status='cancelled' 소프트 취소로 바꾸면서 전제가 깨졌다.
--   이제 근무표에서 빠진 스태프의 행이 그대로 남아, 그 스태프가 지점 단가표를 계속 조회한다.
--
-- 노출면: role/customRole/salary(지점 역할별 단가). 권한 없는 사용자에게 새는 게 아니라,
--   "권한이 끝난 사용자에게 계속 남는" stale authorization 이다.
--
-- 실측(2026-07-28 prod): 컨테이너-스태프 쌍 2건 모두 배치 유지 중 → 현재 유출 0건.
--   즉 이미 샌 데이터는 없고, 직접 배치 인원을 빼는 순간부터 새는 예약된 결함이다.
--
-- 해법: 형제 리더(get_venue_day_slots / get_venue_grid_summary)가 이미 쓰고 있는
--   `status NOT IN ('cancelled','no_show')` 술어를 EXISTS 에 동일하게 적용한다.
--   같은 컨테이너에 활성 배정이 하나라도 남아 있으면 종전대로 조회된다(과잉 차단 없음).
--
-- 이 마이그레이션은 CREATE OR REPLACE 단일 함수 재정의다 — 파리티 카운트(함수 183·정책 111) 불변.
-- 베이스는 가장 최근 정의인 20260724130000 원문이며, EXISTS 절 한 줄만 추가했다.

CREATE OR REPLACE FUNCTION public.get_my_venue_role_salaries(p_ids uuid[])
RETURNS TABLE(
  job_posting_id uuid,
  role text,
  custom_role text,
  salary_type text,
  salary_amount numeric
)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT
    jp.id AS job_posting_id,
    rs->>'role' AS role,
    rs->>'customRole' AS custom_role,
    rs->'salary'->>'type' AS salary_type,
    (rs->'salary'->>'amount')::numeric AS salary_amount
  FROM public.job_postings jp
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(jp.schedule -> 'roleSalaries') = 'array'
        THEN jp.schedule -> 'roleSalaries'
      ELSE '[]'::jsonb
    END
  ) AS rs
  WHERE jp.id = ANY(p_ids)
    AND jp.status = 'container'::public.posting_status
    AND EXISTS (
      SELECT 1
      FROM public.work_logs wl
      WHERE wl.job_posting_id = jp.id
        AND wl.staff_id = (SELECT auth.uid())
        -- 소프트 취소(#357) 이후 필수: 취소·노쇼 행은 "현재 배치"의 근거가 아니다.
        AND wl.status NOT IN ('cancelled', 'no_show')
    );
$$;

-- SECDEF 하드닝 재선언(CREATE OR REPLACE 는 권한을 보존하지만 드리프트 방어로 멱등 재적용).
REVOKE EXECUTE ON FUNCTION public.get_my_venue_role_salaries(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_venue_role_salaries(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_my_venue_role_salaries(uuid[]) IS
  'staff 본인이 *현재* 배치된 지점 컨테이너의 역할별 단가표만 반환한다. 취소·노쇼 배정은 근거에서 제외(2026-07-28) — remove_direct_staff 가 하드 DELETE 에서 소프트 취소로 바뀐 #357 이후 필수.';
