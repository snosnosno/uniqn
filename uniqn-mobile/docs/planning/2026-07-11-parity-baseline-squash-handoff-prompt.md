# 핸드오프 프롬프트 — ④ prod↔repo 파리티 baseline squash (다음 세션 메인)

> 2026-07-10 RLS/SECDEF 감사 후속의 **마지막 남은 4번**. ①②③은 완료(PR #235·#236 머지, OTA 배포).
> 이 프롬프트만으로 새 세션에서 착수 가능. 정본 3종을 먼저 정독하라.

---

## 착수 전 필수 (매 세션)

1. `git status` — 내가 만들지 않은 미커밋 변경 있으면 새 워크트리+브랜치 격리. 병렬 세션 활발:
   워크트리 `T-HOLDEM-authority`(브랜치 `analysis/userflow-audit-20260710`)·`.claude/worktrees/ux-flow-review-20260710`이 **다른 세션 소유** — 절대 건드리지 말 것.
2. **모든 DB 주장은 prod 라이브 실측**(`mcp__supabase__execute_sql`로 pg_proc/pg_policies/has_function_privilege).
   로컬 `db reset`은 prod와 다른 형상(거짓 GREEN) — 로컬 GREEN을 prod 증거로 쓰지 말 것.
   근거 메모리=`pitfall_prod_repo_schema_drift_massive`.
3. Supabase 마이그는 MCP `apply_migration` 전용(db push 금지). 기존 마이그 수정 금지, `IF EXISTS` 방어.
4. **위험·비가역 작업이므로 `/guard` 먼저** — 편집 경계를 작업 워크트리로 잡고 파괴적 명령 경고 켜기.

## 정본 문서 (먼저 정독)

- 정합화 계획(Option B 7단계): `docs/planning/2026-07-10-prod-repo-schema-reconciliation-plan.md`
- 감사 보고서(파리티 실측 근거): `docs/analysis/2026-07-10-rls-secdef-parity-security-audit.md`
- 상위 핸드오프(①②③ 완료 기록): `docs/planning/2026-07-10-security-audit-followup-handoff.md`
- 관련 wiki: `wiki/decisions/migration-timestamp-collision.md`

## 왜 하나 (문제)

prod DB와 repo 마이그레이션이 대규모 발산 → 로컬 pgTAP/db-tests가 prod를 대표 못 하고, 신규 마이그가
prod 실상태를 전제 못 해 깨질 수 있다. 로컬이 prod보다 **느슨한** 테이블 다수(gen-1 정책 부활).

## 전제 — ✅충족 (2026-07-11 확인)

- 열린 PR **0건**(#222·#233·#235·#236 전부 머지). 마이그 히스토리 확정.
- ⚠️단, `analysis/userflow-audit-20260710`(다른 세션)에 **미머지 마이그가 있을 수 있음**(P0#1 `20260710010000`은 prod 적용됐으나 브랜치 미머지일 가능성). **baseline 덤프 직전 그 브랜치의 prod 미반영 마이그 유무를 반드시 재확인** — 안 그러면 baseline이 그 마이그를 놓쳐 다시 발산한다.

## 사전점검 결과 (2026-07-11 실측)

| 항목                     | 값                                                                          |
| ------------------------ | --------------------------------------------------------------------------- |
| prod public 함수         | **163**                                                                     |
| prod RLS 정책            | **103**                                                                     |
| prod PG 버전             | **17.6** (aarch64)                                                          |
| 로컬 스택                | `supabase_db_uniqn` 실행 중, **PG 15.8.1** (config.toml `major_version=15`) |
| Docker                   | 29.3.1 가용                                                                 |
| supabase CLI             | 2.109.1                                                                     |
| pg_temp 누락 SECDEF 함수 | **63개** (감사 시점 "27"에서 재측정 상향)                                   |

→ baseline 재기록 후 로컬 `db reset` 결과가 **함수 163·정책 103**과 일치해야 한다(파리티 회귀 가드 단언값).

## 실행 단계 (Option B, 정합화 계획 §3)

1. **동결 확인**: `gh pr list --state open` 0건 + userflow-audit 브랜치 미반영 마이그 유무 재확인.
2. **PG17 로컬 스택**: `supabase/config.toml` `major_version = 15 → 17`. `supabase stop && supabase start`로 PG17.6 정합(prod와 메이저 일치, functiondef 포맷 동일화).
3. **prod 덤프**(읽기 전용): `pg_dump --schema-only --schema=public`(RLS·GRANT·함수 보존). anon/authenticated/service_role GRANT 보존 확인. prod 연결 문자열 필요(사용자에게 `! ` 프리픽스로 요청하거나 env 확인).
4. **아카이브**: `git mv supabase/migrations/*.sql supabase/migrations/archive/`(240개, 히스토리 보존·재실행 제외). knip/CI가 archive 제외하는지 확인.
5. **baseline 재기록 + 검증**: 덤프를 단일 `<ts>_baseline_from_prod.sql`로. `db reset` → 로컬 형상 == prod 카운트(함수163·정책103) pgTAP 단언(파리티 회귀 가드 신설). pg_temp 63함수는 이 덤프에 이미 반영됨.
6. **원격 repair**: `supabase migration list` drift 확인 후 `supabase migration repair --status applied`.
7. **CI 가드 신설**: "prod 함수/정책 카운트 == 로컬 카운트" 스모크로 재발산 조기경보.

## baseline이 근본 해소하는 것 (재빌드 보안퇴행 3건)

`db reset`/신환경 재빌드가 prod엔 없는 gen-1 정책을 되살린다. baseline squash가 제거:

- **`action_logs.action_logs_insert_any`** — `WITH CHECK (true)` = 누구나 감사로그 위조. prod=deny.
- **`notifications.notifications_insert_service`** — 수신자 바인딩 없이 인증 아무나 타인에게 알림 위조. prod=deny.
- **`board_comments.board_comments_select_all`** — `USING (true)` 블랭킷. ③(`20260710020000`)이 DROP 마이그를 넣었으나 base_schema에 CREATE가 남아 재빌드가 되살림 → baseline이 근본 제거. (③에서 pgTAP `sync_schedule_board_service_role_only.test.sql` 4번째 단언이 이 부재를 검사 중.)

## 오버로드 모호성 (baseline 재기록 시)

`decrement_unread_counter` prod에 `(uuid)`·`(uuid,integer)` 2종 공존. 단일인자 호출 시 `function is not unique`(42725)
가능. baseline 재기록 시 잉여 `(uuid)` 제거 또는 호출부 2-인자 고정 검토. (③에서 두 오버로드 모두 authenticated
회수됨 = 클라 트리거 표면은 이미 닫힘, service_role 경로만 잔존.)

## 완료 게이트

- prod 무변경 확인(덤프는 읽기, 다운타임 0).
- 로컬 `db reset` 후 함수163·정책103 pgTAP GREEN.
- CI 9종 green + 파리티 스모크 신설.
- 완료 주장 전 실행 증거(카운트 일치 출력·pgTAP·CI) 필수. "될 것"·"통과할 듯" 금지.

## fable 금지

설계·검증·종합에 fable 쓰지 말 것(`pitfall_fable_arithmetic_unreliable`). 파리티 카운트 대조는 prod 라이브 실측으로 직접.
