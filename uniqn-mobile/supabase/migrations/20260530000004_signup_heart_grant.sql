-- ============================================================
-- T4: 가입 시 하트 10 적립 (handle_new_user 확장) + 기존 사용자 백필
--   - 본문 전체 보존 (20260519223300) + grant_signup 블록 EXCEPTION 격리
--   - 멱등: grant_signup ledger 없을 때만 (orphan self-heal 재실행 무적립)
-- ============================================================

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
      RAISE WARNING 'handle_new_user: workspace 자동 생성 실패 (user_id=%, error=%)',
        NEW.id, SQLERRM;
    END;
  END IF;

  -- 가입 적립 +10 (멱등 가드 + EXCEPTION 격리 — 적립 실패가 가입을 막지 않음)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger
      WHERE user_id = NEW.id AND reason = 'grant_signup'
    ) THEN
      PERFORM public.grant_heart_atomically(NEW.id, 10, 'grant_signup'::wallet_reason, NULL, 90);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: grant_signup 실패 (user_id=%, error=%)', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  '신규 가입자 public.users INSERT + employer default workspace 자동 생성 + 가입 하트 10 적립 (2026-05-30 T4). 적립/workspace 실패는 회원가입 차단하지 않음 (EXCEPTION 격리).';

-- 기존 사용자 백필 (grant_signup 없는 모든 public.users에게 1회 +10)
CREATE OR REPLACE FUNCTION public.backfill_signup_hearts()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_count INT := 0;
BEGIN
  FOR v_user IN
    SELECT u.id FROM public.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger l
      WHERE l.user_id = u.id AND l.reason = 'grant_signup'
    )
  LOOP
    BEGIN
      PERFORM public.grant_heart_atomically(v_user.id, 10, 'grant_signup'::wallet_reason, NULL, 90);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill_signup_hearts: skip user=% (error=%)', v_user.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_signup_hearts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_signup_hearts() TO service_role;

-- 1회성 백필 실행 (멱등 — 재적용해도 grant_signup 있는 유저는 skip)
SELECT public.backfill_signup_hearts();
