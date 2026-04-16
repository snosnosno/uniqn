# UNIQN 실행 세션 가이드 (병렬 진행 포함)

> 작성일: 2026-04-14
> 입력: `EXECUTION-PLAN.md`의 23개 task
> 결과: ~14개 세션 / 6 wave / 3개 wave 병렬 가능
> 사용법: 위에서 아래로 wave 순서대로 진행. 같은 wave 내 세션은 git worktree로 병렬 가능.

---

## 0. 사전 준비 (1회만)

```bash
# 1. main 브랜치 깨끗한 상태 확인
cd C:/Users/user/Desktop/T-HOLDEM
git status   # working tree clean
git pull origin master

# 2. Supabase MCP 접근 확인 (Wave 1에서 필요)
# Claude Code에서 mcp__supabase__list_migrations 호출 가능 여부 확인

# 3. 세션 가이드 + 실행 계획 참조 준비
ls docs/qa/2026-04-14/
```

---

## 1. 전체 세션 맵

| Wave | 세션 수 | 병렬? | 총 사이즈 | 핵심 의존성 |
|------|---------|------|----------|------------|
| **W0 Quick Win** | 1 | - | 30분 | 없음 |
| **W1 RPC 회수** | 4 | ✅ 4-way 병렬 | 1일 (병렬 시 4시간) | Supabase MCP |
| **W2 RLS 강화** | 1 | ✅ W1과 병렬 | 30분 | 없음 |
| **W3 Atomicity** | 3 | ✅ 3-way 병렬 | 3일 (병렬 시 1일) | W1 (T-A1) 일부 |
| **W4 e2e 이주** | 1 | - | 2일 | W1, W3 완료 권장 |
| **W5 e2e 작성** | 4 | ✅ 4-way 병렬 | 1-2일/세션 | W3, W4 |
| **W6 백로그** | 2 | - | - | - |

**총 추정**: 순차 진행 시 약 2-3주 / 병렬 활용 시 1-1.5주

---

## 2. Git Worktree 병렬 전략

병렬 가능한 wave (W1, W3, W5)는 git worktree로 격리해서 동시 작업.

### Worktree 생성 패턴

```bash
# Wave 1 예시: 4개 worktree 생성
cd C:/Users/user/Desktop/T-HOLDEM
git worktree add ../T-HOLDEM-w1a -b session/w1-1-auth-rpc
git worktree add ../T-HOLDEM-w1b -b session/w1-2-account-edge
git worktree add ../T-HOLDEM-w1c -b session/w1-3-notification-edge
git worktree add ../T-HOLDEM-w1d -b session/w1-4-stats-rpc

# 각 worktree에서 Claude Code 새 세션 시작
# 작업 완료 후 PR → main 머지 → worktree 정리
git worktree remove ../T-HOLDEM-w1a
```

### 병렬 작업 시 주의사항

- **다른 파일을 수정하는 task만 병렬 가능** (file conflict 방지)
- Wave 1: 모두 다른 마이그레이션 파일 → 안전
- Wave 3: 다른 RPC + 다른 Repository → 안전
- Wave 5: 다른 e2e spec 파일 → 안전
- **마이그레이션 timestamp 충돌 주의**: 각 세션이 commit 직전 최신 main rebase 후 timestamp 재발급

---

## 3. Wave 0 — Quick Win (1 세션, 30분)

### Session W0
**목적**: P0 1-line bug 3건 즉시 수정
**브랜치**: `fix/qa-quick-win`
**의존성**: 없음
**병렬**: 단독

```bash
git checkout -b fix/qa-quick-win
# Claude Code 세션 시작
```

**시작 프롬프트**:
```
@docs/qa/2026-04-14/EXECUTION-PLAN.md §1 P0 Quick Wins 적용:
- T-C1: EventQRRepository.ts:28에 assignment_group_id, time_slot 추가
- T-C2: AdminRepository.ts:37에 last_login_at 추가
- T-C3: templateService.ts:29-31의 Firebase permission-denied 분기 3줄 제거

세 파일 수정 후:
1. cd uniqn-mobile && npm run quality
2. cd uniqn-mobile && npm test -- EventQRRepository AdminRepository templateService
3. 단일 commit (메시지: "fix(repo): EventQR/Admin 컬럼 누락 + templateService Firebase 잔재 제거")
4. PR 생성 (gh pr create)
```

**완료 조건**: PR 머지 + main에 반영
**다음**: W1 또는 W2로 이동

---

## 4. Wave 1 — RPC/Edge Function 회수 (4 세션 병렬, 각 4시간)

### 사전 작업

```bash
# 4개 worktree 생성
cd C:/Users/user/Desktop/T-HOLDEM
git worktree add ../T-HOLDEM-w1a -b session/w1-1-auth-rpc
git worktree add ../T-HOLDEM-w1b -b session/w1-2-account-edge
git worktree add ../T-HOLDEM-w1c -b session/w1-3-notification-edge
git worktree add ../T-HOLDEM-w1d -b session/w1-4-stats-rpc
```

### Session W1.1 — Auth + Confirmation RPC
**Worktree**: `../T-HOLDEM-w1a`
**대상**: T-A1 (4 RPC: check_email_exists, check_nickname_exists, check_phone_exists, confirm_application)

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-a-server-contracts.md §2.1~2.4 참조.

T-A1: 4개 auth/confirmation RPC 회수.

단계:
1. mcp__supabase__execute_sql로 운영 환경 정의 회수:
   SELECT proname, pg_get_function_arguments(oid), pg_get_functiondef(oid)
   FROM pg_proc
   WHERE proname IN ('check_email_exists','check_nickname_exists','check_phone_exists','confirm_application');

2. 회수 결과를 supabase/migrations/20260414xxxxxx_recover_auth_application_rpcs.sql로 저장

3. 회수 안 된 함수가 있다면 team-a-server-contracts.md의 expected contract로 신규 작성

4. SQL 단위 테스트 (해피 패스 + 권한 + idempotency)

5. mcp__supabase__list_migrations로 적용 확인

6. commit + PR
```

### Session W1.2 — Account/Identity Edge Function
**Worktree**: `../T-HOLDEM-w1b`
**대상**: T-A2 (1 RPC + 3 Edge: register_as_employer, revoke-apple-token, verify-portone-identity, verify-and-save-portone-profile)

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-a-server-contracts.md §2.5, §3.3, §3.5, §3.6 참조.

T-A2: 1 RPC + 3 Edge Function 회수.

단계:
1. register_as_employer는 SQL로 회수 (W1.1과 동일 패턴, 별도 마이그레이션 파일)

2. Edge Function 회수:
   mcp__supabase__list_edge_functions
   mcp__supabase__get_edge_function(function_slug='revoke-apple-token')
   동일하게 verify-portone-identity, verify-and-save-portone-profile

3. supabase/functions/<name>/index.ts 디렉토리 신규 생성하여 저장

4. deno.json + import_map.json 필요시 작성

5. commit + PR
```

### Session W1.3 — Notification Counter Edge Function
**Worktree**: `../T-HOLDEM-w1c`
**대상**: T-A3 (3 Edge: reset-unread-counter, decrement-unread-counter, initialize-unread-counter)

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-a-server-contracts.md §3.1, §3.2, §3.4 참조.

T-A3: 3개 notification Edge Function 회수.

W1.2와 동일한 회수 패턴. 모두 supabase/functions/<name>/index.ts에 저장.

commit + PR
```

### Session W1.4 — Stats / Increment RPC
**Worktree**: `../T-HOLDEM-w1d`
**대상**: T-A4 (4 RPC: increment_view_count, increment_announcement_view_count, increment_template_usage, get_job_posting_stats)

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-a-server-contracts.md §2.6~2.9 참조.

T-A4: 4개 stats/increment RPC 회수.

W1.1과 동일한 SQL 회수 패턴. 별도 마이그레이션 파일.

commit + PR
```

### Wave 1 완료 후

```bash
# 4개 PR 머지 후
git worktree remove ../T-HOLDEM-w1a
git worktree remove ../T-HOLDEM-w1b
git worktree remove ../T-HOLDEM-w1c
git worktree remove ../T-HOLDEM-w1d

cd C:/Users/user/Desktop/T-HOLDEM
git pull origin master
mcp__supabase__list_migrations  # 4개 신규 마이그레이션 확인
```

---

## 5. Wave 2 — Announcement RLS 강화 (1 세션, W1과 병렬 가능)

### Session W2
**브랜치**: `feat/announcement-rls-strengthen`
**병렬**: W1과 동시 진행 가능 (다른 파일)

```bash
git worktree add ../T-HOLDEM-w2 -b feat/announcement-rls-strengthen
```

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-e-security-rls.md §4.1 참조.

T-E1 + T-E2: Announcement RLS 정책 강화.

단계:
1. 신규 마이그레이션 supabase/migrations/20260414xxxxxx_strengthen_announcements_rls.sql 작성
   - team-e-security-rls.md §4.1의 SQL을 마이그레이션으로 적용
   - DROP POLICY existing + CREATE POLICY new

2. mcp__supabase__apply_migration으로 적용

3. SQL 검증: admin/staff/employer 3개 role로 SELECT 후 결과 비교
   (target_audience 필터링 작동 확인)

4. 클라이언트 코드 정리:
   - uniqn-mobile/src/repositories/supabase/AnnouncementRepository.ts:145-153의 클라이언트 .filter() 제거
   - 이제 RLS가 처리하므로 불필요

5. npm run quality && npm test -- AnnouncementRepository

6. commit + PR
```

---

## 6. Wave 3 — Atomicity RPC (3 세션 병렬, 각 1일)

**전제**: W1.1 (T-A1) 완료 — confirm_application 회수가 끝나야 cancel/QR과 일관된 패턴 적용 가능

### 사전 작업

```bash
git worktree add ../T-HOLDEM-w3a -b feat/cancel-application-atomic
git worktree add ../T-HOLDEM-w3b -b feat/qr-checkin-atomic
git worktree add ../T-HOLDEM-w3c -b feat/board-sync-outbox
```

### Session W3.1 — cancel_application_atomically
**Worktree**: `../T-HOLDEM-w3a`
**대상**: T-B1, T-B2, T-B3

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-b-atomicity-spec.md §2 참조.

T-B1+B2+B3: cancel_application_atomically RPC + 클라이언트 교체 + 회귀 테스트.

단계:
1. supabase/migrations/20260414xxxxxx_add_cancel_application_atomically.sql 신규 작성
   - team-b-atomicity-spec.md §2.3의 PL/pgSQL 함수 정의 그대로 적용
2. mcp__supabase__apply_migration

3. SQL 단위 테스트 (해피 4종 + 권한 + idempotency)

4. 클라이언트 교체:
   - ApplicationRepositoryTransactions.ts:218-303 → RPC 호출 1줄
   - 동 :475-541 → RPC 호출 1줄
   - 헬퍼 :407-458, :460-473 제거

5. 회귀 테스트 작성:
   - 동시 confirm + 취소 race
   - 네트워크 timeout 후 retry (idempotency)
   - orphan work_log 검사

6. npm run quality && npm test

7. commit + PR
```

### Session W3.2 — process_qr_checkin_atomically
**Worktree**: `../T-HOLDEM-w3b`
**대상**: T-B4, T-B5, T-B6

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-b-atomicity-spec.md §3 참조.

T-B4+B5+B6: process_qr_checkin_atomically RPC + 클라이언트 교체 + 회귀.

단계:
1. supabase/migrations/20260414xxxxxx_add_process_qr_checkin_atomically.sql 신규 작성
   - team-b-atomicity-spec.md §3.3의 PL/pgSQL 함수 그대로 적용

2. mcp__supabase__apply_migration

3. SQL 단위 테스트 (check-in 해피, check-out 해피, payroll 완료 후 차단, staff_id 불일치)

4. 클라이언트 교체:
   - WorkLogRepositoryTransactions.ts:185-348 → RPC 호출 1줄

5. 회귀 테스트:
   - 동시 check-in race
   - payroll 완료 후 check-in 차단
   - 음수 work_duration 방지

6. npm run quality && npm test -- WorkLogRepositoryTransactions

7. commit + PR
```

### Session W3.3 — Schedule Board Outbox 패턴
**Worktree**: `../T-HOLDEM-w3c`
**대상**: T-B7, T-B8, T-B9, T-B10

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-b-atomicity-spec.md §4 참조.

T-B7+B8+B9+B10: Schedule board outbox 패턴 도입.

단계:
1. supabase/migrations/20260414xxxxxx_add_schedule_board_sync_outbox.sql
   - outbox 테이블 + RLS (service_role only)

2. uniqn-mobile/src/services/jobs/jobManagementService.ts 수정:
   - syncScheduleBoardSafely 함수 제거 (line 20-33)
   - createJobPosting (46-66), updateJobPosting (68-92), deleteJobPosting (94-111),
     closeJobPosting (113-130), reopenJobPosting (132-149), bulkUpdateJobPostingStatus (166-199)
     모두 outbox insert로 교체

3. supabase/functions/sync-schedule-board-outbox/index.ts 신규 작성
   - 30초 polling, 3회 재시도, 영구 실패 시 alert

4. mcp__supabase__deploy_edge_function

5. 모니터링: outbox status query + Sentry alert (선택)

6. npm run quality && npm test -- jobManagementService

7. commit + PR
```

### Wave 3 완료 후

```bash
# 3개 PR 순차 머지 (마이그레이션 timestamp 충돌 가능 → main rebase 후 머지)
git worktree remove ../T-HOLDEM-w3a
git worktree remove ../T-HOLDEM-w3b
git worktree remove ../T-HOLDEM-w3c

cd C:/Users/user/Desktop/T-HOLDEM
git pull origin master
```

---

## 7. Wave 4 — e2e Firebase 이주 (1 세션, 2일)

**전제**: W1, W3 완료 (이주 후 새 RPC들이 e2e에서 호출 가능해야 함)

### Session W4
**브랜치**: `chore/e2e-supabase-migration`
**병렬**: 단독 (다른 e2e 작업과 겹침)

```bash
git worktree add ../T-HOLDEM-w4 -b chore/e2e-supabase-migration
```

**시작 프롬프트**:
```
@docs/qa/2026-04-14/team-d-coverage-matrix.md §6 + team-c-bug-inventory.md §5 참조.

T-D1+D2+D3: e2e Firebase → Supabase 이주.

단계:
1. uniqn-mobile/e2e/helpers/supabase-admin.ts 신규 작성
   - service_role 키로 admin client
   - createUser, createJobPosting, createApplication, createWorkLog 헬퍼

2. uniqn-mobile/e2e/scripts/seedSupabase.ts 신규 작성
   - 기존 seed-emulator.ts 구조 복제, Supabase RLS-safe insert로 교체

3. uniqn-mobile/e2e/global-setup.ts:12-14 firebase → supabase 교체

4. uniqn-mobile/e2e/fixtures/storage-states/* Supabase auth token으로 재작성

5. uniqn-mobile/e2e/helpers/firebase-admin.ts 제거
   uniqn-mobile/e2e/scripts/seed-emulator.ts 제거

6. package.json + package-lock.json에서 firebase-admin dependency 제거

7. 차단 해제된 e2e 시범 실행:
   npx playwright test e2e/tests/auth-signup.spec.ts
   npx playwright test e2e/tests/job-detail-apply.spec.ts

8. RLS 정책 mismatch 발생 시 안정화 (예상 1-2일)

9. commit + PR
```

---

## 8. Wave 5 — e2e 시나리오 작성 (4 세션 병렬)

**전제**: W3 + W4 완료

### 사전 작업

```bash
git worktree add ../T-HOLDEM-w5a -b test/e2e-cancel-lifecycle
git worktree add ../T-HOLDEM-w5b -b test/e2e-qr-race
git worktree add ../T-HOLDEM-w5c -b test/e2e-deletion-grace
git worktree add ../T-HOLDEM-w5d -b test/e2e-misc-p0
```

### Session W5.1 — WF-08 취소 라이프사이클
**Worktree**: `../T-HOLDEM-w5a`
**대상**: T-D4

```
@docs/qa/2026-04-14/team-d-coverage-matrix.md §5 #1 참조.

T-D4: WF-08 취소 e2e 신규 작성.

uniqn-mobile/e2e/tests/cancellation-lifecycle.spec.ts 신규.

시나리오:
- happy: applied → confirm → cancel (staff) → 검증
- happy: confirm → request cancel → employer approve → 검증
- 검증 항목: capacity 복원, work_log 삭제, notification 발송

각 시나리오 후 DB 상태 직접 SELECT로 확인.

npx playwright test cancellation-lifecycle.spec.ts
```

### Session W5.2 — WF-10 QR + WF-06 capacity race
**Worktree**: `../T-HOLDEM-w5b`
**대상**: T-D6 (capacity race) + WF-10 동시 스캔 e2e

```
@docs/qa/2026-04-14/team-d-coverage-matrix.md §5 #2, #6 참조.

T-D6: 동시 지원 + 동시 QR 스캔 race 통합 테스트.

uniqn-mobile/__tests__/integration/applicationCapacityRace.test.ts 신규
uniqn-mobile/__tests__/integration/qrConcurrentScan.test.ts 신규

시나리오:
- 정원 1 공고에 2 사용자 동시 지원 → 1 성공, 1 실패
- 같은 work_log에 동시 QR 스캔 → 1 성공, 1 idempotent

Promise.all 패턴 사용. transaction isolation 확인.
```

### Session W5.3 — WF-18 deletion grace + WF-04 JWT race
**Worktree**: `../T-HOLDEM-w5c`
**대상**: T-D5 + T-D7

```
@docs/qa/2026-04-14/team-d-coverage-matrix.md §5 #4, #10 참조.

T-D5 + T-D7: deletion grace + JWT 무효화 단위 테스트.

1. uniqn-mobile/__tests__/services/auth/accountDeletionService.grace.test.ts
   - 시계 mock으로 25일/30일/31일 진행
   - 25일: 복구 가능, 31일: 익명화 완료

2. uniqn-mobile/__tests__/hooks/useAppInitialize.role-change.test.ts
   - role 변경 시 JWT 무효화 → 새 토큰으로 RLS 재평가
```

### Session W5.4 — WF-07 confirm + WF-11 settlement + WF-17 admin
**Worktree**: `../T-HOLDEM-w5d`
**대상**: T-D8 + T-D9 + T-D10

```
@docs/qa/2026-04-14/team-d-coverage-matrix.md §5 #3, #7, #9 참조.

3개 통합/e2e 테스트:
1. __tests__/integration/confirmCreatesWorkLog.test.ts (T-D8)
2. __tests__/services/settlementService.bulk-rollback.test.ts (T-D9)
3. e2e/tests/admin-report-resolution.spec.ts (T-D10)
```

---

## 9. Wave 6 — P1/P2 백로그 (단독 세션, 우선순위 낮음)

### Session W6.1 — XSS + is_active
**브랜치**: `feat/security-polish`

```
T-E3: notification.schema.ts:53-62의 title/body/link에 .refine(xssValidation) 추가
T-E4: users 테이블 RLS에 is_active 검토 후 추가 (옵션 분석)
```

### Session W6.2 — 토너먼트 + 회수 단위 테스트 + monitoring
**브랜치**: `chore/p2-polish`

```
T-A5: 토너먼트 Edge Function 회수 (별도 트랙)
T-A6: W1에서 회수한 함수에 SQL 단위 테스트 추가
T-C4: swallow 패턴 Sentry breadcrumb 추가
```

---

## 10. 의존성 그래프

```
W0 (Quick Win) ─────────────────────────────── 독립

W1 (RPC 회수) ──┬──→ W3.1 (cancel) ──→ W5.1
                ├──→ W3.2 (QR) ───────→ W5.2
                └──→ (W3.3 outbox은 독립)

W2 (RLS 강화) ─── W1과 병렬 가능

W3 (Atomicity) ─┬──→ W4 (e2e 이주) ──→ W5 (e2e 작성)
                └──→ W5 일부

W4 (e2e 이주) ──→ W5.4 (admin e2e)

W6 (백로그) ────── 언제든 가능
```

---

## 11. 권장 진행 시나리오

### 시나리오 A — 1인 진행 (순차 + 일부 병렬)

**Day 1** (오전): W0 Quick Win (30분) + W2 Announcement RLS (30분) → 머지
**Day 1** (오후~Day 2): W1.1, W1.2 직렬 (Supabase MCP 충돌 방지)
**Day 3**: W1.3, W1.4 직렬 → 머지
**Day 4-6**: W3.1, W3.2 직렬 (다른 파일이라 병렬도 가능)
**Day 7**: W3.3 outbox
**Day 8-9**: W4 e2e 이주
**Day 10-12**: W5.1~W5.4 직렬 또는 2개씩 병렬
**Day 13**: W6 백로그

**총: ~13일**

### 시나리오 B — 2인 진행 (병렬 활용)

**Day 1**: 사람 A가 W0 + W1.1, 사람 B가 W2 + W1.2
**Day 2**: A가 W1.3, B가 W1.4 → 모두 머지
**Day 3-4**: A가 W3.1, B가 W3.2 (각자 worktree)
**Day 5**: A가 W3.3, B는 W4 시작
**Day 6**: B가 W4 마무리
**Day 7-9**: A가 W5.1+W5.3, B가 W5.2+W5.4 (병렬)
**Day 10**: W6

**총: ~10일** (병렬로 30% 단축)

### 시나리오 C — 안전 우선 (1인 직렬)

순차로만 진행. worktree 사용 안 함. 매 task 후 main 머지 → 다음 task.
**총: ~18일** 하지만 충돌/실수 위험 최소.

---

## 12. 매 세션 시작/종료 체크리스트

### 세션 시작 시
- [ ] `git status` clean 확인
- [ ] `git pull origin master` 또는 worktree에서 main rebase
- [ ] 해당 wave의 의존성 task가 main에 머지되었는지 확인
- [ ] Claude Code 새 세션 (이전 세션 컨텍스트 누적 방지)
- [ ] EXECUTION-PLAN.md + 해당 team report `@`로 첨부

### 세션 종료 시
- [ ] `cd uniqn-mobile && npm run quality` PASS
- [ ] `cd uniqn-mobile && npm test` PASS (관련 부분)
- [ ] `git diff main` 검토 (의도하지 않은 변경 없음)
- [ ] 단일 또는 작은 commit (메시지 명확)
- [ ] PR 생성 (`gh pr create`)
- [ ] worktree 사용 시 보존 (머지 후 정리)

---

## 13. 머지 순서 (충돌 최소화)

1. **W0** (1 PR)
2. **W2** (1 PR) — RLS, 다른 파일
3. **W1.1 → W1.2 → W1.3 → W1.4** (4 PR 순차)
   - 마이그레이션 timestamp 충돌 시 머지 직전 rebase
4. **W3.1, W3.2, W3.3** (3 PR 순차)
   - 마찬가지로 timestamp 정리
5. **W4** (1 PR)
6. **W5.1~W5.4** (4 PR, 순서 무관)
7. **W6** (백로그)

---

## 14. 비상 시 롤백

각 세션이 단일 PR이므로:
```bash
# 문제 PR revert
gh pr list --state merged
git revert <merge-commit-sha>
git push origin master
```

마이그레이션 롤백:
```sql
-- 신규 마이그레이션의 DOWN 절을 직접 실행
DROP FUNCTION IF EXISTS public.cancel_application_atomically;
-- 등
```

---

## 15. 진행 추적

각 세션 종료 시 `INDEX.md`의 5섹션 매트릭스 마지막 컬럼에 ✅ 마킹.
또는 별도 `STATUS.md` 작성하여 wave별 상태 기록.

---

## 16. FAQ

**Q. worktree 처음이라 무서운데 단순 브랜치로 하면?**
A. 가능. worktree는 동시에 여러 디렉토리에서 작업할 때만 필요. 한 사람이 1세션씩 직렬 진행이라면 일반 `git checkout -b`만으로 충분 (시나리오 C).

**Q. Supabase MCP 권한이 없으면?**
A. W1 RPC 회수가 막힘. 대안: Supabase Studio Web UI에서 SQL Editor로 `pg_proc` 직접 조회 → 결과 복붙.

**Q. e2e Firebase 이주(W4)가 너무 무거우면?**
A. W5의 e2e 작성을 유닛/통합 테스트 위주로 우회. e2e는 W4 완료 후 일괄 처리.

**Q. 한 세션에 여러 task 묶어도 되나?**
A. 같은 wave 내에서 작은 task들(XS/S)은 묶기 가능. 단 검증 게이트는 task별로 통과 확인.

**Q. PR 리뷰 없이 바로 머지해도?**
A. 1인 작업이면 self-review 후 머지 OK. 단 W3 atomicity는 SQL 검토가 critical하므로 codex 또는 본인이 다시 한번 확인 권장.

---

**총 ~14 세션 / 6 wave / 병렬 활용 시 1-1.5주, 안전 우선 시 2.5-3주**
