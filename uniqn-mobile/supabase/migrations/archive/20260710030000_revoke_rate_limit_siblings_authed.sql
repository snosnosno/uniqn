-- 2026-07-10 RLS/SECDEF 감사 후속 ③-B — rate_limit 3형제 권한 일관화
--
-- 20260710000400 이 check_user_rate_limit 의 authenticated EXECUTE 를 회수했으나
-- (lens-authed HIGH#6: p_user_id 무바인딩 victim-DoS), 같은 벡터를 가진 형제 2개는
-- 20260710000000 에서 anon 만 회수하고 authenticated 를 유지했다. 일관성을 맞춘다.
--
-- 대상 (prod 실측 2026-07-10, 적용 전):
--   check_rate_limit(text,int,int)     anon=false  authenticated=TRUE   service_role=true
--   check_ip_rate_limit(text,int,int)  anon=false  authenticated=TRUE   service_role=true
--   check_user_rate_limit(...)         anon=false  authenticated=false  service_role=true  ← 대조군
--
-- 위험(authenticated 잔존 시):
--   * 인자가 전부 클라 통제 → `max_requests = 2^31-1` 로 호출하면 항상 allowed:true (레이트리밋 우회).
--   * 임의 p_key / p_ip 로 rate_limits 무한 INSERT → 스토리지 DoS.
--   * SECDEF 라 호출자 신원 바인딩이 없다(p_key 는 그냥 문자열).
--
-- 회귀 위험 0 — dead code 실측:
--   * src/, app/, supabase/functions/ 전체에서 두 함수의 호출자 0건.
--   * 내부 SECDEF 함수가 호출하더라도 definer 권한으로 실행되므로 caller grant 와 무관.
--   * service_role 은 유지(향후 cron/edge 재도입 여지).
--
-- ⚠️ 이 두 함수는 저장소에 CREATE 가 없다(prod-only, 파리티 발산 항목).
--    따라서 로컬 `db reset` 에는 존재하지 않아 아래 DO 루프가 no-op 이고,
--    pgTAP 도 로컬에서 항상 vacuous skip 이다. **prod 라이브 실측이 유일한 증거**다.
--    근본 해소 = docs/planning/2026-07-10-prod-repo-schema-reconciliation-plan.md 의 baseline squash
--    (덤프에 두 함수 CREATE 가 편입되면 pgTAP 가 비로소 실효한다).
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('check_rate_limit', 'check_ip_rate_limit')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
    RAISE NOTICE 'rate_limit sibling → service_role only: %', rec.sig;
  END LOOP;
END $$;
