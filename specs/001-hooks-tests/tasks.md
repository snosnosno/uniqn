# Tasks: 핵심 Hooks 단위 테스트 작성

**Input**: Design documents from `/specs/001-hooks-tests/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: 작업은 사용자 스토리별로 그룹화되어 각 스토리를 독립적으로 구현하고 테스트할 수 있습니다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 작업이 속한 사용자 스토리 (US1, US2, US3)
- 설명에 정확한 파일 경로 포함

## Path Conventions

프로젝트 타입: Web (React SPA, app2/ 디렉토리)

---

## Phase 1: Setup (공통 인프라)

**목적**: 테스트 환경 초기화 및 공통 Mock 설정

- [X] T001 Create test directory structure per implementation plan
- [X] T002 [P] Create Firebase Mock setup file in app2/src/\_\_tests\_\_/mocks/firebase.ts
- [X] T003 [P] Create Logger Mock setup file in app2/src/\_\_tests\_\_/mocks/logger.ts
- [X] T004 [P] Create Test Data Factory file in app2/src/\_\_tests\_\_/mocks/testData.ts

**Checkpoint**: 공통 테스트 인프라 준비 완료

---

## Phase 2: Foundational (차단 요소)

**목적**: 모든 사용자 스토리가 의존하는 핵심 Mock 및 유틸리티 구현

**⚠️ CRITICAL**: 이 단계가 완료되어야 사용자 스토리 작업을 시작할 수 있습니다

### Mock Factory 구현

- [X] T005 [P] Implement createMockNotification factory in app2/src/\_\_tests\_\_/mocks/testData.ts
- [X] T006 [P] Implement createMockWorkLog factory in app2/src/\_\_tests\_\_/mocks/testData.ts
- [X] T007 [P] Implement createMockApplicant factory in app2/src/\_\_tests\_\_/mocks/testData.ts

### Firebase Mock 구현

- [X] T008 Implement mockOnSnapshot with callback control in app2/src/\_\_tests\_\_/mocks/firebase.ts
- [X] T009 [P] Implement mockUpdateDoc with success/failure modes in app2/src/\_\_tests\_\_/mocks/firebase.ts
- [X] T010 [P] Implement mockDeleteDoc in app2/src/\_\_tests\_\_/mocks/firebase.ts
- [X] T011 [P] Implement createMockSnapshot helper in app2/src/\_\_tests\_\_/setup/mockFactories.ts

### 공통 Test Utilities

- [X] T012 [P] Create test data sets (minimal, realistic, edge cases) in app2/src/\_\_tests\_\_/mocks/testData.ts
- [X] T013 [P] Implement validation helpers in app2/src/\_\_tests\_\_/setup/validators.ts
- [X] T014 Update setupTests.ts to import Firebase and Logger mocks in app2/src/setupTests.ts

**Checkpoint**: Foundation 완료 - 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 지원자 관리 Hook 테스트 (Priority: P1) 🎯 MVP

**목표**: `useApplicantActions` Hook의 핵심 비즈니스 로직(지원자 승인/거부/일괄 처리)을 테스트 코드로 검증

**Independent Test**: 지원자 승인 테스트만 실행하면, "지원자를 승인하면 상태가 'approved'로 변경되고 Firebase가 올바르게 업데이트된다"는 것을 독립적으로 검증 가능

**Why P1**: 803줄의 복잡한 코드, 핵심 비즈니스 로직, 가장 높은 테스트 커버리지 필요

### 테스트 파일 생성

- [ ] T015 [US1] Create test file app2/src/components/applicants/ApplicantManagement/hooks/\_\_tests\_\_/useApplicantActions.test.ts

### 초기화 및 기본 동작 테스트

- [ ] T016 [P] [US1] Write test for initial state in useApplicantActions.test.ts
- [ ] T017 [P] [US1] Write test for loading applicants from Firestore in useApplicantActions.test.ts

### 단일 지원자 작업 테스트

- [ ] T018 [P] [US1] Write test for approving single applicant in useApplicantActions.test.ts
- [ ] T019 [P] [US1] Write test for rejecting single applicant in useApplicantActions.test.ts
- [ ] T020 [P] [US1] Write test for cancelling application in useApplicantActions.test.ts

### 일괄 작업 테스트

- [ ] T021 [P] [US1] Write test for bulk approval (Promise.all) in useApplicantActions.test.ts
- [ ] T022 [P] [US1] Write test for bulk rejection in useApplicantActions.test.ts
- [ ] T023 [US1] Write test for partial failure handling in bulk operations in useApplicantActions.test.ts

### 에러 처리 테스트 (최소 5개)

- [ ] T024 [P] [US1] Write test for Firebase permission error in useApplicantActions.test.ts
- [ ] T025 [P] [US1] Write test for network error and retry in useApplicantActions.test.ts
- [ ] T026 [P] [US1] Write test for validation error (incomplete data) in useApplicantActions.test.ts
- [ ] T027 [P] [US1] Write test for concurrent operation handling (race condition) in useApplicantActions.test.ts
- [ ] T028 [P] [US1] Write test for rollback on update failure in useApplicantActions.test.ts

### 엣지 케이스 테스트

- [ ] T029 [P] [US1] Write test for handling 100+ applicants (performance) in useApplicantActions.test.ts
- [ ] T030 [P] [US1] Write test for memory leak prevention (cleanup on unmount) in useApplicantActions.test.ts
- [ ] T031 [US1] Write test for state consistency during rapid updates in useApplicantActions.test.ts

### 커버리지 검증

- [ ] T032 [US1] Run coverage for useApplicantActions.test.ts and verify ≥70%
- [ ] T033 [US1] Add missing tests to reach 70% coverage for useApplicantActions

**Checkpoint**: User Story 1 완료 - 지원자 관리 Hook이 완전히 테스트되고 독립적으로 검증 가능

---

## Phase 4: User Story 2 - 급여 계산 Hook 테스트 (Priority: P2)

**목표**: `useScheduleData` Hook의 계산 로직(급여, 야간수당, 휴일수당, 연장수당)을 테스트 코드로 검증

**Independent Test**: 기본 급여 계산 테스트만 실행하면, "근무 시간에 따라 기본 급여가 정확히 계산된다"는 것을 독립적으로 검증 가능

**Why P2**: 323줄의 복잡한 계산 로직, 재무적 정확성 필요

### 테스트 파일 생성

- [ ] T034 [US2] Create test file app2/src/pages/MySchedulePage/components/hooks/\_\_tests\_\_/useScheduleData.test.ts

### 초기화 및 데이터 로드 테스트

- [ ] T035 [P] [US2] Write test for initial state in useScheduleData.test.ts
- [ ] T036 [P] [US2] Write test for loading work logs from Firestore in useScheduleData.test.ts

### 기본 급여 계산 테스트

- [ ] T037 [P] [US2] Write test for basic salary calculation (hours × rate) in useScheduleData.test.ts
- [ ] T038 [P] [US2] Write test for multiple work logs aggregation in useScheduleData.test.ts

### 수당 계산 테스트

- [ ] T039 [P] [US2] Write test for night shift allowance (22:00-06:00, +50%) in useScheduleData.test.ts
- [ ] T040 [P] [US2] Write test for holiday allowance (1.5x rate) in useScheduleData.test.ts
- [ ] T041 [P] [US2] Write test for overtime allowance (>40h/week, +50%) in useScheduleData.test.ts
- [ ] T042 [US2] Write test for combined allowances (night + holiday) in useScheduleData.test.ts

### 캐싱 동작 테스트

- [ ] T043 [P] [US2] Write test for caching with useMemo in useScheduleData.test.ts
- [ ] T044 [US2] Write test for cache invalidation on data change in useScheduleData.test.ts

### 데이터 변환 테스트

- [ ] T045 [P] [US2] Write test for Firebase data to UI format conversion in useScheduleData.test.ts
- [ ] T046 [P] [US2] Write test for date/time parsing in useScheduleData.test.ts

### 에러 처리 테스트 (최소 5개)

- [ ] T047 [P] [US2] Write test for invalid time range (end before start) in useScheduleData.test.ts
- [ ] T048 [P] [US2] Write test for negative hourly rate error in useScheduleData.test.ts
- [ ] T049 [P] [US2] Write test for missing required fields error in useScheduleData.test.ts
- [ ] T050 [P] [US2] Write test for future date validation in useScheduleData.test.ts
- [ ] T051 [P] [US2] Write test for Firestore read error handling in useScheduleData.test.ts

### 엣지 케이스 테스트

- [ ] T052 [P] [US2] Write test for 24-hour work shift in useScheduleData.test.ts
- [ ] T053 [P] [US2] Write test for empty work logs (zero salary) in useScheduleData.test.ts

### 커버리지 검증

- [ ] T054 [US2] Run coverage for useScheduleData.test.ts and verify ≥70%
- [ ] T055 [US2] Add missing tests to reach 70% coverage for useScheduleData

**Checkpoint**: User Story 2 완료 - 급여 계산 Hook이 완전히 테스트되고 독립적으로 검증 가능

---

## Phase 5: User Story 3 - 알림 시스템 Hook 테스트 (Priority: P3)

**목표**: `useNotifications` Hook의 실시간 구독 및 알림 관리 로직을 테스트 코드로 검증

**Independent Test**: 알림 구독 테스트만 실행하면, "Firestore 알림이 실시간으로 업데이트된다"는 것을 독립적으로 검증 가능

**Why P3**: 사용자 경험에 중요하지만 비즈니스 영향도는 상대적으로 낮음, 실시간 구독 테스트 복잡성

### 테스트 파일 생성

- [ ] T056 [US3] Create test file app2/src/hooks/\_\_tests\_\_/useNotifications.test.ts

### 초기화 및 실시간 구독 테스트

- [ ] T057 [P] [US3] Write test for initial state in useNotifications.test.ts
- [ ] T058 [P] [US3] Write test for Firestore onSnapshot subscription in useNotifications.test.ts
- [ ] T059 [P] [US3] Write test for real-time notification updates in useNotifications.test.ts
- [ ] T060 [US3] Write test for subscription cleanup on unmount in useNotifications.test.ts

### 알림 필터링 테스트

- [ ] T061 [P] [US3] Write test for filtering unread notifications in useNotifications.test.ts
- [ ] T062 [P] [US3] Write test for filtering by notification type in useNotifications.test.ts
- [ ] T063 [P] [US3] Write test for sorting notifications by createdAt in useNotifications.test.ts

### 알림 작업 테스트

- [ ] T064 [P] [US3] Write test for marking notification as read in useNotifications.test.ts
- [ ] T065 [P] [US3] Write test for marking all as read in useNotifications.test.ts
- [ ] T066 [P] [US3] Write test for deleting single notification in useNotifications.test.ts
- [ ] T067 [US3] Write test for bulk delete notifications in useNotifications.test.ts

### 에러 처리 테스트 (최소 5개)

- [ ] T068 [P] [US3] Write test for Firestore connection error in useNotifications.test.ts
- [ ] T069 [P] [US3] Write test for permission denied error in useNotifications.test.ts
- [ ] T070 [P] [US3] Write test for network timeout handling in useNotifications.test.ts
- [ ] T071 [P] [US3] Write test for invalid notification data handling in useNotifications.test.ts
- [ ] T072 [P] [US3] Write test for update failure rollback in useNotifications.test.ts

### 엣지 케이스 테스트

- [ ] T073 [P] [US3] Write test for handling 1000+ notifications (performance) in useNotifications.test.ts
- [ ] T074 [P] [US3] Write test for rapid notification updates (debouncing) in useNotifications.test.ts
- [ ] T075 [US3] Write test for memory leak prevention in useNotifications.test.ts

### 커버리지 검증

- [ ] T076 [US3] Run coverage for useNotifications.test.ts and verify ≥70%
- [ ] T077 [US3] Add missing tests to reach 70% coverage for useNotifications

**Checkpoint**: User Story 3 완료 - 알림 시스템 Hook이 완전히 테스트되고 독립적으로 검증 가능

---

## Phase 6: Polish & Cross-Cutting Concerns

**목적**: 전체 테스트 스위트 최적화 및 검증

### 전체 커버리지 검증

- [ ] T078 [P] Run full test suite with coverage (npm run test:coverage)
- [ ] T079 Verify overall coverage ≥65% and each Hook ≥70%
- [ ] T080 Generate and review coverage report (HTML)

### 성능 검증

- [ ] T081 [P] Measure total test execution time (must be ≤8 seconds)
- [ ] T082 Optimize slow tests if needed (reduce waitFor timeouts)
- [ ] T083 [P] Verify parallel test execution works correctly

### 코드 품질

- [X] T084 [P] Run TypeScript type-check (npm run type-check) on all test files
- [X] T085 [P] Run ESLint on all test files (npm run lint)
- [X] T086 Refactor duplicate test code into shared helpers

### 문서화

- [X] T087 [P] Update CLAUDE.md with test coverage status
- [X] T088 [P] Add test execution guide to README.md
- [X] T089 Validate quickstart.md examples work correctly

### CI/CD 통합

- [ ] T090 [P] Verify tests pass in CI environment (GitHub Actions)
- [ ] T091 Add coverage reporting to CI pipeline (Codecov)

### 최종 검증

- [ ] T092 Run all quality gates (type-check, lint, test, build)
- [ ] T093 Verify no production code changes broke existing functionality
- [ ] T094 Review and close all tasks.md checkboxes

**Checkpoint**: 전체 테스트 스위트 완성 및 검증 완료

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 - 모든 사용자 스토리 차단
- **User Stories (Phase 3-5)**: Foundational 완료 후
  - 사용자 스토리는 병렬 진행 가능 (인력 충분 시)
  - 또는 우선순위 순서로 순차 진행 (P1 → P2 → P3)
- **Polish (Phase 6)**: 모든 원하는 사용자 스토리 완료 후

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 완료 후 시작 가능 - 다른 스토리와 독립적
- **User Story 2 (P2)**: Foundational 완료 후 시작 가능 - 다른 스토리와 독립적
- **User Story 3 (P3)**: Foundational 완료 후 시작 가능 - 다른 스토리와 독립적

### 각 User Story 내부

- 테스트 파일 생성 → 초기화 테스트 → 핵심 기능 테스트 → 에러 처리 → 엣지 케이스 → 커버리지 검증
- 동일 파일 내 테스트는 순차 작성 권장 (일부 [P] 표시는 다른 테스트와 병렬 작성 가능)

### Parallel Opportunities

- Phase 1: T002, T003, T004 병렬 실행 가능
- Phase 2: 대부분의 Factory 구현 병렬 가능 (T005, T006, T007, T009, T010, T011, T012, T013)
- Phase 3-5: 전체 User Story를 팀원별로 병렬 진행 가능
- Phase 6: 대부분의 검증 작업 병렬 가능

---

## Parallel Example: User Story 1

```bash
# User Story 1의 테스트들을 병렬로 작성 가능 (다른 테스트 블록):
Task: "Write test for initial state" (T016)
Task: "Write test for loading applicants" (T017)
Task: "Write test for approving single applicant" (T018)
Task: "Write test for rejecting single applicant" (T019)

# Mock Factory들을 병렬로 구현 가능:
Task: "Implement createMockNotification" (T005)
Task: "Implement createMockWorkLog" (T006)
Task: "Implement createMockApplicant" (T007)
```

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료 (CRITICAL - 모든 스토리 차단)
3. Phase 3: User Story 1 완료
4. **STOP and VALIDATE**: User Story 1 독립적으로 테스트
5. 커버리지 70% 달성 확인

### Incremental Delivery

1. Setup + Foundational → Foundation 준비
2. User Story 1 추가 → 독립 테스트 → 검증 (MVP!)
3. User Story 2 추가 → 독립 테스트 → 검증
4. User Story 3 추가 → 독립 테스트 → 검증
5. 각 스토리가 이전 스토리를 깨지 않고 가치 추가

### Parallel Team Strategy

여러 개발자가 있을 때:

1. 팀이 함께 Setup + Foundational 완료
2. Foundational 완료 후:
   - Developer A: User Story 1 (useApplicantActions)
   - Developer B: User Story 2 (useScheduleData)
   - Developer C: User Story 3 (useNotifications)
3. 각 스토리 독립적으로 완료 및 통합

---

## Notes

- **[P]** 작업 = 다른 파일, 의존성 없음
- **[Story]** 라벨 = 특정 사용자 스토리에 작업 매핑
- 각 사용자 스토리는 독립적으로 완료 및 테스트 가능
- 각 작업 또는 논리적 그룹 후 커밋
- 각 체크포인트에서 스토리를 독립적으로 검증
- 피해야 할 것: 모호한 작업, 같은 파일 충돌, 독립성을 해치는 스토리 간 의존성
