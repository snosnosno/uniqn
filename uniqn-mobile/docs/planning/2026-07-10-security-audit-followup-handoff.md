# 핸드오프 — 보안 감사 후속 4종 (다음 세션 메인 프롬프트)

> 2026-07-10 RLS/SECDEF 감사(PR #235) 후속. 감사 보고서 `docs/analysis/2026-07-10-rls-secdef-parity-security-audit.md`, 정합화 계획 `docs/planning/2026-07-10-prod-repo-schema-reconciliation-plan.md`, 메모리 `project_rls_secdef_audit_20260710`·`pitfall_prod_repo_schema_drift_massive`.

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

## ④ 파리티 baseline 정합 (prod 덤프 squash)

- **전제(동결)**: 진행 중 PR **#222(weekly grid)·#233(ops wiki)·#235(이 감사)** 전부 머지 완료 = 마이그 히스토리 확정. `gh pr list --state open`으로 0건 확인 후 착수.
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

- ①②는 즉시(#235 머지 → OTA). ③-A는 독립 가능(소유권 가드). ③-B·④는 함께(baseline 정합 시 pg_temp 일괄).
- 인접 작업 주의: `project_userflow_audit_20260710`(다른 세션)이 **work_logs 보호트리거 P0 CRITICAL**(payroll 4컬럼만 막아 스태프가 check_in_ts 자기 PATCH 가능)을 별도 적발 — DB 보안 후속과 겹칠 수 있으니 착수 전 그 브랜치(`analysis/userflow-audit-20260710`) 상태 확인. 소유권 판정함수 통합(userflow P0#3)과 ③-A sync 가드가 같은 권한모델을 건드림 → 조율 권장.
