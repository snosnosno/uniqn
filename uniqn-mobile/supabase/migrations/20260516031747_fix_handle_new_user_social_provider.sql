-- handle_new_user trigger 수정 — social_provider 컬럼을 raw_app_meta_data 에서 추출
-- 기존 trigger 는 social_provider 를 채우지 않아 모든 OAuth 가입자가 NULL 로 들어가
-- authRedirect 의 socialSignup 분기를 통과 못하고 identity_verified=false reverify 게이트에 trap.
-- root cause: handle_new_user 본문이 (id, email, name, role) 4개만 INSERT.
-- fix: raw_app_meta_data->>'provider' 에서 OAuth provider 추출 → apple/google/kakao 화이트리스트.
-- email/password 가입은 raw_app_meta_data.provider='email' 이므로 NULL 유지 (CASE ELSE).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider text;
BEGIN
  v_provider := NEW.raw_app_meta_data ->> 'provider';

  INSERT INTO public.users (id, email, name, role, social_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE((NEW.raw_app_meta_data ->> 'role')::user_role, 'staff'),
    CASE
      WHEN v_provider IN ('apple', 'google', 'kakao') THEN v_provider
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$function$;
