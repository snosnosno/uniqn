# Team D — Workflow ↔ Test Coverage Matrix

> 작성일: 2026-04-14
> 입력: 사용자 정의 19 워크플로우 + Phase 0 발견사항
> 결과: 총 228개 테스트 자산 카탈로그 + 19행 매트릭스 + Top 10 P0 미커버 시나리오 + e2e Firebase 차단 매핑

---

## 0. Summary

| 영역 | 결과 |
|------|------|
| 카탈로그된 테스트 | 165 unit + 31 integration + 32 e2e = **228** |
| e2e 0% 워크플로우 | WF-09, WF-12, WF-14, WF-15, WF-19 (5개) |
| P0 워크플로우 critical gap | WF-04, WF-06, WF-07, WF-08, WF-10, WF-11, WF-16, WF-17, WF-02, WF-18 (10개) |
| Firebase로 e2e 차단 | 6/32 e2e 파일 (19% 차단) |
| 현재 워크플로우 coverage | ~70% (P0/P1 일부 critical 시나리오 누락) |

---

## 1. Methodology

1. `uniqn-mobile/src/**/__tests__`, `uniqn-mobile/__tests__`, `uniqn-mobile/e2e/tests` 전수 검색
2. 각 테스트 파일의 `describe(...)` + 상단 주석 read하여 워크플로우 분류
3. 19 워크플로우 각각의 entry point 식별 (route/hook/service/store)
4. 워크플로우 × {unit, integration, e2e, 미커버} 매트릭스 생성
5. Phase 0 + Team A/B/C/E 발견사항을 cross-reference하여 critical gap 식별

---

## 2. 테스트 인벤토리

| 카테고리 | 개수 | 비고 |
|---------|------|------|
| Unit | 165 | Hooks 26, Services 48, Utils 35, Components 28, Domains 13, Other 15 |
| Integration | 31 | applicant mgmt, schedule, settlement, job posting |
| E2E | 32 | Playwright. P0:8, P1:6, P2:6, P3:9, P4:3 |
| **합계** | **228** | 19 워크플로우 중 14개 일부 커버 |

---

## 3. 워크플로우 entry point

| WF | Route | Hook | Service | Store |
|----|-------|------|---------|-------|
| WF-01 | `(auth)/_layout.tsx` | `useAppInitialize`, `useSplashGate` | `authService` | `authStore` |
| WF-02 | `(auth)/login` | `useAuth`, `useAutoLogin` | `authService`, `socialLoginService` | `authStore` |
| WF-03 | `(app)/_layout.tsx` | `useUserProfile`, `useCompletionFlag` | — | `authStore` |
| WF-04 | `(app)/settings` | `useAppInitialize` (role check) | `accountDeletionService` | `authStore` |
| WF-05 | `(app)/(tabs)/index.tsx` | `useJobPostings`, `useJobDetail` | `jobService`, `searchService` | — |
| WF-06 | `(app)/jobs/[id]/index.tsx` | `useApplications`, `useAssignmentSelection` | `applicationService` | — |
| WF-07 | `(employer)/my-postings/[id]` | `useApplicantManagement`, `useConfirmedStaff` | `applicantManagementService` | — |
| WF-08 | `(app)/applications` | `useApplications` | `applicationService` | — |
| WF-09 | `(app)/(tabs)/schedule` | `useSchedules`, `useJobSchedule` | `scheduleService` | — |
| WF-10 | `(employer)/qr`, `(app)/schedule` | `useEventQR` | `eventQRService` | — |
| WF-11 | `(employer)/settlement` | `useSettlement`, `useWorkLogs` | `settlementService`, `workLogService` | — |
| WF-12 | `(app)/notifications` | `useNotifications`, `useNotificationHandler` | `notificationService`, `pushNotificationService` | `notificationStore` |
| WF-13 | `(app)/reviews` | `useReviews` | `reviewService` | — |
| WF-14 | `(app)/(tabs)/board` | `useBoard` | `boardService` | — |
| WF-15 | `(app)/support` | `useInquiry` | `inquiryService` | — |
| WF-16 | `(admin)/announcements` | `useAnnouncement` | `announcementService` | — |
| WF-17 | `(admin)/` | `useAdminDashboard`, `useAdminReports` | `adminService` | — |
| WF-18 | `(app)/settings` | `useAuth` | `accountDeletionService` | `authStore` |
| WF-19 | `(app)/` (offline) | `useTemplateManager` | `templateService` | — |

---

## 4. Coverage 매트릭스 (19 workflows)

> Unit/Integration/E2E 숫자는 해당 워크플로우 entry point를 직접 다루는 테스트 개수.

| WF | Unit | Integration | E2E | Critical Gap |
|----|------|-------------|-----|-------------|
| WF-01 | 17 | 0 | 3 | cold start + force update branch, expired session 복구 timing |
| WF-02 | 17 | 0 | 3 | social auth token race, 전화 OTP edge, 비활성 계정 가입 차단 |
| WF-03 | 11 | 0 | 0 | **0% e2e** — incomplete profile redirect 미검증 |
| WF-04 | 10 | 0 | 1 | **JWT/RLS sync timing on role change**, employer profile race, 30일 grace 강제 |
| WF-05 | 23 | 0 | 2 | hidden/draft/closed status filter, "이미 지원함" guard edge, 마감 boundary |
| WF-06 | 29 | 5 | 1 | **capacity race (동시 지원)**, 사전질문 validation order, 중복 활성 차단 retry |
| WF-07 | 28 | 5 | 1 (partial) | **work_log 생성 RPC 누락**, filled positions atomicity, bulk confirm 부분 실패 |
| WF-08 | 11 | 0 | **0** | **취소 라이프사이클 e2e 0건** — pending → approve/reject 상태머신 미검증 |
| WF-09 | 24 | 4 | 2 | calendar deep link, partial failure, offline schedule sync |
| WF-10 | 18 | 0 | 1 | **QR 만료 + scope 동시 스캔**, 정산 후 비활성, clock skew, 데이터 round-trip |
| WF-11 | 31 | 0 | 1 | **settlement override 권한**, bulk 부분 실패 + rollback, 분 단위 boundary |
| WF-12 | 23 | 0 | 1 | unread counter drift, deep link 라우팅, FCM 토큰 만료 race |
| WF-13 | 24 | 0 | 1 | 블라인드 author masking, 마감 강제, hold/pending atomicity |
| WF-14 | 24 | 0 | 1 | membership gate, board lock, realtime sync conflict |
| WF-15 | 13 | 0 | 1 | admin 응답 알림, 상태 머신, FAQ 검색 인덱스 |
| WF-16 | 17 | 0 | 1 | **RLS role-targeted 노출** (Phase 0 #10), draft access gate |
| WF-17 | 23 | 0 | 2 | admin RLS on stats, ban/unban audit, 토너먼트 승인 atomicity, 신고 처리 |
| WF-18 | 17 | 0 | **0** | **30일 deletion grace e2e 0건**, data export 완전성, 익명화 |
| WF-19 | 11 | 0 | 1 | stale cache 감지, 템플릿 inheritance scope, offline form queue |

**관찰**:
- WF-03, WF-08, WF-18: e2e 0건 (그중 WF-08, WF-18은 P0)
- WF-04, WF-06, WF-07, WF-08, WF-10, WF-11, WF-16, WF-17: 단위 테스트는 있지만 **critical race/atomicity 시나리오 미커버**
- WF-12, WF-15는 unit 충실하나 e2e 1건씩 — Firebase 차단 영향

---

## 5. Top 10 P0 미커버 시나리오

### 1. WF-08 — 취소 라이프사이클 (applied → cancellation_pending → approved)
- **Gap**: 전체 취소 e2e 0건. 단위 테스트는 상태 머신만, work_log cleanup + notification 통합 미검증.
- **Effort**: M (3-4일)
- **Dependency**: Team B `cancel_application_atomically` RPC 완성 후

### 2. WF-10 — QR 동시 스캔 + 정산 후 비활성
- **Gap**: 동시 스캔 race, 정산 완료 후 QR 차단 e2e 없음.
- **Effort**: M (3-4일)
- **Dependency**: Team B `process_qr_checkin_atomically` RPC 완성 후

### 3. WF-07 — 확정 시 work_log 생성 atomicity
- **Gap**: applicantManagementService → confirm_application RPC 호출 → work_log 생성 통합 e2e 없음. Team A 분석에 따르면 confirm_application RPC 정의 자체가 repo에 없음.
- **Effort**: M (2-3일)
- **Dependency**: Team A confirm_application 회수 + Firebase e2e 차단 해제

### 4. WF-04 — Employer 전환 시 JWT/RLS sync timing
- **Gap**: useAppInitialize role check 단위 테스트는 있으나 JWT가 RLS 평가 전에 갱신되는지 검증 안 됨. Race: "구인자 전환" 클릭 → 구 JWT → RLS 거부.
- **Effort**: M (3-4일)
- **Dependency**: Team A `register_as_employer` RPC 회수 + auth store JWT 무효화 확인

### 5. WF-16 — Announcement RLS role 노출
- **Gap**: announcement 단위 테스트는 비즈니스 로직만. RLS 정책으로 role별 다른 announcement set 노출됨을 검증하는 e2e 없음. Phase 0 #10 (Team E P0).
- **Effort**: M (2-3일)
- **Dependency**: Team E RLS 정책 갱신 + 3 role e2e 로그인

### 6. WF-06 — 정원 race (동시 지원)
- **Gap**: 정원=1, 두 사용자 동시 지원 → 둘 다 confirm 안 되어야 하는 race 테스트 없음.
- **Effort**: L (4-5일)
- **Dependency**: 동시 호출 시뮬레이터 + Postgres isolation level 확인

### 7. WF-11 — 정산 override 권한 + bulk rollback
- **Gap**: 정산 happy path만. 6개 중 5개 성공 6번째 실패 시 6개 모두 rollback 검증 없음.
- **Effort**: M (3-4일)
- **Dependency**: 없음 (서비스 레이어 트랜잭션 로직)

### 8. WF-02 — 중복 이메일 + 전화 OTP edge
- **Gap**: 비활성/탈퇴 계정 이메일로 가입 시도, OTP timeout 후 새 OTP 발급 시 구 OTP 만료 검증 없음.
- **Effort**: M (2-3일)
- **Dependency**: 없음 (Firebase 차단 해제 후)

### 9. WF-17 — 관리자 신고 처리 + audit trail
- **Gap**: report pending → 검토 → 해결 → audit log → 신고자 알림 전체 e2e 없음.
- **Effort**: M (3-4일)
- **Dependency**: audit log 테이블 + notification service 통합

### 10. WF-18 — 계정 삭제 30일 grace
- **Gap**: 삭제 요청 생성만 단위 테스트. 30일 grace 강제, 25일 후 복구 가능, 31일 후 익명화 e2e 없음.
- **Effort**: L (4-5일)
- **Dependency**: 백엔드 cron task + 시계 mock + Team A `revoke-apple-token` Edge Function

---

## 6. e2e Firebase 차단 매핑

| WF | 차단? | 이유 | 차단 파일 |
|----|------|------|----------|
| WF-02 | YES | Firebase Firestore 시드 | `auth-signup.spec.ts` |
| WF-05 | YES | 잡 팩토리 Firebase | `job-detail-apply.spec.ts` |
| WF-06 | YES | 같은 파일 | `job-detail-apply.spec.ts` |
| WF-07 | YES | applicant + posting 시드 | `employer-applicants.spec.ts` |
| WF-10 | YES | work log 픽스처 | `qr-checkin.spec.ts` (간접) |
| WF-11 | YES | work log + job 시드 | `employer-settlement.spec.ts` |
| WF-12 | YES | notification 시드 | `notifications.spec.ts` |
| WF-16 | NO | 시드 없이 public endpoint | `notices.spec.ts` |
| WF-17 | NO | 대부분 UI 중심 | admin tests |
| 기타 | NO | P3/P4 시드 없음 | - |

**총 차단**: 6/32 (19%). 차단 해제 작업:
1. `seedSupabase.ts` 모듈 작성 (현재 factory 구조 복제, Firebase → Supabase RLS-safe insert)
2. `global-setup.ts`를 Supabase client로 교체
3. `fixtures/storage-states/`를 Supabase auth token으로 재작성
4. 차단된 7 워크플로우 e2e 재실행 (RLS 정책 mismatch 안정화 2-3일 예상)

---

## 7. 권장사항

### Quick Win 우선순위
1. **WF-08 취소** — pending→approve happy path e2e (Team B RPC 후, M)
2. **WF-04 JWT sync** — useAppInitialize 단위 테스트 (역할 변경 시 토큰 무효화) (S)
3. **WF-16 Announcement RLS** — 3 role e2e (Team E RLS 갱신 후, M)
4. **WF-18 deletion grace** — 단위 테스트 (시계 mock, 30일 계산) (S)
5. **WF-06 capacity race** — 동시 호출 시뮬레이터 (L)

### Supabase e2e 이주 로드맵
1. `seedSupabase.ts` 모듈 작성 (1일)
2. `global-setup.ts` Supabase 전환 (반나절)
3. `fixtures/storage-states/` 재작성 (1일)
4. 차단된 7 워크플로우 e2e 실행 + RLS 안정화 (2-3일)

### Coverage 목표
- 현재: ~70% (일부 critical race 미커버)
- 목표: P0/P1 95% (e2e + unit) by Q2 종료
- 추정 노력: ~60 person-day

### Known Risks (Top 10에 영향)
- WF-07: confirm_application 백엔드 정의 미확인 (Team A) — e2e 작성 전 백엔드 확인
- WF-04: 역할 변경 시 Supabase JWT 무효화 미확인 — 백엔드 확인
- WF-16: Announcement RLS 정책 미배포 (Phase 0 #10) — 보안 검토 후 e2e
- WF-11: 정산 부분 실패 atomicity는 transaction isolation 의존 — Postgres config 확인

---

## 8. 다음 액션

| Task | 우선순위 | 사이즈 | 의존성 |
|------|---------|--------|--------|
| WF-08 e2e (취소 happy path) | P0 | M | Team B cancel_application_atomically |
| WF-10 e2e (QR race + 정산 후) | P0 | M | Team B process_qr_checkin_atomically |
| WF-07 e2e (confirm + work_log 생성) | P0 | M | Team A confirm_application 회수 |
| WF-04 JWT 무효화 단위 테스트 | P0 | S | - |
| WF-16 e2e (3 role announcement) | P0 | M | Team E RLS 정책 갱신 |
| WF-18 30일 grace 단위 테스트 | P0 | S | - |
| WF-06 capacity race 통합 테스트 | P0 | L | - |
| WF-11 정산 bulk rollback 단위 테스트 | P1 | M | - |
| `seedSupabase.ts` + `global-setup` 이주 | P1 | M | Team C e2e Firebase 매핑 |
| 차단 해제 후 7 워크플로우 e2e 실행 | P1 | L | 위 |

---

**Generated**: 2026-04-14 | **자산**: 228 (165 unit + 31 integration + 32 e2e) | **워크플로우**: 19 | **신뢰도**: High
