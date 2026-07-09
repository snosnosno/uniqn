-- ============================================================
-- 2026-07-10 공개 공고 SELECT whitelist 축소 회귀 가드 (마이그 20260710000200)
-- 검증(구조): job_postings_select_all 의 USING 이 공개 whitelist 로 좁혀졌고,
--   블랭킷 `status <> container` 잔재가 제거되었으며, container 는 여전히 제외(fail-close).
-- 행동 검증(anon 이 cancelled 못 봄)은 prod red-green 으로 수행(라이브 cancelled 2행→0행).
--   로컬 행동 시드는 workspace_id NOT NULL+FK 로 무거워 구조 단언으로 대체.
-- 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(4);

-- 정책 존재
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.job_postings'::regclass AND polname = 'job_postings_select_all'),
  'job_postings_select_all 정책이 존재한다'
);

-- 1) whitelist status 포함
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
   WHERE polrelid = 'public.job_postings'::regclass AND polname = 'job_postings_select_all')
   LIKE '%capacity_full%',
  'USING 이 공개 whitelist(capacity_full 포함)로 좁혀졌다'
);

-- 2) 블랭킷 `status <> container` 잔재 없음 (누수 제거 회귀)
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
   WHERE polrelid = 'public.job_postings'::regclass AND polname = 'job_postings_select_all')
   NOT LIKE '%<>%',
  'USING 에 status<>container 블랭킷 잔재가 없다(cancelled/draft 비노출)'
);

-- 3) container 는 whitelist 에 없다(fail-close 유지)
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
   WHERE polrelid = 'public.job_postings'::regclass AND polname = 'job_postings_select_all')
   NOT LIKE '%container%',
  'container 는 공개 whitelist 에 포함되지 않는다(20260630000400 fail-close 계약 유지)'
);

SELECT * FROM finish();
ROLLBACK;
