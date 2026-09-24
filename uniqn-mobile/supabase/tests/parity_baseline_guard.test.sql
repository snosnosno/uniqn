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
--   2026-08-07 개인 정산 설정 저장 RPC 화(마이그 20260807190000, 감사 S-D):
--     함수 201 = 200 + update_work_log_custom_settlement 1종.
--     클라이언트 read-modify-write 를 대체해 settlement_modification_history 의
--     Lost Update 를 닫는다. 정책 111 불변(RPC 신설만, RLS 미변경).
--   2026-08-07 ops 칩 카운트 수동 입력(마이그 20260807210000, 결함① — prod 선적용):
--     함수 202 = 201 + ops_set_participant_chips 1종(SECDEF, anon REVOKE).
--     정책 111 불변(RPC 신설만, RLS 미변경).
--     ⚠️ 두 레인이 각각 +1 했는데 숫자가 겹쳐 조용히 병합될 뻔했다 — 양쪽 브랜치가 모두
--        "201" 을 기대값으로 적어 텍스트 충돌이 문구 줄에서만 났다(리터럴은 자동 병합).
--        합집합은 202 다. 위 2026-07-31 항목의 경고와 같은 계열의 함정이다.
--     ✅ 2026-08-08 실측 정정: prod 는 **202** 다 — S-D(20260807190000)가 #437 워크플로우로
--        적용돼(기록명=파일명, prosrc md5 일치) 202/111 로 일치했다. 위 "prod 는 201" 서술은
--        그 시점의 관측이었고 지금은 해소됐다.
--   2026-08-08 ops 노쇼 표시/취소(마이그 20260808210000, 결함②):
--     함수 203 = 202 + ops_set_participant_no_show 1종(SECDEF, anon REVOKE).
--     `no_show` enum 값을 쓰는 함수가 0개였던 것을 닫는다(2026-08-08 pg_proc 실측).
--     정책 111 불변(RPC 신설만, RLS 미변경).
--   2026-08-08 ops 참가자 정정·오등록 제거·대회 아카이브(마이그 20260808230000, 결함③):
--     함수 206 = 203 + ops_update_participant · ops_delete_participant
--                    · ops_set_tournament_archived 3종(모두 SECDEF, anon REVOKE).
--     정책 111 불변(RPC 신설 + ops_tournaments.archived_at 컬럼 추가, RLS 미변경).
--     🔑 대회 hard DELETE 는 ops_events append-only 트리거와 충돌해 **물리적으로 불가능**하다
--        (2026-08-08 로컬 실증) — archived_at 이 "치우기"의 유일한 경로다.
--     🔴 prod 미적용 — 머지·prod 적용 시점까지 주간 parity-smoke(PR 게이트 아님)가
--        202 vs 206 불일치를 보고한다. 로컬/CI 는 마이그가 있으므로 206 이 정답이다.
--        (결함② 마이그 20260808210000 도 함께 미적용 — 순서: 200000→210000→220000→230000)
--     ✅ 2026-08-08 후속 실측: 위 4건이 prod-migrate 로 적용돼 prod = 206/111 로 일치했다.
--   2026-08-09 ops 수동 추가 스태프 배정 알림(마이그 20260809100000, 결함⑦-1):
--     함수 207 = 206 + notify_on_ops_staff_insert 1종(트리거 함수, SECDEF, PUBLIC/anon REVOKE).
--     정책 111 불변(트리거 신설만, RLS 미변경 — 알림 INSERT 는 postgres 소유 SECDEF 경유).
--     🔑 트리거 신설이지만 ops_staff 는 트리거 0개였던 테이블이다(graph-db-deps.mjs triggers
--        실측: 살아있는 트리거 89개, 중복 후보에 ops_* 없음) — 중복 발송 사고 계열이 아니다.
--     🔴 prod 미적용 — 적용 전까지 주간 parity-smoke 가 206 vs 207 불일치를 보고한다.
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
--   · 20260809110000_ops_resolve_staff_work_logs.sql — 함수 206 → **207**(해석기 1개 신설).
--     ops 결함 ⑦-2. 읽기 전용 STABLE SECDEF — 근태 쓰기는 기존 update_work_log_slot 단독이라
--     쓰기 함수는 늘지 않는다. 정책 111 불변(테이블·RLS 미변경).
--     ✅ prod 적용 완료(list_migrations 실측 2026-08-13).
--
--   · 20260809140000_rls_cost_hygiene_and_notification_retention.sql — 정책 111 → **110**.
--     감사 cost-01. baseline 덤프에 글자 그대로 중복 실려 있던 공개 SELECT 정책 2개 중
--     `jp_select_public_search` 를 제거했다(qual 동일·둘 다 TO public — 20260710000002:13592/:13636).
--     남긴 쪽은 `job_postings_select_all` — 전용 회귀 파일(job_postings_select_all_whitelist)이
--     붙어 있어 whitelist 축소 보호가 그대로 산다.
--     같은 마이그의 `ops_prizes_select`(cost-04 initplan 래핑)는 DROP+CREATE 재정의라 증감 0.
--     함수 208 불변 — 크론 2건(cost-02 alter_job / cost-03 신설)은 인라인 SQL 이라 함수를 안 만든다.
--     ✅ prod 적용 완료(master 측 기록, list_migrations 실측 2026-08-13).
--     이 시점의 마커 208/110 이 prod 실측과 일치해 parity-smoke 가 정상 통과였다.
--   · 2026-08-13~15 공고상세 3단계 + 재리뷰 — 함수 208 → **214**, 정책 110 → **112**.
--     함수 +6: fn_notify_posting_capacity_gap(20260813110000, S3-1) ·
--              get_applicant_no_show_counts(20260813120000, S3-3) ·
--              send_job_posting_announcement(20260813140000, S3-2) ·
--              is_posting_collaborator_any + fn_jpc_role_update_guard +
--              fn_jpc_role_change_audit(20260813150000, S3-4)
--     정책 +2: jpa_select_manager(S3-2) · jpc_update_role_owner(S3-4)
--     (S3-4 가 읽기 정책 5개를, 재리뷰의 20260813160000 이 ae_anon_insert 1개를
--      **같은 이름으로 DROP+CREATE** 하지만 둘 다 개수는 불변이다 — net 0)
--     🔴 **prod 미적용** — 마이그 **6종**이 prod 에 들어가기 전까지 주간 parity-smoke 가
--        214/112 vs 208/110 불일치를 보고한다. 위 20260809140000 사례와 같은 상태다.
--
-- ✅ 2026-09-18 — 아래 2026-09-12 항목이 남긴 "11개의 정체를 밝혀라"를 **전부 규명**했다.
--   결론: 정책 감소는 소실 사고가 아니라 9월 커뮤니케이션 게시판 폐지의 직접 증분이고,
--   함수 증가는 9월 QR/게시판 마이그 5건의 신설분이다. 아래 출처를 세어 기준선을
--   **함수 225 / 정책 102** 로 다시 세운다(prod 실측과 동일 — 2026-09-12 확인분).
--
--   원인은 갱신 누락 구간이다: 위 기준선 214/112 는 2026-08-15 판이고, 근무표
--   마이그(20260911053907)의 +2/+1 만 얹어 216/113 으로 적었다. 그 사이에 들어온
--   9월 마이그 **7건**(20260909135618 ~ 20260910153217)의 증분이 장부에 한 번도
--   반영되지 않았다. 그 7건이 차이의 전부다.
--
--   함수 +9 (216 → 225) — 각 마이그에서 **처음 등장**하는 이름만 셌다:
--     · 20260909135618 (QR 15분 올림 정규화) +4
--         protect_work_log_qr_scan_timestamps · normalize_work_log_attendance_quarter_hour
--         · recompute_work_log_duration · process_posting_qr_attendance
--       (get_venue_day_slots 는 DROP+CREATE 시그니처 교체라 증감 0)
--     · 20260910002240 (커뮤니케이션 게시판 하드닝) +2 순증
--         +1 enforce_board_comment_parent_integrity
--         +1 enqueue_schedule_board_sync_on_expiration
--         +1 sync_schedule_board — 구본체를 `ALTER FUNCTION ... RENAME TO
--            sync_schedule_board_legacy` 로 **남긴 채** 같은 이름으로 새로 만들었다
--            (rename 은 삭제가 아니므로 개수가 하나 늘어난다)
--         -1 toggle_board_post_vote (투표 폐지, DROP FUNCTION)
--         (toggle_comment_reaction 은 DROP+CREATE OR REPLACE 라 증감 0)
--     · 20260910123553 (QR 리뷰 반영) +1  enforce_work_log_checkout_after_checkin
--         (process_posting_qr_attendance 는 DROP+CREATE 시그니처 교체라 증감 0)
--     · 20260910123555 +1  enforce_board_comment_update_scope
--     · 20260910153217 +1  enforce_board_comment_pin_invariants
--     · 20260910104500 · 20260910110000 은 GRANT/REVOKE 전용이라 0.
--
--   정책 −11 (113 → 102) — 전부 20260910002240 한 건에서 나온다:
--     · 정책 DROP 10 / CREATE 3 = **−7**
--         DROP: bp_insert · bp_delete · bp_update · bm_insert · board_memberships_delete
--               · bc_insert · bc_update · reaction_insert · reaction_update · reaction_delete
--         CREATE: bp_update · bc_insert · bc_update
--       (free/tda/substitute 게시판·투표를 폐지하고 schedule 게시판만 남긴 결과)
--     · `DROP TABLE IF EXISTS public.board_votes` = **−4**
--       테이블과 함께 bv_select · bv_insert · bv_update · bv_delete 가 사라진다.
--       🔑 정책 감소를 CREATE/DROP POLICY 문장만 세서는 설명할 수 없었던 이유가 이것이다 —
--          **테이블을 지우면 그 위의 정책도 같이 사라진다.**
--     · 20260910123555 의 bc_update 는 DROP+CREATE 라 0.
--     · 20260910123553 이 만든 qr_attendance_selections 는 RLS 를 켜지만 정책을 하나도
--       만들지 않는다(deny-all — SECDEF RPC 전용 테이블)라서 0.
--
--   ⚠️ 2026-09-12 항목이 지목한 20260809140000(정책 111→110)은 **차이의 원인이 아니다**.
--      그 마이그는 이 장부에 이미 반영돼 있었다(위 해당 항목 참조).
--
--   2026-09-15 · 2026-09-18 마이그는 함수·정책 증감 0이다:
--     · 20260915122335(정산 알림 문구) — notify_on_work_log_update ·
--       bulk_settle_work_logs 의 CREATE OR REPLACE 재정의만
--     · 20260915133500(권한 하드닝 복원) — GRANT/REVOKE 전용
--     · 20260918105900(QR 퇴근 후보 하한) — process_posting_qr_attendance 재정의만
--     · 20260918110000(댓글 트리거 순서) — 트리거 재등록만(함수 미변경)
--
--   2026-09-23 핵심 퍼널 영속화 + 관리자 DAU(마이그 20260923100000):
--     함수 226 = 225 + get_admin_daily_active_users 1(SECDEF admin 게이트, anon REVOKE).
--     정책 102 불변(event CHECK 교체·인덱스 추가만, RLS 미변경).
--
-- 🔴 2026-09-12 실측 — 이 단언은 **근무표 PR 이전부터 이미 red** 다(선행 과제).
--   · CI 로컬(마이그 전량 적용): 함수 **225** / 정책 **102**
--   · prod(`list_migrations`·`pg_proc` 실측):   함수 **223** / 정책 **101**
--   · 둘의 차 (+2 함수 / +1 정책) = 근무표 마이그 20260911053907 의 증분
--     (`release_scheduled_assignment`·`enforce_work_log_payroll_owner` + 감사 조회 정책).
--     즉 이 마이그가 prod 에 적용되면 prod 도 225/102 가 된다.
--   · 아래 기대값의 기준선 214/112 는 **2026-08-15 판**이다. 9월 마이그 7건
--     (20260909135618 ~ 20260910153217: 커뮤니케이션 게시판 하드닝·QR 15분 정규화 등)이
--     들어오면서 갱신이 누락돼 master 의 DB Tests 가 09-10 부터 red 였다.
-- ⚠️ **기대값을 실측으로 낮추지 않는다.** 함수는 214 → 223 으로 늘었지만 정책은
--    112 → **101 로 11개 줄었다**. 9월 작업이 의도한 정책 통합인지 소실 사고인지
--    확인되지 않았고, 기대값을 102 로 맞추면 그 감소를 조용히 덮는다. 먼저 11개의
--    정체를 밝힌 뒤 기준선을 다시 세워야 한다.
--    → ✅ 2026-09-18 에 11개 전부의 출처를 규명해 위 항목에 적었다. 이제 기준선을
--       225/102 로 올린다(숫자를 덮는 것이 아니라 사유를 세어 올린 것).
--    (근무표 PR 이 새로 깨뜨린 것은 없다 — 실패 파일이 master baseline 5개와 일치함을
--     `comm -13` 으로 대조 확인했다.)
--
-- 기계용 마커 — .github/workflows/parity-smoke.yml 이 prod 대조 기대값으로 파싱한다.
-- ⚠️아래 단언 리터럴과 반드시 동시 갱신:
-- PARITY_EXPECT_FUNCS=226
-- PARITY_EXPECT_POLICIES=102
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
  226,
  'public function count (226 = 225 + get_admin_daily_active_users 1, 2026-09-23 — 출처는 상단 장부 참조)');

-- 3. public RLS 정책 카운트 == prod 실측
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'),
  102,
  'public RLS policy count (102 = 113 − 게시판 폐지 정책 순감 7 − board_votes 테이블 폐기 4, 2026-09-18)');

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
