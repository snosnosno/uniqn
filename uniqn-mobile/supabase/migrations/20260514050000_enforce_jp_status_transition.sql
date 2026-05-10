-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2A.후속 — job_postings status 전이 trigger (RLS gap 보강)
--
-- Why
--   기존 RLS jp_update_workspace_member 는 (workspace member|admin) 에게 일반
--   UPDATE 권한을 부여한다. 하지만 client 측 deletePosting 은 soft-delete 형태로
--   UPDATE status='cancelled' 을 사용하므로, member (editor) 가 PostgREST API 를
--   직접 호출하면 jp_delete_workspace_owner (owner|admin) 가 아닌
--   jp_update_workspace_member (member|admin) 가 평가되어 권한 우회가 가능하다.
--   client 측 loadAndVerifyDeleteAccess (JobPostingRepository.ts:186) 는 즉시
--   UX 차단만 제공할 뿐 API 직접 호출 갭은 차단하지 못한다.
--
-- What
--   active|closed → cancelled 전이를 BEFORE UPDATE trigger 에서 가로채어
--   (1) workspace 소유자 또는 (2) admin 만 통과시킨다. 그 외 transition
--   (active↔closed, draft→cancelled 등) 은 기존 RLS 정책에 위임한다.
--
--   service-side (no JWT — cron, SECURITY DEFINER RPC, 시드/마이그레이션) 는
--   bypass 한다 (auth.uid() IS NULL 분기). 기존 fn_fixed_posting_expired
--   (active → closed) 은 cancelled 가 아니므로 영향 없음.
--
-- Verification (production DB, dry-run with rollback, 2026-05-10)
--   10 시나리오 통과:
--   S1  member active→cancelled                      → BLOCKED 42501  ✅
--   S2  workspace-owner active→cancelled             → ALLOWED        ✅
--   S3  admin (own workspace) active→cancelled       → ALLOWED        ✅
--   S4  member active→closed (regression)            → ALLOWED        ✅
--   S5  member closed→cancelled                      → BLOCKED 42501  ✅
--   S6  member draft→cancelled (not guarded)         → ALLOWED        ✅
--   S7a member bulk→cancelled                        → BLOCKED 42501  ✅
--   S7b bulk rollback integrity (cancelled count=0)  → 0 rows         ✅
--   S8  workspace-owner cancelled→active (reverse)   → ALLOWED        ✅
--   S10 service-side (no JWT) active→cancelled       → ALLOWED        ✅
--
-- Out of scope (별도 PR)
--   • RLS jp_update_workspace_member 의 (SELECT is_admin()) 서브쿼리 평가가
--     PostgREST UPDATE 경로에서 admin (non-workspace-owner) 를 차단하는 quirk.
--     이 trigger 와 무관하며, 기존 admin-not-workspace-member 사용 사례가 적어
--     운영 영향 미미. /cso 후속 감사 권장.
--   • bulkUpdateStatus owner-only 전환 결정 (프롬프트 3): 보수적 가정으로
--     active|closed→cancelled bulk 도 본 trigger 가 row-by-row 차단.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_jp_status_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $func$
DECLARE
  v_caller_uid uuid;
  v_is_workspace_owner boolean;
  v_is_admin boolean;
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

    -- 메모리 룰: app role 식별은 auth.jwt() -> 'app_metadata' ->> 'role' 사용
    -- ('role' top-level 은 PostgREST 의 db role 이라 절대 사용 금지)
    v_is_admin := coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      false
    );

    IF NOT (v_is_workspace_owner OR v_is_admin) THEN
      RAISE EXCEPTION
        'permission denied: only workspace owner or admin can cancel job posting (id=%)',
        NEW.id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION public.enforce_jp_status_transition() IS
  'BEFORE UPDATE trigger 로 active|closed → cancelled 전이를 workspace owner|admin 만 통과시킨다. RLS jp_update_workspace_member 의 soft-delete 우회 갭을 DB-level 에서 차단. service-side (no JWT) bypass.';

DROP TRIGGER IF EXISTS trg_enforce_jp_status_transition ON public.job_postings;

CREATE TRIGGER trg_enforce_jp_status_transition
  BEFORE UPDATE OF status ON public.job_postings
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.enforce_jp_status_transition();

-- 실행 권한: SECURITY DEFINER 라 호출 권한만 필요
REVOKE ALL ON FUNCTION public.enforce_jp_status_transition() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_jp_status_transition() TO authenticated, service_role;
