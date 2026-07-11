-- 2026-07-10 RLS/SECDEF 감사 후속 ③ — 권한 확대 부작용 되돌리기 + 재빌드 보안퇴행 차단
--
-- ─────────────────────────────────────────────────────────────────────────────
-- (A) sync_schedule_board(uuid): authenticated EXECUTE 회수 → 원래 계약(service_role only) 복원
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 근본원인: 20260621090000_harden_anon_rpc_revoke_and_delete_guard.sql 의 일괄 DO 루프가
--   REVOKE EXECUTE ... FROM PUBLIC, anon
--   GRANT  EXECUTE ... TO authenticated, service_role   ← 32개 함수에 무차별 재부여
-- 를 수행하면서, 원래 authenticated 권한이 **없던** sync_schedule_board 에 권한을 새로 부여했다.
-- (해당 마이그의 의도는 "authenticated 권한은 유지"였으나, 유지가 아니라 신규 부여가 된 케이스.)
--
-- 원 설계는 명시적으로 service_role 전용이다 — 20260414120400_add_sync_schedule_board_rpc.sql:285
--   GRANT EXECUTE ON FUNCTION public.sync_schedule_board(uuid) TO service_role;
--   -- authenticated에는 권한 부여하지 않음. outbox processor (service_role)만 호출.
--
-- 호출자 실측(2026-07-10):
--   * 앱 소스(src/, app/) 전체에 sync_schedule_board RPC 직접 호출 0건.
--     클라이언트는 schedule_board_sync_outbox 테이블에 INSERT(enqueue)만 한다.
--   * 유일 호출자 = Edge Function `sync-schedule-board-outbox`
--     - supabase/functions/sync-schedule-board-outbox/index.ts:185 createClient(URL, SERVICE_ROLE_KEY)
--     - 같은 파일 :175 게이트웨이도 `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` 를 요구
--     - pg_cron 이 service_role JWT 로 1분마다 트리거 (config.toml:117)
--
-- 그래서 authenticated 회수는 sync 흐름에 회귀를 만들지 않는다. 감사 보고서(§2-c)가 제안한
-- "함수 본문에 posting 소유권 가드 추가"는 채택하지 않는다 — 호출 표면 자체를 닫는 편이
--   (1) 함수 본문을 건드리지 않아 prod↔repo 본문 파리티 드리프트를 늘리지 않고,
--   (2) service_role(auth.uid() = NULL) 예외 분기를 넣을 필요가 없어 sync 회귀 위험이 0이며,
--   (3) authenticated 호출자가 애초에 0명이라 실효 방어력이 동일하다.
--
-- 이름 기반 REVOKE(oid::regprocedure)로 모든 오버로드를 정확한 시그니처로 처리한다.
-- 함수 부재 시 루프가 자연 no-op 이므로 멱등. EXCEPTION 으로 실패를 삼키지 않는다.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sync_schedule_board'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L', rec.sig,
      'Schedule board sync (board_posts + board_memberships)를 단일 트랜잭션으로 처리. '
      'outbox processor(service_role)만 호출 — authenticated EXECUTE 없음(20260710020000에서 회수). '
      '재부여 금지: 클라이언트는 schedule_board_sync_outbox 에 enqueue 만 한다.');
    RAISE NOTICE 'sync_schedule_board → service_role only: %', rec.sig;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (B) board_comments.board_comments_select_all 블랭킷 정책 제거
-- ─────────────────────────────────────────────────────────────────────────────
--
-- base_schema(20260409000000:842)가 `USING (true)` 로 만든 gen-1 정책. prod 는 수동 DROP 되어
-- 이미 부재이지만(2026-07-10 라이브 실측: bc_select/bc_insert/bc_update/bc_delete 4개뿐),
-- 저장소 어디에도 DROP 이 없어 `supabase db reset` 재빌드가 이 블랭킷을 되살린다.
--
-- PERMISSIVE 정책은 OR 로 합산되므로 `true OR (visibility 조건)` = true 가 되어,
-- 20260710000300 이 넣은 bc_select 하드닝(비공개 글 댓글 잠복누수 차단)이 로컬에서 완전히
-- 무효화된다. 게다가 pgTAP tier3 테스트는 bc_select 의 모양만 검사하므로 이 누수를 놓친다
-- (거짓 GREEN). → prod 에서는 no-op, 로컬/CI 에서만 실효.
--
-- 같은 계열의 재빌드 보안퇴행: action_logs_insert_any, notifications_insert_service.
-- 근본 해소는 prod 덤프 baseline squash(docs/planning/2026-07-10-prod-repo-schema-reconciliation-plan.md).
DO $$
BEGIN
  IF to_regclass('public.board_comments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "board_comments_select_all" ON public.board_comments;
    RAISE NOTICE 'board_comments_select_all 블랭킷 정책 제거(부재 시 no-op)';
  END IF;
END $$;
