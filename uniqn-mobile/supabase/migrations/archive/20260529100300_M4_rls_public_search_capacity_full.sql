-- M4 (공고 자동마감 Approach B): 공개 SELECT RLS 에 capacity_full 추가
--
-- /review 적발(P1): 공개 SELECT 정책의 status 허용집합이 ('approved','active','closed')
--   하드코딩이라, M2 트리거가 공고를 capacity_full 로 자동 전이하면 anon/비관리자에게
--   해당 공고가 **읽기 불가**가 된다 → 공유 링크 404 + 확정 스태프의 상세 조회 실패.
--   closed 가 이미 공개 가시인데 capacity_full(덜 마감된 상태)이 빠진 비대칭.
--   spec §4/§6: capacity_full 은 "정원 마감" 회색으로 사용자에게 노출되어야 함.
--
-- ⚠️ prod/repo 정책 드리프트(선재): 공개 SELECT 정책 이름이 환경별로 다르다.
--   - prod: `jp_select_public_search` (status 허용집합, TO public) — CREATE 마이그 미커밋
--   - repo/로컬: `jp_select` (status 허용집합 OR owner OR admin, TO public, 20260414015346)
--   둘 중 존재하는 정책만 갱신해 환경 무관 멱등 적용. (드리프트 자체 정리는 별도 작업.)

DO $$
BEGIN
  -- prod: jp_select_public_search (status 허용집합만)
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.job_postings'::regclass AND polname = 'jp_select_public_search'
  ) THEN
    ALTER POLICY jp_select_public_search ON public.job_postings
      USING (status = ANY (ARRAY['approved'::posting_status, 'active'::posting_status, 'capacity_full'::posting_status, 'closed'::posting_status]));
  END IF;

  -- repo/로컬: jp_select (status 허용집합 OR owner OR admin)
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.job_postings'::regclass AND polname = 'jp_select'
  ) THEN
    ALTER POLICY jp_select ON public.job_postings
      USING ((status = ANY (ARRAY['approved'::posting_status, 'active'::posting_status, 'capacity_full'::posting_status, 'closed'::posting_status]))
        OR (owner_id = (SELECT auth.uid()))
        OR ((SELECT get_my_role()) = 'admin'));
  END IF;
END $$;
