-- [P2] applications/work_logs 중복 permissive SELECT 정책 정리 (fresh-stack drift)
--
-- 근거: rev1 보안·머니 리뷰 (docs/planning/2026-06-05-rev1-security-money-fixes.md §1-4)
-- 문제: base(20260409000000)가 applications_select_involved 를 만든 뒤, 후속 마이그는 별도명
--       app_select 만 갱신 → 파일로 재구축하는 fresh-stack 에 SELECT permissive 2정책 공존
--       (노출 동일·app_select 상위집합, perf/advisor 부채). work_logs 도 동일 패턴 가능성.
-- 실측: prod 에는 app_select / wl_select 만 존재(base 명칭 이미 정리됨) → 본 DROP 은 prod no-op.
--       fresh-stack 일관성 확보용. 상위집합 정책(app_select/wl_select) 존재 시에만 안전.

DROP POLICY IF EXISTS "applications_select_involved" ON public.applications;
DROP POLICY IF EXISTS "work_logs_select_involved"    ON public.work_logs;
