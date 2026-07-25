-- ============================================================
-- prod↔repo 파리티 회귀 가드 (baseline squash 2026-07-11)
--
-- 목적: 로컬 재빌드(db reset) 형상이 prod 실측 카운트와 일치하는지 단언해
--   "레포만 아는 오브젝트"(gen-1 정책 부활 등) 재발산을 조기 검출한다.
--   기준값은 prod(ygfxukhktpqymahfrvbz) 라이브 실측(2026-07-13 갱신):
--     public 함수 163 = baseline 163 - 1(20260711100000 오버로드 제거) + 1(#242 userflow-audit)
--     RLS 정책 104 = baseline 103 + 1(20260713010000 brep_update 신설) · pg_temp 누락 0 · PG 17
--   2026-07-17 ops S1 갱신(마이그 20260717090000~090600, prod 미적용 — 머지·prod 적용과 동기):
--     함수 168 = 163 + RPC 3(ops_set_monitor_config/ops_duplicate_tournament/ops_set_prize_paid)
--       + 가드 트리거 fn 2(fn_ops_public_reports_guard/fn_analytics_events_guard)
--     정책 110 = 104 + ops_public_reports 3(opr_*) + analytics_events 3(ae_*)
--   2026-07-18 좌석 기준 통일(마이그 20260718000000·000100·000200, prod 적용 완료):
--     함수 173 = 168 + enforce_tournament_approval_authority 1(20260717093000 grid 하드닝, 168 산정 누락분)
--       + 좌석 fn 3(_total_positions_from_schedule/fn_recalc_total_and_capacity/fn_sync_filled_positions_seat)
--       + 보안 하드닝 fn 1(fn_work_logs_pin_posting_id, 20260718000100 리뷰 P1)
--     정책 110 불변(좌석 마이그는 RLS 미변경).
--   2026-07-19 멤버 초대 닉네임 검색(마이그 20260720002917, prod 적용 완료):
--     함수 174 = 173 + search_workspace_invite_candidates_by_nickname 1
--       (팀 멤버 초대 후보 검색 — lookupUserByEmail 이메일 정확일치 대체.
--        후보가 employer/admin 한정이라 기존 search_users_by_nickname 재사용 불가)
--     정책 110 불변(RPC 신설만, RLS 미변경).
--   2026-07-24 ops 블라인드 프리셋(마이그 20260724000000, prod 적용 완료 — 재적용 금지):
--     함수 174 불변(ops_blind_presets 는 테이블+RLS 만, 함수 미추가).
--     정책 111 = 110 + ops_blind_presets_owner_all 1(소유자 전용 FORCE RLS 정책 1종).
--   2026-07-24 ops 블라인드 프리셋 save/delete RPC(마이그 20260724000100, prod 적용 완료 — 재적용 금지):
--     함수 176 = 174 + ops_save_blind_preset 1 + ops_delete_blind_preset 1(SECDEF, anon REVOKE).
--     정책 111 불변(RPC 신설만, RLS 미변경).
--   ↑ 두 마이그 모두 2026-07-24 prod(ygfxukhktpqymahfrvbz) 실측 확인: 정책 111·함수 176.
--   2026-07-24 지점 역할별 급여 JIT(마이그 20260723100000, PR#311 머지·prod 적용 완료 — 재적용 금지):
--     함수 177 = 176 + set_venue_role_salary 1(SECDEF 단가표 upsert RPC).
--     정책 111 불변(RPC 신설만, RLS 미변경).
--     (#311이 이 가드 갱신을 누락해 master DB Tests red — 본 PR에서 소급 갱신)
--   2026-07-24 staff 지점 단가 조회 RPC(마이그 20260724130000, #6 JIT 급여 후속):
--     함수 178 = 177 + get_my_venue_role_salaries 1(SECDEF 최소노출 조회 — 본인 work_log 컨테이너 한정).
--     정책 111 불변(RPC 신설만, RLS 미변경).
--   2026-07-25 지원 본인인증 게이트(마이그 20260725020000, app_insert RLS 강화):
--     함수 179 = 178 + is_identity_verified 1(SECDEF, users RLS 우회 헬퍼 — with_check 게이트용).
--     정책 111 불변(app_insert 는 DROP/CREATE 재정의라 개수 불변, apply_with_capacity_check 도 재정의).
--   2026-07-25 관리자 문의 응답 RPC(마이그 20260725150000, Sentry UNIQN-MOBILE-1N, prod 적용 완료 — 재적용 금지):
--     함수 181 = 179 + respond_inquiry 1 + update_inquiry_status 1
--       (Supabase 전환 때 클라이언트만 출하되고 함수 마이그가 누락됐던 관리자 문의 응답 경로 복구).
--     정책 111 불변(RPC 신설만, RLS 미변경).
--     ↑ #325(본인인증 게이트)와 본 PR 이 각각 prod 선적용 후 합류 — 2026-07-25 prod 실측 181 확인.
--   2026-07-25 identity_verified 컬럼 가드(마이그 20260725200000, 셀프 승격 차단):
--     함수 182 = 181 + prevent_identity_flag_self_update 1(SECDEF 트리거 fn — users_update
--       RLS 셀프 UPDATE로 identity_verified 직접 쓰기가 가능하던 게이트 우회 봉합).
--     정책 111 불변(트리거 신설만, RLS 미변경). 같은 배치의 20260725180000·190000은
--     기존 함수 CREATE OR REPLACE라 개수 불변. (#326의 181과 머지 합집합 = 182)
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
-- PARITY_EXPECT_FUNCS=182
-- PARITY_EXPECT_POLICIES=111
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
  182,
  'public function count == prod (182 = 179 + 문의 응답 RPC 2 + prevent_identity_flag_self_update 1, 2026-07-25)');

-- 3. public RLS 정책 카운트 == prod 실측
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'),
  111,
  'public RLS policy count == prod (111 = 110 + ops_blind_presets_owner_all 1, 2026-07-24)');

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
