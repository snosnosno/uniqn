# Tasks: AuthContext 단위 및 통합 테스트

**Input**: Design documents from `/specs/001-authcontext-tests/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

프로젝트 구조 (단일 애플리케이션):
- **테스트 디렉토리**: `app2/src/contexts/__tests__/`
- **Mock 디렉토리**: `app2/src/contexts/__tests__/__mocks__/`
- **프로덕션 코드**: `app2/src/contexts/AuthContext.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 테스트 환경 초기화 및 디렉토리 구조 생성

- [ ] T001 Create test directory structure: `app2/src/contexts/__tests__/` and `app2/src/contexts/__tests__/__mocks__/`
- [ ] T002 Verify Jest configuration in `app2/package.json` (react-scripts includes Jest)
- [ ] T003 [P] Verify TypeScript configuration for test files in `app2/tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Firebase Auth Mock 구현 및 테스트 유틸리티 - 모든 User Story가 의존하는 핵심 인프라

**⚠️ CRITICAL**: 이 Phase가 완료되기 전까지 User Story 작업을 시작할 수 없습니다

- [ ] T004 Create Firebase Auth Mock base structure in `app2/src/contexts/__tests__/__mocks__/firebase.ts`
- [ ] T005 [P] Create test user presets (admin, manager, regular, unverified) in `app2/src/contexts/__tests__/__mocks__/test-users.ts`
- [ ] T006 [P] Create test token presets (admin token, manager token, no role token) in `app2/src/contexts/__tests__/__mocks__/test-tokens.ts`
- [ ] T007 [P] Create test error presets (12 error cases) in `app2/src/contexts/__tests__/__mocks__/test-errors.ts`
- [ ] T008 Create test utilities (renderWithAuth wrapper) in `app2/src/contexts/__tests__/__mocks__/test-utils.tsx`
- [ ] T009 Implement Mock functions for Firebase Auth (signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdTokenResult) in `app2/src/contexts/__tests__/__mocks__/firebase.ts`
- [ ] T010 Add Mock setup and cleanup utilities (resetMocks, setMockUser, setMockRole, setMockError) in `app2/src/contexts/__tests__/__mocks__/test-utils.tsx`

**Checkpoint**: Foundation ready - User Story 테스트 작성을 이제 병렬로 시작할 수 있습니다

---

## Phase 3: User Story 1 - 핵심 인증 로직 검증 (Priority: P1) 🎯 MVP

**Goal**: 개발 팀이 사용자 인증의 핵심 기능(로그인, 로그아웃, 세션 관리)이 정상적으로 동작함을 확신할 수 있어야 합니다.

**Independent Test**: useAuth Hook을 독립적으로 테스트하여 인증 상태 변경, 사용자 정보 반환, 로그아웃 동작을 검증할 수 있습니다.

**Acceptance Scenarios**:
1. ✅ 유효한 자격 증명으로 로그인 시 인증 상태가 true로 변경되고 사용자 정보가 반환됨
2. ✅ 로그아웃 시 인증 상태가 false로 변경되고 사용자 정보가 null이 됨
3. ✅ 잘못된 자격 증명으로 로그인 시 인증 실패 에러가 발생하고 인증 상태는 false 유지
4. ✅ 페이지 새로고침 시 세션이 유지되고 사용자 정보가 복원됨

### US1 테스트 작성

- [ ] T011 [P] [US1] Setup test file structure and imports in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T012 [P] [US1] Write test: "useAuth Hook returns all context values" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T013 [P] [US1] Write test: "signIn with valid credentials updates auth state to true" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T014 [P] [US1] Write test: "signIn with valid credentials returns user information" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T015 [P] [US1] Write test: "signOut updates auth state to false and user to null" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T016 [P] [US1] Write test: "signOut clears session data from localStorage" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T017 [P] [US1] Write test: "signIn with invalid credentials throws authentication error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T018 [P] [US1] Write test: "signIn with invalid credentials keeps auth state as false" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T019 [P] [US1] Write test: "page refresh maintains session and restores user info" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T020 [P] [US1] Write test: "onAuthStateChanged callback is triggered on auth state changes" in `app2/src/contexts/__tests__/AuthContext.test.tsx`

### US1 검증

- [ ] T021 [US1] Run User Story 1 tests: `npm test AuthContext.test.tsx`
- [ ] T022 [US1] Verify all US1 tests pass (10 tests for acceptance scenarios)
- [ ] T023 [US1] Check US1 code coverage: `npm run test:coverage -- --collectCoverageFrom="src/contexts/AuthContext.tsx"`

**Checkpoint**: User Story 1이 완전히 기능하고 독립적으로 테스트 가능해야 합니다 (MVP 완성!)

---

## Phase 4: User Story 2 - 역할 기반 권한 검증 (Priority: P2)

**Goal**: 개발 팀이 사용자 역할(admin, manager)에 따른 권한 검증 로직이 정확하게 동작함을 확신할 수 있어야 합니다.

**Independent Test**: 역할 검증 함수(isAdmin, hasRole)를 독립적으로 테스트하여 각 역할에 대한 권한 확인이 정확한지 검증할 수 있습니다.

**Acceptance Scenarios**:
1. ✅ admin 역할로 로그인한 상태에서 관리자 권한 확인 시 권한이 있음으로 반환됨
2. ✅ manager 역할로 로그인한 상태에서 관리자 권한 확인 시 권한이 있음으로 반환됨 (manager도 isAdmin=true)
3. ✅ 역할 없이 로그인한 상태에서 특정 역할 권한 확인 시 권한이 없음으로 반환됨
4. ✅ 인증되지 않은 상태에서 권한 확인 시 권한이 없음으로 반환됨

### US2 테스트 작성

- [ ] T024 [P] [US2] Write test: "isAdmin returns true for admin role" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T025 [P] [US2] Write test: "isAdmin returns true for manager role" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T026 [P] [US2] Write test: "isAdmin returns false for users without role" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T027 [P] [US2] Write test: "isAdmin returns false for unauthenticated users" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T028 [P] [US2] Write test: "role returns 'admin' for admin users" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T029 [P] [US2] Write test: "role returns 'manager' for manager users" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T030 [P] [US2] Write test: "role returns null for users without role" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T031 [P] [US2] Write test: "getIdTokenResult is called to fetch user role claims" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T032 [P] [US2] Write test: "role state updates when user role changes on server" in `app2/src/contexts/__tests__/AuthContext.test.tsx`

### US2 검증

- [ ] T033 [US2] Run User Story 2 tests: `npm test -- --testNamePattern="isAdmin|role"`
- [ ] T034 [US2] Verify all US2 tests pass (9 tests for role verification)
- [ ] T035 [US2] Check cumulative coverage including US1 and US2

**Checkpoint**: User Stories 1 AND 2가 모두 독립적으로 작동해야 합니다

---

## Phase 5: User Story 3 - 에러 및 엣지 케이스 처리 (Priority: P3)

**Goal**: 개발 팀이 네트워크 오류, Firebase 인증 오류, 중복 로그인 시도 등 비정상 상황에서도 시스템이 안정적으로 동작함을 확신할 수 있어야 합니다.

**Independent Test**: 각 에러 케이스를 시뮬레이션하여 AuthContext가 적절한 에러 메시지를 제공하고 시스템이 크래시하지 않는지 검증할 수 있습니다.

**Acceptance Scenarios**:
1. ✅ 네트워크 연결 불가 상태에서 로그인 시도 시 네트워크 에러 메시지가 반환되고 인증 상태는 false 유지
2. ✅ Firebase 인증 서버 오류 시 서버 에러 메시지가 반환되고 시스템은 정상 동작
3. ✅ 이미 로그인 진행 중일 때 중복 로그인 시도 시 이전 요청이 완료될 때까지 새 요청은 대기하거나 거부됨
4. ✅ 세션 만료 상태에서 보호된 리소스 접근 시 자동으로 로그아웃 처리되고 로그인 화면으로 리다이렉트

### US3 에러 케이스 테스트 (최소 12개)

- [ ] T036 [P] [US3] Write test: "signIn handles auth/wrong-password error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T037 [P] [US3] Write test: "signIn handles auth/user-not-found error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T038 [P] [US3] Write test: "signIn handles auth/invalid-email error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T039 [P] [US3] Write test: "signIn handles auth/user-disabled error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T040 [P] [US3] Write test: "signIn handles auth/network-request-failed error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T041 [P] [US3] Write test: "signIn handles auth/too-many-requests error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T042 [P] [US3] Write test: "signInWithGoogle handles auth/popup-closed-by-user error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T043 [P] [US3] Write test: "sendPasswordReset handles auth/expired-action-code error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T044 [P] [US3] Write test: "sendPasswordReset handles auth/invalid-action-code error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T045 [P] [US3] Write test: "getIdTokenResult handles auth/id-token-expired error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T046 [P] [US3] Write test: "Firebase Auth handles auth/claims-too-large error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T047 [P] [US3] Write test: "Firebase Auth handles auth/app-not-initialized error" in `app2/src/contexts/__tests__/AuthContext.test.tsx`

### US3 엣지 케이스 테스트 (8개)

- [ ] T048 [P] [US3] Write test: "session expiry triggers automatic logout" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T049 [P] [US3] Write test: "logout in one tab updates auth state in other tabs" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T050 [P] [US3] Write test: "offline to online transition restores session" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T051 [P] [US3] Write test: "Firebase Auth initialization failure is handled gracefully" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T052 [P] [US3] Write test: "rapid login/logout sequence is handled correctly" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T053 [P] [US3] Write test: "corrupted or tampered token is rejected" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T054 [P] [US3] Write test: "role change on server is reflected on client" in `app2/src/contexts/__tests__/AuthContext.test.tsx`
- [ ] T055 [P] [US3] Write test: "concurrent login from multiple devices is handled" in `app2/src/contexts/__tests__/AuthContext.test.tsx`

### US3 검증

- [ ] T056 [US3] Run User Story 3 tests: `npm test -- --testNamePattern="error|edge case"`
- [ ] T057 [US3] Verify all US3 tests pass (20 tests: 12 errors + 8 edge cases)
- [ ] T058 [US3] Check cumulative coverage including US1, US2, and US3

**Checkpoint**: 모든 에러 및 엣지 케이스가 안정적으로 처리되어야 합니다

---

## Phase 6: User Story 4 - 통합 시나리오 검증 (Priority: P4)

**Goal**: 개발 팀이 인증 시스템이 다른 컴포넌트들과 통합된 환경에서도 정상적으로 동작함을 확신할 수 있어야 합니다.

**Independent Test**: 실제 컴포넌트 트리를 구성하여 로그인 → 페이지 접근 → 로그아웃 전체 흐름을 테스트할 수 있습니다.

**Acceptance Scenarios**:
1. ✅ 로그인 → 대시보드 접근 → 역할 확인 시 모든 단계가 정상적으로 동작하고 올바른 페이지가 표시됨
2. ✅ 로그아웃 → 세션 정리 → 보호된 페이지 접근 시도 시 로그인 화면으로 리다이렉트됨
3. ✅ manager 역할로 로그인 후 admin 전용 페이지 접근 시도 시 접근 거부되고 적절한 에러 메시지 표시
4. ✅ 토큰 만료 시간 경과 시 자동으로 로그아웃 처리되고 다음 요청 시 재로그인 요구

### US4 통합 테스트 작성

- [ ] T059 [US4] Create integration test file in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T060 [P] [US4] Write integration test: "complete login flow with dashboard access and role verification" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T061 [P] [US4] Write integration test: "complete logout flow with session cleanup and redirect" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T062 [P] [US4] Write integration test: "role-based access control prevents unauthorized page access" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T063 [P] [US4] Write integration test: "token expiry triggers automatic logout and re-login prompt" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T064 [P] [US4] Write integration test: "remember me functionality persists session across page refreshes" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T065 [P] [US4] Write integration test: "session-only mode clears session on browser close" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T066 [P] [US4] Write integration test: "Google login flow integrates correctly with auth state" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T067 [P] [US4] Write integration test: "Kakao login flow integrates correctly with custom token" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T068 [P] [US4] Write integration test: "email verification flow updates user state correctly" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`
- [ ] T069 [P] [US4] Write integration test: "password reset flow completes successfully" in `app2/src/contexts/__tests__/AuthContext.integration.test.tsx`

### US4 검증

- [ ] T070 [US4] Run User Story 4 integration tests: `npm test AuthContext.integration.test.tsx`
- [ ] T071 [US4] Verify all US4 integration tests pass (11 integration scenarios)
- [ ] T072 [US4] Check final coverage including all user stories

**Checkpoint**: 모든 User Stories가 독립적으로 기능하며 통합 시나리오도 정상 작동해야 합니다

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 커버리지 검증, 성능 최적화, CI/CD 통합, 문서화

- [ ] T073 Verify test coverage meets 80% threshold: `npm run test:coverage -- --coverageThreshold='{"global":{"lines":80,"branches":80,"functions":80,"statements":80}}'`
- [ ] T074 [P] Verify test execution time is under 5 seconds: `npm test -- --verbose`
- [ ] T075 [P] Run TypeScript type check on test files: `npm run type-check`
- [ ] T076 [P] Run linter on test files: `npm run lint`
- [ ] T077 [P] Optimize slow tests (if execution time exceeds 5 seconds)
- [ ] T078 Setup GitHub Actions workflow for automated testing in `.github/workflows/test.yml`
- [ ] T079 [P] Add coverage reporting to CI/CD pipeline (Codecov integration)
- [ ] T080 [P] Update CLAUDE.md with test commands and coverage requirements
- [ ] T081 [P] Add test documentation comments to complex test scenarios
- [ ] T082 Run full test suite in CI mode: `npm run test:ci`
- [ ] T083 Verify all quality gates pass: `npm run type-check && npm run lint && npm run test:ci && npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - **BLOCKS all user stories**
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - **No dependencies on other stories** ✅ MVP
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - **No dependencies on other stories** ✅ Independent
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - **No dependencies on other stories** ✅ Independent
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Uses US1/US2/US3 functionality but tests remain independent

### Within Each User Story

- All tests for a story marked [P] can run in parallel (different test cases)
- Tests should be written and verified to pass before moving to next story
- Each story should be verified independently before proceeding

### Parallel Opportunities

- **Phase 1 (Setup)**: Tasks T002 and T003 marked [P] can run in parallel
- **Phase 2 (Foundational)**: Tasks T005, T006, T007 can run in parallel (different files)
- **Phase 3 (US1)**: All test tasks T012-T020 can be written in parallel (different test cases in same file)
- **Phase 4 (US2)**: All test tasks T024-T032 can be written in parallel
- **Phase 5 (US3)**: All test tasks T036-T055 can be written in parallel (20 tests)
- **Phase 6 (US4)**: All test tasks T060-T069 can be written in parallel (10 integration tests)
- **Phase 7 (Polish)**: Tasks T074, T075, T076, T079, T080, T081 can run in parallel
- **Across User Stories**: Once Foundational is complete, all user stories (Phase 3-6) can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write test: useAuth Hook returns all context values"
Task: "Write test: signIn with valid credentials updates auth state to true"
Task: "Write test: signIn with valid credentials returns user information"
Task: "Write test: signOut updates auth state to false and user to null"
Task: "Write test: signOut clears session data from localStorage"
Task: "Write test: signIn with invalid credentials throws authentication error"
Task: "Write test: signIn with invalid credentials keeps auth state as false"
Task: "Write test: page refresh maintains session and restores user info"
Task: "Write test: onAuthStateChanged callback is triggered on auth state changes"

# All 9 tests can be written simultaneously in app2/src/contexts/__tests__/AuthContext.test.tsx
```

---

## Parallel Example: User Story 3

```bash
# Launch all error case tests for User Story 3 together:
Task: "Write test: signIn handles auth/wrong-password error"
Task: "Write test: signIn handles auth/user-not-found error"
Task: "Write test: signIn handles auth/invalid-email error"
Task: "Write test: signIn handles auth/user-disabled error"
Task: "Write test: signIn handles auth/network-request-failed error"
Task: "Write test: signIn handles auth/too-many-requests error"
Task: "Write test: signInWithGoogle handles auth/popup-closed-by-user error"
Task: "Write test: sendPasswordReset handles auth/expired-action-code error"
Task: "Write test: sendPasswordReset handles auth/invalid-action-code error"
Task: "Write test: getIdTokenResult handles auth/id-token-expired error"
Task: "Write test: Firebase Auth handles auth/claims-too-large error"
Task: "Write test: Firebase Auth handles auth/app-not-initialized error"

# All 12 error tests can be written simultaneously in app2/src/contexts/__tests__/AuthContext.test.tsx

# Launch all edge case tests for User Story 3 together:
Task: "Write test: session expiry triggers automatic logout"
Task: "Write test: logout in one tab updates auth state in other tabs"
Task: "Write test: offline to online transition restores session"
Task: "Write test: Firebase Auth initialization failure is handled gracefully"
Task: "Write test: rapid login/logout sequence is handled correctly"
Task: "Write test: corrupted or tampered token is rejected"
Task: "Write test: role change on server is reflected on client"
Task: "Write test: concurrent login from multiple devices is handled"

# All 8 edge case tests can be written simultaneously in app2/src/contexts/__tests__/AuthContext.test.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Tasks T001-T003)
2. Complete Phase 2: Foundational (Tasks T004-T010) - **CRITICAL - blocks all stories**
3. Complete Phase 3: User Story 1 (Tasks T011-T023)
4. **STOP and VALIDATE**: Run User Story 1 tests independently
5. Verify coverage for core authentication logic

**Expected Result**: AuthContext의 핵심 인증 기능(로그인, 로그아웃, 세션 관리)에 대한 테스트가 완성되고 80% 커버리지 목표의 약 30-40%를 달성합니다.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP 완성! (핵심 인증 로직 검증)
3. Add User Story 2 → Test independently → 역할 기반 권한 검증 추가
4. Add User Story 3 → Test independently → 에러 및 엣지 케이스 처리 완료
5. Add User Story 4 → Test independently → 통합 시나리오 검증 완료
6. Polish → Final validation → 80% 커버리지 달성 및 CI/CD 통합

**Each story adds value without breaking previous stories**

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Tasks T001-T010)
2. Once Foundational is done:
   - Developer A: User Story 1 (Tasks T011-T023) - 핵심 인증 로직
   - Developer B: User Story 2 (Tasks T024-T035) - 역할 기반 권한
   - Developer C: User Story 3 (Tasks T036-T058) - 에러 및 엣지 케이스
   - Developer D: User Story 4 (Tasks T059-T072) - 통합 시나리오
3. Stories complete and integrate independently

---

## Task Summary

### Total Tasks by Phase

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 7 tasks (BLOCKS all user stories)
- **Phase 3 (US1 - MVP)**: 13 tasks (10 test cases + 3 verification)
- **Phase 4 (US2)**: 12 tasks (9 test cases + 3 verification)
- **Phase 5 (US3)**: 23 tasks (20 test cases + 3 verification)
- **Phase 6 (US4)**: 14 tasks (11 integration tests + 3 verification)
- **Phase 7 (Polish)**: 11 tasks (coverage, CI/CD, documentation)

**Total**: 83 tasks

### Test Count by User Story

- **User Story 1**: 10 tests (핵심 인증 로직)
- **User Story 2**: 9 tests (역할 기반 권한)
- **User Story 3**: 20 tests (12 에러 케이스 + 8 엣지 케이스)
- **User Story 4**: 11 tests (통합 시나리오)

**Total**: 50 tests

### Parallel Opportunities

- **Setup**: 2 parallel tasks (T002, T003)
- **Foundational**: 3 parallel tasks (T005, T006, T007)
- **User Story 1**: 9 parallel test tasks (T012-T020)
- **User Story 2**: 9 parallel test tasks (T024-T032)
- **User Story 3**: 20 parallel test tasks (T036-T055)
- **User Story 4**: 10 parallel test tasks (T060-T069)
- **Polish**: 6 parallel tasks (T074-T081, excluding T073, T078, T082, T083)
- **Across Stories**: All 4 user stories can be worked on in parallel after Foundational

**Total Parallel Opportunities**: 59 tasks can run in parallel at various stages

### Independent Test Criteria

Each user story can be independently tested:

- **US1**: Run `npm test -- --testNamePattern="signIn|signOut|session"`
- **US2**: Run `npm test -- --testNamePattern="isAdmin|role"`
- **US3**: Run `npm test -- --testNamePattern="error|edge case"`
- **US4**: Run `npm test AuthContext.integration.test.tsx`

### Suggested MVP Scope

**MVP = User Story 1 only** (Tasks T001-T023)

- Setup + Foundational + US1 = 23 tasks
- Delivers: 핵심 인증 로직 검증 (로그인, 로그아웃, 세션 관리)
- Expected Coverage: 30-40% of AuthContext
- Expected Time: Day 1 (8 hours)

---

## Format Validation

✅ **All tasks follow the checklist format**:
- Every task starts with `- [ ]`
- Every task has a sequential Task ID (T001-T083)
- Tasks that can run in parallel are marked with `[P]`
- User Story phase tasks are labeled with `[US1]`, `[US2]`, `[US3]`, or `[US4]`
- Every task includes exact file paths
- Descriptions are clear and actionable

---

## Notes

- [P] tasks = different files or test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run tests frequently during development: `npm test -- --watch`
- Use `npm run test:coverage` to track progress toward 80% goal
- Follow TDD approach: Write test → Verify it fails → Run test → Verify it passes
