-- 2026-06-21 VCS↔prod 드리프트 정합화.
-- prod 에는 수기 DDL 로 존재하나 마이그레이션(VCS)엔 없는 보안 객체들을 멱등 코드화하여,
-- fresh 스택(로컬 dev / CI db-tests / DR 재구축)이 prod 와 동일한 보안 자세를 갖도록 한다.
-- prod 적용 시: 대부분 멱등 no-op, 단 sec-auth-4 의 중복 sync 트리거만 실제 제거(이중 쓰기 해소).

-- ─── (sec-auth-1) 권한상승 차단 함수 + 트리거 (prod 실측 본문) ──────────────
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  -- 일반 사용자의 직접 role 변경 차단 (register_as_employer 등 SECURITY DEFINER RPC 는 우회).
  RAISE EXCEPTION 'ROLE_CHANGE_DENIED: 역할 변경은 전용 API를 통해서만 가능합니다';
END;
$function$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.users;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ─── (sec-auth-2) base_schema 의 광역 SELECT 정책 제거 ───────────────────────
-- users_select_self_or_admin 는 USING 에 auth.role()='authenticated' 가 있어 인증 사용자
-- 누구나 전 users PII 를 읽을 수 있다. prod 엔 이미 없으나 fresh 스택엔 남아있음 → 멱등 DROP.
-- 정식 정책 users_select(self/admin) 는 20260414015346 에서 이미 생성됨.
DROP POLICY IF EXISTS users_select_self_or_admin ON public.users;

-- ─── (dataint-1) applications 중복지원 방지 UNIQUE (prod 존재, fresh 누락) ────
-- prod 에는 applications_job_posting_id_applicant_id_key 가 존재하나 VCS 엔 없음.
-- apply_with_capacity_check 는 cancelled 행 UPDATE 재지원이라 full UNIQUE 와 정합.
CREATE UNIQUE INDEX IF NOT EXISTS applications_job_posting_id_applicant_id_key
  ON public.applications (job_posting_id, applicant_id);

-- ─── (sec-auth-4) role→app_metadata 동기화 중복 트리거 제거 ──────────────────
-- prod 에 on_public_user_role_changed(→sync_user_role_to_app_metadata) 와
-- users_role_sync(→sync_role_to_auth) 가 공존해 role UPDATE 마다 auth.users 이중 쓰기.
-- 정식 경로(sync_user_role_to_app_metadata, VCS 20260412082628)만 남기고 중복 제거.
DROP TRIGGER IF EXISTS users_role_sync ON public.users;
DROP FUNCTION IF EXISTS public.sync_role_to_auth();
