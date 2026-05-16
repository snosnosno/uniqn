-- handle_new_user 화이트리스트에 naver 추가 — DB CHECK 와 일치시킴
-- 직전 migration(20260516031747)에서 apple/google/kakao 만 처리. CHECK 제약은
-- ['apple','google','kakao','naver'] 4종 허용이므로 naver 누락은 향후 trap 재발 위험.
-- 현재 naver 로그인 미구현이지만 일관성 확보 차원.

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
      WHEN v_provider IN ('apple', 'google', 'kakao', 'naver') THEN v_provider
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$function$;
