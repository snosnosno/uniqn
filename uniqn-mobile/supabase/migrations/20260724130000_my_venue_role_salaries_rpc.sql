-- uniqn-mobile/supabase/migrations/20260724130000_my_venue_role_salaries_rpc.sql
-- staff 본인이 배치된 지점 컨테이너의 역할별 단가표 조회 RPC (JIT 급여 #6, 2026-07-24)
--
-- 문제: staff "내 스케줄"에서 컨테이너 직속 배치(job_posting_id = venue, status='container')의
-- 급여가 항상 기본단가(15,000원)로 폴백됐다. 원인은 job_postings SELECT RLS 가 container 를
-- 제외하기 때문 — job_postings_select_all / jp_select_public_search 는
-- approved/active/capacity_full/closed 만, jp_select_managed 는 workspace member/owner/collaborator
-- 만 허용한다. 직접배치된 staff 는 워크스페이스 멤버가 아니라 컨테이너 roleSalaries 를 못 읽는다.
-- (employer 정산은 settlementVenueQuery 가 getVenueContainerById 로 해소 — 그쪽은 멤버라 RLS 통과.)
--
-- 해법: SECDEF RPC 로 "호출자 본인이 work_log 를 가진 컨테이너"의 역할단가만 최소 노출한다.
-- 노출면은 role/customRole/salary 뿐이고, 대상 컨테이너도 본인 배치가 있는 것으로 제한한다
-- (지점 전체 단가표를 무차별 노출하지 않는다). anon REVOKE + authenticated 만 실행.
--
-- ⚠️ 이 마이그레이션은 배포 후 실기기(staff 계정)에서 "내 스케줄 급여가 지점 단가로 표시되는지"
--    실측 검증이 필요하다(클라이언트는 typecheck/test 로만 검증됨).

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
    );
$$;

-- SECDEF 하드닝: anon/public 실행 차단, authenticated 만 허용.
REVOKE EXECUTE ON FUNCTION public.get_my_venue_role_salaries(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_venue_role_salaries(uuid[]) TO authenticated;
