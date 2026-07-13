-- public.users.role 변경 시 auth.users.app_metadata.role 자동 동기화
-- authorizationService.ts의 requireAdminUser()는 app_metadata.role을 체크하므로,
-- DB role 변경 시 JWT에 반영되도록 트리거로 동기화.
-- 주의: role 변경 후 기존 발급된 JWT는 다음 로그인(토큰 갱신) 시 반영됨.

CREATE OR REPLACE FUNCTION public.sync_user_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 신규 가입 시 role 동기화
CREATE OR REPLACE TRIGGER on_public_user_created_sync_role
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_app_metadata();

-- role 변경 시 동기화 (employer 등록, admin 승격 등)
CREATE OR REPLACE TRIGGER on_public_user_role_changed
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.sync_user_role_to_app_metadata();
