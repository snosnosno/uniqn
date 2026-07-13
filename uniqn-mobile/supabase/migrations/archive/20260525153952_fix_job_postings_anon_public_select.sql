-- BUG: 공유 링크 클릭 시 비로그인(anon) 사용자가 공개 공고 상세에서
-- "permission denied for function is_workspace_member" (SQLSTATE 42501) 발생.
--
-- 원인: public.job_postings 의 SELECT 정책 jp_select_managed 가 TO PUBLIC(anon 포함)인데
-- USING 절에서 is_workspace_member()/is_posting_collaborator() 를 호출한다. 두 헬퍼는
-- EXECUTE 가 authenticated/service_role/postgres 에만 부여되어 있어, anon 이 함수 권한
-- 체크 단계에서 abort 된다. permissive 정책은 OR 로 합산되므로 jp_select_public_search
-- (status 필터, TO PUBLIC)가 행을 허용하기 전에 함수 참조만으로 anon 쿼리 전체가 실패.
--
-- FIX: 관리자용 SELECT 정책을 authenticated 롤로 한정. anon 쿼리는 jp_select_public_search
-- 만 평가하여 approved/active/closed 공고를 정상 조회한다. 로그인 사용자는 두 정책이
-- OR 로 결합되어 동작 불변.
--
-- 안전성: 제거되는 것은 anon 에 대한 "추가" permissive 분기이므로 anon 가시성은 늘 수
-- 없고 동일하거나 더 엄격해진다. jp_select_public_search 는 본 변경 이전부터 TO PUBLIC.
--
-- 적용: 2026-05-25 MCP apply_migration 으로 prod 선반영 + anon SELECT Red→Green 검증 완료.
-- 본 파일은 레포/신규 스택 동기화용.

ALTER POLICY jp_select_managed ON public.job_postings TO authenticated;
