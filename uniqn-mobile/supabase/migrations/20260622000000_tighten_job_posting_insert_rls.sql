-- ============================================================
-- [P2-1] 공고 INSERT RLS 강화 — owner_id 위조 방지
--
-- 배경: 지갑/IAP 제거(PR #196)로 공고 생성이 결제 RPC
--   create_job_posting_with_payment_atomically (SECURITY DEFINER, 서버측에서
--   p_owner_id = auth.uid() 강제) 경유에서 클라이언트 직접 supabase.insert()
--   (JobPostingRepository.createWithTransaction) 로 환원됨.
--   이때 RPC가 보장하던 "owner_id = 호출자" 서버측 바인딩이 사라져,
--   RLS만 남게 됨.
--
-- 문제: 현행 INSERT 정책 2개가 모두 owner_id 를 auth.uid() 에 묶지 않음.
--   ① job_postings_insert_authenticated (base_schema)
--      WITH CHECK (auth.uid() IS NOT NULL)  ← 과허용. PERMISSIVE OR 합산이라
--      이 정책 하나만으로 임의 인증 사용자가 arbitrary owner_id 공고 위조 가능.
--   ② jp_insert (20260414015346)
--      WITH CHECK (get_my_role() IN ('admin','employer'))  ← 역할만 검사,
--      owner_id 바인딩 없음 → employer 가 타인 명의 공고 생성 가능.
--
-- 수정:
--   - ① 과허용 정책 폐기 (DROP).
--   - ② jp_insert 를 재생성하되 WITH CHECK 에 owner_id = auth.uid() 결합.
--        admin 은 타인 명의 생성 정상 경로 허용 (OR public.is_admin()).
--   - service_role(백엔드)은 BYPASSRLS 라 영향 없음.
--   - 정상 클라 생성(owner_id = 본인, role=employer)은 그대로 통과.
--
-- 멱등: DROP POLICY IF EXISTS 후 CREATE.
-- ⚠️ 이 파일은 작성만 된 상태이며 prod/staging 에 적용하지 않았음 (2026-06-22).
-- ============================================================

-- ① 과허용 INSERT 정책 폐기
DROP POLICY IF EXISTS "job_postings_insert_authenticated" ON public.job_postings;

-- ② jp_insert 강화: 역할 게이트(admin|employer) + owner_id 본인 바인딩 (admin 예외)
DROP POLICY IF EXISTS jp_insert ON public.job_postings;
CREATE POLICY jp_insert ON public.job_postings FOR INSERT TO public
  WITH CHECK (
    (SELECT get_my_role()) = ANY (ARRAY['admin'::text, 'employer'::text])
    AND (
      owner_id = (SELECT auth.uid())
      OR public.is_admin()
    )
  );
