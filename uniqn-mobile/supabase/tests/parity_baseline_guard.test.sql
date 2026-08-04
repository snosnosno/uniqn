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
--   2026-07-26 알림 중복 트리거 정리(마이그 20260726000000, prod 적용 완료 — 재적용 금지):
--     함수 180 = 182 - fn_notify_review_created 1 - fn_notify_inquiry_created 1
--       (레거시 notify_on_* 와 동일 이벤트 이중 발동하던 QA기 fn_ 계열 제거 — 중복 알림 해소).
--     정책 111 불변(트리거/함수만 변경, RLS 미변경). (#327의 182와 머지 합집합 = 180)
--   2026-07-26 last_work_date 동기화(마이그 20260726120000, prod 적용 완료 — 재적용 금지):
--     함수 181 = 180 + fn_sync_last_work_date 1(work_dates 최대 날짜 → last_work_date).
--       이 컬럼에 값을 쓰는 코드가 없어 자동 마감 크론(expire-by-last-work-date)이
--       매일 0건을 닫고 있던 결함을 봉합 — 기존 28행 백필 동반.
--     정책 111 불변(트리거 신설만, RLS 미변경).
--   2026-07-27 공고 자동 마감 사각지대 정리(마이그 20260727000000):
--     함수 183 = 181 + fn_expire_pending_applications_on_close 1(자동 마감 시 미확정 지원 종결)
--       + fn_log_scheduled_close 1(마감 크론 처리 건수를 action_logs 에 기록 —
--         job_run_details.return_message 가 항상 "1 row" 라 0건 처리를 구분할 수 없었다).
--     정책 111 불변(트리거·함수만 변경, 테이블·RLS 미변경 — action_logs 재사용).
--   2026-07-31 지점 프로필 RPC 2종 신설(마이그 20260731120000, PR#370 머지·prod 적용 완료):
--     함수 185 = 183 + update_venue_container 1(지점 이름·장소·연락처 수정, SECDEF 쓰기)
--       + get_my_venue_contexts 1(배치된 스태프에게 지점 표시 정보 1행 반환 — 기존
--         get_my_venue_role_salaries 는 CROSS JOIN LATERAL 이라 단가표가 비면 0행이라
--         확장으로는 해결할 수 없었다).
--     정책 111 불변(RLS 미변경 — 컨테이너 쓰기는 종전대로 SECDEF RPC 가 유일 경로).
--   2026-07-31 알림 카운터 INSERT 가드(마이그 20260731130000, prod 적용 완료 — 재적용 금지):
--     함수 184 = 185 - fn_notification_insert_increment 1
--       (트리거 0개 고아 — archive/20260412192356 이 INSERT 트리거만 재등록하지 않아
--        "is_read 검사가 있던 버전"이 호출자 없이 남아 있던 것. 검사는 살아있는
--        increment_unread_counter 로 이관 후 제거).
--     정책 111 불변(함수 제거·재정의와 컬럼 NOT NULL 조이기만, RLS 미변경).
--     ↑ 이 마이그는 #370 보다 먼저 prod 에 적용됐고 PR 은 나중에 합류했다.
--       그래서 브랜치 시점엔 183-1=182 였고, #370 머지 후 185-1=184 로 재산정했다.
--       🔑 PR 보다 먼저 prod 적용하면 다른 레인의 기대값이 자동으로 어긋난다.
--   2026-08-02 정산 확정·일괄 RPC 화(L1 잔여, prod 적용 완료 — 재적용 금지):
--     함수 189 = 186 + fn_settlement_amount·settle_work_log·bulk_settle_work_logs 3
--     정책 111 불변(RPC 신설만, RLS 미변경).
--     🔴 prod 기록은 **4건**인데 레포 파일은 2개다. 뒤 2건은 같은 두 함수의 **재정의**라
--        별도 파일이 없다: `settlement_amount_calculator_comments`(20260802003419, 본문 주석 누락 복구) ·
--        `settlement_calc_json_null_and_notes_guard`(리뷰 지적 반영 — JSON null 3지점 + 메모 가드).
--        레포↔prod↔로컬은 md5(prosrc, CR 제거) 대조로 4/4 일치 확인했다. **함수 수는 불변**.
--   2026-08-02 신고 처리 결과 알림 + 신원 고정(prod 미적용 — 머지와 동기):
--     함수 191 = 189 + notify_on_report_review 1 (20260802170000)
--                    + fn_reports_pin_identity 1 (20260802170300)
--       (앱 FAQ 가 "처리 결과는 앱 내 알림으로 안내드립니다"라고 약속했는데 reports 에
--        UPDATE 알림 트리거가 없어 report_resolved 가 한 번도 발송된 적이 없었다.
--        그 트리거가 NEW.reporter_id 를 믿는데 rep_update 에 WITH CHECK 이 없어
--        관리자 raw PATCH 로 수신자를 바꿔치기할 수 있었다 — 신원 고정 트리거로 봉쇄).
--     정책 111 불변(트리거 신설만, 테이블·RLS 미변경).
--     같은 배치의 20260802170100(notify_on_job_posting_update 본문 라벨링)과
--     20260802170200(create_report 증빙 서버 검증)은 CREATE OR REPLACE 재정의라 개수 불변.
--     20260802150000(신고 증빙 Storage 버킷·정책)은 storage 스키마 소관이라
--     public 함수/정책 카운트에 영향이 없다.
--     ⚠️ 이 브랜치는 착수 시점 base(186)에서 188 로 잡았다가, 정산 레인(#402)이 먼저
--        머지되어 기준선이 189 가 된 뒤 191 로 재산정했다 — 위 2026-07-31 항목이 경고한
--        "PR 보다 먼저 prod 적용하면 다른 레인의 기대값이 어긋난다"가 그대로 재현된 사례다.
--   2026-08-03 시간 '미정' 표현 통일 R0(마이그 20260803120000, prod 미적용 — 머지와 동기):
--     함수 193 = 192 + _normalize_time_slot 1
--       (work_logs.time_slot 저장 정본화 헬퍼 — 센티널 4종→NULL·범위형→시작시각·0패딩.
--        confirm_application·add_direct_staff 두 INSERT 가 공유하므로 함수로 뽑았다.)
--     정책 111 불변(헬퍼 신설 + 기존 4함수 재정의만, 테이블·RLS 미변경).
--     같은 마이그의 _posting_slot_key·confirm_application·add_direct_staff·
--     notify_on_job_posting_update 는 전부 CREATE OR REPLACE 재정의라 개수 불변.
--
--   20260804120000_update_posting_slot_time_rpc (3-C 공고 시간 변경): 함수 193 → **199**.
--     신설 6종 = update_posting_slot_time(본체) + _posting_schedule_slot_key
--              + _posting_schedule_role_count + _posting_schedule_move_capacity
--              + _posting_role_capacity + _posting_role_count_key.
--     뒤 2종은 레거시 `headcount` 정원 키 대응 — count 로만 읽고 쓰면 총합이 깨져
--     total_positions 가 바뀌고 capacity_full 자동 전이까지 연쇄한다(실측 확인).
--     정책 111 불변(RPC·헬퍼 신설만, RLS 미변경).
--     로컬 스택 실측(2026-08-04): 함수 199 / 정책 111.
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
-- PARITY_EXPECT_FUNCS=199
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
  199,
  'public function count == prod (193 = 192 + _normalize_time_slot 1(시간 미정 통일 R0), 2026-08-03)');

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
