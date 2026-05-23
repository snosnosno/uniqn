-- handle_new_user 트리거 확장 — employer 가입 시 default workspace 자동 생성
--
-- 문제: 2026-05-07 backfill 마이그레이션은 일회성이라 그 이후 가입한 employer 는
-- default workspace 가 없음. 공고 등록 시 jobManagementService.createJobPosting →
-- workspaceService.getDefaultWorkspaceIdForOwner 가 0개 발견하고
-- "워크스페이스를 찾을 수 없어요" 에러 throw → 신규 가입자는 공고 등록 차단.
--
-- 해결: handle_new_user 안에서 role='employer' 일 때 자동으로 workspace INSERT.
-- 워크스페이스 이름은 backfill 마이그레이션과 동일한 COALESCE 패턴 (LEFT 40자 안전).
-- workspace INSERT 가 실패해도 회원가입 자체는 성공하도록 EXCEPTION 블록으로 격리
-- (실패 시 클라이언트 fallback workspaceService.getDefaultWorkspaceIdForOwner 가
-- 자동 생성으로 복구).
--
-- 호환: SECURITY DEFINER 라 RLS workspaces_insert_employer_with_cap 우회.
-- staff/admin/staff→employer 역할 변경은 다음 별도 trigger 또는 클라이언트 fallback 처리.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider text;
  v_role public.user_role;
  v_workspace_name text;
BEGIN
  v_provider := NEW.raw_app_meta_data ->> 'provider';
  v_role := COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'staff');

  INSERT INTO public.users (id, email, name, role, social_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    v_role,
    CASE
      WHEN v_provider IN ('apple', 'google', 'kakao', 'naver') THEN v_provider
      ELSE NULL
    END
  );

  -- employer 자동 default workspace 생성 (2026-05-07 backfill 후속)
  IF v_role = 'employer' THEN
    BEGIN
      v_workspace_name := COALESCE(
        NULLIF(LEFT(NEW.raw_user_meta_data ->> 'name', 40), ''),
        NULLIF(LEFT(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 40), ''),
        '내'
      ) || ' 워크스페이스';

      INSERT INTO public.workspaces (name, owner_id)
      VALUES (v_workspace_name, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- workspace 생성 실패는 회원가입 자체를 막지 않음.
      -- 클라이언트 fallback (workspaceService.getDefaultWorkspaceIdForOwner)
      -- 이 첫 공고 등록 시점에 재생성 시도.
      RAISE WARNING 'handle_new_user: workspace 자동 생성 실패 (user_id=%, error=%)',
        NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  '신규 가입자 public.users INSERT + employer 일 경우 default workspace 자동 생성 (2026-05-19 hotfix). workspace 실패는 회원가입 차단하지 않음 (클라이언트 fallback 안전망).';
