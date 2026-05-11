-- E2E helper schema drift 해소.
--
-- 배경:
--   public.is_employer_or_admin()은 prod DB에는 존재하지만 git migration 이력에는
--   CREATE 정의가 없고 20260414013837_fix_function_search_path_final.sql 의
--   ALTER FUNCTION만 남아 있어 local supabase reset / 새 환경 부트스트랩 시
--   "function does not exist" 에러를 일으킨다.
--
-- 동작:
--   CREATE OR REPLACE 이므로 prod 적용은 no-op. local / staging / E2E 환경에
--   동일한 정의를 보장한다. is_admin()(20260410110237 fix_security_advisors 에서
--   정의됨)과 동일한 SECURITY DEFINER + STABLE + search_path 시그니처.
--
-- 참고:
--   ALTER FUNCTION ... SET search_path 는 20260414013837 에서 이미 prod에 적용
--   되었으나, 본 migration이 SET search_path 절을 본문에 직접 포함하므로
--   재실행 시 동일한 효과 유지.

CREATE OR REPLACE FUNCTION public.is_employer_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'employer'), false);
$function$;

COMMENT ON FUNCTION public.is_employer_or_admin() IS
  'JWT app_metadata.role 이 admin 또는 employer 인지 확인. RLS 정책 / RPC 권한 게이트에서 사용. is_admin()과 동일한 보안 시그니처 (SECURITY DEFINER + STABLE + 고정 search_path).';
