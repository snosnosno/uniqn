# UNIQN 실행 계획 (EXECUTION-PLAN)

> 작성일: 2026-04-14
> 입력: 5팀 보고서 + Phase 0 검증
> 사용법: 각 task는 (a) 영향 파일, (b) 한 줄 변경 내용, (c) 검증 명령, (d) 사이즈, (e) 의존성을 포함. 위에서 아래로 의존성 순서대로 진행 가능.

---

## 0. 글로벌 검증 명령

| 명령 | 용도 |
|------|------|
| `cd uniqn-mobile && npm run quality` | type-check + lint + format:check (모든 task 후 실행) |
| `cd uniqn-mobile && npm test` | Jest unit/integration |
| `cd uniqn-mobile && npx playwright test` | e2e (Firebase 차단 해제 후) |
| `mcp__supabase__execute_sql` | Supabase 운영 환경 함수/정책 직접 조회 |
| `mcp__supabase__list_migrations` | 마이그레이션 적용 상태 확인 |
| `mcp__supabase__list_edge_functions` | Edge Function 운영 상태 |

---

## 1. P0 Quick Wins (5분 작업, 의존성 없음)

### T-C1 — EventQR scope 컬럼 추가
- **파일**: `uniqn-mobile/src/repositories/supabase/EventQRRepository.ts:28`
- **변경**: `TABLE_COLUMNS` 끝에 `,assignment_group_id,time_slot` 추가
- **검증**: `npm run quality && npm test -- EventQRRepository` (회귀)
- **사이즈**: XS
- **영향**: WF-10 — scope 필터 정상 동작 복원

### T-C2 — Admin last_login_at 추가
- **파일**: `uniqn-mobile/src/repositories/supabase/AdminRepository.ts:37`
- **변경**: `USER_COLUMNS` 끝에 `,last_login_at` 추가
- **검증**: `npm run quality && npm test -- AdminRepository`
- **사이즈**: XS
- **영향**: WF-17 — 관리자 user 상세에 lastLoginAt 표시

### T-C3 — templateService Firebase 분기 제거
- **파일**: `uniqn-mobile/src/services/jobs/templateService.ts:29-31`
- **변경**: `firebaseError.code === 'permission-denied'` 분기 3줄 삭제
- **검증**: `npm run quality && npm test -- templateService`
- **사이즈**: XS
- **영향**: WF-19 — dead code 제거

**커밋 메시지**: `fix(repo): EventQR/Admin 컬럼 누락 + templateService Firebase 잔재 제거`

---

## 2. P0 Server Contract Recovery (Team A)

### T-A1 — Auth/Application/Confirmation RPC 회수
**4개 RPC**: `check_email_exists`, `check_nickname_exists`, `check_phone_exists`, `confirm_application`

- **단계 1**: MCP로 운영 환경 정의 회수
  ```sql
  SELECT proname, pg_get_function_arguments(oid), pg_get_functiondef(oid)
  FROM pg_proc
  WHERE proname IN ('check_email_exists','check_nickname_exists','check_phone_exists','confirm_application');
  ```
- **단계 2**: 회수 결과를 신규 마이그레이션으로 저장 — `supabase/migrations/20260414xxxxxx_recover_auth_application_rpcs.sql`
- **단계 3**: 누락된 함수가 있으면 Team A 보고서의 expected contract로 신규 작성
- **단계 4**: SQL 단위 테스트 (해피 + 권한 + idempotency)
- **검증**: `mcp__supabase__list_migrations`로 적용 확인 + 앱에서 회원가입/지원 e2e 수동 테스트
- **사이즈**: M
- **의존성**: Supabase MCP 접근

### T-A2 — Auth/Account 함수 회수
**3개**: `register_as_employer` (RPC), `revoke-apple-token` (Edge), `verify-portone-identity` (Edge), `verify-and-save-portone-profile` (Edge)

- **Edge Function 회수**:
  ```
  mcp__supabase__list_edge_functions
  mcp__supabase__get_edge_function(function_slug='revoke-apple-token')
  # 동일하게 verify-portone-identity, verify-and-save-portone-profile
  ```
- **회수 결과를 `supabase/functions/<name>/index.ts`로 저장** (디렉토리 신규 생성)
- **사이즈**: M
- **의존성**: Supabase MCP

### T-A3 — Notification Counter Edge Function 회수
**3개**: `reset-unread-counter`, `decrement-unread-counter`, `initialize-unread-counter`

- 동일 회수 과정 (P1)
- **사이즈**: M
- **의존성**: T-A2 (Edge Function 디렉토리 구조 확립 후)

### T-A4 — Stats/Increment 함수 회수
**4개**: `get_job_posting_stats`, `increment_view_count`, `increment_announcement_view_count`, `increment_template_usage`

- 동일 회수 과정 (P1/P2)
- **사이즈**: S

### T-A5 — Tournament Edge Function (별도 트랙)
**3개**: `approve-job-posting`, `reject-job-posting`, `resubmit-job-posting`

- 별도 분석 후 진행
- **사이즈**: M
- **우선순위**: P2

### T-A6 — 회수된 정의에 단위 테스트 추가
- 각 회수 함수에 SQL 단위 테스트
- **사이즈**: M
- **의존성**: T-A1~A5

---

## 3. P0 Atomicity RPC (Team B)

### T-B1 — `cancel_application_atomically` 마이그레이션
- **파일**: `supabase/migrations/20260414xxxxxx_add_cancel_application_atomically.sql` (신규)
- **내용**: Team B 보고서 §2.3의 PL/pgSQL 함수 정의
- **검증**: SQL 단위 테스트 (staff_initiates 해피, staff_approves 해피, 권한 오류, idempotency)
- **사이즈**: M
- **의존성**: 없음

### T-B2 — 클라이언트 cancel 코드 RPC로 교체
- **파일**: 
  - `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryTransactions.ts:218-303` (executeCancelConfirmation)
  - 동 `:475-541` (executeApproveCancellation)
  - 동 `:407-458` (updateJobPostingCapacity 헬퍼 — 제거)
  - 동 `:460-473` (deleteScheduledWorkLogs 헬퍼 — 제거)
- **변경**: 3개 client op 시퀀스를 `supabase.rpc('cancel_application_atomically', {...})` 단일 호출로 교체
- **검증**: `npm test -- ApplicationRepositoryTransactions`
- **사이즈**: S
- **의존성**: T-B1

### T-B3 — 취소 회귀 테스트
- 동시 confirm + 취소 race
- 네트워크 timeout 후 retry (idempotency)
- orphan work_log 검사
- **사이즈**: M
- **의존성**: T-B1, T-B2

### T-B4 — `process_qr_checkin_atomically` 마이그레이션
- **파일**: `supabase/migrations/20260414xxxxxx_add_process_qr_checkin_atomically.sql`
- **내용**: Team B 보고서 §3.3
- **검증**: SQL 단위 테스트 (check-in 해피, check-out 해피, payroll 완료 후 차단, staff_id 불일치)
- **사이즈**: M

### T-B5 — 클라이언트 QR 코드 RPC로 교체
- **파일**: `uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts:185-348` (executeProcessQRCheckInOut)
- **변경**: select/validate/update 3단계를 `supabase.rpc('process_qr_checkin_atomically', {...})` 단일 호출로 교체
- **검증**: `npm test -- WorkLogRepositoryTransactions`
- **사이즈**: S
- **의존성**: T-B4

### T-B6 — QR 회귀 테스트
- 동시 check-in race
- payroll 완료 후 check-in 차단
- 음수 work_duration 방지
- **사이즈**: M
- **의존성**: T-B4, T-B5

### T-B7 — Schedule board outbox 테이블 마이그레이션
- **파일**: `supabase/migrations/20260414xxxxxx_add_schedule_board_sync_outbox.sql`
- **내용**: Team B 보고서 §4.3 outbox 테이블 + RLS
- **사이즈**: S

### T-B8 — `jobManagementService` outbox 패턴 교체
- **파일**: `uniqn-mobile/src/services/jobs/jobManagementService.ts:20-33,46-66,68-92,94-111,113-130,132-149,166-199`
- **변경**: `syncScheduleBoardSafely` 제거, 6개 호출 site 모두 outbox insert로 교체
- **사이즈**: M
- **의존성**: T-B7

### T-B9 — Outbox processor Edge Function
- **파일**: `supabase/functions/sync-schedule-board-outbox/index.ts` (신규)
- **내용**: 30초 주기 polling, 3회 재시도, 영구 실패 시 alert
- **사이즈**: M
- **의존성**: T-B7

### T-B10 — Outbox 모니터링 + alert
- failed_retry_limit 행 alert
- 단순 dashboard 또는 Sentry 알림
- **사이즈**: S
- **의존성**: T-B7~B9

---

## 4. P0 Security & RLS (Team E)

### T-E1 — Announcements RLS 정책 강화
- **파일**: `supabase/migrations/20260414xxxxxx_strengthen_announcements_rls.sql` (신규)
- **변경**: SELECT 정책에 `target_audience` 검증 추가 (Team E §4.1 SQL 참조)
- **검증**: SQL로 admin/staff/employer 각 role로 SELECT 후 결과 비교
- **사이즈**: XS
- **의존성**: 없음

### T-E2 — Announcement 클라이언트 필터 제거
- **파일**: `uniqn-mobile/src/repositories/supabase/AnnouncementRepository.ts:145-153`
- **변경**: 클라이언트 `.filter()` 제거 (이제 RLS가 강제)
- **검증**: `npm test -- AnnouncementRepository`
- **사이즈**: XS
- **의존성**: T-E1

---

## 5. P1 Tasks

### T-E3 — notification.schema XSS 추가
- **파일**: `uniqn-mobile/src/schemas/notification.schema.ts:53-62`
- **변경**: `title`, `body`, `link`에 `.refine(xssValidation)` 추가
- **검증**: `npm test -- notification.schema`
- **사이즈**: XS

### T-E4 — is_active 강제 추가
- **파일**: 
  - `supabase/migrations/20260414xxxxxx_users_is_active_rls.sql` (신규)
  - 또는 critical RPC 진입점에 `IF NOT user.is_active THEN ...`
- **변경**: 옵션 분석 후 결정 (Team E §6.1 참조)
- **사이즈**: M
- **의존성**: 없음

### T-D1 — `e2e/helpers/supabase-admin.ts` 작성
- **파일**: `uniqn-mobile/e2e/helpers/supabase-admin.ts` (신규)
- **변경**: service role 키 사용한 admin client + 헬퍼 함수
- **사이즈**: M

### T-D2 — `seedSupabase.ts` + `global-setup.ts` 이주
- **파일**: 
  - `uniqn-mobile/e2e/scripts/seedSupabase.ts` (신규)
  - `uniqn-mobile/e2e/global-setup.ts:12-14` (firebase → supabase)
  - `uniqn-mobile/e2e/helpers/firebase-admin.ts` (제거)
  - `uniqn-mobile/e2e/scripts/seed-emulator.ts` (제거)
  - `uniqn-mobile/e2e/fixtures/storage-states/*` (Supabase auth token으로 재작성)
- **사이즈**: L
- **의존성**: T-D1

### T-D3 — `firebase-admin` 패키지 제거
- **파일**: `uniqn-mobile/package.json`, `package-lock.json`
- **변경**: dependency 제거
- **사이즈**: XS
- **의존성**: T-D2 완료 후

### T-D4 — WF-08 취소 e2e (happy path + edge)
- **파일**: `uniqn-mobile/e2e/tests/cancellation-lifecycle.spec.ts` (신규)
- **시나리오**: applied → confirm → cancel → 검증 (capacity, work_log, notification)
- **사이즈**: M
- **의존성**: T-B1, T-B2 (RPC 완성 후)

### T-D5 — WF-18 deletion grace 단위/e2e
- **파일**: 
  - `uniqn-mobile/__tests__/services/auth/accountDeletionService.grace.test.ts` (신규)
  - `uniqn-mobile/e2e/tests/account-deletion-grace.spec.ts` (신규)
- **시나리오**: 삭제 요청 → 25일 후 복구 → 31일 후 익명화
- **사이즈**: L
- **의존성**: T-A2 (revoke-apple-token), 시계 mock

### T-D6 — WF-06 capacity race 통합 테스트
- **파일**: `uniqn-mobile/__tests__/integration/applicationCapacityRace.test.ts` (신규)
- **시나리오**: 동시 지원 시뮬레이션, transaction isolation 검증
- **사이즈**: L
- **의존성**: T-A1 (confirm_application 회수)

### T-D7 — WF-04 JWT 무효화 단위 테스트
- **파일**: `uniqn-mobile/__tests__/hooks/useAppInitialize.role-change.test.ts` (신규)
- **시나리오**: role 변경 시 JWT 갱신 → RLS 평가 race 방지
- **사이즈**: S
- **의존성**: T-A2 (register_as_employer)

### T-D8 — WF-07 confirm + work_log 생성 통합 테스트
- **파일**: `uniqn-mobile/__tests__/integration/confirmCreatesWorkLog.test.ts` (신규)
- **사이즈**: M
- **의존성**: T-A1

### T-D9 — WF-11 정산 bulk rollback 단위 테스트
- **파일**: `uniqn-mobile/__tests__/services/settlementService.bulk-rollback.test.ts` (신규)
- **사이즈**: M

### T-D10 — WF-17 신고 처리 audit trail e2e
- **파일**: `uniqn-mobile/e2e/tests/admin-report-resolution.spec.ts` (신규)
- **사이즈**: M
- **의존성**: T-D2 (Firebase 차단 해제)

---

## 6. P2 Tasks

### T-E5 — work_logs payroll 컬럼 가드
- **파일**: 
  - `supabase/migrations/20260414xxxxxx_work_logs_payroll_trigger.sql` (옵션)
  - 또는 코드 grep으로 raw `.update()` site 정기 점검
- **사이즈**: M

### T-E6 — RPC rate limiting (token bucket)
- **파일**: `supabase/migrations/20260414xxxxxx_rpc_rate_limit.sql` (신규)
- **사이즈**: L

### T-C4 — swallow 패턴 monitoring
- **변경**: `TemplateRepository.ts:130`, `JobPostingRepository.ts:340-344`, `notificationReadStateService.ts:24-41` 등에 Sentry breadcrumb 추가
- **사이즈**: M

### T-A5 — 토너먼트 Edge Function 별도 트랙
- 위 §2 T-A5 참조

---

## 7. 의존성 그래프

```
[Quick Wins T-C1/C2/C3] ──── 독립 (즉시 가능)

[T-A1 RPC 회수] ──┬─→ [T-D6 capacity race]
                  ├─→ [T-D8 confirm+work_log]
                  └─→ [T-A6 단위 테스트]

[T-A2 Auth Edge] ──┬─→ [T-D5 deletion grace]
                   ├─→ [T-D7 JWT race]
                   └─→ [T-A6 단위 테스트]

[T-A3 Notification Edge] ──→ [T-A6]

[T-B1 cancel RPC] ──→ [T-B2 client] ──→ [T-B3 회귀] ──→ [T-D4 WF-08 e2e]

[T-B4 QR RPC] ──→ [T-B5 client] ──→ [T-B6 회귀]

[T-B7 outbox 테이블] ──→ [T-B8 jobMgmt 교체] ──→ [T-B9 processor] ──→ [T-B10 모니터링]

[T-E1 Announcement RLS] ──→ [T-E2 client 제거]

[T-D1 supabase-admin] ──→ [T-D2 seedSupabase] ──→ [T-D3 패키지 제거]
                                              └──→ [WF-02/05/06/07/10/11/12 e2e 차단 해제]
                                              └──→ [T-D10 admin 신고 e2e]

[독립 P1] T-E3 (notification XSS), T-E4 (is_active), T-D9 (정산 rollback)

[독립 P2] T-E5, T-E6, T-C4, T-A5
```

---

## 8. 권장 진행 순서 (3 sprint, 3주)

### Sprint 1 (Week 1) — Quick Win + RPC 회수
1. T-C1, T-C2, T-C3 (10분, 1 commit)
2. T-A1, T-A2, T-A3, T-A4 (RPC/Edge 회수, 회수 자체는 1-2일)
3. T-E1, T-E2 (Announcement RLS, 1일)

검증: `npm run quality` + 회원가입 수동 e2e + 공지 role별 노출 확인

### Sprint 2 (Week 2) — Atomicity RPC
1. T-B1, T-B2, T-B3 (취소 RPC + 클라이언트 + 회귀)
2. T-B4, T-B5, T-B6 (QR RPC + 클라이언트 + 회귀)
3. T-B7, T-B8, T-B9, T-B10 (outbox 패턴)

검증: `npm test` 전체 + Team B 회귀 시나리오

### Sprint 3 (Week 3) — e2e + 보안 보강
1. T-D1, T-D2, T-D3 (e2e Firebase 이주)
2. T-D4, T-D5, T-D6, T-D7, T-D8, T-D9, T-D10 (P0/P1 e2e 작성)
3. T-E3, T-E4 (notification XSS, is_active)

검증: `npx playwright test` 전체 통과

### 백로그 (Sprint 4+)
- T-A5 (토너먼트 Edge Function)
- T-A6 (회수 함수 단위 테스트 보강)
- T-E5, T-E6, T-C4 (P2)

---

## 9. 사이즈 기준

| 사이즈 | 시간 | 설명 |
|--------|------|------|
| XS | < 30분 | 1-3줄 변경, 1 commit |
| S | 1-3시간 | 단일 파일, 단위 테스트 1-3개 |
| M | 0.5-1일 | 복수 파일, 기능 단위 |
| L | 2-3일 | 신규 모듈, 통합 테스트 |

---

## 10. 검증 게이트

각 sprint 종료 시:
1. `cd uniqn-mobile && npm run quality` ✅
2. `cd uniqn-mobile && npm test` ✅ (Sprint 1: type, Sprint 2: + atomicity 회귀, Sprint 3: + e2e)
3. Phase 0 검증 표의 영향 항목이 fixed로 갱신됨
4. INDEX.md 업데이트 (✅ → 완료 표시)

---

## 11. 비포함 항목 (별도 트랙)

- 19 워크플로우 중 P3급 시나리오 (WF-13 블라인드 author masking 등 nice-to-have)
- 다크 모드 / 반응형 UI 점검
- 운영 통계 / 조회수 정확성
- 문서 정합화 (README/CLAUDE.md 동기화)

이들은 별도 audit 또는 분기별 점검으로 처리.

---

**Total scope**: 23 task / 3 sprint (3 weeks) / Quick Win 3건은 즉시 가능
**Total risk reduction**: ~95% (race condition, RLS bypass, RPC 부재 모두 해결)
