-- 주간 배치 그리드 — Phase 1 ⑤ 컨테이너 공개 RLS fail-closed 보정 (누수 감사 발견)
--
-- 누수 감사 pgTAP(weekly_grid_container_failclosed)가 base_schema 의 블랭킷 정책
-- job_postings_select_all (FOR SELECT USING(true)) 를 통해 컨테이너(status='container')가
-- 외부인(anon/타 사용자)에게도 노출됨을 적발했다. jp_select 의 status allow-list 만으로는
-- 막히지 않는다 — RLS permissive 정책은 OR 합산이라 USING(true) 가 항상 이긴다
-- (pitfall_anon_rls_secdef_function_poison / permissive OR 합산 함정과 동일 클래스).
--
-- 조치: 블랭킷 SELECT 정책에서 컨테이너만 carve-out 한다. 비컨테이너 공고의 가시성은 종전과
--   완전히 동일(무회귀). 컨테이너는 owner(jp_select owner 분기) / 워크스페이스 멤버·콜라보레이터
--   (jp_select_managed) / admin 만 볼 수 있다(fail-closed, R2).
-- 락 안전(R4): 블랭킷 SELECT 정책 교체 시 ACCESS EXCLUSIVE 락 큐 무한점유 방지.
SET LOCAL lock_timeout = '3s';
DROP POLICY IF EXISTS "job_postings_select_all" ON public.job_postings;
CREATE POLICY "job_postings_select_all" ON public.job_postings
  FOR SELECT USING (status <> 'container');
