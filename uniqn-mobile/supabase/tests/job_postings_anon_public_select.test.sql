-- ============================================================
-- 공개 공고 anon SELECT 회귀 테스트 (공유 링크 401 재발 방지)
-- ============================================================
-- 목적: 비로그인(anon) 사용자가 public.job_postings 를 SELECT 할 때
--       "permission denied for function is_workspace_member" (42501)가
--       다시 발생하지 않음을 보장.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/job_postings_anon_public_select.test.sql
--   또는 supabase test db (CI: .github/workflows/db-tests.yml)
--   기대 결과: 2 tests passed, 에러 0건
--
-- Red→Green:
--   - FIX 이전(jp_select_managed TO PUBLIC): TEST 1 이 42501 로 die → fail.
--   - FIX 이후(jp_select_managed TO authenticated): anon 은 jp_select_public_search
--     만 평가 → 함수 참조 없음 → lives.
--
-- 안전장치: BEGIN/ROLLBACK 래핑, 시드 없음(테이블 행 유무와 무관한 권한 버그라
--           실데이터를 건드리지 않고 정책 평가 경로만 검증).
-- ============================================================

BEGIN;
SELECT plan(2);

-- TEST 1 (behavioral / 핵심 회귀): anon SELECT 가 함수 권한으로 abort 되지 않는다.
-- lives_ok 본문에서만 anon 으로 전환(테스트 러너 자신은 anon 권한 불필요).
SELECT lives_ok(
  $$ SET LOCAL ROLE anon;
     SELECT count(*) FROM public.job_postings WHERE status = 'active';
     RESET ROLE; $$,
  'anon 은 42501 없이 공개(active) 공고를 SELECT 할 수 있어야 한다'
);

-- TEST 2 (structural / 회귀 가드): 관리자 SELECT 정책이 authenticated 로 한정되어
-- anon 쿼리에 is_workspace_member 가 더 이상 섞이지 않는다.
SELECT is(
  (SELECT array_agg(rolname ORDER BY rolname)::text
   FROM pg_policy p
   CROSS JOIN LATERAL unnest(p.polroles) AS r(oid)
   JOIN pg_roles ON pg_roles.oid = r.oid
   WHERE p.polrelid = 'public.job_postings'::regclass
     AND p.polname = 'jp_select_managed'),
  '{authenticated}',
  'jp_select_managed 는 authenticated 롤로만 적용되어야 한다(anon 제외)'
);

SELECT finish();
ROLLBACK;
