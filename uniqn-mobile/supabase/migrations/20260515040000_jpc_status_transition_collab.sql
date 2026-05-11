-- enforce_jp_status_transition collaborator 분기 — Phase 2.6 (audit 신규 발견)
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Task 2.6)
-- 기존 함수: 20260514050000_enforce_jp_status_transition.sql
--
-- 발견 (Phase 0 audit): 공고 status 변경 (active|closed → cancelled) trigger 가
-- workspace owner OR admin 만 허용. D2 풀 관리권에 따라 collaborator 도 cancel 가능해야.

CREATE OR REPLACE FUNCTION public.enforce_jp_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_uid uuid;
  v_is_workspace_owner boolean;
  v_is_admin boolean;
  v_is_collaborator boolean;
BEGIN
  -- 보호 대상: active|closed → cancelled (soft-delete 경로)
  IF NEW.status = 'cancelled' AND OLD.status IN ('active', 'closed') THEN
    v_caller_uid := (SELECT auth.uid());

    -- service-side bypass: 시드/마이그레이션/cron/SECURITY DEFINER RPC
    IF v_caller_uid IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = NEW.workspace_id AND owner_id = v_caller_uid
    ) INTO v_is_workspace_owner;

    -- 메모리 룰: app role 식별은 auth.jwt() -> 'app_metadata' ->> 'role'
    v_is_admin := coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      false
    );

    -- D2 collaborator 추가 (audit 발견)
    v_is_collaborator := public.is_posting_collaborator(NEW.id, v_caller_uid);

    IF NOT (v_is_workspace_owner OR v_is_admin OR v_is_collaborator) THEN
      RAISE EXCEPTION
        'permission denied: only workspace owner, admin, or collaborator can cancel job posting (id=%)',
        NEW.id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
