-- ============================================================
-- prod↔repo 파리티 회귀 가드 (baseline squash 2026-07-11)
--
-- 목적: 로컬 재빌드(db reset) 형상이 prod 실측 카운트와 일치하는지 단언해
--   "레포만 아는 오브젝트"(gen-1 정책 부활 등) 재발산을 조기 검출한다.
--   기준값은 prod(ygfxukhktpqymahfrvbz) 라이브 실측(2026-07-13 갱신):
--     public 함수 163 = baseline 163 - 1(20260711100000 오버로드 제거) + 1(#242 userflow-audit)
--     RLS 정책 103 · pg_temp 누락 SECDEF 0(20260711100000 이 62개 일괄 보정) · PG 17
--
-- ⚠️ 유지보수 계약: 이후 마이그레이션이 public 함수/정책을 추가·삭제하면
--   이 기대값을 같은 PR에서 함께 갱신해야 한다. 갱신을 강제당하는 것 자체가
--   이 가드의 존재 이유다(무단 드리프트는 여기서 fail).
--
-- 카운트 제외 대상:
--   - 확장 소속 함수(pg_depend deptype='e', 예: supabase test db 의 pgtap)
--   - 테스트 fixture 헬퍼(jpc_* / ops_test_* — supabase/fixtures/*.sql 이 주입, 스키마 밖 산물)
-- 안전: BEGIN/ROLLBACK, 읽기 전용.
--
-- 기계용 마커 — .github/workflows/parity-smoke.yml 이 prod 대조 기대값으로 파싱한다.
-- ⚠️아래 단언 리터럴과 반드시 동시 갱신:
-- PARITY_EXPECT_FUNCS=163
-- PARITY_EXPECT_POLICIES=103
-- ============================================================
BEGIN;
SELECT plan(7);

-- 1. PG 메이저 17 이상 (prod 17.6 정합 — config.toml major_version=17)
SELECT cmp_ok(
  current_setting('server_version_num')::int, '>=', 170000,
  'local PG major is 17+ (prod parity)');

-- 2. public 함수 카운트 == prod 실측
SELECT is(
  (SELECT count(*)::int
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d
                     WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
     AND p.proname NOT LIKE 'jpc\_%'
     AND p.proname NOT LIKE 'ops\_test\_%'),
  163,
  'public function count == prod (163 = baseline 162 + 1 from #242 userflow-audit, 2026-07-13)');

-- 3. public RLS 정책 카운트 == prod 실측
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'),
  103,
  'public RLS policy count == prod (103 measured 2026-07-11)');

-- 4~6. gen-1 재빌드 보안퇴행 3종 부재 (prod=deny, 레포 전용 부활 금지)
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'action_logs_insert_any'),
  0, 'gen-1 action_logs_insert_any (WITH CHECK true 감사로그 위조) 부활 없음');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'notifications_insert_service'),
  0, 'gen-1 notifications_insert_service (수신자 무바인딩 알림 위조) 부활 없음');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'board_comments_select_all'),
  0, 'gen-1 board_comments_select_all (USING true 블랭킷) 부활 없음');

-- 7. SECURITY DEFINER search_path pg_temp 누락 0 (20260711100000 일괄 보정 회귀 가드)
SELECT is(
  (SELECT count(*)::int
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND p.proname NOT LIKE 'jpc\_%'
     AND p.proname NOT LIKE 'ops\_test\_%'
     AND EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
                 WHERE c LIKE 'search_path=%' AND c NOT ILIKE '%pg_temp%')),
  0,
  'SECDEF search_path pg_temp 누락 함수 0 (temp-table shadowing 방어)');

SELECT * FROM finish();
ROLLBACK;
