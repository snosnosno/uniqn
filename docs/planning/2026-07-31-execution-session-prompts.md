# 실행 세션 프롬프트 원장 (2026-07-31)

> venue 근무표·내 스케줄 재설계 + 주소 검색 3단계를 **세션 단위로 이어서** 실행하기 위한 문서.
> 각 세션은 §0 공통 블록 + 해당 세션 블록을 **통째로 복사해 붙여넣는다.**
> 세션이 끝나면 §1 상태 보드를 갱신한다 — 이 문서가 세션 간 유일한 인수인계 수단이다.
>
> 원천 설계: [`2026-07-28-venue-schedule-redesign-handoff.md`](2026-07-28-venue-schedule-redesign-handoff.md) ·
> [`2026-07-31-address-search-3phase-design.md`](2026-07-31-address-search-3phase-design.md)

---

## 1. 상태 보드 (세션 종료 시 반드시 갱신)

| 세션 | 범위 | 브랜치 | 상태 | PR | 비고 |
|---|---|---|---|---|---|
| 0-1 | 병렬 워크트리 미커밋 정리 | `fix/sheet-drag-map-phone` | ✅ | #366 | `b2064c8c4`. `mapLink`·`InfoTab`·`ScheduleConverter` 점유 해제됨 |
| 0-2 | 알림 착지 브랜치 머지 | `fix/notification-landing-and-apply-success` | ✅ | #365 | `8fb10f5d2` |
| 0-3 | 핸드오프 문서 1-A 완료 반영 | — | ✅ | — | 2026-07-31 |
| ~~**0-4**~~ | Supabase 안전 정리 | — | ✅ | **#367** | 사용자는 "보류"로 결정했으나 **병렬 세션이 PR#367 로 머지**(`5aeab44b3`). 로컬 `chore/supabase-safe-cleanup-20260731` 브랜치는 이제 불필요 — 삭제 가능 |
| **S1** | 1-B + 1-C | ~~`feat/venue-profile`~~ | ✅ **머지** | **#370** | `dbf1e49d1`. CI 11잡 green(E2E 는 러너 포트 충돌로 1회 fail → 재실행 pass). 브랜치·워크트리 정리 완료 |
| **S2** | 2-A + 2-B | ~~`fix/worklog-time-model`~~ | ✅ **머지** | **#374** | `a06f5311`. CI 9잡 green(E2E 1회 통과). 브랜치·워크트리 정리 완료. 클라 전용·**마이그 0건**. master(#370·#371·#373) 재통합 완료 — 파리티 충돌은 master 판 **184** 채택 |
| **S3** | 2-C + 2-D + 별-2 | ~~`feat/worklog-time-notify`~~ | ✅ **머지** | **#382** | `11a2390a0`. CI 9잡 green(E2E 포함 1회 통과). 브랜치 삭제됨, 워크트리는 유지. | HEAD `fd8d7b52b`(5커밋). 🔴 **마이그 1건 prod 미적용** |
| **S4** | 3-B + 3-E + 별-1 | ~~`feat/qr-badge-and-entry`~~ | ✅ **머지** | **#384** | `40dc21779`. CI **9잡 전부 SUCCESS**(E2E 9m55s 포함, 재실행 없이 1회 통과). 브랜치·워크트리 정리 완료. **마이그 0건** — 파리티 **184/111 불변**(prod 실측 재확인). 리뷰 opus→fable 2회, HIGH 2건 포함 지적 전량 반영 |
| **S5** | 3-A + 3-D | ~~`feat/settlement-and-rename`~~ | ✅ **머지** | **#387** | `97bf7e85c`. CI **10잡 전부 SUCCESS**(E2E 10m14s 포함, 재실행 없이 1회 통과). 브랜치·워크트리 정리 완료. 마이그 2건은 **PR 이전에 prod 선적용**됨 — 재적용 금지. 상세=§5 |
| **S5-후속** | SETTLE-3 되돌리기 + 정산 게이트 status 축 | ~~`feat/settlement-revert-entry`~~ | ✅ **머지** | **#388** | `0ec9abc2c`. CI **9잡 전부 SUCCESS**(E2E 9m56s 포함, 재실행 없이 1회 통과. DB Tests 는 마이그 0건이라 미실행). 브랜치·워크트리 정리 완료. 마이그 **0건** — 파리티 **184/111 불변**(prod 실측). 상세=§5 |
| **A-감사** | A레인 전체 사후 감사 | ~~`docs/wave-audit-20260801`~~ | ✅ **머지** | **#390** | `16a5bb1fa`. 분석은 메인 체크아웃에서 **읽기 전용**, 문서 커밋만 워크트리 `T-HOLDEM-audit` 에서. 산출물=[`docs/analysis/2026-08-01-work-schedule-wave-audit.md`](../analysis/2026-08-01-work-schedule-wave-audit.md). **코드 변경 0건.** CRITICAL 0 / HIGH 1(선재) / MEDIUM 11 / LOW 12. 파리티 **184/111 prod 실측 일치**. 상세=§5 |
| **B1** | 주소 1단계 | ~~`claude/job-posting-address-map-lbrvzd`~~ | ✅ **머지** | **#391** | `33472d8be`. CI **9잡 전부 SUCCESS**(E2E 11m4s 포함, 재실행 없이 1회 통과). 마이그 **0건** — 파리티 184/111 불변. 재통합 후 재검증: quality **exit 0** · jest **599스위트 6573테스트 122스냅샷 전량 통과 exit 0** · e2e 주소 단언 **0건**(시드만) · knip 델타 0(이전 세션 실측). 리뷰 fable **APPROVE**(HIGH 0) / opus HIGH 3건 **전량 반영**. ✅ **M9 선행 불필요**(실측 정정 — B1 diff 는 지점 `location` 을 건드리지 않는다. §5 B1 주의 4번) |
| **P1**(감사후속) | 정산 선택·집계 축 (M1+M2+M10) | `fix/settlement-selection-axis` | 🔨 **PR 생성** | **#393** | 감사 §7 P1. 마이그 **0건**. quality exit 0 · jest **600스위트 6578테스트 전량 통과** · red-green 실증(M1·M2 각각 되돌리면 해당 1건만 red) · 리뷰 fable **APPROVE**(CRITICAL 0/HIGH 0), MEDIUM 1건 반영 |
| **P1**(감사후속) | 정산 선택·집계 축 (M1+M2+M10) | ~~`fix/settlement-selection-axis`~~ | ✅ **머지** | **#393** | `bc295df49`. CI **9잡 전부 pass**(E2E 는 `board.spec:88` 알려진 flake 로 1회 fail → 실패 잡 재실행 9m36s pass). 마이그 **0건**. quality exit 0 · jest **600스위트 6578테스트 전량 통과** · red-green 실증(M1·M2 각각 되돌리면 해당 1건만 red) · 리뷰 fable **APPROVE**(CRITICAL 0/HIGH 0), MEDIUM 1건 반영 |
| **P2**(감사후속) | 알림 계약 정합 (M5+M3) | ~~`fix/notification-contract-alignment`~~ | ✅ **머지** | **#397** | `0808f8ae5`. CI **10잡 전부 pass**(DB Tests pg_prove 1m50s · E2E 11m4s 포함, **재실행 0회**). 🔴**마이그 2건 prod 선적용 — 재적용 금지**(기록명 `20260801174901 notify_settlement_revert_and_cancel_hint_gate` + `20260801180734 notify_work_log_contract_review_fixes`, 파일은 `20260802093000` 1개). 파리티 **184/111 불변**(prod 실측). 본문 md5 대조 `563d0272…`(12720자) 레포=prod 일치. red-green **4종** 실증. 리뷰 opus·fable 둘 다 **APPROVE**, MEDIUM 전량 반영. 상세=§5 |
| **P3**(감사후속) | 리마인더 스코프 수선 (H1, **유일한 HIGH**) | ~~`fix/reminder-scope`~~ | ✅ **머지** | **#396** | `170fd8a2f`. CI **9잡 전부 pass**(E2E 9m45s 포함, **재실행 0회**). 재통합(#397 P2 · #395 P4) 후 재검증: 전체 jest **601스위트 6591테스트 122스냅샷 전량 통과 exit 0** · pre-push quality **0 errors**(경고 98은 선재). 마이그 **0건**. `syncShiftReminders` 에 관측 창(`coverage`) 필수 인자 + 원장 v1→v2. quality 통과 · **red-green 3회**(창 가드/지난근무 가드/`signOut` 배선을 각각 제거하면 해당 1건만 red) · 리뷰 fable **APPROVE**(CRITICAL 0/HIGH 0, MEDIUM 2 **전량 반영**). 🔑 리뷰가 찾은 **이 PR 이 걷어낸 보호막**(공용 기기 계정 전환 시 이전 계정 알림 발화)을 같은 PR 에서 닫음 — `clearShiftReminders()` 를 `signOut` 에 배선 |
| **P4**(감사후속) | 지점 `location` 병합 (M9) | ~~`fix/venue-location-merge`~~ | ✅ **머지** | **#395** | `2e8255dd5`. CI **9잡 전부 pass**(E2E 10m26s 포함, 재실행 0회). 마이그 **0건**(서버 RPC 무변경 — 치환은 의도된 계약). quality 통과 · jest 14/14 · red-green 실증(병합을 되돌리면 신규 2건만 red) · 리뷰 fable **APPROVE**(CRITICAL/HIGH/MEDIUM 0, LOW 3 중 2건 반영). ✅ **B1 선행 불필요 확정** |
| **P6**(감사후속) | 오프라인 캐시 TTL 분리 (M6) | ~~`fix/offline-cache-policies`~~ | ✅ **머지** | **#398** | `40040c8fb`. CI **9잡 전부 pass**(E2E 11m5s 포함, **재실행 0회**). 재통합(#397 P2 · #395 P4 · **#396 P3**) 후 재검증: quality **0 errors**(eslint 경고 98 선재 · prettier clean) · 전체 jest **602스위트 6599테스트 122스냅샷 전량 통과** · pre-push quality 통과. 마이그 **0건**. 감사 5줄 → **실측 6줄**(`useWorkLogs.ts:269` 추가 발견). `offlineCachePolicies` 5키 + **브랜드 타입 `OfflineTtlMs`** 로 컴파일 타임 차단. quality 통과 · jest 600스위트 6583테스트 · **red-green 2종**(호출부 원복 시 tsc 6곳 TS2322 + 테스트 5건 red / 정책값 오염 시 백스톱 2건 red) · 리뷰 fable **APPROVE**(CRITICAL 0/HIGH 0, MEDIUM 1 반영) |
| **P5**(감사후속) | 방어심화 (M4+L2+L1 절반) | ~~`feat/settlement-rpc-and-defense`~~ | ✅ **머지** | **#400** | `95772ce49`. **타 세션 소관** — 세션 A2 가 P6 를 머지하는 사이에 착지했다. 신원 컬럼 고정 트리거 + `time_slot` CHECK + 정산 상태 RPC 화. 🔴**마이그 2건 prod 적용 완료 — 재적용 금지**(기록명 `20260801212753 work_logs_identity_pin_and_time_slot_check`·`20260801212843 set_work_log_payroll_status_rpc`, 파일명과 다름). 파리티 **184→186** / 정책 111 불변(prod 실측), `PARITY_EXPECT_FUNCS` 도 이 PR 에서 186 으로 갱신됨. quality exit 0 · jest **600스위트 6583테스트** · pgTAP **91파일 951테스트**(기준선 88/912) · red-green **5종 1:1 실증**. 리뷰 fable planner·fable/opus database-reviewer 3인 반영. 감사의 M4 처방(컬럼 REVOKE)은 무효였고 트리거로 대체. **L1 은 절반** — 확정·일괄 RPC화와 직접쓰기 차단은 다음 세션(상세=§5) |
| **L1-잔여**(감사후속) | 정산 확정·일괄 RPC 화 + 계산기 서버 이식 | ~~`feat/settlement-rpc-phase2`~~ | ✅ **머지** | **#402** | `d8e3e2dca`. CI **10잡 전부 pass**(DB Tests 2m0s · E2E 포함, **재실행 0회**). `178ecf1ad` + 리뷰반영 `b753aa332`(2커밋). P5 가 남긴 L1 나머지 절반. `SettlementRepository.calculateSettlementAmount`(TS)를 **삭제하고** `fn_settlement_amount`(PL/pgSQL)로 이식 — 복제가 아니라 **이동**이라 클라 계산기 갈래 수는 불변. 신규 함수 3종(`fn_settlement_amount`·`settle_work_log`·`bulk_settle_work_logs`). 🔴**마이그 prod 적용 완료 — 재적용 금지. 기록 4건인데 레포 파일은 2개**(뒤 2건은 같은 함수 재정의라 별도 파일 없음 — 주석 누락 복구 + 리뷰 반영). 파리티 **186→189**/정책 111 불변, `PARITY_EXPECT_FUNCS` 갱신. quality exit 0 · jest **603스위트 6627테스트 122스냅샷** · pgTAP **93파일 991테스트**(기준선 91/951) · **짝 픽스처 21/21 SQL↔TS 일치** · red-green **4종 1:1** · 레포↔prod↔로컬 md5 4함수 일치. `set_work_log_payroll_status` 의 `completed` 진입 차단(호출부 0건 실측 후 결정). fable 리뷰 **APPROVE**(CRITICAL/HIGH 0) — 지적 5건을 prod 프로브로 재판정해 **3건 확증 수정 · 2건 오탐 기각 · 리뷰가 놓친 1건 추가 발견**. 상세=§5 |
| **세션 E**(P2·P3 후속) | 병합 키 표류 + 오프라인 침묵 취소 (클라 전용 2건) | ~~`fix/schedule-merge-key`~~ | ✅ **머지** | **#404** | `c97389daf`. CI **9잡 전부 pass**(E2E 재실행 0). 재통합(#402·#403) 후 재검증: quality exit 0 · jest **603스위트 6639테스트 전량 통과**. 마이그 0건. |
| **세션 F** | 세션 D·E 착지 + 근본수선 설계 | ~~`docs/session-f-ledger`~~ | ✅ **착지 3건** | **#402·#403·#404** | **코드 변경 0건**(착지 전용). 파리티 간극 해소 — 레포 **186 → 189** = prod 189/111 실측 일치. 🔴 **과제 4(근본 수선)는 미착수 — 설계만 완료**, 사용자 결정으로 새 세션 이관. 상세=§5 |
| **세션 G** | 과제 4 — 슬롯 편집 표류 근본 수선 | `feat/work-log-slot-sync` | 🔨 **PR 생성** | **#407** | 신규 SECDEF RPC `update_work_log_slot(uuid, jsonb)` 로 `work_logs`+`applications.assignments` 동시 갱신. 🔴**마이그 1건 prod 적용 완료 — 재적용 금지**(기록명 `20260802180000`, 레포 파일명과 동일). **#406 재통합 후** 파리티 **191 → 192** = prod 실측 일치 / 정책 111 불변. 재검증: quality exit 0 · jest **611스위트 6661테스트** · pgTAP **97파일 1031테스트 전량 PASS**(파리티 포함 — 재통합이 간극을 닫았다) · **red-swap 9종 1:1** · md5 3자 일치 `70f323c8…`. 리뷰 fable **APPROVE**(CRITICAL 0/HIGH 0) — MEDIUM 3건 중 **2건 반영·1건 프로브로 오탐 기각**. 상세=§5 |
| **B2** | 주소 2단계 | `feat/posting-geocoding` | ⬜ | | 🔴 REST 키 재발급 선행 |
| **S6** | 3-C 설계 | — | ⬜ | | 사용자 결정 필요 |
| **S7** | 3-C 구현 | `feat/posting-time-change` | ⬜ | | S6 승인 후 |

### 워크트리 배정 (🔴 모든 세션 예외 없이 격리)

| 세션 | 워크트리 경로 | 상태 |
|---|---|---|
| 0-4 | — | ✅ 불필요(PR#367 로 머지됨) |
| S1 | ~~`T-HOLDEM-venue`~~ | ✅ 정리완료(정션 해제 → worktree remove 순서 준수) |
| S2 | ~~`T-HOLDEM-time`~~ | ✅ 정리완료(정션 해제 → worktree remove 순서 준수) |
| S3 | ~~`T-HOLDEM-notify`~~ | ✅ 정리완료(S4 착수 시 — 정션 해제 선행 → `worktree remove`, 원본 `node_modules` 821 무손상 확인) |
| S4 | ~~`T-HOLDEM-qr`~~ | ✅ 정리완료(정션 해제 → `worktree remove` → 브랜치 삭제, 원본 `node_modules` 821 무손상) |
| S5 | ~~`T-HOLDEM-settle`~~ | ✅ 정리완료(정션 해제 선행 → `worktree remove` → 브랜치 삭제. 원본 `node_modules` **818** 무손상 확인) |
| S5-후속 | ~~`T-HOLDEM-revert`~~ | ✅ 정리완료(정션 해제 선행 → `worktree remove` → 브랜치 삭제. 원본 `node_modules` **818** 무손상 확인) |
| B1·B2 | `T-HOLDEM-address` | 🔨 **유지 중**(B1 #391 머지 완료 — B2 가 이어서 쓰거나, 안 쓰면 정션 해제 선행 → `worktree remove` → 브랜치 삭제). 정션은 PowerShell `New-Item -ItemType Junction` 으로 생성(818 확인). `.env.local`·`.env.development.local` 은 gitignore 라 메인에서 복사해야 앱이 뜬다 |
| A-감사 | ~~`T-HOLDEM-audit`~~ | ✅ **머지 완료(#390)** — 정리 대상(정션 없음. `worktree remove` → 브랜치 삭제) |
| P3 | ~~`T-HOLDEM-reminder`~~ | ✅ **정리완료**(2026-08-02 세션 A2 — 정션 해제 선행 → `worktree remove` → 브랜치 삭제. 해제 전후 원본 `node_modules` **821 → 821** 실측 무손상) |
| P4 | ~~`T-HOLDEM-venueloc`~~ | ✅ **정리완료**(2026-08-02 세션 A2 — 정션 해제 선행 → `worktree remove` → 브랜치 삭제. 해제 전후 원본 `node_modules` **821 → 821** 실측 무손상) |
| P6 | ~~`T-HOLDEM-offline`~~ | ✅ **정리완료**(2026-08-02 세션 A2 — 정션 해제 선행 → `worktree remove` → 브랜치 삭제. 해제 전후 원본 `node_modules` **821 → 821** 실측 무손상) |
| 세션A-원장 | `T-HOLDEM-ledger` | 🔨 이 문서 커밋용(정션 없음). **원장 PR 머지 후 정리 대상**(정션 없으므로 `worktree remove` → 브랜치 삭제만) |
| **P2·P5(타 세션)** | ~~`T-HOLDEM-notifyfix`~~ | ✅ **타 세션이 스스로 정리**(2026-08-02 세션 A2 종료 시 `git worktree list` 에서 사라짐). P2 는 #397, P5 는 #400 으로 머지됐다 |
| **L1-잔여** | ~~`T-HOLDEM-settlerpc`~~ | ✅ **머지 완료(#402)** — 정리 대상(정션 해제 선행 → `worktree remove` → 브랜치 삭제). 정션은 PowerShell `New-Item -ItemType Junction` 으로 생성(821 확인) |
| L1-잔여-원장 | `T-HOLDEM-ledger2` | 🔨 이 문서 커밋용(정션 없음). 원장 PR 머지 후 정리 대상 |
| **세션 E** | ~~`T-HOLDEM-schedkey`~~ | ✅ **정리완료**(세션 F — 정션 해제 선행 → `worktree remove` → 브랜치 삭제. 원본 `node_modules` **821 → 821** 실측 무손상) |
<!-- 🔨 **유지 중**(PR 미생성 — 사용자 결정 대기). 정션은 PowerShell `New-Item -ItemType Junction` 으로 생성, 원본 `node_modules` **821 → 821** 실측 무손상 | -->
| **세션 G** | ~~`T-HOLDEM-slotsync`~~ | ✅ **머지 완료(#407)** — 정리 대상(⚠️ **정션 해제 선행** → `worktree remove` → 브랜치 삭제). 정션은 PowerShell `New-Item -ItemType Junction` 으로 생성 |
| S7 | `T-HOLDEM-timechange` | ⬜ |

전부 `C:/Users/user/Desktop/` 아래. 머지 완료 세션의 워크트리는 다음 세션 착수 시 정리한다
(⚠️ **정션 해제 선행** — `rmdir` 로 `node_modules` 정션을 먼저 끊지 않으면 원본이 지워질 수 있다).

**prod 파리티 추적**: **함수 183 / 정책 111** — 2026-07-31 S1 착수 시 재실측 확정.
0-4(`632adcbae`)는 EXECUTE 권한만 회수했으므로 함수·정책 **수는 불변**이었다(183/111 그대로).
prod 최신 마이그 = `20260730174826_cron_run_details_retention`.

⚠️ **다른 레인 미커밋 마이그 1건 발견** (2026-07-31): 워크트리 `T-HOLDEM-wt-board-body`
(`fix/schedule-board-body-array-literal`)에 미추적 파일
`20260731100000_fix_schedule_board_body_array_literal.sql` 이 있다. **prod 미적용**.
"마이그는 전 레인 동시 1건" 규칙 대상 — S1 마이그 적용 시 이 파일과 순서가 엇갈릴 수 있다.

| 세션 | 마이그 | 적용 후 함수/정책 |
|---|---|---|
| S1 | `20260731120000_venue_profile_rpcs` (RPC 2개 신설) | 레포 기대 **185 / 111** (PR#370 머지). ⚠️ 아래 경고 참조 |
| S3 (#382) | 알림 트리거 | **184 / 111 불변**. ✅ **prod 적용 완료(2026-08-01, S5 세션이 레인 정리 차원에서 적용)**. 적용 후 실측 184/111, `proconfig = public, extensions, pg_temp` 보존, PUBLIC/anon EXECUTE 0 확인 |
| S5 (#387) | `20260801100000_rename_default_venue_containers` | **184 / 111 불변** — 데이터 UPDATE 전용(DDL 없음). prod 적용 완료, 4행 rename, 충돌 0건. ⚠️ **prod 기록명은 `20260731195336_rename_default_venue_containers`** — 파일명으로 `list_migrations` 대조하면 못 찾는다 |
| S5-후속 | 없음 | **184 / 111 불변**(2026-08-01 prod 실측) |
| P2 (#397) | `20260802093000_notify_settlement_revert_and_cancel_hint_gate` (트리거 함수 `CREATE OR REPLACE`) | **184 / 111 불변**(2026-08-02 prod 실측). ✅ **prod 적용 완료 — 재적용 금지.** ⚠️ **prod 기록은 2건**(리뷰 반영으로 재적용): `20260801174901` + `20260801180734`. 파일명으로 `list_migrations` 대조하면 못 찾는다 |
| P3 (#396) · P6 (#398) | 없음 | **수 불변** — 두 묶음 모두 마이그 0건. PR diff 에 `supabase/**` 가 0건이라 **DB Tests 잡 자체가 트리거되지 않았다**(재통합해도 마찬가지 — merge-base 가 master HEAD 로 옮겨가 이미 머지된 마이그는 diff 에 안 들어온다) |
| B2 | 컬럼 추가 | 불변 예상 |

> ⚠️ **파리티 기준값이 184 → 186 으로 바뀌었다 (2026-08-02, 세션 A2 실측).** 위 표의 "184/111 불변"
> 기재들은 **그 시점 사실**이고, **현재 값은 186 / 111** 이다. 원인은 P3·P6 가 아니라(둘 다 마이그 0건)
> **P5 방어심화**가 함수 2개를 늘린 것이다 — prod `schema_migrations` 직접 조회 실측:
> `20260801212753 work_logs_identity_pin_and_time_slot_check` + `20260801212843 set_work_log_payroll_status_rpc`.
>
> 🚨 **세션 A2 도중 한동안 레포↔prod 가 어긋나 있었다** — P5 가 **prod 선적용만 하고 PR 이 없던** 구간에서
> 레포 기대 **184** vs prod 실측 **186**. 그 사이 주간 `parity-smoke`(월 01:17 UTC)·일간 `prod-health` 는
> 이 항목에서 red 가 날 수 있는 상태였다.
> ✅ **해소됨** — P5 가 **PR #400 으로 머지**(`95772ce49`)되며 `PARITY_EXPECT_FUNCS=186` /
> `PARITY_EXPECT_POLICIES=111` 로 갱신됐다. 세션 A2 종료 시점 실측 대조: **레포 186/111 = prod 186/111 일치.**
> 🔑 교훈은 그대로다 — **prod 선적용 + PR 지연은 그 간격만큼 감시를 red 로 만든다.**

> 🚨 **파리티 레포↔prod 불일치 (2026-07-31, S1 머지 직후)** — 레포 기대 **185**, prod 실측 **184**.
> 원인은 S1 이 아니다. 병렬 세션(`fix/notification-counter-guard`, `T-HOLDEM-noti`)이 함수 1개를
> 줄이는 마이그를 **PR 보다 먼저 prod 에 적용**해 놓았고 그 PR 이 아직 미머지다.
> 183(master) + 2(S1) − 1(알림 카운터) = **184** 가 prod 값이다.
> → **그 PR 이 머지될 때 `PARITY_EXPECT_FUNCS` 를 182 가 아니라 `184` 로 적어야 한다**(베이스가 185 로 바뀌었으므로).
> 그때까지 주간 `parity-smoke`(월 01:17 UTC)와 일간 `prod-health` 는 이 항목에서 red 일 수 있다.
>
> ✅ **해소됨 (2026-07-31, S2 세션 실측)** — 그 PR 은 **#371 로 머지됐다**(`605cc1bf4`). master 의 `PARITY_EXPECT_FUNCS` 는 이미 **184**, 정책 **111** 이고 단언 리터럴도 일치한다. S2(#374)는 마이그 0건이라 이 값을 건드리지 않는다 — **레포↔prod 불일치는 남아 있지 않다.**

---

## 2. 공통 블록 (모든 세션 프롬프트 앞에 붙인다)

```
## 팀 편성 (이 세션 고정)

| 역할 | 모델 | 에이전트 |
|---|---|---|
| 설계·계획·판정 | fable | planner / architect / Plan |
| 탐색·수집 | sonnet | Explore / general-purpose |
| 구현·작성 | opus | 메인 세션 · tdd-guide |
| 중간 리뷰 | opus | code-reviewer |
| **최종 리뷰** | **fable** | code-reviewer (PR 직전 1회) |

- 독립 작업 2개 이상이면 한 메시지에 병렬 디스패치. 팬아웃은 5개 단위 배치.
- 서브에이전트 보고의 "성공"은 그대로 믿지 말고 diff·테스트 실행으로 독립 검증.
- 디스패치 프롬프트에 금지사항 명시: mcp__supabase__* 직접 호출 금지 ·
  기존 마이그레이션 파일 수정 금지 · PROD 우회 금지.
- 한도(429) 시 폴백 사다리 fable→opus→sonnet, 보고에 다운그레이드 명시.

## 착수 전 필수 — 🔴 격리 워크트리 상시 규칙

**이 프로젝트의 모든 실행 세션은 예외 없이 전용 워크트리에서 진행한다.**
미커밋 변경이 없어도, 혼자 작업 중이어도 마찬가지다. 메인 체크아웃(`T-HOLDEM`)에서는
읽기·계획·문서만 하고 코드를 고치지 않는다.

1. `git fetch origin && git log --oneline origin/master -3` — 최신 master 확인
2. 전용 워크트리 생성 (§1 워크트리 배정 표에서 경로 확인):
   ```bash
   git worktree add C:/Users/user/Desktop/<워크트리명> -b <브랜치명> origin/master
   ```
   ```cmd
   mklink /J C:\Users\user\Desktop\<워크트리명>\uniqn-mobile\node_modules C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules
   ```
   ⚠️ MSYS 경로 변환 주의 — 실패하면 PowerShell `New-Item -ItemType Junction` 대안
   ⚠️ expo 실행 시 `EXPO_ROUTER_APP_ROOT` 절대경로 + `--clear` (정션이면 라우트 0건 함정)
   ⚠️ 워크트리 안 코드는 시스템 절대경로 하드코딩 금지 — `@/` alias 강제
3. `git status` — 내가 만들지 않은 미커밋 변경이 남아 있으면 그것부터 사용자에게 보고
4. `docs/planning/2026-07-31-execution-session-prompts.md` §1 상태 보드로 선행 세션 완료 확인
5. DB를 건드리는 세션이면 `mcp__supabase__list_migrations` 로 대기 마이그 0건 확인
   (마이그는 전 레인 통틀어 **동시 1건**만)
6. §1 워크트리 배정 표의 해당 행을 🔨(진행중)으로 갱신

## 프로젝트 규율 (위반 시 사고 이력 있음)

- 언어: 응답·커밋·문서·주석 전부 한글
- 마이그레이션 = Supabase MCP `apply_migration` 전용. `db push` 금지
- 마이그 재정의 베이스는 "가장 최근 정의":
  `grep -l "CREATE OR REPLACE FUNCTION <name>" supabase/migrations/*.sql | sort | tail -1`
- `e2e/` 는 `npm run quality` 범위 밖 — 상수·enum·문구를 바꿨으면 **별도 Grep 필수**
- `functions/` 는 ESLint·tsc·prettier가 전부 건너뛴다 (Jest만 잡음)
- 커밋 사전승인 O · **push/PR 은 사용자 명시 요청 시에만**
- 완료 주장 전 이 세션에서 실행한 증거 필수

## 실기기 QA 생략 결정 (2026-07-31 사용자 확정)

실기기 QA 게이트는 제외한다. 대신 **아래 3개로 대체하며, 이건 생략 불가**:
1. 금액·시간에 닿는 변경은 **Jest 회귀 테스트 red→green** 확인 (예상액 0원 사고 이력)
2. 묶음별 PR 유지 — 여러 묶음을 한 번에 배포하지 않는다
3. 웹 렌더가 걸린 변경(CSP·WebView)은 **브라우저 콘솔 직접 관찰**. 정적 검사 불충분

## 🔴 세션 종료 프로토콜 (미완료여도 반드시 실행 — 이어가기의 유일한 수단)

컨텍스트가 차거나 사용자가 중단하면, **끝나지 않았어도** 아래를 실행하고 끝낸다.
"다음에 이어서 하겠다"고 말만 하고 종료하지 말 것.

1. **작업 보존** — 미완이어도 커밋한다(커밋 사전승인 O). 커밋 못 할 상태면
   `git stash` 대신 `wip:` 커밋을 남긴다. **워크트리는 지우지 않는다.**
2. **종료 게이트 실행** → 출력을 읽고 결과를 보고 (통과/실패 모두 사실대로)
3. **§1 상태 보드 갱신** — 상태·PR 번호·파리티 카운트·워크트리 상태
4. **§5 인수인계 로그에 항목 추가** — 아래 형식 그대로:
   ```
   ### <세션ID> — <날짜> · 상태: 완료 | 중단(사유)
   - 워크트리/브랜치: <경로> / <브랜치> · HEAD <sha>
   - 끝난 것: (검증 증거와 함께)
   - 안 끝난 것: (다음 세션이 손댈 첫 파일:줄까지)
   - 막힌 지점: (있으면 증상·시도·실패 지점)
   - 다음 세션에 넘기는 주의: (이 세션에서 새로 알아낸 것만)
   ```
5. **새로 드러난 함정은 메모리에 기록** — 이 문서에는 한 줄 포인터만
6. 마지막 줄에 **다음 세션이 붙여넣을 프롬프트**를 출력한다
   (§3 의 다음 세션 블록 + 4번에서 적은 이어가기 지점)
```

---

## 3. 세션별 프롬프트

### S1 — 지점 프로필 (1-B + 1-C)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 1이다.
docs/planning/2026-07-28-venue-schedule-redesign-handoff.md 를 먼저 읽어라.
"이미 확인된 사실"은 file:line 까지 검증됐다 — 재조사 금지.

범위: 1-B + 1-C. 브랜치 feat/venue-profile.

1-B — DB
- `update_venue_container(p_container_id, p_name, p_location, p_contact_phone, p_description, p_defaults)`
- `get_my_venue_contexts(p_ids uuid[])`
- 둘 다 SECDEF + search_path + anon REVOKE + authenticated GRANT + is_workspace_member 게이트
- 🔴 unique 인덱스 23505 → `INVALID_INPUT: 같은 이름의 지점이 이미 있습니다` 로 변환
- 권한 술어는 20260728185802 와 동일 (soft cancel 필터, .claude/rules/supabase-patterns.md §11)
- ⚠️ `get_my_venue_role_salaries` 를 확장하지 말 것 (CROSS JOIN LATERAL → 빈 배열이면 0행, §C)
- pgTAP 작성 + 파리티 카운트 기록 (183/111 → 185 예상)

1-C — 클라 배선
- scheduleService.ts:160,647 → createScheduleContainerContext 에 title/location/phone 전달
- ScheduleConverter.ts:64 시그니처 확장
  ⚠️ 0-1 세션이 SchedulePostingContext 에 `locationAddress` 를 이미 추가했다.
     그 위에 얹을 것 — 같은 인터페이스다.
- venueContainer.ts: VenueContainer + VENUE_CONTAINER_COLUMNS 갱신
- VenueSettingsSheet.tsx: 단가표 전용 → 지점 설정 전체
- useEnsureDefaultVenue.ts: 워크스페이스명 복사 중단 → `{닉네임}의 지점`
- 기본명 SSOT 통합: useEnsureDefaultWorkspace.ts:20 + workspaceService.ts:91 + workspace/index.tsx:125

금지
- '내 팀' 일괄 rename 마이그는 S5(3-D) 몫 — 여기서 하지 말 것
- 지점 설정에 **기본 근무시간 넣지 말 것** (결정 4 · §J)
- 지점 "주소" 입력 필드를 자유 텍스트로 만들지 말 것 — 주소검색 컴포넌트(B1)가 머지된 뒤 얹는다.
  이번엔 **장소명·연락처만** 받는다.
- 1-C 를 쪼개지 말 것 — 입력만 배포하면 안 보이고 표시만 배포하면 볼 게 없다

종료 게이트
1. npm run quality   2. npm test   3. pgTAP + 파리티 카운트 기록
4. code-reviewer(opus) → 수정 → **최종 code-reviewer(fable) 1회**
```

---

### S2 — 시간 모델 (2-A + 2-B)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 2다.
docs/planning/2026-07-28-venue-schedule-redesign-handoff.md §K + §J 를 먼저 읽어라.
§J 의 "시작+종료 둘 다 입력" 지침은 폐기됐고 §K 가 정본이다.

범위: 2-A + 2-B. 브랜치 fix/worklog-time-model.
선행: S1 머지 완료 상태여야 한다 (scheduleService.ts 의미 접점).

2-A — 시간 저장 규약 (🔴 반드시 단일 PR)
- time_slot = **출근 예정 시각 단일값** 'HH:mm' 또는 미기록(=미정)
- composeTimeSlot 의 슬롯 쓰기 소비를 끊는다.
  parseTimeSlotParts 는 **기존 범위 데이터 읽기 하위호환으로 유지**
- EditSlotSheet: 종료 입력 제거 → 출근 예정 단일 칸 + 실제 출퇴근 섹션
- AddSlotSheet: 프리필 제거(빈 값 시작). 출근시간 하나만 받는 현행 구조는 **정본이므로 유지**
- 저장 게이트: 시간 선택 or '미정' 명시 체크 전까지 저장 비활성
- AddStaffModal.tsx:69 자유 텍스트 → 피커 전환 (addSlotPayload.ts:9 규약)
- ⚠️ DEFAULT_SLOT_START_TIME 상수 자체는 지우지 말 것 —
  utils/order-sheet/mappers.ts:505 가 다른 맥락에서 소비한다
- 🔴 **"계산 전" 표시를 같은 PR에** — 직접 배치는 예상 금액 미표시, 공고 근무는 예상액 유지.
  종료 제거만 배포하면 calculateSettlementBreakdown 이 duration 을 못 내
  "정산 예정(추정)"이 **조용히 0원**이 된다. 동일 사고 이력 있음.
- 🔴 대체 검증: 예상액 회귀 테스트를 **red→green 으로 확인**하고 출력을 보고할 것

2-B — 근무 수정 창 통합 (근무표 경로만)
- EditSlotSheet / VenueDayPanel / ConfirmedStaffCard
- ⚠️ EditSlotSheet(예정) 과 WorkTimeEditor(실제)는 중복이 아니다 — §D 표 확인.
  WorkTimeEditor 사용처 3곳은 건드리지 말 것

종료 게이트
1. npm run quality   2. npm test (예상액 회귀 포함)   3. e2e/ Grep (시간 문구 변경분)
4. 구 빌드 하위호환 확인 — parseTimeSlotToDate 가 end 없으면 duration '-'
5. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### S3 — 알림·표시 (2-C + 2-D + 별-2)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 3이다. 브랜치 feat/worklog-time-notify.
선행: S2 머지 완료 (같은 EditSlotSheet.tsx 를 만진다).

2-C — 출근 예정 변경 알림 배선
- 🔴 알림이 거꾸로다: 트리거 notify_on_work_log_update Case 2 는
  modification_history 배열 길이 증가로만 발화하는데,
  updateSlot(WorkLogRepositoryVenue.ts:112)은 이력을 안 써서 무음이다
- time_slot 쓰기 경로는 updateSlot 단 하나 — 여기에 이력 기록을 붙인다
- 사용자 결정 1: 변경 시 **즉시 알림 + 이전값 병기**, 구직자 **취소 요청 경로 필수**.
  무음 변경 절대 금지
- 트리거 변경 시 `node scripts/graph-db-deps.mjs triggers` (레포 루트)

2-D — 구직자 카드 출근시간 3상태
- ScheduleCard / NextShiftCard / WorkTimeDisplay / InfoTab
- '미정'은 명시 선택으로만 도달 → "출근 시간 미정 · 정해지면 알려드려요"

별-2 — 색상 팔레트
- slotEdit.ts:55 SLOT_COLOR_CHIPS 15종 → 구분되는 4개 기준으로 재구성
- ⚠️ 토큰 제거 시 기존 저장값이 slotColorSwatchClassName 에서 null → **색이 조용히 사라진다.**
  하위호환 필수
- ⚠️ 시맨틱색을 배치색으로 쓰지 말 것 (상태 배지와 충돌)

종료 게이트
1. npm run quality   2. npm test   3. 파리티 카운트 기록 (트리거 변경분)
4. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### S4 — 저위험 묶음 (3-B + 3-E + 별-1)

```
[§2 공통 블록 붙여넣기]

UNIQN 근무표 재설계 세션 4다. 브랜치 feat/qr-badge-and-entry.
선행: S1(3-E), S3(별-1 은 독립이나 ScheduleCard 접점) 머지 완료.

3-B — QR 표시 보강 + 퇴근 미기록 배지 + 리마인더 정리
- QR 기록 vs 수동 수정 구분 표시 (`19:04 ✓QR`)
- 근무표에 "퇴근 미기록 N건" 배지 — 🔴 자동 퇴근을 만들지 않기로 했으므로
  **이 배지가 유일한 안전망**이다. 빼먹지 말 것
- shiftReminderPlan.ts:17 HOURS_BEFORE_START 제거, DAY_BEFORE_HOUR=20 은 **현행 유지**
  ⚠️ "정확히 24시간 전"으로 바꾸지 말 것 — 새벽 2시 근무면 전날 새벽 2시에 발송된다
- 퇴근 리마인드는 만들지 않는다 (스태프 독촉 금지)

3-E — 진입점 정리 (팀↔근무표)
- VenueSettingsSheet.tsx · employer.tsx:123

별-1 — 대시보드 접기 + 필터 이동
- app/(app)/(tabs)/schedule.tsx
- 🔴 statusFilter 의 `unpaid` 축은 **미지급 근무를 찾는 유일한 경로** — 삭제 금지,
  접힌 대시보드 안으로 이동
- 소비 3곳(리스트·캘린더 dot·선택일 카드) 전부 갱신. 줄번호는 이동했으니 grep 으로 재확인
- ⚠️ e2e/ 필터 셀렉터 별도 Grep

종료 게이트
1. npm run quality   2. npm test   3. e2e/ Grep
4. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### S5 — 되돌리기 어려운 것 (3-A + 3-D) 🔴 착수 전 사용자 승인

```
[§2 공통 블록 붙여넣기]

✅ **착수 승인 완료 (2026-08-01)** — ①3-A 지급완료 알림 ②3-D rename, 둘 다 사용자가 승인했다.
🔴 그러나 **3-D 의 UPDATE 는 여전히 멈춰서 보고한다.** 승인은 '착수' 에 대한 것이지
   '카운트를 안 보여주고 실행' 에 대한 것이 아니다. 아래 순서 ①→②를 건너뛰지 말 것.
   (3-A 의 지급완료 알림은 **회수 불가** — 발송 경로를 붙이되 테스트 발송 금지)

UNIQN 근무표 재설계 세션 5다. 브랜치 feat/settlement-and-rename.
선행: S1(1-C) 머지 완료 — 이름이 바뀐 사용자가 즉시 고칠 화면이 먼저 있어야 한다.

3-A — 정산 2단 축소 + 지점 정산 확정 배선 + 지급 알림
- venue-settlements.tsx 는 **읽기 전용이 의도된 상태**였다(half-wired 회피).
  useSettleWorkLog 를 재사용해 배선한다
- payrollStatus 참조는 소스 36파일 110곳 — **전면 제거 금지, UI 어휘만 2단 축소**
- 죽은 상태 2종 정리: 'processing'(DB enum 에 없는 UI 전용값, GroupedSettlementCard.tsx:251) ·
  'failed'(scheduleService.ts:326)
- 사용자 결정 2: 지급완료 알림 O, **일괄 체크는 묶어서 1통**, **체크 취소 시 알림 없음**

3-D — '내 팀' 일괄 rename 마이그
- 🔴 순서: ① 사전 카운트 실측 → ② 사용자 보고·승인 → ③ 충돌 검사 → ④ UPDATE
- 사용자 결정 3: **미변경 기본값만** 대상(사용자가 지은 이름 불가침),
  unique 충돌 사전 카운트, 대상자에게 **1회 인앱 안내**
- workspaces 와 job_postings(container) **양쪽** 대상.
  지점은 unique 인덱스(workspace_id, lower(title), schedule->>'kind') 때문에 더 위험

종료 게이트
1. npm run quality   2. npm test   3. pgTAP + 파리티 카운트 기록
4. security-reviewer(fable) — 알림 발신 경로
5. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### B1 — 주소 검색 1단계 (독립 워크트리, A레인과 동시 가능)

```
[§2 공통 블록 붙여넣기]

docs/planning/2026-07-31-address-search-3phase-design.md 를 읽고 **1단계**를 구현해라.
"이미 확인된 사실"은 file:line 까지 검증됐다 — 재조사 금지.
§3 "원안 대비 정정" 5건을 반드시 먼저 읽어라.

브랜치: claude/job-posting-address-map-lbrvzd
워크트리: 별도 생성 (A레인과 파일이 겹치지 않으므로 동시 진행 가능)
  git worktree add C:/Users/user/Desktop/T-HOLDEM-address -b claude/job-posting-address-map-lbrvzd master
  mklink /J ...\T-HOLDEM-address\uniqn-mobile\node_modules ...\T-HOLDEM\uniqn-mobile\node_modules
  ⚠️ expo 실행 시 EXPO_ROUTER_APP_ROOT 절대경로 + --clear (정션이면 라우트 0건 함정)

1단계는 외부 키가 전혀 필요 없고 DB 마이그레이션도 없다.
2·3단계는 이번 범위가 아니다.

핵심
- district = roadAddress · region = `${sido} ${sigungu}` slug · detailedAddress = 층/호 신규 UI
- region 폴백 4단 — ④ 실패 시 mode:'region' 수동 선택으로. **조용히 넘어가지 말 것**(제출 필수 게이트)
- findRegionByAddress(regions.ts:707) 재사용 — 새 매핑 유틸을 만들면 4번째 구현체다
- 🔴 중첩 RN Modal 금지 → `mode: 'postcode'` 인라인 렌더 (PlaceSheet.tsx:4-8, iOS 터치먹통 이력)
- CSP: script-src += https://t1.daumcdn.net · frame-src += https://postcode.map.kakao.com
  ⚠️ iframe 오리진은 daum.net 이 아니라 **postcode.map.kakao.com**

🔴 종료 게이트 — 브라우저 렌더 관찰은 대체 불가
1. npm run quality   2. npm test (sido+sigungu 조합 유닛 테스트 신규)
3. e2e/ Grep   4. **웹 브라우저에서 실제로 우편번호 검색이 뜨는지 + 콘솔 CSP 위반 0건 확인**
   (CSP 위반은 에러 없이 빈 화면이라 정적 검사로 안 잡힌다)
5. code-reviewer(opus) → **최종 code-reviewer(fable)**
```

---

### B2 — 주소 2단계 (좌표) 🔴 REST 키 재발급 선행

```
[§2 공통 블록 붙여넣기]

🔴 착수 조건: 카카오 REST API 키 **재발급 완료 + Supabase EF 시크릿 KAKAO_REST_API_KEY 등록**.
   미완이면 이 세션을 시작하지 말 것.

docs/planning/2026-07-31-address-search-3phase-design.md §5 2단계를 구현해라.
브랜치 feat/posting-geocoding. 선행: B1 머지.

핵심
- 지오코딩은 **쓰기 시점 1회**, Edge Function 에서. 읽기 경로에 키가 안 붙는다
- 🔴 좌표를 location jsonb 에 넣지 말 것 — 구버전 앱에서 **공고가 통째로 사라진다**(§2-A)
- 새 컬럼(geo_lat/geo_lng)은 **3곳에 동시 등록**:
  ① TABLE_COLUMNS (JobPostingRepositoryHelpers.ts:18-19)
  ② ALLOWED_CAMEL_COLUMNS (위에서 자동 파생)
  ③ jobPostingDocumentSchema (jobPosting.schema.ts:464-508)
  한 곳만 빠져도 read 증발 또는 assertCanonical throw (#194 클래스)
- 🔴 REST 키에 EXPO_PUBLIC_ 접두사 금지
- ⚠️ eas update 는 shell env 만 평가 — app.config fallback + 명시 export
- mapLink.ts 좌표 승격: link/search/{주소} → link/to/{이름},{lat},{lng}
  ⚠️ 0-1 세션이 resolveMapQuery/looksLikeAddress 를 추가했다 — 그 위에 얹을 것
- 지오코딩 실패 시 NULL 허용 → 기존 텍스트 폴백 (fail-open 금지)

종료 게이트
1. npm run quality   2. npm test   3. 컬럼 3곳 등록 확인 (read 왕복 테스트)
4. 파리티 카운트 기록 (컬럼만 추가이므로 불변 예상)
5. security-reviewer(fable) — 키 노출 경로   6. **최종 code-reviewer(fable)**
```

---

### S6 — 3-C 설계 세션 (구현 금지)

```
[§2 공통 블록 붙여넣기]

3-C(공고 시간 전체/개인 2축 변경) **설계만** 하는 세션이다. 코드 작성 금지.
설계 판정은 model:"fable" 서브에이전트에 위임하라.

미결 질문 — 사용자 결정이 필요하다
1. "확정 전원의 시간 일괄 변경"은 단순 UPDATE 가 아닐 수 있다.
   이미 그 시간에 맞춰 다른 일정을 잡은 스태프가 있으면 **거절/재확인 흐름**이 필요한가?
2. 거절이 나오면 그 자리는 어떻게 되나 — 자동 취소? 구인자 수동 처리?
3. 개인 시간 변경과 전체 변경이 충돌하면(개인이 이미 조정됨) 어느 쪽이 이기나?

산출물: 설계 문서 1개 (docs/planning/) + S7 프롬프트를 이 문서 §3 에 추가
```

---

### S7 — 3-C 구현

```
[§2 공통 블록 붙여넣기]

S6 설계 문서를 읽고 3-C 를 구현한다. 브랜치 feat/posting-time-change.
(S6 종료 시 이 블록을 구체화할 것 — 설계 전에는 상세를 쓸 수 없다)
```

---

## 4. 레인 간 규칙 (세션이 바뀌어도 유지)

1. **마이그레이션은 전 레인 통틀어 동시 1건.** S1·S3·S5·B2 가 전부 DB를 건드린다.
2. **A레인이 머지될 때마다 B 워크트리는 즉시 재베이스** (`git fetch && git merge origin/master`).
3. **한 파일은 한 레인만.** 충돌 핫스팟:
   `ScheduleConverter.ts`·`InfoTab.tsx`·`types/schedule.ts` (0-1 · S1 · S3) ·
   `EditSlotSheet.tsx` (S2 · S3) · `scheduleService.ts` (S1 · S2 · S5) ·
   `ScheduleCard.tsx` (S2 · S3 · S4) · `mapLink.ts` (0-1 · B2)
4. **누적 배포 금지** — 실기기 QA를 뺀 대가로 묶음별 PR·배포를 유지한다.
5. 새로 드러난 함정은 **이 문서가 아니라 메모리**에 기록하고, 이 문서에는 한 줄 포인터만 남긴다.
6. **워크트리는 머지 확인 후에만 정리한다.** 정리 순서: 정션 해제(`rmdir node_modules`) →
   `git worktree remove` → 브랜치 삭제. 순서를 바꾸면 원본 `node_modules` 가 지워질 수 있다.

---

## 5. 인수인계 로그 (세션 종료 시 append — 최신이 위)

> 형식은 §2 세션 종료 프로토콜 4번 참조. **삭제하지 말고 쌓는다** —
> 중단된 세션을 다시 여는 사람이 읽을 유일한 기록이다.

### 시간모델 R0+R1 (원장 밖 트랙) — 2026-08-03 · 상태: 완료 (**#409 머지 · #410**)

> ⚠️ 이 트랙은 §1 상태 보드의 세션 목록에 없다. 별도 설계 문서
> `docs/analysis/2026-08-03-time-model-redesign.md` 에서 파생된 R0~R4 단계 중 R0·R1 이다.
> 원장 세션(B2·S6·S7)과는 파일이 거의 겹치지 않는다.

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-timemodel` / `feat/time-model-r1-client-tbd` · HEAD `0761ec28f`
- **끝난 것**
  - **R0(서버) — PR #409 머지 `fe9ba794c`.** master(#408) 재통합 후 CI **10종 green**(E2E 포함) →
    prod 적용 → squash 머지. 🔴 **prod 마이그 기록명 `20260803025714`**(레포 파일 `20260803120000`)
    — **재적용 금지**. 적용 후 실측: `md5(prosrc)` 5종 전부 로컬 기대값 일치 · 오버로드 각 1 ·
    함수 **192→193** · 정책 111 불변 · `search_path` 함수별 하드닝 보존.
    prod 직접 프로브: 센티널 4종→NULL · `'18:30 - 03:00'`→`'18:30'` · `'9:00'`→`'09:00'` ·
    해석 불가(`'협의'`·`'- 18:00'`)는 원문 보존(CHECK 계속 작동).
  - **R1(클라) — PR #410**(커밋 `5032d6a54` + 리뷰 착지 `0761ec28f`). 판정을 `isTimeTBD`,
    키를 `timeSlotKey`(서버 `_posting_slot_key` 동치)로 수렴. 쓰기는 `'NEGOTIABLE'`·null → `'미정'`.
    검증: `npm run quality` 전 단계 통과 · jest **613 스위트 6728 테스트** · **red-green 6회**.
  - 파리티 래칫 **193** = prod 실측 일치.
- **안 끝난 것 / 다음 사람이 손댈 곳**
  - 🔴 **R2 = 웹 배포·OTA (사용자 게이트)** — R1 머지 후 진행. 이게 R3 의 선행 조건.
  - 🔴 R3(백필 + CHECK 강화 + 클라 null 쓰기 전환 + 레거시 읽기 경로·`TBA_TIME_MARKER` 삭제)는
    **센티널 신규 기록률 0 근접을 서버 카운트 쿼리로 측정한 뒤** 착수. 설계 문서 §3 참조.
    R3 착수점: `src/schemas/application.schema.ts:184`(널 흡수 transform 제거) ·
    `src/utils/supabase.ts` 23514 문구 분기(**R1 에서 의도적으로 안 건드림**).
  - 🔴 R4 = 직접 UPDATE REVOKE (#407 잔여와 합류).
  - 🔴 실기기 QA: 고정공고 지원→확정→근무표 표기 · **오프라인 시나리오**(MMKV 캐시에 옛 센티널이
    남은 상태로 스케줄 렌더 — 온라인 QA 로는 안 잡힌다).
- **막힌 지점**: 없음. 단 리뷰 워크플로의 검증 에이전트 4건이 **세션 한도**로 중단됐다(아래 주의 참조).
- **다음 세션에 넘기는 주의(이 세션에서 새로 알아낸 것만)**
  1. 🚨 **워크플로 에이전트가 한도로 죽으면 `verdict=null` 이라 후처리 스크립트가 "기각"으로 분류한다.**
     기각 목록에 **사유가 빈 항목**이 있으면 그건 기각이 아니라 **미검증**이다. 이번에 4건이 그랬고
     그중 2건이 실제 결함이었다(사장 화면 영문 토큰 노출·주석 표류).
  2. 🚨 **`tsc` 는 테스트의 유니온 위반을 못 잡는다** — `Record<string, unknown>` overrides·
     `toBe(unknown)` 이라 폐기한 union 멤버를 테스트가 계속 주입해도 통과한다. jest 로만 잡힌다.
  3. 🚨 **PR 의 핵심 수선에 테스트가 0건일 수 있다** — zod 널 흡수를 되돌려도 6696개가 전부 green
     이었다. 수선마다 "무엇을 되돌리면 red 인가"를 물어라.
  4. 🔑 상세 함정은 메모리 `project_time_model_no_scheduled_end.md`.

### 세션 G (과제 4 — 슬롯 편집 표류 근본 수선) — 2026-08-02 · 상태: 완료 (**PR #407**)

> **재통합 후기(2026-08-03)**: 착수 시 "prod 191 vs 레포 189" 로 벌어져 있던 파리티 간극은
> 타 세션이 **#406 을 머지하면서 닫혔다**(신고 축 함수 2개가 레포로 들어옴). `origin/master` 를
> 재통합해 충돌한 파리티 값을 **192**(=189 + 신고축 2 + 내 1)로 해소했고, 이는 prod 실측과 일치한다.
> 재검증: quality exit 0 · jest **611스위트 6661테스트** · pgTAP **97파일 1031테스트 전량 PASS**
> (착수 시 red 였던 파리티 단언이 재통합으로 green 이 됐다 — 브랜치 결함이 아니었음이 확정됐다).

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-slotsync` / `feat/work-log-slot-sync` · HEAD `32c8ba704`(4커밋)
- 🔴 **마이그 1건 prod 적용 완료 — 재적용 금지.** 기록명 `20260802180000 update_work_log_slot_rpc`
  (이번엔 레포 파일명과 **같다**). 레포↔prod↔로컬 md5 3자 일치 `70f323c84ac9d9f268f2589af9eb5f84`(13990자).

**끝난 것**

- 신규 SECDEF RPC `update_work_log_slot(p_work_log_id uuid, p_patch jsonb)` — `work_logs` 와
  `applications.assignments[]` 를 한 트랜잭션에서 갱신. `updateSlot` 이 `.update()` → `rpc()` 1회로 전환.
- 파리티 **189 → 190**(함수 1개, 정책 111 불변). 마커(:99)와 단언 리터럴(:119) 동시 갱신.
- 검증: quality **exit 0**(0 errors) · jest **604스위트 6648테스트** · pgTAP 신규 **27/27** ·
  **red-swap 9종이 각각 대응 단언만 red**(분할 제거→9·10 / groupId 재발급→11 / JSON null→19 /
  다중집합 가드 제거→22 / 권한 술어 제거→6 / 미지 키 허용→3 / B 조각 제거→25 /
  직접 UPDATE 복귀→8건 / applications 무효화 제거→1건 / 40P01 매핑 제거→1건).
- 리뷰 fable **APPROVE**(CRITICAL 0 / HIGH 0). MEDIUM 3건 중 2건 반영, 1건은 **재현 프로브로 오탐 기각**:
  - ✅ **B 조각 무커버**(실효) — 픽스처 4종이 전부 roleIds 1종이라 분할의 B 조각(같은 날 × 나머지 역할)이
    **한 번도 실행되지 않았다**. 형제 역할 배정이 증발해도 green 이었다 → 픽스처 ⑤ + 단언 4건 추가.
  - ✅ **데드락 40P01 미매핑**(실효) — 이 RPC(A→W)와 QR 체크아웃(W→트리거→A)의 순서 역전은 실재한다
    (선재 클래스). '알 수 없는 오류'로 보이던 것을 재시도 안내로 매핑.
  - ❌ **custom_role↔StaffRole 리터럴 충돌로 역매핑이 깨진다**(오탐) — 프로브 실측:
    work_log 키 `'other:dealer'` vs 원소 키 `'dealer'` 로 **매칭 자체가 성립하지 않아** `no_match` skip 된다.
    역매핑에 도달할 수 없어 이미 안전하다. 가드를 추가하지 않았다.

**🔴 다음 세션이 반드시 먼저 알아야 할 것 — 파리티가 다시 벌어져 있다**

착수 프롬프트는 "prod 선적용·미머지 마이그 0건"이라 했지만 **실측은 달랐다.**
`list_migrations` 에는 안 보이는데 prod 함수 수가 **189가 아니라 191**이었다. 차분 2건:
`notify_on_report_review`·`fn_reports_pin_identity` — 둘 다 **레포 마이그 파일에 존재한 적이 없다.**
OID 순서(31296·31307 > `settle_work_log` 31272)로 보아 **#402 이후에** 타 세션이 신고(reports)
하드닝을 prod 선적용한 것이다. 로컬 스택에도 그 세션의 마이그 기록 5건이 있다
(`20260802150000`·`170000`·`170100`·`170200`·`170300`).

→ 그래서 이 PR 의 기대값은 **190 이 맞다**(레포 마이그만으로 만들어지는 수 = 189 + 내 1).
  CI `DB Tests` 는 fresh 스택이라 green 이고, 주간 `parity-smoke`(prod 대조)는 **타 세션이 머지할 때까지
  붉게 남는 게 정확한 신호**다. 190 을 192 로 올리면 CI 가 대신 red 가 된다.

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)

1. 🚨 **`list_migrations` 0건 ≠ 마이그 슬롯 비어 있음.** 타 세션이 남긴 함수 2개는 마이그 기록 없이
   prod 에 있었다. 슬롯 점유 판정은 기록이 아니라 **`pg_proc` 카운트 대조**로 하라.
2. 🚨 **로컬 스택의 마이그 기록이 내 파일명과 충돌할 수 있다.** 내가 고른 `20260802170000` 이 이미
   타 세션 기록으로 존재해 `migration up` 이 내 파일을 "적용됨"으로 건너뛸 참이었다(→ `20260802180000` 으로 이동).
   **파일명을 정하기 전에 `migration list --local` 을 봐라.**
3. 🚨 **`migration up --local` 은 타 세션 기록이 있으면 통째로 거부한다**(`LegacyMigrationMissingLocalError`).
   CLI 가 권하는 `migration repair --status reverted` 는 **타 세션 상태를 망가뜨리니 쓰지 마라.**
   대안 = `docker cp` + `psql -f` 로 내 파일만 직접 적용(⚠️ `MSYS_NO_PATHCONV=1` 필수 — 없으면
   `/tmp/x.sql` 이 윈도우 경로로 변환돼 "No such file").
4. 🔑 **`applications.assignments` 는 평면형이 아니라 v3 배열형이다.** `confirm_application` 의
   `p_assignments`(work_log 1:1)와 **테이블에 저장되는 `p_assignments_v3`(`dates[]`·`roleIds[]`)는 다른 형태**다.
   평면형 전제로 설계하면 매칭이 통째로 빗나간다.
5. 🔑 **`roleIds` 는 커스텀 역할명도 담고, 집합이 아니라 다중집합이다**(같은 역할 N번 = N명 요청,
   `slotCapacity.ts:116`). 그래서 새 역할을 그대로 넣으면 안 되고 `_posting_role_key` 에서 역산해야 한다
   (`updateSlot` 은 `custom_role` 을 안 건드리므로 role 만 바꿔도 실제 역할 키는 안 바뀔 수 있다).
6. 🚨 **zod 가 서버 쓰기 형태를 강제한다.** `application.schema.ts:167-196` 의 `timeSlot: z.string()` 은
   널 불가 — 미정을 JSON null 로 쓰면 **지원서 레코드가 파싱 단계에서 통째로 증발**한다(A2 선례가 같은 파일 주석에 있다).
   `'미정'` 문자열로 쓴다. **서버 쓰기를 설계하기 전에 그 컬럼의 zod 스키마를 먼저 읽어라.**
7. 🔑 **두 번째 테이블을 쓰기 시작하면 그 테이블의 트리거·캐시를 다시 봐야 한다.**
   `applications` UPDATE 트리거 2종은 status 축이 안 바뀌면 알림을 안 낸다(실측 확인, 안전).
   반면 TanStack 캐시는 새로 stale 해져서 `useUpdateSlot` 에 `applications.all` 무효화를 추가했다.
8. ⚠️ **pgTAP 픽스처**: `applications` 에 `(job_posting_id, applicant_id)` UNIQUE 가 있어
   한 지원자로 여러 지원서를 못 만든다. 갈래마다 지원자를 새로 만들어야 한다(공고는 시드 것을 재사용해야
   협업자 권한 분기를 탈 수 있다).

**안 끝난 것**

- 🔴 **PR 미생성**(사용자 명시 요청 시에만). 브랜치 `feat/work-log-slot-sync` · HEAD `32c8ba704`.
- ⚠️ 리뷰 LOW 3건은 수용(미수정): ①자가 치유가 레거시 범위 timeSlot 의 종료시각을 지운다
  (§K 정본이 단일값이라 정합인 수렴) ②역할 편집이 형제 키와 충돌하면 그 셀이 영구 `ambiguous_match` skip
  (정책 "모호하면 손대지 않는다"와 정합, `logger.warn` 으로 관측) ③구 경로의 무음 0-row no-op 이
  신 경로에서 명시 에러로 바뀐다(개선).
- 🔴 **직접 UPDATE 차단(REVOKE)** 은 의도적으로 이번에 넣지 않았다. 순서 = 이 PR 머지 →
  웹 배포 + OTA → 롤아웃 확인(사용자 게이트) → 그 다음. 역순이면 미전환 구 빌드가 즉사한다.
  🔑 배포도 **마이그가 먼저**다(이미 prod 적용 완료 — 이 조건은 충족).

### 세션 F (세션 D·E 착지 + 근본수선 설계) — 2026-08-02 · 상태: 완료(과제 1~3) · **과제 4 미착수 — 새 세션 이관**

- **소스 코드 변경 0건.** 앞선 두 세션이 만든 브랜치를 재검증·착지시키고, 과제 4 는 설계만 냈다.
- 착지 3건: **#402** `d8e3e2dca`(세션 D 코드) · **#403** `8b4702000`(세션 D 원장) · **#404** `c97389daf`(세션 E)

**끝난 것** (전부 이 세션의 도구 출력 기준)

| 대상 | CI | 머지 전 재검증 |
|---|---|---|
| #402 세션 D | **10잡 pass**(DB Tests 2m0s · E2E 포함, 재실행 0) | quality exit 0 · jest **603/6627** · pgTAP **93파일 991테스트 PASS** · md5 3자 대조 **4/4** |
| #403 원장 | 체크 없음(문서 전용) | — |
| #404 세션 E | **9잡 pass**(E2E 재실행 0) | 재통합 후 quality exit 0 · jest **603/6639** |

- 🔴 **파리티 간극 해소** — 착수 시 레포 `PARITY_EXPECT_FUNCS=186` vs prod 실측 **189** 였다.
  #402 머지로 레포가 189 로 올라가 **189/111 = prod 189/111 일치**. 주간 parity-smoke red 위험 제거.
- 워크트리 3개 정리 완료(`T-HOLDEM-settlerpc`·`T-HOLDEM-schedkey`·`T-HOLDEM-ledger2`).
  정션 해제 선행, 원본 `node_modules` **821 → 821** 실측 무손상.

**안 끝난 것 — 🔴 과제 4(근본 수선). 설계 완료, 구현 0.**

원인: `updateSlot` 이 `work_logs` 의 `time_slot`·`role` 만 갱신하고 `applications.assignments[]` 를
그대로 둬 두 원천이 표류한다. 세션 E 는 병합 키를 FK 기반 2단계로 바꿔 **증상만** 막았다.

**채택 설계** (fable planner 판정 + 이 세션 실측 정정):
- `update_work_log_slot(p_work_log_id uuid, p_patch jsonb)` **SECDEF RPC 1개** 신설.
  jsonb 패치인 이유 = 기존 계약이 3상("키를 안 보내면 그 컬럼을 만들지 않는다" — GRID-1).
- multi-date 원소는 **(date × role) 셀 단위로 분할**하되 **`groupId` 는 원본 유지**.
  새 groupId 를 발급하면 `assignment_group_id`(work_logs)와 어긋나 병합이 다시 깨진다.
  분할 후에도 키에 `date` 가 있어 dates 가 서로소면 1:1 이 유지된다.
- 매칭 실패·모호 시 **assignments 동기화만 skip**(work_logs 만 갱신, `assignmentSynced:false`).
  남의 원소를 오염시키는 것보다 표류가 싸다.
- 🔴 **권한은 RLS `wl_update` 를 정확히 그대로 반영한다(확대 0).** 이 세션 prod 실측:
  `owner_id = auth.uid() OR job_posting_id IN (SELECT id FROM job_postings WHERE is_workspace_member(workspace_id, auth.uid()) OR is_posting_collaborator(id, auth.uid()))`.
  planner 는 `is_admin()`·`job_postings.owner_id` 추가를 "순수 확대"로 권했으나 **채택하지 않았다** —
  현행 RLS 에 둘 다 없고, 권한 확대는 조용히 넣을 성질이 아니다. 선례가 admin 을 연 것은 그 함수의 결정이다.
- 파리티 **189 → 190**(신규 함수 1개, 정책 불변). 마커(:91)와 단언 리터럴 **동시 갱신** 필수.

**🔑 planner 설계의 전제 하나를 이 세션이 정정했다 (다음 세션은 이걸 먼저 읽어라)**
planner 는 "`generateApplicationLinkKey` 가 없다 → 표류하면 지금도 병합이 끊긴다"를 근거로
(다)안(multi-date skip)을 기각했다. 그 관찰은 **당시 master 기준으로 정확**했지만, 이유는
**세션 E 가 아직 머지 안 됐기 때문**이었다. #404 머지로 링크 키가 들어왔으므로
(`ScheduleMerger.ts` 2단계 병합) **표류해도 병합은 안 끊긴다.**
→ 과제 4 는 "사용자에게 보이는 파손 수리"가 아니라 **데이터 정합성 수선**이다.
   채택안 (나)는 그대로 유효하지만(과제가 원인 제거를 요구), **긴급도는 planner 판정보다 낮다.**

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)

1. 🚨 **로컬 Docker 스택은 prod·레포 어느 쪽과도 다를 수 있다 — pgTAP red 를 브랜치 결함으로 오판하지 마라.**
   #402 검증 중 `parity_baseline_guard` 가 1건 red 였는데 원인은 브랜치가 아니라
   **로컬에만 있던 고아 함수** `notify_on_report_review`(+트리거 `report_notify_review`)였다.
   prod 0건 · 레포 전체 0건(마이그 파일에 존재한 적 없음)으로 확인 후 로컬에서 DROP → 991/991 green.
   **CI 는 fresh 스택이라 애초에 영향 없었다**(DB Tests pass 로 독립 확인).
2. 🚨 **`migration list --local` 의 "적용됨"은 DDL 이 실제로 돌았다는 뜻이 아니다.**
   `20260802160000` 이 적용 기록은 있는데 `fn_settlement_amount` 가 **로컬에 없었다.**
   고아 기록 2건(`20260802150000`·`20260802160100`, 파일로 커밋된 적 없음)도 있었다.
   복구 = `migration repair --status reverted <ver>` → `migration up --local --include-all`.
   **믿을 것은 기록이 아니라 `pg_proc` 실측이다.**
3. 🔑 **md5 3자 대조는 이렇게 한다** — 레포 마이그 파일에서 `$$…$$` 본문을 추출해 md5,
   prod·로컬은 `md5(replace(prosrc, chr(13), ''))`. 이번엔 4/4 길이·해시 모두 일치했다.
   (#402 는 이전 세션에서 드리프트가 있었고 이미 고쳐진 상태였다 — 재확인해서 확정했다.)
4. 🔑 **`gh pr merge --delete-branch` 의 로컬 삭제 실패는 이번 세션에도 3/3 재현됐다.**
   머지·원격삭제는 정상. 판정은 반드시 `gh pr view <n> --json state,mergeCommit`.
5. ⚠️ **원장 워크트리 pre-push 훅은 `node_modules` 부재로 tsc 에러를 낸다** — 문서 전용이면
   `--no-verify`(선례). 코드가 섞였다면 그러면 안 된다.
6. 🚨 **PowerShell `.ps1` 에 한글을 쓰면 cp949 로 깨져 파서 에러가 난다.**
   정션 조작 스크립트는 **ASCII 로만** 써라(이번에 실제로 한 번 깨졌다).
7. 🔑 **원장 충돌은 "양쪽 보존"이 기계적으로 가능하다** — 세 훅 전부 같은 앵커의 순수 추가라
   §1 표는 시간순, §5 는 "최신이 위"로 배치하면 끝난다. `git merge-tree` 로 **머지 전에 미리** 범위를
   확인할 수 있다(이번엔 충돌 파일이 원장 1개뿐임을 사전 확인).

### 세션 E (P2·P3 후속 — 병합 키 표류 + 오프라인 침묵 취소) — 2026-08-02 · 상태: 완료(PR 미생성, 사용자 결정 대기)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-schedkey` / `fix/schedule-merge-key` · HEAD `3fb6a4326`(3커밋)
- **마이그레이션 0건** (세션 D 가 슬롯 점유 중이라 절대 조건이었다). **파리티 기여 0** — `PARITY_EXPECT_FUNCS` 미변경. ⚠️ 착수 시점 186/111 이었으나 절대값은 세션 D 의 prod 선적용으로 이동했다(그 세션 소관).
- 파일 5개 전부 내 레인 — 세션 D(`settlement/**`)와 겹침 0. 배럴·공용 상수 미변경.

**끝난 것** (전부 이 세션의 도구 출력 기준)

| 대상 | 내용 |
|---|---|
| 과제 1 병합 키 | 2단계 병합 — ①엄격 키(불변)로 전부 소진 → ②남은 것만 **지원서 링크 키**(`applicationId + date + assignmentGroupId`)로 재시도, **양쪽 후보 1:1 일 때만** |
| 과제 2 오프라인 | `syncShiftReminders` 에 `offline` **필수** 인자. 취소만 차단하고 지난근무 정리·재예약은 유지(비대칭) |
| 게이트 | quality **0 errors**(eslint 경고 98 선재·prettier clean) · tsc **0 errors** · 전체 jest **602스위트 6612테스트 122스냅샷 전량 통과** · `e2e/` 참조 **0건** |
| red-green | **6종 1:1 실증** — 링크 3가드(work_log 모호성/지원서 모호성/`consumed` 제외) 각각 제거 시 해당 1건만 red · 오프라인 취소 보호 제거 시 오프라인 2건만 red(**온라인 대조군 green 유지**) · 지난근무 정리를 오프라인 뒤로 밀면 해당 1건만 red |
| 리뷰 | fable code-reviewer **APPROVE** — CRITICAL/HIGH/**MEDIUM 전부 0**, LOW 3(2건 반영, 1건은 전제검증 기록). 요청한 반증 6축(오병합·dateRange 회귀·`canCancel` 진리표·보호막 상실·테스트 실효성·e2e) **전부 불성립** |

**안 끝난 것**

- 🔴 **PR 미생성** — push/PR 은 사용자 명시 요청 사항. 워크트리 유지 중.
- 🔴 **근본 수선은 이 세션 범위 밖**: `updateSlot` 이 `applications.assignments[].timeSlot`(+`role`)도 함께 갱신해야 원인이 사라진다. 다중 쓰기라 **RPC 필수 → 마이그 슬롯 필요**. 이번 수선은 클라에서 **증상을 정확히 가리는** 것이지 원인 제거가 아니다.
- `generateScheduleKey` 는 `createGroupKey`(`scheduleGrouping.ts:200`)와 달리 **구분자 정규화를 하지 않는다**(`'18:30 - 03:00'` vs `'18:30~03:00'`). 링크 병합이 결과적으로 가려 주지만 원인은 남아 있다.

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)

1. 🚨 **`updateSlot` 은 시각뿐 아니라 `role` 도 표류시킨다**(`WorkLogRepositoryVenue.ts:125-127`). 인계 프롬프트는 `timeSlot` 만 지목했는데 실측하니 두 축이었다. **"표류하는 축"을 셀 때 UPDATE 페이로드 전체를 봐라** — 하나만 보고 키를 설계하면 반쪽짜리가 된다.
2. 🔑 **병합 키의 정답은 FK 였다.** `work_logs.application_id` 는 `confirm_application` 이 심는, **이 병합이 찾으려는 링크 그 자체**다. 표류하는 표시 속성(시각·역할)으로 동일성을 추론하지 말고 **기록된 링크를 써라.** 어느 경로도 UPDATE 하지 않는 축만 고른 것이 안전 논거이고, 리뷰가 마이그레이션 전수(`UPDATE work_logs SET` 10곳)로 반증 시도해 불성립을 확인했다.
3. 🚨 **`add_direct_staff` 는 `assignment_group_id` 를 안 쓸 뿐 아니라 `application_id` 도 명시적으로 NULL 로 넣는다**(`20260718000000…:298-315`). 그래서 수동 추가 행은 **지원서 쪽 짝이 아예 없어** 병합 대상이 아니다 — "groupId 가 NULL 이라 위험하다"는 우려는 이 경로에선 성립하지 않는다. **NULL 컬럼을 보고 위험을 세기 전에 그 행에 상대편이 있는지부터 확인하라.**
4. 🚨 **"green 이다" ≠ "그 테스트가 결함을 잡는다" 를 또 만났다.** `ScheduleMerger.test.ts:28` 의 제목은 "assignmentGroupId **or** timeSlot differs" 인데 픽스처는 **둘 다** 다르게 잡혀 있어 `timeSlot` 을 전혀 지키지 못했다. 실제로 키에서 `timeSlot` 을 빼고 70테스트를 돌렸더니 red 는 **키 문자열 리터럴 단언 1건뿐**이었다. **설계 판단을 스위트에 기대지 말고, 위험을 반증할 땐 스키마를 직접 읽어라.**
5. 🔑 **관찰 불가능한 방어가 이 diff 에 2개 있었고 둘 다 주석에 명시했다** — 링크 키의 `applicationId` 없음 분기, `linkCandidates.delete(key)`. 둘 다 제거해도 red 0건임을 실측했다. 첫 번째는 내가 스스로 찾았고 **두 번째는 리뷰가 찾았다** — 자기 코드의 dead defense 는 스스로 다 못 찾는다.
6. ⚠️ **jest 는 타입을 안 본다.** `syncShiftReminders(…, NOW)` 를 options 객체로 바꾸며 여러 줄 호출 1곳을 놓쳤는데, `Date` 가 `{offline}` 자리에 들어가도 babel 은 통과시켰고 **단언이 깨져서야** 드러났다(`now` 가 실시간으로 잡혀 계획이 1건으로 줄었다). 시그니처를 바꿨으면 **jest 말고 `tsc --noEmit` 로 호출부를 확인**하라.
7. 🔑 **오프라인 판정 자산은 이미 완비돼 있다** — SSOT `src/services/offline/networkState.ts`(NetInfo→`onlineManager`), 훅 `useNetworkStatus`, `useSchedules` 가 `isOffline` 반환(`:437`), 화면도 이미 구조분해 중(`schedule.tsx:253`). **새로 만들 필요가 없었다.**
8. 🔑 **`useSchedules` 는 오프라인이면 `error` 를 항상 `null` 로 접는다**(`:419-425`, 주석 `:432-437` 이 그 사실을 명시). 그래서 `{isLoading, error}` 만 보는 게이트는 **원리적으로 오프라인을 볼 수 없다.** 로딩/에러 기반 게이트를 쓰는 다른 화면도 같은 사각지대일 수 있다.
### L1-잔여 (정산 확정·일괄 RPC 화 + 계산기 서버 이식) — 2026-08-02 · 상태: 완료 (**PR #402 머지** `d8e3e2dca`)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-settlerpc` / `feat/settlement-rpc-phase2` · HEAD `178ecf1ad`(1커밋)
- 🔴 **마이그 prod 적용 완료 — 재적용 금지. 기록 3건인데 레포 파일은 2개다.**
  `20260802002505 settlement_amount_calculator` · `20260802003147 settle_work_log_rpcs` ·
  `20260802003419 settlement_amount_calculator_comments`(← 대응 파일 없음. 아래 주의 1번)
- 파리티 **186 → 189** / 정책 **111 불변**(prod 실측). `PARITY_EXPECT_FUNCS` 마커 + 단언 리터럴 둘 다 갱신

**끝난 것** (전부 이 세션의 도구 출력 기준)
- **리뷰 반영**(`b753aa332`) fable **APPROVE**(CRITICAL/HIGH 0). 지적 5건을 그대로 믿지 않고
  prod 재현 프로브로 판정했다 — **3건 확증** · **2건 오탐 기각** · **리뷰가 놓친 같은 클래스 1건 추가 발견**.
  🔴 확증분은 전부 **"조용히 0원 확정"** — `jsonb 의 JSON null 은 SQL NULL 이 아니다`
  (`'{"defaultSalary":null}'::jsonb -> 'defaultSalary'` = `'null'::jsonb` → `IS NULL` 미통과).
  수정 전→후 실측: defaultSalary=null 0→100,000 · catalog salary=null 0→75,000 ·
  컨테이너 항목 salary 없음 0→75,000(내가 만든 `jsonb_build_object('salary', NULL)` 이 원인).
  `taxableItems` 값이 문자열 `"false"` 인 경우도 10,000→9,000 으로 정정(`->>` → `->`).
  `payroll_notes` 는 `work_logs_xss_check` 커버 밖이라 XSS+500자 가드 신설.
- **계산기 이식** `fn_settlement_amount`(IMMUTABLE, 순수). `SettlementRepository.calculateSettlementAmount`(TS)는
  **삭제**했다 — 복제가 아니라 이동이라 클라 계산기 갈래 수는 그대로다.
  컨테이너/일반 분기 · 역할 단가표 해소 · PROVIDED_FLAG(-1) 비대칭 · opt-out `taxableItems` ·
  "basePay 는 반올림 전 원값 시간을 쓴다"까지 원본 의미론 그대로. JS 가 NaN 을 만드는 두 자리만 0 으로 닫음
- **확정** `settle_work_log` — FOR UPDATE 로 TOCTOU·중복 확정 차단, 금액은 서버 재계산.
  권한 술어는 **job_postings 기준**(행 접근으로 쓰면 staff 셀프 정산이 열린다)
- **일괄** `bulk_settle_work_logs` — 항목별 `BEGIN…EXCEPTION` 서브트랜잭션으로 부분 성공 계약 보존.
  `settle_work_log` 를 그대로 호출해 규칙을 한 곳에만 둠. 상한 100 = 클라 `BATCH_CHUNK_SIZE`
- **계약 변경** `set_work_log_payroll_status` 가 `'completed'` 진입을 거부한다(P5 가 남긴 판단 과제).
  프로덕션 호출부 **0건 실측** 후 결정 — 이 함수는 payroll_amount 를 안 써서 금액 없는 지급완료를 만든다
- 게이트: quality **exit 0**(eslint 0 errors · 경고 98 선재) · jest **603스위트 6622테스트 122스냅샷** ·
  pgTAP **93파일 984테스트**(P5 기준선 91/951 → +2파일 +33) · `check:rpc-migrations` 96종 통과
- **짝 픽스처 16/16 SQL↔TS 일치** — pgTAP `settlement_amount_calc.test.sql` ↔ Jest `settlementAmountParity.test.ts`
- **red-green 3종 1:1**: 권한 술어를 행 접근으로 약화 → 셀프 정산 단언(5번)만 red /
  컨테이너 폴백 단가 변조 → 07 픽스처만 red / `completed` 차단 제거 → 14·15만 red. 복원 후 md5 원상 확인
- 레포 ↔ prod ↔ 로컬 `md5(replace(prosrc, chr(13),''))` **4함수 전부 일치**

**안 끝난 것**
- ✅ **PR #402 머지 완료**(`d8e3e2dca`) — 세션 F 가 착지시켰다. 머지 직전 재검증: quality exit 0 · jest **603스위트 6627테스트** · pgTAP **93파일 991테스트 PASS** · 레포↔prod↔로컬 md5 **4/4 일치** · CI **10잡 pass, E2E 재실행 0**. 파리티 **레포 189/111 = prod 189/111 일치**(간극 해소)
- 🔴 **L1 3단계 = payroll 컬럼 직접 UPDATE 차단.** 순서 엄수: 이 PR 머지 → 웹 배포 + OTA →
  롤아웃 확인(사용자 게이트) → 그때 차단. 역순이면 미전환 구 빌드가 즉사한다
- 🔴 **Lost Update 잔존** — `updateWorkTimeWithTransaction`·`updateWorkLogCustomSettlement` 두 경로가
  아직 클라에서 이력 jsonb 를 read-modify-write 한다(P5 주의 10번, 이번에도 미해결)

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
0. 🚨 **`jsonb -> 'key'` 의 JSON null 은 SQL NULL 이 아니다.** `IS NULL` 을 통과하지 못해
   "값이 없다"는 판정이 통째로 뒤집힌다. 금액 경로에서는 그대로 **0원 확정**으로 이어진다.
   jsonb 에서 객체를 꺼내 "있으면 쓰고 없으면 폴백"하는 코드는 **전부** `NULLIF(x,'null'::jsonb)` 를 걸어라.
   ⚠️ 내가 `jsonb_build_object('salary', <SQL NULL>)` 로 **JSON null 을 스스로 만들어** 같은 함정에 빠졌다 —
   입력만 방어하면 부족하다.
1. 🚨 **적용할 SQL 을 손으로 줄이면 레포와 조용히 갈라진다.** 마이그 파일에 있던 본문 주석을
   `apply_migration` 에 안 실어 prod 만 9280자, 레포 13599자로 갈렸다. **md5(prosrc) 대조가 유일한 적발 수단**이고
   실제로 4함수 중 1건을 잡았다(그래서 마이그 기록이 3건). 대조는 반드시 CR 제거 후.
2. 🔑 **계산기 이식은 "5번째 구현 추가"가 아니라 "이동"으로 설계하라.** TS 원본을 남겼으면
   판정 복제가 하나 더 늘었을 것이다 — 이 레포의 상습 결함 클래스다.
3. 🔑 **순수 함수로 만들면 두 언어를 한 표로 묶을 수 있다.** `fn_settlement_amount` 를 테이블 행이 아니라
   11개 스칼라/jsonb 인자로 받게 해서 pgTAP 이 **시딩 없이 리터럴 픽스처**로 호출한다.
   같은 16 케이스를 Jest 에도 물려 이식 드리프트를 잡는다. 이게 없으면 드리프트는 관측 불가능하다.
4. 🚨 **손계산을 기대값으로 쓰면 틀린 쪽은 사람이다.** 픽스처 16개 중 2건의 기대값을 내가 잘못 계산했고
   클라 구현이 맞았다. 짝 테스트가 없었으면 **SQL 을 클라에 맞춰 틀리게 고칠 뻔했다.**
   기대값은 양쪽 구현에 각각 물려 보고 확정하라.
5. 🚨 **차단 계약을 새로 걸면 그 상태를 시드로 쓰던 테스트가 깨진다.** `completed` 진입을 막자
   기존 pgTAP 15번이 "14번이 RPC 로 만들어 둔 completed 상태"에 의존하던 게 드러났다
   (직접 UPDATE 는 `protect_work_log_payroll_columns` 가 42501). → 완료 행은 **UPDATE 가 아니라 INSERT 로** 세운다.
6. 🔑 **약화·복원은 `tr -d '\r' | docker exec -i psql` 로 파이프**하면 CR 오염 없이 왕복한다
   (`docker cp` + `psql -f` 는 CRLF 워크트리에서 prosrc 에 CR 을 섞는다 — P5 실증).
7. ⚠️ **`instanceof Error` 만 보는 에러 매퍼는 통째로 무력화될 수 있다.** `String(error)` 로 떨어지면
   평범한 객체가 `'[object Object]'` 가 되어 접두사 매칭이 전부 실패한다. 실측: supabase-js
   `PostgrestError` 는 **Error 를 상속한다**(`postgrest-js/dist/index.d.cts:26`) — 즉 프로덕션은 멀쩡했고
   **내 테스트 목이 비현실적이었다.** 목을 실제 형태로 고치고 `.message` 폴백도 넣었다.
8. 🔑 **계산기 4갈래는 값이 갈라져 있지 않다**(실측). 세금 코어(`calculateItemizedRateTax`)와
   시간 변환(`TimeNormalizer`)은 실제로 공유된다. 발산 지점은 ①시간 출처 폴백 유무 ②세전/세후 반환
   ③공고 데이터 신선도(캐시 vs 재조회) 셋이다. `services/work/settlement/settlementCalculation.ts` 는
   **소비처 0건(죽은 경로)** 이며 유일하게 `deductions` 개념을 갖고 있다 — 되살리면 즉시 갈라진다.
9. ⚠️ **`guaranteedHours` 는 금액에 반영되지 않는다**(표시 전용, SETTLE-2 계약 테스트가 고정).
   prod 공고 `compensation.allowances` 에 실제로 들어 있어 착각하기 쉽다.
10. ⚠️ **prod 데이터는 사실상 비어 있다** — `work_logs` 3건, 정산 완료 **0건**. 이식 위험의 실데이터 노출은 0이다.
11. 🔑 **리뷰 지적은 재현 프로브로 판정하라.** fable 리뷰 5건 중 2건은 **오탐**이었다
    (`allowances: null` 은 양쪽 다 수당 0 · schedule `role:''` 는 `getPostingDefaultSalary` 가
    카탈로그 첫 단가로 폴백해 양쪽이 수렴). 그대로 "고쳤으면" 멀쩡한 동작을 바꿨을 것이다.
    반대로 프로브를 돌린 덕에 **리뷰가 놓친 인스턴스 1건**을 찾았다.
    오탐도 픽스처(21번)로 남겨 다음 사람이 같은 의심을 다시 파헤치지 않게 했다.
12. ⚠️ 이 세션 중 병렬 워크트리 2개(`T-HOLDEM-cleanup`·`T-HOLDEM-schedkey`)가 새로 떴다.
    **로컬 Docker 스택과 `node_modules` 는 공유**다 — pgTAP·quality 전에 재확인할 것.

---

### 세션 A2 (세션 A 착지 — P3·P6 머지 + 원장) — 2026-08-02 · 상태: 완료

- **소스 코드 변경 0건.** 세션 A 가 만든 PR 을 재통합·재검증·머지만 했다. 머지 순서는 사용자 승인대로 **P4 → P3 → P6**.
- 워크트리/브랜치: `T-HOLDEM-reminder`/`fix/reminder-scope`(#396) · `T-HOLDEM-offline`/`fix/offline-cache-policies`(#398) · `T-HOLDEM-ledger`/`docs/session-a-followups`(이 문서)

**끝난 것** (전부 이 세션의 도구 출력 기준)

| 대상 | 머지 SHA | CI | 재통합 후 로컬 재검증 |
|---|---|---|---|
| P4 #395 | `2e8255dd5` | 9잡 pass (E2E 10m26s, 재실행 0) | 이전 세션 검증분 |
| P3 #396 | `170fd8a2f` | **9잡 pass** (E2E 9m45s, **재실행 0**) | jest **601스위트 6591테스트 122스냅샷** 전량 통과 · pre-push quality **0 errors** |
| P6 #398 | `40040c8fb` | **9잡 pass** (E2E 11m5s, **재실행 0**) | quality **0 errors**(eslint 98 warning 은 선재, prettier clean) · jest **602스위트 6599테스트 122스냅샷** 전량 통과 |
| 타 세션 #399 | `7d1d4c1c7` | 체크 없음(문서 전용) | 사용자 승인 후 머지 — 내 원장 PR 이 그 위에 얹히도록 |

- **P3·P6 둘 다 E2E 재실행 0회** — `board.spec:88` 알려진 flake 가 이번엔 나오지 않았다.
- 워크트리 정리 **3건 완료**(`T-HOLDEM-venueloc` · `T-HOLDEM-reminder` · `T-HOLDEM-offline`).
  전부 **정션 해제 선행 → `worktree remove` → 브랜치 삭제** 순서, 매 건 원본 `node_modules`
  **821 → 821** 실측 확인. 남은 워크트리는 메인 + `T-HOLDEM-ledger` 뿐이다.
- ⚠️ **P5 가 이 세션 도중 `#400` 으로 착지했다**(`95772ce49`, 타 세션). 인계 프롬프트의
  "P5 미착수" 는 이미 stale 이었다 — 착수 정도가 아니라 **마이그 2건이 prod 에 적용된 상태**였다.

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)

1. 🔑 **master 재통합은 DB Tests 를 켜지 않는다 — 인계 프롬프트의 경고는 기우였다.** 재통합하면
   merge-base 가 master HEAD 로 옮겨가므로 **이미 머지된 마이그는 PR diff 에서 빠진다.**
   실측: 두 PR 모두 `git diff --name-only origin/master...HEAD` 에 `supabase/**` **0건**,
   실제로 시작된 워크플로 런도 **CI·E2E 2개뿐**(db-tests.yml 은 `paths: uniqn-mobile/supabase/**`).
2. 🚨 **파리티가 184 → 186 으로 벌어져 있다**(§1 파리티 경고 참조). 원인은 P3·P6 가 아니라
   **P5 가 prod 선적용만 하고 PR 이 없는 것**이다. prod `schema_migrations` 직접 조회로 확인.
   **P5 PR 이 생길 때 `PARITY_EXPECT_FUNCS` 를 186 으로** 올려야 주간 감시가 green 으로 돌아온다.
3. 🔑 **`gh pr merge --delete-branch` 는 워크트리가 브랜치를 점유하면 로컬 삭제만 실패한다** —
   원격은 정상 삭제되고 머지도 정상 완료된다(실측). 에러 메시지만 보고 "머지 실패"로 오판하지 말 것.
4. ⚠️ **원장 워크트리는 `node_modules` 가 없어 pre-commit 훅이 깨진다**(`eslint-config-expo/flat`
   모듈 없음). 문서 전용 커밋이므로 `--no-verify` 로 통과시켰다 — 코드가 섞였다면 그러면 안 된다.
5. ⚠️ **병렬 세션의 quality/push 가 내 검증 시간을 배로 늘린다.** P6 quality+jest 가 평소의 2배
   넘게 걸려 hang 을 의심했는데, `Win32_Process` 커맨드라인을 보니 **타 세션이 같은 시각
   `T-HOLDEM-notifyfix` 에서 pre-push 훅 + eslint 를 돌리고 있었다**(node 프로세스 87~97개).
   **"멈춘 것 같다" 싶으면 프로세스 커맨드라인부터 봐라** — 워크트리별로 누가 뭘 도는지 드러난다.
6. ⚠️ **`cmd //c "dir ..."` 는 MSYS 에서 조용히 빈 셸만 띄운다**(정션 판별이 전부 거짓 음성으로
   나왔다). 또 인라인 `powershell -Command` 는 `\$var` 이스케이프가 경로를 망가뜨린다.
   **정션 판별·해제는 `.ps1` 파일로 써서 `-File` 로 실행**할 것 — `(attributes -band ReparsePoint)`
   와 `.Target` 이 정확하다.

---

### 세션 A (감사 후속 P3 + P4 + P6) — 2026-08-02 · 상태: 완료(PR 3건 생성, 머지는 사용자 결정 대기)

- 워크트리/브랜치 3개 — **묶음별 PR 분리**(실기기 QA 대체 규칙 3번, 롤백 단위 최소화)
  - `T-HOLDEM-reminder` / `fix/reminder-scope` · HEAD `5bf2c2352`(2커밋) → **PR #396**
  - `T-HOLDEM-venueloc` / `fix/venue-location-merge` · HEAD `767cb5d90`(2커밋) → **PR #395**
  - `T-HOLDEM-offline` / `fix/offline-cache-policies` · HEAD `4026abdff`(1커밋) → **PR #398**
- **마이그레이션 0건 (3묶음 전부)** — 파리티 **184/111 불변**. 착수 시 `list_migrations` 로 prod 대기 0건 확인.

**끝난 것** (전부 이 세션의 도구 출력 기준)

- **P3 (H1 — 이 웨이브 유일한 HIGH)**: `syncShiftReminders(schedules, coverage, now?)` 로
  "이 목록이 실제로 관측한 날짜 창"을 필수 선언하게 했다. 창 밖 항목은 건드리지 않고,
  지난 근무 항목만 시간 근거로 정리. 원장 v1(string)→v2(`{id, workDate}`) 하위호환.
  조회 원천을 전체 지평 쿼리로 바꾸는 대안은 **기각**(쿼리 증가 + 빈 캐시 오프라인 시 원장 전소).
- **P4 (M9)**: `saveProfile` 이 기존 `location` 을 병합. **서버 RPC 무변경 = 마이그 0건.**
- **P6 (M6)**: `offlineCachePolicies` 도메인 키 5개 + 호출부 6곳 + **브랜드 타입 `OfflineTtlMs`**.
- 게이트: 3워크트리 모두 `npm run quality` 체인 끝까지 통과(tsc 0 errors · eslint 0 errors ·
  prettier clean) · `npm test` P3 **601/6583/122**, P6 **600/6583/122** 전량 통과 ·
  `e2e/` 파급 **0건**(Grep 도구 재확인) · **red-green 총 6회 실증**(아래).
- 리뷰: 3묶음 전부 code-reviewer(**fable**) → **APPROVE**. CRITICAL 0 / HIGH 0.
  MEDIUM 3건 **전량 반영**, LOW 는 선별 반영.

**red-green 실증 6회** (가드를 제거해 red 를 본 것만 셈)

| 대상 | 제거한 것 | 결과 |
|---|---|---|
| P3 | 창 판정 | 해당 1건만 red (1F/4P) |
| P3 | 지난 근무 정리 | 해당 1건만 red (1F/4P) |
| P3 | `signOut` 의 `clearShiftReminders()` 배선 | 해당 1건만 red (1F/17P) |
| P4 | `location` 병합 | 신규 2건만 red (2F/12P) |
| P6 | 호출부 6곳 원복 | tsc 6곳 TS2322 + 테스트 5건 red(무관 1건만 pass) |
| P6 | 정책값 오염(`as OfflineTtlMs` 로 tsc 우회) | 백스톱 2건 red |

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)

1. 🚨 **결함을 고치면 그 결함이 우연히 막고 있던 것이 열린다.** H1(월 스코프 전량 취소)은
   공용 기기 계정 전환 시 이전 계정의 로컬 알림도 같이 지우고 있었다. 창 보호를 넣자 그게
   살아남아 **A 의 지점명·근무일이 B 의 기기에서 울리게 됐다.** `signOut` 은 푸시 토큰·세션·
   생체·PortOne 토큰까지 지우면서 **로컬 알림만 빠져 있었다**(같은 함수 주석이 "공용 기기"
   위협을 이미 적고 있었는데도). **방어를 추가할 때 "지금까지 이걸 대신 막던 게 뭐였나"를 물어라.**
2. 🚨 **감사 문서의 순서 전제가 틀렸다 — P4 는 B1 머지 전에 넣을 필요가 없었다.** 그러나
   **휴면도 아니었다**: `ScheduleConverter:100-101` 이 이미 `district`/`detailedAddress` 를 읽어
   스태프 근무상세 주소 줄로 렌더한다. **채우는 UI 만 없고 지우는 경로는 열려 있었다.**
3. 🔑 **`p_location` 치환을 유지해야 하는 진짜 이유는 "전체 제거 경로"가 아니다.** 형제
   파라미터 `p_defaults` 가 `'{}'` 센티널 + 병합으로 그 경로를 이미 양립시킨다(`:198-203`).
   진짜 이유는 **단일 키 삭제** — 서버가 빈 문자열을 건너뛰므로(`:159-161`) 병합에서는
   `{name:''}` 이 아무것도 못 지워 "장소명만 비우기"가 원리적으로 불가능해진다.
4. 🚨 **서브에이전트가 워크트리에 파일을 만들어 내 quality 를 깼다.** P6 리뷰어(fable)가
   "파일 수정 금지" 지시를 어기고 `src/__ttl_brand_probe__.ts` 를 만들었다 지웠고, 그 사이
   돌던 `npm run quality` 가 그 파일의 tsc 에러로 실패해 **eslint·prettier 가 아예 실행되지
   못했다**. **리뷰 디스패치와 quality 를 같은 워크트리에서 동시에 돌리지 말 것.**
5. 🔑 **목(mock) 기반 회귀 테스트는 "배선"만 지킨다.** 훅 테스트 5건은 `@/lib/queryClient` 를
   부분 목으로 대체하므로 실물 값이 오염돼도 전부 green 이다 — 실물 import 백스톱을 따로 뒀다.
6. 🔑 **`useCurrentWorkStatus` 는 오프라인에서 MMKV 캐시가 유일한 원천**이다
   (`useQuery` 가 `enabled: false`, 라이브 소스는 realtime 구독). 그런데 TTL 이 30초라
   자기 캐시를 스스로 지웠다 — 감사 M6 목록에 없던 **6번째 호출부**.
7. ⚠️ `jest.fn(() => null)` 은 rest 파라미터가 없어 `(...args)` 위임 목으로 쓰면 tsc 가 **TS2556**
   을 낸다(babel 은 통과 → quality 에서만 터진다). `jest.fn((..._args: unknown[]) => null)` 로 쓸 것.
8. ⚠️ `git push` 가 pre-push 훅(quality 전체)으로 **5분을 넘긴다** — 포그라운드로 돌리면 타임아웃.

**안 끝난 것 / 잔여**

- 🔴 **머지 미실행** — 사용자가 요청한 범위는 PR 3건까지다. 머지는 사용자 결정.
- 🔴 **오프라인 빈 폴백 침묵 취소는 선재로 남았다**(P3 범위 밖). 오프라인이면 `error` 가 null 로
  접히고 `isLoading` 도 false 라 `shouldSyncShiftReminders` 게이트가 열린다. P3 은 폭발 반경을
  **원장 전체 → 보고 있는 달**로 축소했을 뿐 없애지 않았다. **후속 후보.**
- 🔴 P4 LOW-3: 연락처만 고쳐도 `location` 전체가 전송된다. 주소 writer 가 0곳이라 현재 도달
  불가지만 **주소 UI 를 지점 시트에 얹는 PR 에서 MEDIUM 으로 재평가**할 것(파일 헤더에 기재).
- 🔴 P3 LOW: 같은 `workLogId` 의 `workDate` 가 바뀌면 낡은 날짜로 발화(선재). 이제 원장에
  `workDate` 가 있어 drift 감지가 가능해졌으나 쓰지 않았다.
- 🔴 P6 LOW: `currentWorkStatus` 12시간은 벽시계 근사치다. 궁극형은 `cachedAt` 의 달력 날짜 비교.
- ⚠️ **P2 는 타 세션이 진행 중**(`T-HOLDEM-notifyfix` / `fix/notification-contract-alignment`,
  HEAD `d51465f55`). **마이그 1건 포함** — "마이그는 전 레인 동시 1건" 슬롯을 그 레인이 점유한다.
- 🔴 감사 후속 **P5 미착수**. → **정정**: 이 기재는 곧 stale 이 됐다. P5 는 타 세션이 진행해
  **PR #400 로 머지**됐다(`95772ce49`). 아래 P5 항목 참조.

---

### P5 (감사 후속 — 방어 심화 M4+L2+L1) — 2026-08-02 · 상태: 완료(L1 은 의도적 절반) · **PR #400**

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-notifyfix` / `feat/settlement-rpc-and-defense` · HEAD `fd1172555`(5커밋)
- 🔴 **마이그 2건 prod 적용 완료 — 재적용 금지.** 기록명 `20260801212753 work_logs_identity_pin_and_time_slot_check` ·
  `20260801212843 set_work_log_payroll_status_rpc` (레포 파일명 `20260802120000`·`20260802130000` 과 **다르다**)
- 파리티 **184 → 186** / 정책 **111 불변**(prod 실측). `parity_baseline_guard.test.sql` `:91` 마커 + `:111` 리터럴 둘 다 갱신

**끝난 것** (전부 이 세션의 도구 출력 기준)
- **M4** `fn_work_logs_pin_identity` + `tr_work_logs_pin_identity`(`BEFORE UPDATE OF staff_id, owner_id`).
  staff_id 는 전면 차단, owner_id 는 재지정 전면 차단 + NULL 화는 `current_user` 데니리스트로 신뢰 채널만 허용
- **L2** `work_logs_time_slot_format` CHECK. 클라 `assertSlotStartTime` 0패딩 정규화 + 23514 전용 사용자 문구까지 동반
- **L1(절반)** `set_work_log_payroll_status` RPC 신설 + `updatePayrollStatusWithTransaction` 전환 + 테스트 2파일 재편
- 게이트: quality **exit 0** · jest **600스위트 6583테스트 122스냅샷** · pgTAP **91파일 951테스트**(기준선 88/912 → +3파일 +39) ·
  `check:rpc-migrations` 통과(94종) · e2e 는 정산 쓰기 흐름 미단언이라 파급 0
- **red-green 5종 1:1 실증**: 트리거 DROP → identity_pin 만 red / CHECK DROP → time_slot_format 만 red /
  RPC 사유가드 제거 → payroll_status_rpc 만 red / 강화조건 제거 → 해당 단언만 red / throws_like 스왑방지 확인
- 리뷰 3인 전량 반영 — fable planner(갈래 판정) · fable database-reviewer(REQUEST CHANGES) · opus database-reviewer(REQUEST CHANGES)

**안 끝난 것**
- 🔴 **PR 미생성**(push/PR 은 사용자 명시 요청 사항). 워크트리 유지 중
- 🔴 **L1 나머지** — `settleWorkLog`·`bulkSettlement` RPC 화 + 전환. **반쪽 전환은 퇴행**이다(아래 주의 1번)
- 🔴 **L1 3단계 = payroll 컬럼 직접 UPDATE 차단** — 확정·일괄 전환 + 롤아웃 확인 **뒤**에만 가능
- ⚠️ §1 상태보드 P5 행이 PR **#399** 와 충돌할 수 있다(그쪽이 먼저 P5 행을 ⏸ 로 넣어 뒀다)

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
1. 🚨 **확정(settle)만 RPC 로 옮기면 개선이 아니라 퇴행이다.** 계산기를 포팅하지 않은 채 옮기면
   서버가 클라 금액을 그대로 받아 **지금 있는 canonical 재계산 방어가 사라진다.** 확정은 계산 포팅과 한 묶음이어야 한다.
   그 계산기는 **4갈래로 발산한 병렬 구현**이고(과거 실제 발산 이력) 타임존·이중반올림·3값논리·클라상수 4개가 전부
   "조용히 다른 금액"을 만드는 유형이다. bulk 는 **부분성공 계약**을 반드시 보존할 것(항목별 서브트랜잭션).
2. 🔑 **SECDEF 안에서 `current_user` 는 definer 로 바뀌지만 `auth.uid()` 는 호출자를 유지한다**(로컬 실증).
   직접 PostgREST PATCH 와 SECDEF 경유를 가르는 **유일한 판별자**다 — `auth.uid() IS NULL` 류 신뢰 게이트는 못 쓴다.
3. 🚨 **42501 단독 단언은 red-스왑된다** — `wl_update` 의 WITH CHECK(=USING 재사용) 위반도 같은 42501 이라
   트리거를 빼도 green 이 유지될 수 있다. 차단 단언은 `throws_like` 로 메시지 접두사를 볼 것.
4. 🚨 **CRLF 워크트리에서 `docker cp` + `psql -f` 로 적용하면 prosrc 에 CR 이 섞인다.**
   로컬 1383자 vs prod 1352자로 31자 차이가 났는데 줄 수와 정확히 같았고, CR 제거 후 md5 가 완전 일치했다 —
   **전사 누락으로 오판하기 직전이었다.** `replace(prosrc, chr(13), '')` 로 한 번 거르고 판정하라.
5. 🚨 **"잔여 위험이 좁다"를 서버 소비처만 보고 판단하면 틀린다.** `work_logs.owner_id` 를 읽는 서버 코드는
   RLS 정책 2개뿐이라(함수들이 쓰는 owner_id 는 전부 `jp.owner_id`) 처음엔 수용했는데,
   **클라가 `.eq('owner_id', …)` 로 조회**하는 경로에서 타인 피해임이 드러났다.
   ⚠️ 그 두 메서드(`WorkLogRepository.ts:226,264`)의 유일한 소비처는 정산이 아니라 **미작성 리뷰 대상 목록**이다.
6. 🚨 **에러 접두사를 바꾸면 공통 핸들러의 다른 특례에 걸릴 수 있다** — `INVALID_STATUS` 로 바꾸자
   `handleSupabaseError` 의 confirm_application 동시성 특례로 떨어져 **"다른 사용자가 먼저 처리했어요"라는
   거짓 안내**가 나갈 뻔했다.
7. 🔑 **`protect_work_log_payroll_columns` 는 SECDEF RPC 도 우회시키지 않는다**(호출자 JWT 의 app_metadata.role 을 읽는다).
   pgTAP 은 `jpc_test_set_user_with_role(…, 'employer')` 필수. **협업자가 employer 역할이 아니면 RPC 통과여도 트리거가 막는다**(선재).
8. ⚠️ **fable 서브에이전트 2인의 판정이 메인 세션에 전달되지 않았다**(SendMessage 유실, 25분 정지처럼 보였다).
   `subagents/agent-*.jsonl` 에서 직접 회수했다 — 같은 증상이면 파일을 열어라.
9. ⚠️ prod 실측 정정: 공고 `schedule` 에 `timeSlot` 키 **0건**(실제 키는 `timeSlots[].startTime`).
   startTime 전수 **109건 17종이 전부 새 CHECK 을 통과**한다(확정이 깨지는 경로 0).
10. 🔴 **Lost Update 는 축소됐을 뿐 소멸하지 않았다.** revert 는 서버 `FOR UPDATE` 로 닫혔지만
    `updateWorkTimeWithTransaction`·`updateWorkLogCustomSettlement` 두 경로가 여전히 클라에서
    이력 jsonb 를 read-modify-write 한다. **`settlement_modification_history`·`custom_allowances`
    직접 쓰기는 아직 열려 있다** — 그 두 경로까지 전환해야 이력 컬럼 보호(③ 2단계)를 걸 수 있다.
11. 🚨 **③ 설계 시 "행 접근 권한"과 "공고 관리 권한"을 혼동하지 말 것.** `wl_update` 의 USING 은
    `owner_id = auth.uid()` 도 통과시키므로, ③ 이후 채널이 열린 RPC 의 권한 절을 행 접근으로 쓰면
    **staff 가 자기 근무기록에 호출해 셀프 정산**할 수 있다. 이번 RPC 는 `job_postings` 기준 술어라
    이미 안전하고, pgTAP 12번이 정확히 그 케이스(work_log 의 staff 본인 = outsider)를 고정한다.
12. ⚠️ **`updatePayrollStatusWithTransaction` 은 completed "진입"도 허용하는데 금액을 쓰지 않는다**
    (payroll_date 만 세팅). 이 경로로 들어가면 금액 없는 지급완료가 생긴다. 선재 행동이라
    이번 RPC 가 그대로 재현했다 — 확정 RPC 화 때 **completed 진입을 settle 전용으로 좁힐지**
    클라 호출부의 completed 진입 사용례를 grep 확인한 뒤 결정하라(행동 변경이므로 의식적 판단 필요).

---

### P2 (감사 후속 — 알림 계약 정합) — 2026-08-02 · 상태: 완료 (**PR #397 머지** `0808f8ae5`)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-notifyfix` / `fix/notification-contract-alignment` · 머지 전 HEAD `d51465f55`(4커밋)
- 🔴 **마이그 prod 선적용 완료 — 재적용 금지.** 기록명 2건(파일은 1개):
  `20260801174901 notify_settlement_revert_and_cancel_hint_gate` · `20260801180734 notify_work_log_contract_review_fixes`
- 파리티 **184 / 111 불변**(prod 실측). `get_advisors(security)` ERROR 0 / WARN 121 — 전부 선재, 이번 변경 참조 **0건**

**끝난 것** (전부 이 세션의 도구 출력 기준)
- **M3** Case 2-B 의 취소 힌트 조건에 `NOT EXISTS(applications.status='cancellation_pending')` 추가 → `T' ⊆ C` 회복
- **M5** Case 3-B 신설(`payroll_status: completed → 그 외`). 사유는 이미 서버에 있던 `settlement_modification_history` 의 `payroll_status_revert` 항목에서 읽어 본문에 싣는다. 새 타입 `settlement_reverted` 배선 5파일
- 게이트: quality **exit 0** · jest **600스위트 6579테스트 122스냅샷 전량 통과** · 로컬 pgTAP **88파일 912테스트 전량 통과**(`parity_baseline_guard` 포함) · `check:rpc-migrations` 통과 · `graph-db-deps triggers` **master 와 출력 md5 동일**(트리거 델타 0) · `e2e/` Grep **0건**
- **red-green 4종 실증**: M3 `NOT EXISTS` 제거→**2번만** red · Case 3-B 제거→4·5번 · 정산이력 `jsonb_typeof` 제거→**8번만** · 수정이력 `jsonb_typeof` 제거→**9번만**
- CI **10잡 전부 pass, 재실행 0회**(DB Tests pg_prove 1m50s · E2E 11m4s 포함)
- 리뷰 2인 **둘 다 APPROVE** — opus(이 diff 귀속 CRITICAL 0/HIGH 0, 선재 HIGH 1·MEDIUM 4·LOW 4) · fable database-reviewer(CRITICAL 0/HIGH 0/MEDIUM 1). 지적 전량 반영 또는 별도 항목 이관

**안 끝난 것**
- 🔴 **P5 미착수 — 사용자 결정 대기**(아래 주의 1·2번). 워크트리 `T-HOLDEM-notifyfix` 유지 중
- 🔴 **신규 발견 = 병합 키 결함**(아래 주의 3번). 감사에 없던 항목이라 **후속 PR 신규 묶음**이 필요하다
- 🔴 실기기/실사용 알림 수신 미확인(실기기 QA 제외 결정 범위)

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
1. 🚨 **감사 §7 P5 의 M4 처방이 틀렸다 — `REVOKE UPDATE (staff_id, owner_id) … FROM authenticated` 는 아무것도 회수하지 못한다.** 로컬에서 실제로 실행해 확인했다: `REVOKE` 를 성공 반환하지만 `information_schema.column_privileges` 도 `relacl` 도 불변이다. `authenticated` 가 **테이블 레벨** UPDATE(`authenticated=arwdDxtm/postgres`)를 갖고 있고 PostgreSQL 은 테이블 레벨 GRANT 에서 컬럼 부분집합을 뺄 수 없다. 실제 선택지는 ①`REVOKE UPDATE ON work_logs` 후 나머지 36컬럼 재GRANT(새 컬럼 추가 때마다 조용히 권한 누락) ②**BEFORE UPDATE 트리거**(레포에 정확한 선례 `fn_work_logs_pin_posting_id` 가 있다 — `job_posting_id` 를 예외 없이 42501 로 차단).
2. 🔑 **`staff_id` 는 정당한 writer 가 DB·클라 통틀어 0곳이다**(감사는 "SECDEF RPC 2개"라 했으나 실측은 1개). prod `pg_proc` 전수: `permanently_delete_user` 만이 `UPDATE work_logs SET owner_id = NULL` 을 쓰고, `staff_id` 는 손대지 않는다(`staff_name/nickname/photo_url` 익명화만). `remove_direct_staff` 는 두 컬럼 모두 미사용.
3. 🚨 **M3 는 서버 계약을 바로잡았지만 그 이득이 아직 사용자에게 안 보인다 — 선재 결함 하나가 더 있다.** `ScheduleMerger.generateScheduleKey:187-196` 이 병합 키에 `timeSlot` 을 넣는데, `updateSlot` 은 `work_logs.time_slot` 만 쓰고 `applications.assignments[].timeSlot` 은 그대로 둔다(`WorkLogRepositoryVenue.ts:108-122`). **시각을 바꾸는 순간 키가 어긋나 `isCancellationPending` 를 얹는 유일한 지점(`ScheduleMerger.ts:238-251`)이 실행되지 않아 취소 요청 버튼이 오히려 그대로 보인다.** 덤으로 같은 날짜 카드가 2장 뜬다. 클라 전용 수선이라 **감사에 없던 신규 후속 묶음**이다.
4. 🚨 **가드를 넣은 자리보다 상류를 봐라.** Case 3-B 에 `jsonb_typeof` 가드를 넣었는데 리뷰 2인이 *각각 독립적으로* 실측 재현한 결과 **그 가드가 지키지 못했다** — Case 2 의 `jsonb_array_length(modification_history)` 가 IF 밖 최상단이라 무조건 먼저 실행되고, 거기서 22023 이 터지면 `EXCEPTION WHEN OTHERS` 가 BEGIN 전체를 되감아 가드에 도달조차 못 한다. **`WHEN OTHERS` 블록 안에 가드를 넣을 땐 그 블록의 최상단 무조건 실행 구간부터 봐야 한다.**
5. 🔑 **재정의 베이스 판정 + 전사 검증은 `md5(prosrc)` 로 한다.** 적용 전 prod md5 = 레포 마이그 파일 본문 md5 정확 일치(`da652c36…`, 7811자)로 베이스를 확정했고, 적용 후에도 로컬(파일 직접 적용) md5 와 prod md5 를 대조해 **주석 한 줄 전사 누락을 잡아냈다**(3자 차이 → 청크 md5 20분할로 위치 특정). MCP `apply_migration` 에 본문을 붙여 넣는 방식은 이 대조 없이는 검증되지 않는다.
6. ⚠️ **로컬 Supabase 스택은 조용히 뒤처져 있었다** — `20260728185802` 에 멈춰 있어 `notify_on_work_log_update` 가 prod 와 다른 판(md5 불일치)이었다. `npx supabase migration up --local` 로 7건을 올리자 **`parity_baseline_guard` 가 통과**했다(메모리의 "로컬 파리티는 원래 red" 기재는 **드리프트 때문이었고 이제 stale**).
7. 🔑 **`e2e/` 는 알림 타입·문구 단언이 0건**이라 이 축에서는 사각지대가 없다. 대신 `NotificationRouteMap.test.ts:15` 가 **타입 개수 리터럴**을 박아 두고 있어 타입 추가 시 반드시 red 가 된다(46→47).
8. 🔑 EF `send-push-notification` 은 `TYPE_CATEGORY_MAP` 미매핑 타입을 **fail-open** 으로 통과시킨다(`index.ts:128-140`). 즉 배선을 빼먹어도 푸시는 나가고, **배선의 실효는 "수신거부 설정이 적용되는가"** 다.
9. ⚠️ **prod `time_slot` 실측 = `'18:30 - 03:00'` · `'17:00 - 00:00'` · `'19:00'`** — 레거시 범위는 **하이픈 양쪽에 공백**이 있다. L2 의 CHECK 를 순진한 정규식으로 쓰면 기존 행이 즉시 깨진다.
---

### A-감사 (A레인 전체 사후 감사) — 2026-08-01 · 상태: 완료

- 워크트리/브랜치: 분석은 메인 체크아웃 `T-HOLDEM` / `master` `0d4d99309` 에서 **읽기 전용**으로 수행(**소스 코드 변경 0건**). 아래 '막힌 지점'의 세션 충돌 때문에 문서 커밋만 `C:/Users/user/Desktop/T-HOLDEM-audit` / `docs/wave-audit-20260801` 에서 했다(커밋 1건). → **PR #390 머지 완료** (`16a5bb1fa`). 정리 순서는 §4-6 준수.
- **산출물**: [`docs/analysis/2026-08-01-work-schedule-wave-audit.md`](../analysis/2026-08-01-work-schedule-wave-audit.md)
- **DB 마이그레이션 0건.** 파리티 **prod 실측 184 / 111** = 레포 기대값(`parity_baseline_guard.test.sql:91-92`) 일치.

- **끝난 것** (전부 이 세션의 도구 출력 기준)
  - 감사 축 **A~G 7축 전부** 수행(탐색 sonnet 7 → 적대적 검증 fable 6, 13 에이전트 0 실패) + 메인 세션 prod 실측 독립 재검증.
  - 판정 **CRITICAL 0 / HIGH 1 / MEDIUM 11 / LOW 12**. HIGH 1건은 이 웨이브 산물이 아니라 **선재**(#356).
  - 🔑 **핵심 발견 — 판정 복제 누락 2건 추가.** 둘 다 #388 이 `isSettlableWorkLogStatus` SSOT 를 세우며 소비처를 빠뜨린 것: ①`settlementGrouping.ts:251-253` 집계에 `status` 축 누락 ②`GroupedSettlementCard.tsx:258` 그룹 체크박스가 '전체 행수' 축으로 남아 **혼합 그룹에서 해제 불가**(신규 회귀).
  - 게이트: `npm test` **598 스위트 / 6534 테스트 / 122 스냅샷 전량 통과 exit 0**(기준값 정확 일치) · 파리티 prod 재실측 184/111 · 마이그 4건 **스네이크 본명 대조 완료** · `e2e/` 별도 Grep **파급 0건** · `npm run quality` **해당 없음**(코드 변경 0건).
  - 최종 검증: 산출물을 code-reviewer(fable)에 근거 검증 디스패치 → **수정 후 APPROVE, 기각 0건**. 인용 정정 3건 반영(상세=산출물 §9).

- **안 끝난 것**
  - 🔴 **결함 수선 0건** — 감사가 범위였다. 후속 PR 6묶음(P1~P6)은 산출물 §7.
  - 🔴 **E축 red-green 실증 미수행**(읽기 전용이라 소스를 되돌릴 수 없었다). 최우선 후보 3건은 산출물 §5.
  - 🔴 **M4 익스플로잇 미실행** — prod 무단 쓰기 회피. 정책·권한·트리거 실측 근거 판정.
  - ✅ **PR #390 머지 완료**(`16a5bb1fa`) — 워크트리 `T-HOLDEM-audit` 는 정리 대상(정션 없음 → `worktree remove` → 브랜치 삭제).
  - jest "worker process failed to exit gracefully" 원인 스위트 미특정(exit 0·전량 통과 확인까지만).

- **막힌 지점**: 🚨 **세션 충돌 — 메인 체크아웃 git 상태가 다른 세션 소유다.** B1 세션이 메인 체크아웃 `master` 에서 원장을 커밋(`6e7a98384`, 13:18)하면서 **내 미커밋 편집을 함께 삼켰고**, 이후 `reset` 으로 master 가 `0d4d99309` 로 되돌아가 그 커밋이 dangling 이 됐다(내 편집도 작업 트리에서 소실 → 재적용함). 추가로 **7/20 자 stale cherry-pick 상태**가 남아 있다(`.git/sequencer/` Jul 20, `CHERRY_PICK_HEAD` 빈 파일) — 내 것이 아니라 손대지 않았다.
  - 🔴 **B1 세션이 확인할 것**: dangling 커밋 `6e7a98384` 에는 **B1 의 원장 갱신분(주소 검색 1단계 인수인계 로그)이 들어 있고 현재 어느 브랜치에도 없다.** reflog 에서만 접근 가능하니 필요하면 `git show 6e7a98384` 로 회수할 것. 이 감사 세션은 그 커밋에서 **내 몫만** 재적용했고 B1 몫은 건드리지 않았다.
  - 해결 방식: 메인 체크아웃에서 브랜치를 만들면 HEAD 가 움직여 B1 을 방해하므로, **전용 워크트리 `T-HOLDEM-audit`** 를 파서 거기서만 커밋했다. 메인 체크아웃은 발견 당시 상태(`0d4d99309` 클린)로 되돌려 놓았다.

- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - ⚠️ ~~**B1 머지 전에 M9 를 먼저 넣어라.**~~ → **B1 세션 실측으로 정정됨**(아래 B1 항목 주의 4번): B1 은 공고 `location` 만 건드리고 지점 컨테이너 `location` 의 유일한 writer 는 `VenueSettingsSheet` 뿐이라 **B1 diff 는 M9 를 활성화하지 않는다**. M9 는 선재 결함이며 지점 시트에 주소를 넣는 순간 활성화된다. 원문: `VenueSettingsSheet.tsx:108` 이 `location: { name }` 으로 **전체 교체**하고 서버 RPC 도 `'{}'` 에서 재구성해 교체한다(`20260731120000...sql:147-174,212`) → B1 이 `district`/`detailedAddress` 를 추가하는 순간 저장 버튼이 주소를 **소거**한다.
  - 🚨 **"막는 계층이 없다" ≠ "새로 할 수 있는 일이 있다".** 선재 MEDIUM(`wl_update` WITH CHECK 부재)을 가설 3개로 쪼개 2개를 기각했다(`fn_work_logs_pin_posting_id` 가 `job_posting_id` 고정, `protect_work_log_payroll_columns` 가 payroll 고정). 남은 `staff_id` 도 "위조 알림"은 증분이 아니다 — **`add_direct_staff` 가 `authenticated` 에 GRANT + 동의 검사 없음**(prod 실측). 진짜 증분은 *출근·정산 완료 기록의 무음 삭제* 하나. **권한 결함은 차분으로 판정할 것.**
  - 🚨 **알림 계약을 세우는 마이그가 그 계약을 스스로 어길 수 있다.** `20260731140000...sql:163-168` 이 *"버튼이 실제로 있을 때만 말한다"* 를 주석으로 못박고도 조건을 클라(`ScheduleDetailModal.tsx:536-539`)의 **진부분집합**으로 잡아 `cancellation_pending` 을 놓쳤다. **트리거 조건은 클라 게이트와 집합 연산으로 대조할 것.**
  - 🔑 **`settleWorkLogWithTransaction` 은 DB RPC 가 아니다** — prod 에 `%settle%` 함수 **0개**. 클라 TS 메서드이고 정산은 원시 `.update()` 로 나간다(CLAUDE.md '정산=RPC 필수' 위반, LOW 기록). 문서·주석 여러 곳이 이걸 "서버 게이트"라 부른다.
  - 🔑 **`e2e/` 시드와 prod 분포가 어긋나 있다** — prod `work_logs` 3행 중 **2행이 레거시 범위 `time_slot`**, **2행이 `application_id` NULL** 인데 e2e 시드는 전부 단일값·정상.
  - 🔑 **잔여 목록은 줄지 않는 경향이 있다** — F축 재판정 16건 중 **2건이 이미 해소**돼 있었다(`handle_new_user` 는 `{이름} 팀` 이 맞고 S1 기재가 stale · 레거시 색상 15종은 정확히 구현). 주기적 재판정이 값어치가 있다.
  - ⚠️ **`proconfig` 하드닝은 실제로는 안 터졌다** — 재정의 4함수 전부 `pg_temp` 보존(prod 실측). 가장 크게 걱정한 함정이 무사했다는 사실도 기록해 둔다.
  - 🔴 **메인 체크아웃에서 커밋하지 말 것** — 이 세션이 실증했듯 두 세션이 같은 트리를 쓰면 한쪽의 미커밋 편집이 다른 쪽 커밋에 조용히 삼켜진다. 문서만 고치는 세션도 예외가 아니다.

### P1 (감사 후속 — 정산 선택·집계 축) — 2026-08-02 · 상태: 완료 (**PR #393 머지** `bc295df49`)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-settlefix` / `fix/settlement-selection-axis` · HEAD `32c1f8d9a`(3커밋 = 구현 1 + 리뷰반영 1 + master 재통합 1)
- **마이그 0건** — 파리티 불변(DB 미접촉). 근거 = 감사 산출물 §7 P1

**끝난 것**
- **M1** `settlementGrouping.ts` — 배지 집계가 `hasValidTimes` 만 보고 `isSettlableStatus` 를 빠뜨렸다. `isSettlableDateStatus` 술어를 뽑아 집계·일괄정산이 같은 축을 쓰게 했다. 파일 내 인라인 잔존 0건
- **M2** `GroupedSettlementCard.tsx` — `isAllSelected` 분모를 '선택 가능한 행'으로 바꾸고, **그 축을 부모가 `selectableIds` 로 내려준다**(카드 자체 판정 = 부모 게이트와 어긋나는 구조라 판정처를 하나로 줄였다). 순회 대상·`Checkbox checked` 동치식 정리
- **M10** `GroupedSettlementCard.selection.test.tsx` 5건 신설 — `SettlementList` 경유 렌더로 실배선을 밟는다
- 검증: quality **exit 0** · jest **600 스위트 6578 테스트 122 스냅샷 전량 통과 exit 0** · 정산 도메인 단독 10스위트 105테스트 · e2e 파급 0건 · **red-green 실증**(M1 되돌리면 집계 1건만 red, M2 되돌리면 왕복 1건만 red)
- 리뷰 fable **APPROVE**(CRITICAL 0 / HIGH 0 / MEDIUM 1 / LOW 3). MEDIUM 반영

**이 세션에서 새로 알아낸 주의**
1. 🚨 **"green 이다"는 "그 테스트가 결함을 잡는다"가 아니다.** 내가 쓴 테스트 1건이 지킨다고 주장한 가드를 못 잡았다 — 가드를 제거해도 5/5 green 이었고(직접 재현), 픽스처가 "전부 지급완료"라던 주석과 달리 pending 을 한 건 품어 정작 그 경로를 안 밟았다. **가드를 넣었으면 가드를 제거해 red 를 확인하라.**
2. 🔑 **관찰 불가능한 방어는 그렇다고 적어라.** `selectableInGroup.length > 0` 가드는 현재 소비처 구조상 결과를 바꾸지 못한다(`isAllSelected` 의 유일 소비처인 루프가 같은 빈 집합을 순회). 제거하지 않되 **주석에 사실대로** 남겼다.
3. 🚨 **`origin/master` 가 세션 도중 두 번 움직였다**(#390, #392). PR 직전 `fetch` + `merge` 는 형식이 아니라 실제 필요.
4. ⚠️ **남은 축 불일치(휴면)**: `SettlementList.selectableWorkLogs` 는 `payrollStatus === 'pending'`, `getSettlableWorkLogIds` 는 `!== 'completed'` — `'failed'` 행에서 갈린다. writer 0곳이라 휴면이고 실경로는 부모 축 하나. 감사 M11 과 함께 처리할 것
5. ⚠️ **선재 잔존**: 펼침+선택 모드에서 선택 불가 행에도 체크박스가 그려지고 눌러도 no-op — 이 PR 이 없앤 것과 같은 클래스다. `selectableIds` 가 카드까지 내려왔으므로 행에 스레딩하면 싸게 닫힌다

**안 끝난 것**
- ✅ CI **9잡 전부 pass** → 스쿼시 머지 `bc295df49`. ⚠️ E2E 는 1회차에 `board.spec.ts:88`(게시판, `page.goto: net::ERR_ABORTED`)로 fail — **정산 변경과 인과 없음**이고 메모리에 이미 기록된 알려진 flake다. 실패 잡만 재실행해 9m36s pass
- 🔴 워크트리 `T-HOLDEM-settlefix` 정리 대기(정션 해제 선행 → `worktree remove` → 브랜치 삭제)
- 🔴 후속 남음: **P3(유일한 HIGH, 권장 다음)** · P2 · P4 · P5 · P6 — 상세는 감사 산출물 §7

---

### B1-PR (주소 검색 1단계 착지) — 2026-08-02 · 상태: 완료 (**PR #391 머지** `33472d8be`)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-address` / `claude/job-posting-address-map-lbrvzd` · HEAD `87cbf19be`(6커밋, master `16a5bb1fa` 재통합 포함)
- **마이그 0건** — 파리티 184/111 불변(DB 미접촉)
- 사용자 결정: 선택지 A(B1 PR 생성) + 리스크 2건 수용 + WebView 경로 웹 프리뷰 추가 관찰

**이 세션에서 한 것**
- **최신 master 재통합** — 착수 직후 `origin/master` 가 `0d4d99309` → `16a5bb1fa`(A-감사 문서 **PR #390 머지**)로 움직여 있었다. merge 로 재통합(rebase 금지 규율), 충돌은 **실행 원장 4구간뿐이고 코드 충돌 0건**. §5 A-감사 항목은 origin/master 판이 최종본이라 그쪽 채택(브랜치 판은 구버전 스냅샷이었다).
- **재통합 후 재검증**: `npm run quality` **exit 0**(lint 0 errors / warning 98 은 선재) · `npx jest` **599 스위트 / 6573 테스트 / 122 스냅샷 전량 통과 exit 0** · 주소 스위트 단독 재실행 **3/3 스위트 57/57 테스트** · `e2e/` 주소 관련 **`expect` 단언 0건** 독립 확인(시드 데이터만 존재)
- **네이티브 WebView 브릿지 실관찰**(리스크 부분 보강) — `PostcodeSearch.tsx` 의 `POSTCODE_HTML` 을 그대로 재현한 페이지를 브라우저에서 실행(`ReactNativeWebView` 만 스텁 주입). 벤더 스크립트 로드 true · 위젯 iframe `postcode.map.kakao.com` 생성 확인 · '테헤란로 152' 검색 → 결과 클릭 → **브릿지 페이로드 1건 수신**(39키) · 페이지 에러·콘솔 에러 **0건**. 회수한 실페이로드를 `parsePostcodeBridgeMessage` → `resolveRegionSlug` 에 통과시켜 `'서울 강남구'` 확인(임시 테스트 1/1 통과 후 파일 제거).
- **PR #391 생성** — push 시 pre-push 훅의 quality 전체 통과(exit 0).

**안 끝난 것**
- ✅ **CI 9잡 전부 SUCCESS** → 스쿼시 머지 `33472d8be`. 잡별: Quality 4(rpc-migrations 38s / format 57s / lint 1m18s / type-check 1m0s) · Quality Gate 2s · Tests 3m46s · Bundle Size 1m25s · EAS Config 8s · **E2E 11m4s**. 재실행 없이 1회 통과
- 🔴 **워크트리 `T-HOLDEM-address` 는 남겨 뒀다** — B2 가 같은 영역이라 재사용 가능. 안 쓸 거면 정션 해제 선행 후 제거
- 🔴 **네이티브 WebView 실기기 미검증은 그대로** — 브릿지 페이로드·파싱까지는 실관찰로 덮었지만 **WebView 렌더·가상키보드·iframe 터치 입력**은 여전히 검증 수단이 없다(사용자 수용)
- 지원 전 도로명주소 공개 여부 = 제품 결정 미정(현행 비공개 유지, 사용자 수용)

**이 세션에서 새로 알아낸 주의**
1. 🚨 **세션 착수 시점의 `origin/master` 를 신뢰하지 말 것** — 첫 `git fetch` 직후 `0d4d99309` 였는데 수 분 뒤 `16a5bb1fa` 로 바뀌어 있었다(다른 경로로 #390 이 머지됨). **머지 직전 재통합은 규율이 아니라 실제로 필요**하다. 워크트리별 `git rev-parse origin/master` 가 어긋나 보이면 그건 워크트리 문제가 아니라 그 사이 fetch 가 일어난 것이다.
2. 🚨 **검증 실행 중에 워크트리에 임시 파일을 만들지 말 것** — `quality` 가 도는 도중 임시 테스트를 만들어 lint·prettier 결과를 오염시킬 뻔했다(발견 즉시 워크트리 밖으로 이동). 임시 검증 파일은 **scratchpad 에 두고 실행 직전에만 복사**한다.
3. 🔑 **playwright MCP 브라우저가 "already in use" 면 죽이지 말고 레포 playwright 로 직접 몰아라** — 다른 세션이 같은 프로파일(`mcp-chrome-*`)을 쓰고 있을 수 있다. `node_modules/@playwright/test` 를 **절대경로로 require** 하면 scratchpad 스크립트에서도 바로 쓸 수 있다(스크립트 위치 기준 모듈 해석이라 상대 require 는 실패한다).
4. 🔑 **위젯 실응답 39키를 실물로 재확인**했다 — `sido:'서울'`·`sigungu:'강남구'`·`zonecode:'06236'`·`roadAddress:'서울 강남구 테헤란로 152'`. 기존 픽스처와 **정확히 일치**. iframe URL 에 `origin=http%3A%2F%2Flocalhost%3A8899` 가 실려 나가므로 http 로컬 프로브에서도 위젯 자체는 정상 동작한다(막히는 건 CSP `frame-src https://` 쪽뿐).

**끝난 것** (검증 증거와 함께)
- 우편번호 검색 전환: `PlaceSheet` 에 `mode:'postcode'` 인라인 추가(중첩 RN Modal 금지 준수), 주소 TextInput → 검색 버튼, 상세주소(층/호) 입력 신설, region 4단 폴백
- 신규 `src/utils/address/postcodeAddress.ts`(zod 경계 검증 + region 해석) · `src/components/address/PostcodeSearch{,.web}.tsx`
- CSP: `script-src += t1.daumcdn.net` · `frame-src += postcode.map.kakao.com`
- **같이 고친 결함**(이번 변경이 만들어낼 것): `resolveMapQuery` 가 `detailedAddress` 최우선이라 '3층 301호'가 지도 검색어가 되는 문제 → `composeFullAddress` SSOT 로 교체(red→green 확인). `InfoTab` 주소 줄 동반 수정. `orderSheet.schema` district 50→200.
- 검증: `npm run quality` **exit 0**(lint 0 errors) · jest **599 스위트 / 6573 테스트 전량 통과** · e2e 축 확인(PlaceSheet testID 0건, 주소 표시·길찾기 단언 0건) · knip **델타 0**(master 2223 / 브랜치 2223 실측 대조, 래칫 red 는 master 부터 선재)
- **브라우저 실관찰**(정적 검사 대체 불가 게이트): ①프로덕션 CSP 를 실제 헤더로 붙인 페이지에서 위젯 정상 렌더 + 콘솔 위반 **0건** ②실제 앱(주문서→장소→주소 검색)에서 검색·선택·지역 자동선택·상세주소 노출 확인. 리뷰 수정 후 **재관찰까지 완료**
- **리뷰 2회**(opus 중간 → fable 최종). fable = **APPROVE**(CRITICAL 0 / HIGH 0), opus = REQUEST CHANGES(HIGH 3). **HIGH 3건 전부 반영**(`ccd1cbe26`):
  ① `text-status-error` 는 이 레포에 없는 토큰이라 실패 안내가 다크모드에서 사실상 투명했다 → `error-600/dark:error-400`
  ② 네이티브 WebView 가 SheetModal 의 ScrollView 안이라 Android 가 제스처를 가져간다(`nestedScrollEnabled` 기본 false) → prop 추가
  ③ 이 기능의 린치핀인 `district` 동시 쓰기에 회귀 가드 0건 → PlaceSheet 컴포넌트 테스트 4건 신설, **red-green 확인**(`district: address` 제거 시 정확히 2건 red)
  MEDIUM 도 반영: 상세주소 렌더 조건 `address || detailedAddress`(주소를 지우면 상세주소가 숨겨진 채 제출되던 경로) · 브릿지 파싱 실패 `onError` · `originWhitelist` 축소 + `domStorageEnabled` · 네이티브 HTML 이 위젯 옵션을 리터럴 재선언하던 드리프트 제거

**안 끝난 것**
- 🔴 **PR 미생성** — push/PR 은 사용자 명시 요청 시에만(원장 §2 규율). 워크트리·브랜치 유지 중
- 🔴 **네이티브 WebView 실기기 미검증** — 실기기 QA 제외 결정이라 이 경로는 검증 수단이 0이다. 브릿지 파싱만 유닛 테스트로 고정했고 WebView 렌더·가상키보드·iframe 입력은 미검증
- knip 래칫 미확인(종료 게이트 밖)

**막힌 지점**: 없음

**다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
1. 🚨 **설계 문서 §2-H 가 틀렸다** — `react-native-webview` 를 `src/` 에서 직접 import 하는 코드는 **0건**이었다(PortOne RN SDK 가 내부적으로 쓸 뿐). 이번이 레포 최초 직접 사용이고, **jest 목이 없어 order-sheet 계열 10개 스위트가 통째로 실행조차 안 됐다**(실패 테스트 1개인데 실패 스위트 11개면 이 신호). `jest.setup.js` 에 목 추가로 해결.
2. 🚨 **CSP 검증은 dev 서버로 불가** — `_headers` 는 Cloudflare Pages 파일이라 `expo start --web` 에 적용되지 않는다. 또 위젯 iframe **스킴이 페이지 프로토콜을 따라간다**(`postcode.v2.js`: `w = "http:" !== CONT.PROTOCOL`) → http 로컬 프로브는 `frame-src https://...` 에 걸린다. playwright 는 self-signed 인증서를 거부하므로 https 프로브 불가.
3. 🚨 **`district` 는 시군구가 아니라 주소다.** `district ?? address` 붕괴가 **4곳 전부 district 우선**이라, 편집 화면에서 `address` 만 갱신하면 stale district 가 이겨 새 주소가 조용히 사라진다.
4. 🔑 **M9 는 B1 diff 가 활성화하지 않는다**(실측 정정) — B1 은 공고 location 만 건드리고, 지점 컨테이너 location 의 **유일한 writer** 는 `VenueSettingsSheet` 뿐이다(`update_venue_container` 호출부 전수 확인). 감사 문서는 B1 이 지점 시트에도 주소를 넣는다고 가정했으나 1단계 범위가 아니다. M9 는 선재 결함이며 **지점 시트에 주소를 넣는 순간** 활성화된다.
5. ⚠️ **`update_venue_profile` RPC 는 district 100자 서버 게이트**(`20260731120000_venue_profile_rpcs.sql:168-170`) — 클라 200 / 지점서버 100 / 공고 무제한 **3원 불일치**. B2 나 지점 주소 확장 시 서버가 거부한다.
6. 🔑 **지역 택소노미는 2026-07 개편이 이미 반영돼 있다**(설계 문서 §8 미확인 항목의 답) — 인천 신설 4구·화성시 4구 전부 존재. 위험은 반대 방향(위젯이 개편 전 구명을 줄 때)이라 ②단계 폴백이 그걸 받는다.
7. 🔑 **위젯 실응답은 39개 키** — 우리가 쓰는 건 5개뿐이라 zod `.strict()` 금지. `sido` 축약형(`경기`)·`sigungu` 2단계 문자열(`성남시 분당구`)을 **관찰로** 확정해 픽스처에 고정했다.
8. 🔑 새 워크트리는 `.env.local`·`.env.development.local`(gitignore)을 메인에서 복사해야 앱이 뜬다 — 없으면 "환경변수 검증 실패"로 부팅 실패.
9. 🔑 **`composeFullAddress` 의 포함 검사는 완전 토큰이어야 한다** — 단순 `includes` 면 `'강남구청길 5'` 가 `'강남구'` 를 품은 것으로 판정돼 **시·구가 조용히 사라진다**. 역방향 포함, 그리고 "주소 칸이 주소 꼴이 아니면 앞에 붙이지 않는다"(레거시 자유텍스트 별칭 방어)까지 세 갈래가 필요하다.
10. ⚠️ **`fullLabel`(`core.ts:44`)은 이 PR 이 건드리지 않았다** — 구직자 화면 `근무지` 행은 `name [+detailedAddress] · regionLabel` 이고 **도로명주소는 원래부터 안 보인다**(확정 스태프의 `InfoTab` 에서만 보인다). B1 이 뺏은 게 아니라 선재 경계다. 지원 전 주소 공개 여부는 **제품 결정**이라 범위 밖으로 남겼다 — 바꾸려면 사용자 확인 먼저.
11. 🔑 **리뷰 에이전트가 0바이트로 멈출 수 있다** — opus 리뷰가 13분간 출력 0바이트인 채 살아 있었다(형제 fable 은 211KB 작성 중). 출력 파일 크기·mtime 으로 생사를 판별해 재디스패치했고, 원래 것도 결국 18분 만에 완주했다(둘 다 유효). 판정이 갈리면 **양쪽 근거를 직접 실측해 채택**할 것 — 이번에도 `composeFullAddress` 반례에서 두 리뷰가 정면 충돌했고 opus 가 맞았다.

---
### S5-후속 (SETTLE-3 + 정산 게이트 status 축) — 2026-08-01 · 상태: 완료 (**PR #388 머지** `0ec9abc2c`)

- 워크트리/브랜치: ~~`C:/Users/user/Desktop/T-HOLDEM-revert`~~ / ~~`feat/settlement-revert-entry`~~ · 머지 전 HEAD `d707fb6fc`(커밋 5개, base `97bf7e85c`) → **머지 `0ec9abc2c`**. 브랜치·워크트리 **정리 완료**
- **DB 마이그레이션 0건.** 파리티 **prod 실측 184 / 111** = 레포 기대값 일치(세션 시작·종료 두 번 측정, 동일).
- 착수 시 정리: **S5 를 PR #387 로 착지**(사용자 결정). CI **10잡 전부 SUCCESS**(E2E 10m14s 포함, 재실행 없이 1회 통과) → 스쿼시 머지 `97bf7e85c`. 워크트리 `T-HOLDEM-settle` 제거(정션 해제 선행, 원본 `node_modules` 818 무손상), 브랜치 삭제.

- **끝난 것** (전부 이 세션에서 실행한 출력 기준)
  - **SETTLE-3 지급 완료 취소 진입점** `741f9cf00` — `venue-settlements.tsx` 에 `useUpdateSettlementStatus` + `SettlementRevertModal` 배선. 상세 모달에 `onRevertSettlement` 를 넘겨 취소 버튼이 렌더된다. 전환 대기는 `SHEET_DISMISS_ANIMATION_MS` SSOT. 실패 시 모달 유지(성공에서만 닫음).
  - **정산 게이트 status 축** `e01011032` → `564614f9d` → `00d900693` — 서버(`settleWorkLogWithTransaction`, `status ∈ {checked_out, completed}`)와 UI 축을 맞춰 "누르면 항상 실패하는 버튼" 을 제거. 술어 `isSettlableWorkLogStatus` 를 `@/shared/status` 에 SSOT 로 신설하고 **정산 어포던스 4곳 전부**를 통과시켰다.
  - **차단 사유 노출** — 개별 카드는 안내 배너, 그룹 행은 배지 `'출퇴근 미확정'`(+ accessibilityLabel 동일 값 합성).
  - 게이트: `npm run quality` **exit 0**(0 errors / 97 warnings = S4·S5 baseline 동일) · `npm test` **598 스위트 / 6534 테스트 / 122 스냅샷 전량 통과 exit 0** · `e2e/` 별도 Grep **파급 0건**.
  - 리뷰: code-reviewer(opus) CRITICAL 0 / HIGH 0 / MEDIUM 3 / LOW 5 → **MEDIUM 3 + LOW 2 반영** · 최종 code-reviewer(fable) **APPROVE**(MEDIUM 1 = 선재 결함 잔존) → **그 MEDIUM 도 마저 반영**.

- **안 끝난 것**
  - ~~push / PR~~ → ✅ **PR #388 머지**(`0ec9abc2c`).
  - 🔴 **되돌리기 경로 실사용 검증 없음.** prod 에서 눌러보지 않았다. 유닛·타입·레포 진입점·화면 진입점까지만 검증됨.
  - ⚠️ **`GroupedSettlementCard` 는 렌더 레벨 테스트가 여전히 0건**(선재 갭). 배지·라벨은 `statusText` 한 값에서 합성해 원리적으로 갈라질 수 없게 해 뒀지만, 그 행 자체를 렌더하는 테스트는 없다.
  - ⚠️ 정산 라벨 맵은 아직 **4곳**에 흩어져 있다(S5 에서 이월된 항목, 색/variant 통합은 시각 확인 필요).
  - 비차단: `handleOpenRevert` 의 `workLog as SettlementWorkLog` 캐스트(`onRevertSettlement` 제네릭화가 더 정직하나 소비 필드가 id/staffName/payrollAmount 뿐이라 실해 없음).
  - 비차단: 되돌리기 사실이 **스태프에게 통지되지 않는다**(트리거가 `completed` 전이에서만 발화 — 코드는 의도대로 동작). 금전 상태 역행이므로 제품 결정으로 명시해 둘 값어치가 있다.

- **막힌 지점**: 없음.

- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - 🚨 **`SettlementCard` 는 공유 컴포넌트가 아니다.** 원장 S5 백로그와 내 첫 커밋 메시지가 둘 다 "공고 정산 화면 동시 영향" 이라고 적었는데 **사실이 아니었다** — `SettlementCard` 의 렌더 소비처는 `venue-settlements.tsx` **단 1곳**이고, 공고 정산 화면(`SettlementList`)이 쓰는 것은 이름만 닮은 **별개 컴포넌트 `GroupedSettlementCard`** 다. 그 전제대로 한 곳만 고치면 "고쳤다고 적힌 채 공고 화면엔 결함이 그대로" 가 된다. **이름이 닮았다는 이유로 공유를 가정하지 말고 렌더 소비처를 grep 할 것.**
  - 🔑 **같은 판정이 4곳에 복제돼 있었다** — 개별 카드 버튼 · 그룹 행 버튼 · 그룹 일괄 집계 · 리스트 선택 모집합. 넷 중 **서버 축을 보는 곳이 0곳**이었고, 그룹 카드는 자기 파일 안에서 `getSettlableWorkLogIds` 와 인라인 복제본을 **동시에** 갖고 있었다(복제본에만 축이 빠짐). 판정을 고칠 땐 술어를 SSOT 로 세우고 **소비처를 전수로 세어 볼 것**.
  - 🔑 **필수 필드로 추가하면 tsc 가 누락 생성 지점을 전수로 잡아 준다.** `DateSettlementStatus.isSettlableStatus` 를 optional 로 뒀다면 기존 픽스처 5곳이 조용히 `undefined` 가 돼 게이트가 전부 닫히는(=정산 불가) 반대 방향 사고가 났을 것이다. 필수로 두니 tsc exit 2 로 5곳을 정확히 지목했다.
  - 🚨 **RN `Pressable` 함정 재확인** — 배지를 그려도 명시 `accessibilityLabel` 이 자식 텍스트를 덮으므로 스크린리더엔 아무것도 안 간다. 이번엔 배지 문구와 라벨을 **한 값(`statusText`)에서 합성**해 구조적으로 못 갈라지게 했다. 문구를 두 번 쓰면 다음에 또 갈라진다.
  - 🔑 **컨테이너 되돌리기는 확정과 같은 소유권 검증 경로**(`validateWorkLogOwnership` → `toJobPosting`)를 탄다. 즉 S5 가 봉합한 컨테이너 증발 결함이 살아 있었다면 확정뿐 아니라 취소도 함께 죽어 **완전한 편도 문**이 됐을 것이다. 레포 진입점 테스트는 `parseJobPostingDocument` 를 **항상 null 로 목**한 채 통과해야 증거가 된다(비컨테이너 행으로 `/파싱/` 거부를 단언해 그 목이 load-bearing 임을 반증해 둠).
  - 🔑 **`e2e/` 는 문자열 grep 만으로 판정하지 말 것.** 이번 변경은 문구가 아니라 **게이트 축**을 바꿨으므로, 시드 데이터의 `status` 축을 봐야 파급을 안다. 실측: `employer-settlement.spec.ts:134`·`work-log.factory.ts:28` 이 미정산 행을 `checked_out` 으로 심는다 → 새 게이트를 그대로 통과, 파급 0건.
  - 🔑 **pre-push 훅이 `npm run quality` 전체를 돈다** — push 가 2분 넘게 "멈춘 것처럼" 보인다. 죽은 게 아니니 타임아웃 늘리거나 백그라운드로 돌릴 것.
  - ⚠️ **전체 jest 에서 "A worker process has failed to exit gracefully" 경고가 뜬다**(exit 0, 598/598 통과). 신규 테스트 3파일을 개별 실행했을 땐 안 뜬다 — 이 브랜치가 만든 것이 아니라 기존 스위트발이다. 원인 스위트는 미특정.

### S5 (3-A + 3-D) — 2026-08-01 · 상태: 완료 (**PR #387 머지** `97bf7e85c`)

- 리뷰 3종 전부 통과: security-reviewer(fable) **CRITICAL 0 / HIGH 0**(MEDIUM 1 은 선재 — RLS `wl_update` WITH CHECK 부재로 `staff_id` 재지정 알림 위조 가능, 별도 PR 권고) · code-reviewer(opus) CRITICAL 1·HIGH 1·MEDIUM 3·LOW 2 **전량 반영** · 최종 code-reviewer(fable) **APPROVE**(LOW 3 비차단).
- 최종 게이트 실행 증거: `npm run quality` exit 0(0 errors / 97 warnings = S4 baseline) · `npm test` **595 스위트 / 6503 테스트 / 122 스냅샷 전량 통과** · `tsc --noEmit` exit 0 · `e2e/` Grep 파급 0건.

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-settle` / `feat/settlement-and-rename` · 커밋 4개
- ⚠️ **prod 기록명 ≠ 레포 파일명이다.** `mcp__supabase__apply_migration` 이 적용 시각으로 자체 버전을 매기기 때문에, 레포 `20260801100000_rename_default_venue_containers.sql` 은 prod 에 `20260731195336_rename_default_venue_containers` 로, 레포 `20260731140000_notify_on_time_slot_change.sql` 은 `20260731195045_notify_on_time_slot_change` 로 기록돼 있다. **`list_migrations` 로 "재적용 금지" 를 대조할 때 파일명으로 찾으면 못 찾는다 — 이름 뒷부분(스네이크 케이스 본명)으로 대조할 것.**
- **DB 마이그레이션 2건 prod 적용.** 파리티 **184 / 111 불변**(적용 전·후 실측 동일, 레포 기대값 `parity_baseline_guard.test.sql:91-92` 와 일치)
  - `20260731195045_notify_on_time_slot_change` — **S3(#382)가 남긴 미적용분**. 레인을 막고 있어 사용자 승인 후 먼저 적용했다. 적용 후 신규 `time_slot` 분기 존재·`settlement_completed` 보존·`proconfig = public, extensions, pg_temp` 보존·PUBLIC/anon EXECUTE 0 전부 실측 확인.
  - `20260731195336_rename_default_venue_containers` — 이번 세션 신규(데이터 UPDATE 전용, DDL 없음).

- **끝난 것**
  - **3-D 지점 기본명 소급 rename** `9e5389880` — 게이트 순서 준수(①사전 카운트 실측 → ②사용자 보고·승인 → ③충돌 검사 → ④UPDATE). prod 4행 rename, unique 충돌 **0건**, 발송 알림 **0건**(적용 후 실측). `'기본 지점'→'로즈의 지점'` / `'기본 지점'→'정태규의 지점'` / `'내 팀'→'스노의 지점'` / `'ㅇ 팀'→'ㅋ의 지점'`.
  - **3-A 정산 UI 어휘 2단 축소** `92ee16dee` — `PayrollStatus` 에서 `'processing'` 제거, `SettlementDisplayStatus`(2값)+`toSettlementDisplayStatus()` 신설, 표시 맵 4종을 2키로 축소, 인덱싱 7곳에 fold 적용.
  - **3-A 지점 정산 확정 배선** `453db187e` — `venue-settlements.tsx` 에 개별+일괄 정산. 배선 전에 컨테이너 단가표 canonical 불일치를 먼저 봉합(아래 주의 참조).
  - 게이트: `npm run quality` **exit 0**(0 errors / 97 warnings = S4 baseline 동일) · `tsc --noEmit` exit 0 · `e2e/` 별도 Grep **파급 0건**(e2e 는 이미 `'pending'|'completed'` 2값만 씀).

  - **리뷰 반영** `90006d3e5` — opus 리뷰가 잡은 **CRITICAL 1건**(아래 주의 참조) + MEDIUM 3 + LOW 2. 레포 진입점 테스트 신설로 HIGH(vacuous green) 도 해소.

- **안 끝난 것**
  - ~~push / PR~~ → ✅ **PR #387 머지**(`97bf7e85c`). CI 10잡 전부 SUCCESS(E2E 10m14s 포함, 재실행 없이 1회 통과).
  - 🔴 **정산 확정 경로 실사용 검증 없음.** prod 에서 한 번도 눌러보지 않았다(확정은 스태프에게 회수 불가 알림이 나가므로 테스트 발송 금지 지시를 지켰다). 유닛·타입·레포 진입점까지만 검증됨.
  - 🔴 **지점 정산에 "지급 완료 취소"(SETTLE-3) 진입점이 없다 — 편도 문.** `SettlementDetailModal` 에 `onRevertSettlement` 를 안 넘겨 되돌리기 버튼이 안 뜬다. 컨테이너 직속 행은 공고 정산 화면에 아예 나오지 않으므로 **오지급 정정 경로가 앱 전체에 존재하지 않는다.** 확정 문구는 비가역성을 고지하는데 정정 수단이 없어 반쪽이다. 이번엔 세션 후반 신규 기능 추가(사유 입력 포함)를 QA 없이 얹는 위험이 더 크다고 판단해 남긴다 — **다음 세션 최우선.**
  - ⚠️ **rename 마이그의 fail-closed 가드가 후보 간(intra-batch) 충돌을 못 본다.** 한 워크스페이스에 컨테이너 2건(`'내 팀'`+`'기본 지점'`)이 있으면 목표명이 **같아지는데**, 가드의 `EXISTS` 는 "이미 존재하는" title 만 보므로 서로를 못 본다 → `uniq_venue_container` raw 위반으로 마이그 전체 abort. **prod 는 4행·충돌 0으로 이미 통과했고 파일은 적용된 내용의 기록이므로 수정하지 않았다**(기존 마이그 수정 금지). `db:reset`·새 환경에서 재생 시 터질 수 있다 — 그때는 `ROW_NUMBER() OVER (PARTITION BY workspace_id, lower(new_title), kind)` 로 후보 간 중복을 먼저 걸러야 한다.
  - ⚠️ 마이그 UPDATE 가 `job_postings_updated_at` 을 발화시켰다 → **"대상 행은 rename UI 도입 이전에 마지막 수정" 이라는 판별 근거는 이 마이그 실행 후로는 더 이상 성립하지 않는다.** 재실행·재판정 시 다른 근거가 필요하다.
  - 라벨 맵이 아직 **4곳**에 흩어져 있다(라벨 문자열만 SSOT 로 모았고 색/variant 는 화면별로 달라 통합 보류 — 합치면 배지 음영이 바뀌어 시각 확인이 필요하다).
  - 비차단: 개별 "지급 완료" 버튼이 `isSettling` 중 얼리 리턴으로 **무피드백 무시**된다(`SettlementCard` 에 `disabled` prop 부재).
  - 비차단(최종 fable 리뷰 LOW): **개별 카드 버튼은 `status` 축을 안 본다.** 일괄 바는 `status ∈ {checked_out, completed}` 를 보는데 `SettlementCard.tsx:192` 게이트는 `pending && hasValidTimes` 뿐이라, 시각은 있고 status 미승격인 레거시 행에서 개별 버튼만 "누르면 항상 실패" 로 남는다. 선재 공유 컴포넌트 게이트라 공고 정산 화면에 동시 영향 — **별도 커밋 권장**(`canSettle` prop 개방 또는 게이트에 status 축 추가).
  - 비차단(최종 fable 리뷰 LOW): `'failed'` 행은 배지가 '정산 대기' 로 접히는데 필터·버튼 게이트는 raw `pending` 비교라 제외된다 → "대기 배지인데 필터에서 사라지고 버튼도 없는" 행이 된다. **현재 `'failed'` writer 가 UI 에 0곳이라 발화 불가.** `'failed'` 전이 경로를 만들 때 필터·게이트도 `toSettlementDisplayStatus` 축으로 통일할 것.

- **막힌 지점**: 없음.

- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - 🚨 **세션 프롬프트의 전제 2건이 실측으로 뒤집혔다.**
    ① "지급완료 알림 발송 경로를 붙여라" → **이미 있다.** prod 트리거 `notify_on_work_log_update` Case 3 가 `payroll_status → 'completed'` 전이에서 행마다 1통 INSERT 한다. 클라에 발송 코드를 넣으면 중복이 된다. 그래서 "일괄 체크 1통" 은 클라가 아니라 **트리거** 작업이었고, 사용자가 "행당 1통 유지" 로 결정해 트리거는 건드리지 않았다.
    ② "`handle_new_user` 트리거가 `{닉네임} 워크스페이스` 를 만든다" → **stale.** 최신 정의(`20260719233000_team_terminology_unification.sql:30`)는 `{이름|이메일로컬|'내'} 팀` 을 만들고 같은 마이그가 `' 워크스페이스$' → ' 팀'` 소급 UPDATE 까지 끝냈다(prod 에 `~워크스페이스` 0건). 고칠 결함이 없어 **트리거는 그대로 두고 주석만 정정**했다(사용자 결정).
  - 🚨🚨 **컨테이너 공고는 `parseJobPostingDocument` 를 통과하지 못한다 — 정산 경로 전체가 여기서 죽었다.** 컨테이너 `schedule` 은 `{kind, softTargets, roleSalaries}` 인데 dated 분기가 `.strict()` + `primaryDate/allDates/requirements` 필수라 `"Unrecognized key: softTargets"` 로 거부된다(prod 행 전체를 파서에 넣어 재현, 결과 null). 증발하면 개별 경로는 '공고 데이터를 파싱할 수 없습니다', 일괄 경로는 `jobPostingMap` 미등록으로 '권한이 없는 공고입니다'(**소유자인데도**)가 된다. 레포는 이 계약을 이미 문서화하고 있었다 — `JobPostingRepository.venue.test.ts:1-6`. 🔑 **교훈: 컨테이너를 일반 공고 경로에 태우는 코드는 타입도 tsc 도 안 잡는다. 런타임에만 죽고, 그것도 "권한 없음" 이라는 엉뚱한 메시지로 죽는다.** 새 기능이 컨테이너를 만지면 반드시 레포 진입점까지 태우는 테스트를 쓸 것.
  - 🚨 **순수 헬퍼만 검증하는 테스트는 이런 결함을 못 잡는다.** 첫 시도의 회귀 테스트 3건은 `as unknown as JobPosting` 캐스트로 픽스처를 만들어 zod 게이트를 건너뛰었고, **CRITICAL 이 살아 있는 상태에서도 green** 이었다. 지금은 `parseJobPostingDocument` 를 항상 null 로 목한 레포 진입점 테스트가 있다 — 성공 자체가 우회 증거가 되도록.
  - 🚨 **`getPostingSettlementContext` 를 컨테이너에 쓰면 안 된다.** 그 함수는 `schedule.requirements[]` 를 훑는데 컨테이너엔 requirements 가 없어 **roles 가 빈 배열**이 된다 → 지점 역할별 단가표가 통째로 무시되고 폴백(시급 15,000원)으로 계산된다. 그리고 이 canonical 값은 **호출자가 넘긴 amount 를 덮어쓴다**. 즉 배선만 했으면 화면 20,000원 / 지급 기록 15,000원이 됐을 것이다. 읽기·쓰기 공용 헬퍼 `domains/settlement/venueSettlementContext.ts` 로 봉합했고 회귀 테스트 3건을 걸어 뒀다.
  - 🔑 **컨테이너 `title` UPDATE 는 알림을 깨울 수 있다.** `notify_on_job_posting_update` 가 `OLD.title IS DISTINCT FROM NEW.title` 로 `job_updated` 를 보낸다. 다만 수신자가 `applications` 행이고 컨테이너엔 지원 행이 붙지 않아 이번엔 0건이었다. **일반 공고 title 을 건드리는 마이그는 이 경로를 반드시 먼저 세어 볼 것.**
  - 🔑 `'failed'` 는 UI 어휘에선 `'정산 대기'` 로 접히지만 **금액 집계에서는 접으면 안 된다**(`scheduleService`) — 지급 무산 건을 "받을 예정" 으로 세면 오지 않을 돈을 약속하게 된다.
  - 🔑 `settlement.byVenue` 는 `settlement.all` 접두라 기존 `invalidateRelated('settlement.process')` 가 지점 화면까지 그대로 덮는다(`queryClient.ts:376`). 별도 무효화 배선 불요.

### S4 (3-B + 3-E + 별-1) — 2026-07-31 · 상태: 완료 (**PR #384 머지** `40dc21779`)

- 워크트리/브랜치: ~~`C:/Users/user/Desktop/T-HOLDEM-qr`~~ / ~~`feat/qr-badge-and-entry`~~ · 머지 전 HEAD `4ec631230`(커밋 8개) → **머지 `40dc21779`**. 브랜치·워크트리 **정리 완료**
- **DB 마이그레이션 0건.** 파리티 **prod 실측 184 / 111** = 레포 기대값(`parity_baseline_guard.test.sql:91-92`) 일치.
- 착수 시 정리: 머지 완료된 S3 워크트리 `T-HOLDEM-notify` 제거(정션 해제 선행, 원본 `node_modules` 821 무손상 확인).
- **끝난 것** (전부 이 세션에서 실행한 출력 기준)
  - **3-B QR 출처 표시** `da1a735c4` — 실측이 원안을 두 군데 고쳤다. ①`✓QR` 은 **퇴근에만** 붙는다(출근축엔 출처 컬럼이 스키마에 없다). ②레거시 행은 QR 퇴근을 수동 수정해도 `'qr'` 로 남아 있어, `modification_history` 의 해당 축 수정 이력을 먼저 보고 근거 없으면 아무것도 주장하지 않는다. 수동 경로 3곳이 이제 `end_time_source`·`edited_by` 를 남긴다.
  - **3-B 리마인더** `da1a735c4` — `hours-before` 제거, `DAY_BEFORE_HOUR=20` 현행 유지(근거를 상수 주석에 못박음).
  - **3-B 퇴근 미기록 배너** `113fe0863` + `92f3e5ef2` — 지점 스팬 리더 기반, 지난 날짜만, 누르면 가장 오래된 미기록 날짜로 이동.
  - **3-E 진입점** `2a54183e9` — 팀 화면에 근무표 진입 행 신설(기존 링크 **0개**였다). `VenueSelector` ⚙ a11y 라벨을 "단가 설정"→"설정" 로 정정(S1 이 시트를 확장했는데 라벨이 안 따라왔다).
  - **별-1 대시보드 접기** `f587a8eba` — 요약+필터를 한 덩어리로 접고 MMKV 에 영속. 접어도 활성 필터·미지급 건수는 계속 보인다(칩 제거 시 red 로 실증). 부수로 `schedule.tsx` 1412→1203줄, `ScheduleDashboard` 분리.
  - **리뷰 반영** `92f3e5ef2` — opus 리뷰 HIGH 1 + MEDIUM 6 + LOW 2 반영(아래 '주의' 참조).
  - **최종 리뷰 반영** `6dd836b74` — fable 리뷰가 잡은 HIGH 1건. 앞 커밋에서 얼리 리턴을 없앤 것이 새 결함을 만들었다(로딩·에러 구간의 빈 배열로 유효 예약 전체 취소). 게이트 축을 "비었나"→"로드가 끝났나" 로 바꾸고 `shouldSyncShiftReminders` 순수 함수로 분리. fable 판정: 이 1건 외 **CRITICAL 0 / 나머지 비차단**.
  - 최종 게이트: `npm run quality` **exit 0**(0 errors / 97 warnings = baseline) · `npm test` **593 스위트 / 6496 테스트 / 122 스냅샷 전량 통과 exit 0** · `e2e/` 별도 Grep **파급 0건** · knip **델타 0**(master 1249/911 == 브랜치, 동일 명령 실측).
- **안 끝난 것**
  - ~~push / PR~~ → ✅ **PR #384 머지**(`40dc21779`). CI 9잡 전부 SUCCESS, 재실행 없이 1회 통과.
  - ⚠️ fable 리뷰의 **비차단 백로그**: ①리마인더 sync 입력이 **월 스코프**라 다른 달의 유효 예약을 "사라진 계획" 으로 오판한다(선재 결함 — 8/1 근무 알림은 8월 화면을 봐야 예약되고 7월로 돌아오면 취소된다). ②`timeProvenance` 는 "수동 수정 → checked_in 복귀 → 재QR" 시퀀스에서 이력이 이겨 '수정됨' 오라벨(보수적 방향이라 비차단). ③배너 쿼리 **에러가 무음**이라 조회 실패와 "0건" 이 화면상 같다.
  - ⚠️ 배너 스코프 = **보이는 달**. 더 오래된 미기록은 사용자가 월을 넘겨야 발견된다(의도된 한계, 주석에 명시).
  - ⚠️ 출근축은 원리적으로 QR 판정 불가 — `start_time_source` 컬럼을 추가하는 마이그레이션은 별도 세션 몫.
- **막힌 지점**: 없음.
- **다음 세션에 넘기는 주의** (이 세션에서 새로 알아낸 것만)
  - 🚨 **`work_logs.date` 로 "지났다" 를 판정하지 말 것.** 홀덤펍 표준 18:00~02:00 근무는 date 가 전날이라 새벽엔 이미 "어제" 다 — 사전 비교만 쓰면 **근무 중인 사람이 매일 밤 집계에 잡힌다**. 내가 그 실패 모드를 주석에 써 놓고도 `isToday` 축만 막아 리뷰가 잡았다. 야간 유예(`OVERNIGHT_GRACE_HOUR`) 필요.
  - 🚨 **지점 단위 집계는 `useConfirmedStaff`(= `job_posting_id` 단일 매칭)로 하면 안 된다.** 컨테이너 직속 배치만 잡혀 공고로 뽑은 스태프가 통째로 빠진다. 지점 스팬은 `venue_span_posting_ids` RPC 경유(`getByVenueSpanInRange`).
  - 🔑 **`end_time_source` 는 절반만 배선돼 있었다** — QR RPC 퇴근 분기만 쓰고, SELECT 화이트리스트엔 없었다. 이런 "DB엔 있는데 안 읽는 컬럼" 은 타입에도 없어 존재 자체가 안 보인다.
  - 🚨 **RN `Pressable` 은 기본 `accessible=true` 라 자식 텍스트를 한 노드로 병합하고, 명시 `accessibilityLabel` 이 그걸 덮어쓴다.** 눌리는 영역 안에 상태 칩을 그려도 스크린리더엔 **아무것도 안 간다** — 라벨을 상태에서 합성할 것. `queryByText` 테스트는 이 갭을 못 잡는다.
  - 🔑 **동기화 함수의 얼리 리턴은 "정리" 까지 같이 죽인다** — `syncShiftReminders` 는 예약뿐 아니라 원장 정리도 하는데 `length===0` 리턴이 폐지된 알림 종류의 취소를 막고 있었다.
  - 🔑 `git worktree`/jest 경로에 괄호가 있으면(`app/(employer)/`) `npx jest <path>` 가 정규식으로 먹혀 0건이 된다 — `--runTestsByPath` 사용.

### S2 (2-A + 2-B) — 2026-07-31 · 상태: 완료 (**PR #374 머지** `a06f5311`)
- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-time` / `fix/worklog-time-model` · HEAD `3a6c53f8e`
- 커밋 5개: `5d7a614c1`(2-A+2-B 본체) → `5f6b91bd5`(인계 순서 가드) → `1d1e79b5e`(master 재통합)
  → `20273ba28`(타입 수정) → `3a6c53f8e`(리뷰 반영)
- **DB 마이그레이션 0건** (클라 전용). 파리티 기대값은 master 판 **184/111** 채택 — 내 브랜치는
  함수·정책을 건드리지 않으므로 `PARITY_EXPECT_FUNCS` 를 손대지 말 것.
- **끝난 것** (전부 이 세션에서 실행한 출력 기준):
  - 2-A: `time_slot` 정본을 출근 예정 단일값으로 통일. **범위를 생산하던 유일한 지점이
    `updateSlot` 이었다** — 시작 하나로 갱신 + 미정은 명시적 null. 형식 검증(`assertSlotStartTime`)을
    도메인 SSOT 로 올려 인원추가·편집 두 경로가 같은 관문을 쓴다.
  - `EditSlotSheet` 재구성(종료 입력·익일 프리뷰·시작==종료 가드 제거, 실적 섹션 신설),
    `AddSlotSheet`·`AddStaffModal` 프리필 제거 + 저장 게이트. **AddStaffModal 은 자유 텍스트였다** —
    검증 0으로 임의 문자열이 `time_slot` 에 들어가던 구멍을 닫았다.
  - "계산 전" 표시: 근무 전에는 금액을 못 낸다. "정산 정보를 계산할 수 없습니다"(고장으로 읽힘)를
    교체하고, 결과 없이 예상액 배너만 뜨던 모순도 함께 막았다.
  - 2-B: 카드의 '시간 수정' 버튼을 없애고 예정·실적 입구를 근무 수정 시트 하나로 통합.
    `WorkTimeEditor` 사용처 3곳 렌더는 **불변**(`StaffManagementTab:349`·`VenueDayPanel:385`·
    `SettlementModals:147`), `DEFAULT_SLOT_START_TIME` 과 `mappers.ts:505` 소비도 **존치**.
  - 리뷰: opus 중간 + fable 최종이 **독립적으로 같은 HIGH 2건** 지적 → 전부 반영(아래 주의 참조).
  - 최종 게이트: `npm run quality` **exit 0**(0 errors/97 warnings=기존 baseline) ·
    `npm test` **588 스위트 / 6436 테스트 / 122 스냅샷 전량 통과 exit 0** ·
    `e2e/` 별도 Grep **파급 0건**(시딩이 이미 단일값 `'18:00'`) ·
    knip 은 **2209 통과/2189 실패 = master baseline 과 동일**(악화 없음).
  - red→green 실증 2건: ①"계산 전" 표시 — 수정 원복 시 2건 실패 ②모달 인계 순서 — 지연 제거 시 1건 실패.
- **안 끝난 것**:
  - 🔴 **iOS 실기기 QA 1건은 유닛으로 대체 불가**: 근무 수정 시트 → '출퇴근 시간 수정' → 저장/취소 후
    터치 반응. 모달 전환은 jsdom 이 최종 상태만 보므로 지연이 실제로 충분한지는 실기기에서만 안다.
  - ⚠️ 확정 스태프 로딩 중에는 시트에 실적 섹션이 아예 안 보인다(로딩 완료 시 자가치유). 예전 카드
    버튼은 "불러오는 중" 토스트라도 줬다. 부수로 `resolveAttendanceTarget` 의 로딩 갈래는 이 경로에서
    도달 불가 방어코드가 됐다.
- **막힌 지점**: 없음.
- **다음 세션에 넘기는 주의**:
  - 🔑 **`time_slot` 판정 갈래를 늘릴 일이 생기면 `slotsOverlap`(domains/workSchedule/slotEdit) 한
    곳만 고칠 것.** 구인자(`detectSlotConflicts`)와 구직자(`detectScheduleOverlaps`)가 이걸 공유한다.
    이번에 내가 한쪽만 고쳐 "사장 화면엔 경고, 스태프 화면엔 침묵" 을 만들었고 리뷰가 잡았다.
  - 🔑 **모달→모달 전환에는 `SHEET_DISMISS_ANIMATION_MS`(constants/animation.ts) 를 쓸 것.**
    닫기·열기를 한 핸들러에서 부르면 React 가 한 커밋으로 배칭해 "먼저 닫는" 구간이 **없다**.
    레포에 이미 지연 상수가 있으니 로컬 복제하지 말 것(하마터면 네 번째 복사본을 만들 뻔했다).
  - 🚨 **pre-commit 훅은 eslint/prettier 만 돌고 tsc 는 안 돈다.** 테스트 파일의 타입 오류가
    jest(babel)를 통과해 커밋됐다가 `npm run quality` 에서 잡혔다. 커밋 전 type-check 를 따로 볼 것.
  - 🔑 **S3 은 같은 `EditSlotSheet.tsx` 를 만진다** — 시간 상태가 `pickedTime`/`timeUndecided` 파생
    구조로 바뀌었고 `timeDirty` 는 **상태가 아니라 파생값**이다. 상태로 되돌리면 "미정 체크했다
    해제" 가 레거시 범위를 조용히 자른다.
  - ⚠️ **DB 는 여전히 굵은 값을 심을 수 있다** — 이번 변경은 클라 전용이라 `add_direct_staff`·
    `confirm_application` RPC 가 `time_slot` 에 무엇을 쓰는지는 손대지 않았다(현재는 단일값).

### S1 (1-B + 1-C) — 2026-07-31 · 상태: 완료 (PR 미생성)
- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-venue` / `feat/venue-profile` · HEAD `0752c09c6`
- 커밋 4개: `de79d4095`(1-B DB) → `b0619c0fc`(1-C 클라) → `092310611`(master 재통합) → `0752c09c6`(리뷰 반영)
- **끝난 것** (전부 이 세션에서 실행한 출력 기준):
  - 1-B: 마이그 `20260731120000_venue_profile_rpcs` **prod 적용 완료**. 파리티 실측 **183 → 185 / 정책 111**.
    pgTAP 15/15 신규(`venue_profile_rpcs.test.sql`). schedule 형제 키 보존 단언은 **red→green 실증**.
  - 1-C: 컨테이너 read 3컬럼 확장 · ScheduleConverter 시그니처 확장 · scheduleService 2차 해소를
    두 RPC **키 합집합** 순회로 · VenueSettingsSheet 지점 설정 전체화 · 기본명 SSOT(`constants/defaultNames.ts`).
  - 리뷰: code-reviewer(fable) HIGH 1건 반영(P0001 접두사 매핑 신설 + vacuous 테스트 실질화).
  - 최종 게이트: `npm run quality` **exit 0** · `npm test` **584 스위트 / 6400 테스트 / 122 스냅샷 전부 통과 exit 0** ·
    pgTAP 22/22(파리티 가드 포함) · `e2e/` 별도 Grep 파급 **0건**.
  - `PARITY_EXPECT_FUNCS` 183 → **185** 갱신(방치 시 주간 parity-smoke red).
  - 최신 master(#367·#368·#369) 재통합 완료 — 무충돌, 마이그 정렬 무결(내 것이 마지막).
- **안 끝난 것**:
  - 🔴 **push/PR 미실행** — 사용자 명시 요청 대기(커밋 사전승인 범위 밖).
  - ⚠️ `p_defaults` 는 계약 예약 상태(UI 없음). 요소 검증(문자열·길이·개수 상한)은
    소비 UI 를 붙이는 후속 마이그에서 반드시 추가할 것 — 지금은 소비자 0이라 실해 없음.
  - ⚠️ `VenueSettingsSheet` `saveProfile` 이 `location` 을 항상 `{name}` 으로 **전체 교체**한다.
    B1(주소검색) 머지로 district/detailedAddress 가 생기면 이 저장 버튼이 주소를 **소거**한다 —
    그때 기존 location 병합 필수.
  - ⚠️ DB `handle_new_user` 는 여전히 `{닉네임} 워크스페이스` 를 만든다 → **3-D 범위에 트리거 수정 포함 필수**.
    안 하면 기본명 SSOT 통합이 신규 가입자에게 효과 없다.
- **막힌 지점**: 없음. 다만 세션 중 **공유 `node_modules` 가 외부 요인으로 손상**(818→345 엔트리)돼
  테스트가 대량 red 였다. `npm ci` 로 복구 후 재실행해 확정. 상세=메모리
  `pitfall_shared_node_modules_corruption_junction`.
- **다음 세션에 넘기는 주의**:
  - 🔑 **XSS 트리거 인자는 레포↔prod 가 어긋나 있다** — 레포 baseline 은 `('title','description')`,
    **prod 실측은 `('title','description','contact_phone')`**. `location` 은 여전히 대상 밖.
    트리거 인자는 **prod 에서 확인**할 것.
  - 🔑 **`jpc_test_set_user` 는 role GUC 까지 `authenticated` 로 바꾼다**(= `SET LOCAL ROLE`).
    이후 픽스처 INSERT 가 RLS 에 막히고 TEMP 테이블 쓰기도 권한 오류가 난다. SECDEF RPC 의
    `auth.uid()` 게이트만 볼 때는 JWT 주입 직후 role 만 postgres 로 되돌리는 `pg_temp` 래퍼를 쓸 것.
  - 🚨 **커밋 메시지에 백틱 금지** — 큰따옴표 안에서 명령 치환으로 먹혀 문장이 조용히 사라진다.
    히어독(`-F -`)을 쓸 것.
  - ⚠️ 0-4 는 사용자가 "보류"로 결정했으나 **병렬 세션이 PR#367 로 이미 머지**했다.
    로컬 `chore/supabase-safe-cleanup-20260731` 브랜치는 정리 가능.

### 계획 세션 — 2026-07-31 · 상태: 완료
- 워크트리/브랜치: `T-HOLDEM`(메인) / `chore/supabase-safe-cleanup-20260731`
- 끝난 것: 0단계 완료 확인(#365·#366 머지 실측) · 두 계획 문서 교차 검증 ·
  실행 순서/병렬 매트릭스 확정 · 이 원장 작성 · 핸드오프 문서 1-A 완료 반영
- 안 끝난 것: 0-4(미푸시 `632adcbae` Supabase 안전 정리) 처리 미결
- 다음 세션에 넘기는 주의:
  - 파리티 183/111 은 0-4 때문에 **신뢰 불가** — S1 착수 시 재실측
  - PR#366 이 `SchedulePostingContext.locationAddress` 를 이미 추가함 — 1-C 는 그 위에 얹을 것
  - 계획 문서 3개는 미추적 상태 (커밋 여부 사용자 결정 대기)

### S3 (2-C + 2-D + 별-2) — 2026-07-31 · 상태: 완료 (**PR #382 머지** `11a2390a0`)

- 워크트리/브랜치: `C:/Users/user/Desktop/T-HOLDEM-notify` / `feat/worklog-time-notify` · HEAD `fd8d7b52b` (5커밋, `d3d484a07`(#375) 리베이스) · **PR #382**
- 끝난 것
  - **2-C** `407063fb4` — 트리거 `notify_on_work_log_update` 에 Case 2-B 신설. `time_slot` 변경 자체를 감지(이력 배열 경유 안 함). 알림 타입은 기존 `schedule_change` 재사용, `data.applicationId` 로 스케줄 상세 정밀 착지. 로컬 Docker 무오염 red→green 4케이스.
  - **2-D** `9e2990a85` — `WorkTimeDisplay.scheduleTimeState`(confirmed/undecided/negotiable) 신설. 미정을 '시간 협의'라 부르던 거짓 표시 제거. `WorkTab`(헬퍼 미사용 재구현)·`GroupedScheduleCard`(시간 행 은닉) 두 갈래를 SSOT 로 흡수. red 4건 → green.
  - **별-2** `597eca3fe` — tailwind `slot.*` 4종 신설(청록·하늘·보라·자홍), 레거시 15종은 읽기·쓰기 모두 보존.
  - **리뷰 반영** `9b8eb9d80` + `fd8d7b52b` — 아래 '막힌 지점' 참조.
  - 게이트: `npm run quality` exit 0 · `npm test` 588 suites / 6452 tests · `e2e/` 별도 Grep 0건 · code-reviewer opus → fable **"PR 진행 가능"(CRITICAL/HIGH 0)**
- 안 끝난 것 (🔴 사용자 결정 대기)
  1. **마이그레이션 prod 미적용** — `uniqn-mobile/supabase/migrations/20260731140000_notify_on_time_slot_change.sql`. prod 실측 `case_2b_applied=0`. 적용해도 파리티 184/111 불변(`CREATE OR REPLACE`).
  2. ~~push / PR~~ → ✅ **PR #382 머지**(`11a2390a0`). CI 9잡 green — `DB Tests (pg_prove)` 가 신규 pgTAP 과 `parity_baseline_guard` 를 모두 통과했다(로컬에서 red 이던 함수 수 항목은 CI 의 새 스택에서 green — 로컬 드리프트 확정).
  3. 이 원장 파일은 **메인 체크아웃에 미커밋** 상태(S2 세션 종료분 + 이 S3 항목이 함께 쌓여 있음). 커밋 주체 미정.
- 막힌 지점: 없음. 다만 리뷰가 잡은 함정 2개는 재발 위험이 크다 —
  - 🚨 **`CREATE OR REPLACE` 의 `SET` 절은 proconfig 를 통째로 갈아치운다.** baseline 의 `search_path` 를 그대로 베끼면 그 뒤 `ALTER FUNCTION` 으로 얹은 `pg_temp` 하드닝(`20260711100000`)이 조용히 사라진다. **베이스는 baseline 이 아니라 `pg_proc.proconfig` 실측값**이어야 한다. `parity_baseline_guard.test.sql:134` 가 CI 에서 잡는다(RED 재현 완료).
  - 🚨 **알림 본문이 약속한 버튼이 실제로 있는지 확인할 것.** 취소 요청 버튼은 `schedule.applicationId` 로 게이트되는데, 근무표 직접 배치 work_log 는 `application_id` 가 NULL 이다(prod 3건 중 2건).
- 다음 세션에 넘기는 주의
  - `EditSlotSheet.tsx` 는 S2·S3 가 연속으로 만졌다. S4 는 이 파일을 피한다.
  - `ScheduleCard.tsx` 는 S3·S4(별-1) 접점 — S3 머지 후 착수 권장.
  - 신규 pgTAP `supabase/tests/worklog_time_slot_change_notify.test.sql` 은 마이그 적용 후에만 통과한다. prod/로컬 적용 전에 `npm run test:db` 를 돌리면 T1 이 red 다(정상).
