-- 2026-07-10 보안 하드닝 (P0, C1): 공개 공고 SELECT 정책 whitelist 축소
--
-- 배경(prod 라이브 감사 실측, 2026-07-10):
--  * job_postings_select_all 은 base_schema 의 블랭킷 정책(FOR SELECT USING(true))에서
--    출발했고, 20260630000400(weekly grid)이 컨테이너 누수만 막으려 USING(status<>'container')
--    로 좁혔다. 그러나 그 변경은 컨테이너만 대상 → cancelled/draft/pending/rejected/expired
--    가 여전히 anon(및 모든 사용자)에게 노출됨(라이브 재현: anon 이 cancelled 공고 2행 SELECT).
--  * PERMISSIVE 정책은 OR 합산이라, 세밀한 공개 whitelist 정책(prod=jp_select_public_search /
--    repo=jp_select, status IN approved/active/capacity_full/closed)이 이 블랭킷에 의해 무력화된다.
--
-- 의도된 공개 집합(문서·기존 pgTAP 계약): approved / active / capacity_full / closed.
--   draft/pending/rejected 는 소유자만(authenticated jp_select_managed), cancelled/expired 는
--   공개 대상 아님. container 는 fail-closed(20260630000400 계약 유지 — whitelist 가 container 제외).
--
-- 수정: job_postings_select_all 의 USING 을 공개 whitelist 로 축소(DROP+CREATE, 멱등).
--   좁아진 정책은 공개 whitelist 정책과 동치가 되나(중복 OR 무해), 블랭킷 누수는 제거된다.
--   소유자/멤버/협업자/admin 의 관리 접근은 jp_select_managed(authenticated) 로 불변.
--
-- 락 안전: SELECT 정책 교체 시 ACCESS EXCLUSIVE 락. lock_timeout 으로 큐 무한점유 방지.
-- 검증: prod red-green(anon cancelled 2행→0행) + pgTAP 구조 회귀(USING=whitelist).

SET LOCAL lock_timeout = '3s';

DROP POLICY IF EXISTS "job_postings_select_all" ON public.job_postings;
CREATE POLICY "job_postings_select_all" ON public.job_postings
  FOR SELECT
  TO public
  USING (
    status = ANY (ARRAY[
      'approved'::posting_status,
      'active'::posting_status,
      'capacity_full'::posting_status,
      'closed'::posting_status
    ])
  );
