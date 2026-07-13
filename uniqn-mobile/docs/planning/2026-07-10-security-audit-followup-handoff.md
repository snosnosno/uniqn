# 핸드오프 — 보안 감사 후속 4종 (다음 세션 메인 프롬프트)

> 2026-07-10 RLS/SECDEF 감사(PR #235) 후속. 감사 보고서 `docs/analysis/2026-07-10-rls-secdef-parity-security-audit.md`, 정합화 계획 `docs/planning/2026-07-10-prod-repo-schema-reconciliation-plan.md`, 메모리 `project_rls_secdef_audit_20260710`·`pitfall_prod_repo_schema_drift_massive`.

## ✅ 진행 상태 (2026-07-11 세션 종료 시점)

- **① PR #235 ✅머지**(squash `63d92dc9d`). `/review` 1회 + prod 라이브 독립검증(하드닝 6종 실측 일치). Sentry redact 신규검토로 **과잉마스킹 3건(RRN=epoch-ms·PHONE 부분매치·EMAIL @2x 에셋) 제거 + 누락 3건(cookies 복수형·ip_address/geo·device.name) 보강** — 46/46 GREEN. 워크트리 `T-HOLDEM-audit` 정리 완료(물리 디렉터리는 busy로 잔존, 재시도 필요).
- **② Sentry redact OTA ✅배포**(update group `391367bc-aa9c-4115-9851-ac59689f1735`, `Commit=e26553d4d` = master HEAD). ⚠️#222(weekly-grid)가 그새 master 머지돼 함께 배포됨(사용자 승인). tsc0·jest 399스위트/4989 통과. PortOne fallback 정상(빈값 아님)·EAS prod env(supabaseUrl=prod 일치) 실측. **잔여=사용자: Sentry 대시보드에서 실오류 1건 발생시켜 마스킹+event_id/trace_id 원본유지 눈으로 확인.**
- **③ ✅완료·prod 적용·PR #236 머지**(squash `983d91b9d`). **핸드오프의 ③-A 전제가 틀렸음을 실측으로 반증**: sync_schedule_board는 "정상 클라 호출"이 아니라 **앱 RPC 호출 0건 + Edge Function(service_role) 전용**. 근본원인은 auth.uid() 무검증이 아니라 **20260621090000 일괄 GRANT가 권한 확대**(원래 authenticated 없던 함수에 부여). → 소유권 가드 대신 **authenticated REVOKE로 원계약(service_role only) 복원**(마이그 `20260710020000`). 나머지 31함수 전수검증(오탐 2 기각). +③-B rate_limit 형제 2개 authenticated 회수(`20260710030000`, check_user_rate_limit와 일관화). +board_comments_select_all 블랭킷 DROP(재빌드 누수 차단, prod no-op). prod red-green 전건 + cron 무회귀 실증(적용 35초 뒤 succeeded).
- **④ 착수 가능(전제 충족)**: 열린 PR **0건** 확인(#222·#233·#235·#236 전부 머지). 사전점검 완료 — 아래 §④ 참조.

---

## ⚠️ 착수 전 필수 (매 세션)

1. `git status` — 내가 만들지 않은 미커밋 변경 있으면 새 워크트리+브랜치 격리(병렬 세션 활발함: #222·#233 진행 중).
2. **모든 DB 주장은 prod 라이브 실측**(`mcp__supabase__execute_sql`로 pg_proc/pg_policies/has_function_privilege). 로컬 `db reset`은 prod와 다른 형상(거짓 GREEN) — 로컬 GREEN을 prod 증거로 쓰지 말 것. 근거=`pitfall_prod_repo_schema_drift_massive`.
3. Supabase 마이그는 MCP `apply_migration` 전용(db push 금지). 기존 마이그 수정 금지, `IF EXISTS`/존재가드 방어.

---

## ① PR #235 리뷰·머지

- **현 상태(2026-07-10)**: `chore/security-audit-sweep`, 12커밋, **MERGEABLE/CLEAN**(CI green). DB 하드닝 6종은 이미 prod 적용·검증됨(마이그 `20260710000000`~`000400`) → 이 PR은 저장소 정합 + 앱코드(Sentry).
- 할 일: CI 재확인 → `/review` 또는 코드리뷰 1회(특히 Sentry redact 정규식 과잉마스킹 재확인 — 이미 hex·name 2건 수정했으나 신규 눈으로) → 머지.
- 머지 후: 워크트리 `T-HOLDEM-audit` 정리(`git worktree remove`), 로컬 Supabase 스택 정리 판단.

## ② Sentry redact OTA 배포

- **전제**: ①(#235) 머지 완료. Sentry 하드닝은 앱코드(JS만, 네이티브 무변경) → OTA로 즉시 반영 가능.
- **배치 권장**: OTA 대기 중인 다른 JS 변경과 함께 1회 배포(평점/리뷰 #208, weekly-grid #222 머지 시 등). `eas update` — ⚠️함정 `pitfall_eas_update_shell_env_not_loaded`(shell env만 평가, eas.json env 무시) 준수.
- **검증**: 배포 후 실 오류 1건 발생시켜 Sentry 대시보드에서 이메일/토큰/전화 `[EMAIL]`/`[JWT]`/`[PHONE]` 마스킹 + `event_id`/`trace_id` **원본 유지**(과잉마스킹 회귀 없음) 실측.

## ③ sync_schedule_board 소유권 가드 + pg_temp 27함수 (별도 마이그)

### ③-A sync_schedule_board(p_job_posting_id) [MED]

- 문제: auth.uid() 무검증 SECDEF → 인증된 임의 사용자가 임의 posting 재동기화 트리거(권한상승·유출은 없음, 삽입 신원은 실제 work_logs 기반 = 리소스 넛지).
- **정상 클라 호출 함수**(`src/services/jobs/jobManagementService.ts` + edge `sync-schedule-board-outbox`) → **REVOKE 금지**. 소유권 가드 추가:
  - 본문 상단에 posting 관리권한 검증(공고 owner/workspace_member/collaborator/admin). 기존 `confirm_application`류 패턴 참조.
  - ⚠️prod 현행 본문 기준 `CREATE OR REPLACE`(파리티 드리프트 — prod `pg_get_functiondef` 실측 후). edge(service_role) 경로는 auth.uid() NULL이라 가드 통과하도록 설계(service_role 예외 OR 분기).
  - **sync 흐름 회귀 테스트 필수**(정상 소유자 호출 GREEN + 비소유자 RAISE). pgTAP red-green + jest jobManagementService.
- prod red-green 후 적용.

### ③-B search_path pg_temp 누락 27함수 [LOW, ~0 exploit]

- `search_path=public`만 있고 pg_temp 미명시(temp-table shadowing 이론). Supabase PostgREST에서 authenticated 임의SQL 채널 부재로 실질 악용 ~0.
- **권장: ④ 파리티 baseline 정합 시 일괄 처리**(27함수 개별 `CREATE OR REPLACE`는 파리티 드리프트를 더 벌림). 단독 진행 시 prod 본문 실측 후 `SET search_path = public, pg_temp`로 재정의.
- 목록: 감사 보고서 §2-c + lens-authed 결과(cancel_application_atomically·confirm_application이 스키마-미명시 참조 최다 = 이론상 최대 노출).

## ④ 파리티 baseline 정합 (prod 덤프 squash) — **착수 가능, 다음 세션 권장**

### 사전점검 결과 (2026-07-11)

- **전제 충족**: 열린 PR 0건 확인(#222·#233·#235·#236 전부 머지).
- **환경 실현 가능**: Docker 29.3.1 가용, 로컬 스택 `supabase_db_uniqn` 실행 중이나 **PG 15.8.1** (config.toml `major_version=15`) → ④는 이걸 **17.6으로 상향** 필요. supabase CLI 2.109.1.
- **prod 대조군 실측(2026-07-11)**: 함수 **163** · RLS 정책 **103** · PG **17.6**. baseline 재기록 후 로컬이 이 카운트와 일치해야 함(파리티 회귀 가드 단언 값).
- **pg_temp 누락 SECDEF 함수 = 63개**(감사 시점 "27함수"에서 재측정 상향). baseline 덤프 시 `SET search_path = ..., pg_temp` 일괄 반영 대상. ⚠️LOW·~0 exploit(PostgREST에 authenticated CREATE TEMP 채널 부재).
- **왜 다음 세션인가**: 정합화 계획 문서가 "별도 세션 실행용"으로 명시. PG17 스택 상향+240마이그 아카이브+baseline 재기록+migration repair는 비가역 재구조화라 신선한 컨텍스트 권장. 이 세션은 ①②③로 이미 진행됨.

### 전제·계획(원본)

- **전제(동결)**: 진행 중 PR **#222(weekly grid)·#233(ops wiki)·#235(이 감사)·#236(③)** 전부 머지 완료 = 마이그 히스토리 확정. ✅2026-07-11 `gh pr list --state open` 0건 확인.
- 정본 계획: `docs/planning/2026-07-10-prod-repo-schema-reconciliation-plan.md`(Option B, 7단계). 핵심:
  1. PG17 로컬 스택(현 dev 15.8 → prod 17.6 정합).
  2. prod `pg_dump --schema-only --schema=public`(RLS·GRANT·함수 보존) 읽기 덤프.
  3. 기존 240 마이그 `archive/` 이동 + 덤프를 baseline 1개로 재기록.
  4. `db reset` 후 로컬 형상 == prod 카운트(함수163·정책103) pgTAP 단언(파리티 회귀 가드 신설).
  5. `migration repair` 원격 정합 + CI 카운트 스모크.
- ⚠️재빌드 보안퇴행 2건 제거 확인(`action_logs_insert_any`·`notifications_insert_service` gen-1) + `decrement_unread_counter` 오버로드 모호성(42725) 정리.
- **다운타임 0**(prod 무변경, 덤프는 읽기).

---

## 순서·범위

- ✅①②③ 완료. **남은 건 ④ 하나** — 사전점검까지 끝났고 실행만 다음 세션에서.
- ④ 착수 시 **③-B pg_temp 63함수(재측정)를 baseline 덤프에 일괄 포함**. 개별 CREATE OR REPLACE는 파리티 드리프트를 더 벌리므로 금물.
- 인접 작업 주의: `project_userflow_audit_20260710`(다른 세션)이 **work_logs 보호트리거 P0 CRITICAL**을 별도 적발 → **P0#1은 이미 prod 적용**(마이그 `20260710010000_wl_update_revoke_staff_self`, 커밋 `729b7d14f`). 워크트리 `T-HOLDEM-authority`(브랜치 `analysis/userflow-audit-20260710`)가 그 세션 소유 — ④ baseline 덤프는 이 세션의 마이그까지 prod에 반영된 뒤 떠야 파리티가 정확. 착수 전 그 브랜치 미머지 마이그 유무 재확인.
- ③에서 발견해 baseline에 반영할 재빌드 보안퇴행 **3건**(원래 2건 + 신규): `action_logs_insert_any`·`notifications_insert_service`·**`board_comments_select_all`**(USING true 블랭킷, `20260710020000`이 DROP했으나 base_schema에 CREATE 잔존 → baseline 덤프가 근본 해소).
