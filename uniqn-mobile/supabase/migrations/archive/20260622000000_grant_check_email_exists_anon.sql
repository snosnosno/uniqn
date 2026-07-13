-- 2026-06-22 가입 경로 anon 명시 grant — #195 db-tests test7 회귀 + 암묵 grant 명시화
--
-- 배경: check_email_exists(text) 는 회원가입 Step 1(계정 생성 전, 미인증 anon)에서
--   이메일 중복을 확인하는 공개 경로 함수다(authCoreService.ts checkEmailExists).
--   20260414130300_recover_auth_application_rpcs.sql 가 REVOKE ALL FROM PUBLIC +
--   GRANT TO authenticated 만 부여해, fresh 스택에서는 anon 의 암묵 PUBLIC grant 가
--   사라져 anon 실행권한이 소실됐다(PR #183 의 "암묵→명시 grant" 갭과 동일 패턴).
--   prod 는 암묵 grant 잔존으로 무영향이나, CI fresh 스택의 db-tests test7
--   ('anon retains EXECUTE on check_email_exists (signup path)') 가 RED.
--
-- 수정: anon 에 EXECUTE 를 명시 부여(멱등 — 반복 적용 안전).

GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon;
