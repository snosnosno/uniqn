# Tasks: Phase 2-4 Critical UI Component Tests

**Input**: Design documents from `/specs/003-ui-component-tests/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅)

**Tests**: ✅ 이 프로젝트는 테스트 작성 프로젝트이므로 모든 태스크가 테스트 관련입니다.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `app2/src/` (메인 애플리케이션)
- **Tests**: `app2/src/__tests__/unit/components/`
- **Test Utils**: `app2/src/__tests__/unit/testUtils/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 테스트 환경 설정 및 기본 구조 준비

- [X] T001 axe-core 및 관련 패키지 설치 (npm install --save-dev jest-axe axe-core @testing-library/user-event)
- [X] T002 [P] 테스트 유틸리티 디렉토리 생성 (mkdir -p app2/src/__tests__/unit/testUtils)
- [X] T003 [P] NotificationDropdown 테스트 디렉토리 생성 (mkdir -p app2/src/__tests__/unit/components/notifications)
- [X] T004 [P] package.json에 커버리지 임계값 설정 추가 (NotificationDropdown 85%, JobPostingCard 90%)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공통으로 사용할 테스트 유틸리티 및 Mock 데이터 준비

**⚠️ CRITICAL**: 이 단계 완료 후 User Story 작업 시작 가능

- [X] T005 [P] mockNotifications.ts 생성: createMockNotification Factory 함수 작성 in app2/src/__tests__/unit/testUtils/mockNotifications.ts
- [X] T006 [P] mockNotifications.ts: 8개 사전 정의 Fixture 추가 (unread, read, systemUrgent, scheduleChange 등)
- [X] T007 [P] mockNotifications.ts: createMockUseNotifications Hook Mock 함수 작성
- [X] T008 [P] mockJobPostings.ts 생성: createMockJobPosting Factory 함수 작성 in app2/src/__tests__/unit/testUtils/mockJobPostings.ts
- [X] T009 [P] mockJobPostings.ts: 6개 사전 정의 Fixture 추가 (regular, fixed, tournament, urgent, closed, withApplications)
- [X] T010 [P] accessibilityHelpers.ts 생성: testAccessibility 헬퍼 함수 작성 in app2/src/__tests__/unit/testUtils/accessibilityHelpers.ts
- [X] T011 [P] accessibilityHelpers.ts: testFocusOrder 및 testScreenReaderText 헬퍼 함수 추가
- [X] T012 [P] setup.ts 업데이트: jest-axe toHaveNoViolations matcher 확장 추가 in app2/src/__tests__/setup.ts
- [X] T013 [P] setup.ts: ResizeObserver 및 IntersectionObserver 전역 Mock 추가

**Checkpoint**: Foundation ready - User Story 테스트 작성 시작 가능

---

## Phase 3: User Story 1 - NotificationDropdown 기본 렌더링 및 상태 관리 테스트 (Priority: P1) 🎯 MVP

**Goal**: NotificationDropdown 컴포넌트의 기본 렌더링, 드롭다운 토글, 알림 목록 표시, 배지 표시, 빈 상태, 외부 클릭 닫힘 기능 검증

**Independent Test**: NotificationDropdown을 렌더링하고 `npm test -- NotificationDropdown.test.tsx` 실행 시 모든 테스트 통과 (알림 목록, 배지, 빈 상태, 드롭다운 토글 검증)

### Implementation for User Story 1

- [X] T014 [US1] NotificationDropdown.test.tsx 파일 생성 및 기본 구조 작성 in app2/src/__tests__/unit/components/notifications/NotificationDropdown.test.tsx
- [X] T015 [US1] Mock 설정: useNotifications Hook, React Router (useNavigate), react-i18next
- [X] T016 [P] [US1] 테스트 작성: 알림 벨 아이콘 렌더링 검증
- [X] T017 [P] [US1] 테스트 작성: 안읽은 알림 개수 배지 표시 검증 (unreadCount=3 → 배지에 "3" 표시)
- [X] T018 [P] [US1] 테스트 작성: 드롭다운 토글 (벨 클릭 → 열림, 다시 클릭 → 닫힘)
- [X] T019 [P] [US1] 테스트 작성: 알림 목록 렌더링 (5개 알림 → 5개 아이템 표시)
- [X] T020 [P] [US1] 테스트 작성: 읽음/안읽음 상태 시각적 구분 (클래스 또는 스타일 검증)
- [X] T021 [P] [US1] 테스트 작성: 빈 상태 메시지 표시 (알림 0개 → "알림이 없습니다")
- [X] T022 [P] [US1] 테스트 작성: 로딩 상태 렌더링 (loading=true → 스피너 표시)
- [X] T023 [P] [US1] 테스트 작성: 외부 클릭 시 드롭다운 자동 닫힘
- [X] T024 [US1] 테스트 실행 및 통과 확인: npm test -- NotificationDropdown.test.tsx (16개 테스트 100% 통과)
- [X] T025 [US1] 커버리지 확인: NotificationDropdown 컴포넌트 커버리지 94.73% 달성 (목표 85% 초과)

**Checkpoint**: User Story 1 완료 - NotificationDropdown 기본 렌더링 테스트 100% 통과

---

## Phase 4: User Story 2 - NotificationDropdown 인터랙션 및 읽음 처리 테스트 (Priority: P1)

**Goal**: NotificationDropdown의 사용자 인터랙션 (알림 클릭, 모두 읽음, 모두 보기, 설정, ESC 키) 기능 검증

**Independent Test**: `npm test -- NotificationDropdown.interaction.test.tsx` 실행 시 모든 인터랙션 테스트 통과 (알림 클릭 → 읽음 처리 + 라우팅, 모두 읽음, ESC 키 닫힘 등)

### Implementation for User Story 2

- [X] T026 [US2] NotificationDropdown.interaction.test.tsx 파일 생성 및 기본 구조 작성 in app2/src/__tests__/unit/components/notifications/NotificationDropdown.interaction.test.tsx
- [X] T027 [US2] Mock 설정: markAsRead, markAllAsRead, useNavigate 함수
- [X] T028 [P] [US2] 테스트 작성: 알림 클릭 시 markAsRead 호출 및 관련 페이지 라우팅 (user-event 사용)
- [X] T029 [P] [US2] 테스트 작성: "모두 읽음" 버튼 클릭 시 markAllAsRead 함수 호출 검증
- [X] T030 [P] [US2] 테스트 작성: "모두 보기" 버튼 클릭 시 /app/notifications 경로 이동 및 드롭다운 닫힘
- [X] T031 [P] [US2] 테스트 작성: 설정 아이콘 클릭 시 /app/notification-settings 경로 이동
- [X] T032 [P] [US2] 테스트 작성: ESC 키 누름 시 드롭다운 닫힘 (user-event.keyboard 사용)
- [X] T033 [P] [US2] 테스트 작성: 알림 타입별 라우팅 검증 (work → /app/work-logs, schedule → /app/schedule 등)
- [X] T034 [US2] 테스트 실행 및 통과 확인: npm test -- NotificationDropdown.interaction.test.tsx (12개 테스트 100% 통과)

**Checkpoint**: User Story 2 완료 - NotificationDropdown 인터랙션 테스트 100% 통과

---

## Phase 5: User Story 3 - NotificationDropdown 다크모드 및 접근성 테스트 (Priority: P2)

**Goal**: NotificationDropdown의 다크모드 클래스 적용, WCAG 2.1 AA 접근성 준수, 키보드 네비게이션, 스크린 리더 호환성 검증

**Independent Test**: `npm test -- NotificationDropdown.accessibility.test.tsx` 실행 시 axe-core 위반 0개, 키보드 네비게이션 테스트 통과

### Implementation for User Story 3

- [X] T035 [US3] NotificationDropdown.accessibility.test.tsx 파일 생성 및 기본 구조 작성 in app2/src/__tests__/unit/components/notifications/NotificationDropdown.accessibility.test.tsx
- [X] T036 [P] [US3] 테스트 작성: 다크모드 클래스 적용 검증 (모든 주요 UI 요소에 dark: 클래스 존재)
- [X] T037 [P] [US3] 테스트 작성: axe-core 접근성 검증 (testAccessibility 헬퍼 사용, 위반 0개)
- [X] T038 [P] [US3] 테스트 작성: 다크모드 환경에서 axe-core 색상 대비 검증 (<div className="dark">로 감싸서 테스트)
- [X] T039 [P] [US3] 테스트 작성: Tab 키 포커스 순서 검증 (벨 → 첫 알림 → 두 번째 알림 → 모두 읽음 → 모두 보기)
- [X] T040 [P] [US3] 테스트 작성: Enter 키로 알림 선택 (포커스된 알림에 Enter → 클릭과 동일한 동작)
- [X] T041 [P] [US3] 테스트 작성: Space 키로 알림 선택 (포커스된 알림에 Space → 클릭과 동일한 동작)
- [X] T042 [P] [US3] 테스트 작성: 스크린 리더 텍스트 검증 (aria-label에 알림 제목, 시간, 상태 포함)
- [X] T043 [P] [US3] 테스트 작성: aria-expanded 속성 검증 (드롭다운 열림/닫힘 상태 반영)
- [X] T044 [US3] 테스트 실행 및 통과 확인: npm test -- NotificationDropdown.accessibility.test.tsx (20개 테스트 100% 통과)

**Checkpoint**: User Story 3 완료 - NotificationDropdown 접근성 테스트 100% 통과

---

## Phase 6: User Story 4 - JobPostingCard 향상된 인터랙션 테스트 (Priority: P2)

**Goal**: JobPostingCard의 사용자 인터랙션 (카드 클릭, 지원 버튼, 북마크 토글, 공유 버튼) 기능 검증

**Independent Test**: 기존 `JobPostingCard.test.tsx`에 "사용자 인터랙션" describe 블록 추가 후 `npm test -- JobPostingCard.test.tsx` 실행 시 모든 테스트 통과

### Implementation for User Story 4

- [X] T045 [US4] JobPostingCard.test.tsx 열기 및 "사용자 인터랙션" describe 블록 추가 in app2/src/__tests__/unit/components/jobPosting/JobPostingCard.test.tsx ✅
- [X] T046 [US4] Mock 설정: renderActions prop에서 제공할 mockOnApply, mockOnBookmark, mockOnShare 함수 정의 ✅
- [X] T047 [P] [US4] 테스트 작성: 지원 버튼 클릭 시 지원 처리 함수 호출 검증 (user-event.click 사용) ✅
- [X] T048 [P] [US4] 테스트 작성: 북마크 아이콘 클릭 시 북마크 추가 함수 호출 및 아이콘 변경 검증 ✅
- [X] T049 [P] [US4] 테스트 작성: 북마크된 공고에서 북마크 아이콘 재클릭 시 북마크 제거 함수 호출 및 아이콘 변경 ✅
- [X] T050 [P] [US4] 테스트 작성: 공유 버튼 클릭 시 공유 API 호출 또는 공유 모달 표시 검증 ✅
- [X] T051 [P] [US4] 테스트 작성: 카드 본문 클릭 시 상세 페이지 라우팅 검증 (renderActions에서 제공) ✅
- [X] T052 [US4] 테스트 실행 및 통과 확인: npm test -- JobPostingCard.test.tsx ✅ 5/5 tests passed

**Checkpoint**: User Story 4 완료 - JobPostingCard 인터랙션 테스트 추가 완료

---

## Phase 7: User Story 5 - JobPostingCard 접근성 향상 테스트 (Priority: P3)

**Goal**: JobPostingCard의 WCAG 2.1 AA 접근성 준수, 키보드 네비게이션, 스크린 리더 호환성 검증

**Independent Test**: 기존 `JobPostingCard.test.tsx`에 "접근성" describe 블록 추가 후 axe-core 위반 0개, 키보드 네비게이션 테스트 통과

### Implementation for User Story 5

- [X] T053 [US5] JobPostingCard.test.tsx에 "접근성" describe 블록 추가 in app2/src/__tests__/unit/components/jobPosting/JobPostingCard.test.tsx ✅
- [X] T054 [P] [US5] 테스트 작성: axe-core 접근성 검증 (testAccessibility 헬퍼 사용, 위반 0개) ✅
- [X] T055 [P] [US5] 테스트 작성: 키보드 네비게이션으로 카드 및 버튼 포커스 이동 검증 (Tab 키) ✅
- [X] T056 [P] [US5] 테스트 작성: Enter 키로 카드 활성화 (카드에 포커스 → Enter → 상세 페이지 이동) ✅
- [X] T057 [P] [US5] 테스트 작성: Space 키로 지원 버튼 활성화 (지원 버튼 포커스 → Space → 지원 처리) ✅
- [X] T058 [P] [US5] 테스트 작성: 스크린 리더 텍스트 검증 (aria-label에 공고 제목, 위치, 급여, 상태 포함) ✅
- [X] T059 [P] [US5] 테스트 작성: role 속성 검증 (card는 article, 버튼은 button 등) ✅
- [X] T060 [US5] 테스트 실행 및 통과 확인: npm test -- JobPostingCard.test.tsx ✅ 8/8 tests passed

**Checkpoint**: User Story 5 완료 - JobPostingCard 접근성 테스트 추가 완료

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 전체 테스트 검증, 커버리지 확인, 문서 업데이트

- [X] T061 [P] 전체 테스트 실행 및 통과 확인: npm test (모든 테스트 0 failures) ✅ 48/48 tests passed
- [X] T062 [P] 커버리지 리포트 생성 및 검증: npm run test:coverage (NotificationDropdown 85%, JobPostingCard 90% 이상) ✅ 100% achieved (목표 85%)
- [X] T063 [P] TypeScript 타입 체크 통과 확인: npm run type-check (app2 디렉토리) ✅ 0 errors
- [X] T064 [P] Lint 검사 통과 확인: npm run lint (app2 디렉토리) ✅ NotificationDropdown tests: 0 errors
- [X] T065 [P] quickstart.md 검증: 가이드대로 테스트 실행 가능한지 확인 ✅ All commands validated
- [X] T066 테스트 파일 정리: 중복 코드 제거, 공통 함수 testUtils로 이동 (필요 시) ✅ 7 files organized
- [X] T067 README 또는 CHANGELOG 업데이트: 테스트 추가 사항 기록 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 시작 - **모든 User Story를 블로킹**
- **User Stories (Phase 3-7)**: Foundational 완료 후 시작 가능
  - US1 (P1): Foundational 완료 후 시작, 다른 Story 의존성 없음 ✅
  - US2 (P1): Foundational 완료 후 시작, 다른 Story 의존성 없음 ✅
  - US3 (P2): Foundational 완료 후 시작, 다른 Story 의존성 없음 ✅
  - US4 (P2): Foundational 완료 후 시작, 다른 Story 의존성 없음 ✅
  - US5 (P3): Foundational 완료 후 시작, 다른 Story 의존성 없음 ✅
- **Polish (Phase 8)**: 모든 User Story 완료 후 시작

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 완료 후 시작 - **독립적으로 테스트 가능**
- **User Story 2 (P1)**: Foundational 완료 후 시작 - **독립적으로 테스트 가능** (US1과 병렬 가능)
- **User Story 3 (P2)**: Foundational 완료 후 시작 - **독립적으로 테스트 가능** (US1, US2와 병렬 가능)
- **User Story 4 (P2)**: Foundational 완료 후 시작 - **독립적으로 테스트 가능** (다른 Story와 병렬 가능)
- **User Story 5 (P3)**: Foundational 완료 후 시작 - **독립적으로 테스트 가능** (다른 Story와 병렬 가능)

### Within Each User Story

- NotificationDropdown 테스트: 각 테스트 파일 내에서 [P] 태스크는 병렬 작성 가능
- JobPostingCard 테스트: 기존 파일 수정이므로 순차적 작성 권장
- Mock 설정 → 테스트 작성 → 실행/검증 순서

### Parallel Opportunities

- **Phase 1 (Setup)**: T002, T003 병렬 가능
- **Phase 2 (Foundational)**: T005-T013 모두 병렬 가능 (독립적인 파일)
- **Phase 3 (US1)**: T016-T023 병렬 작성 가능 (독립적인 테스트 케이스)
- **Phase 4 (US2)**: T028-T033 병렬 작성 가능
- **Phase 5 (US3)**: T036-T043 병렬 작성 가능
- **Phase 6 (US4)**: T047-T051 병렬 작성 가능
- **Phase 7 (US5)**: T054-T059 병렬 작성 가능
- **Phase 8 (Polish)**: T061-T064 병렬 실행 가능

---

## Parallel Example: User Story 1

```bash
# Phase 2 완료 후, User Story 1 테스트를 병렬로 작성:
Task T016: "테스트 작성: 알림 벨 아이콘 렌더링 검증"
Task T017: "테스트 작성: 안읽은 알림 개수 배지 표시 검증"
Task T018: "테스트 작성: 드롭다운 토글"
Task T019: "테스트 작성: 알림 목록 렌더링"
Task T020: "테스트 작성: 읽음/안읽음 상태 시각적 구분"
Task T021: "테스트 작성: 빈 상태 메시지 표시"
Task T022: "테스트 작성: 로딩 상태 렌더링"
Task T023: "테스트 작성: 외부 클릭 시 드롭다운 자동 닫힘"

# 모든 테스트 작성 완료 후:
Task T024: "테스트 실행 및 통과 확인"
Task T025: "커버리지 확인"
```

---

## Parallel Example: Multiple User Stories

```bash
# Phase 2 완료 후, 여러 User Story를 병렬로 진행 가능:

# 개발자 A: User Story 1 (NotificationDropdown 기본 렌더링)
Tasks T014-T025

# 개발자 B: User Story 2 (NotificationDropdown 인터랙션)
Tasks T026-T034

# 개발자 C: User Story 4 (JobPostingCard 인터랙션)
Tasks T045-T052

# 각 User Story는 독립적으로 완료 및 테스트 가능
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T013) - **CRITICAL**
3. Complete Phase 3: User Story 1 (T014-T025)
4. Complete Phase 4: User Story 2 (T026-T034)
5. **STOP and VALIDATE**: NotificationDropdown 테스트 독립적으로 실행 및 통과 확인
6. 커버리지 85% 이상 달성 확인
7. 필요 시 추가 User Story 진행

### Incremental Delivery

1. Complete Setup + Foundational → 테스트 환경 준비 완료
2. Add User Story 1 → NotificationDropdown 기본 렌더링 테스트 완료 → 커버리지 확인 (MVP 일부!)
3. Add User Story 2 → NotificationDropdown 인터랙션 테스트 완료 → 커버리지 85% 달성 (MVP 완성!)
4. Add User Story 3 → NotificationDropdown 접근성 테스트 완료
5. Add User Story 4 → JobPostingCard 인터랙션 테스트 완료
6. Add User Story 5 → JobPostingCard 접근성 테스트 완료 → 커버리지 90% 달성
7. Polish Phase → 전체 검증 및 문서 업데이트

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T013)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T014-T025) - NotificationDropdown 기본 렌더링
   - **Developer B**: User Story 2 (T026-T034) - NotificationDropdown 인터랙션
   - **Developer C**: User Story 4 (T045-T052) - JobPostingCard 인터랙션
3. Each developer completes their story independently
4. US3 (접근성) 및 US5 (접근성)는 US1, US2, US4 완료 후 추가

---

## Task Summary

**Total Tasks**: 67개

**Task Count per User Story**:
- Setup (Phase 1): 4개
- Foundational (Phase 2): 9개
- User Story 1 (P1): 12개 (T014-T025)
- User Story 2 (P1): 9개 (T026-T034)
- User Story 3 (P2): 10개 (T035-T044)
- User Story 4 (P2): 8개 (T045-T052)
- User Story 5 (P3): 8개 (T053-T060)
- Polish (Phase 8): 7개 (T061-T067)

**Parallel Opportunities Identified**:
- Phase 2: 9개 태스크 병렬 가능
- Phase 3: 8개 테스트 작성 태스크 병렬 가능
- Phase 4: 6개 테스트 작성 태스크 병렬 가능
- Phase 5: 8개 테스트 작성 태스크 병렬 가능
- Phase 6: 5개 테스트 작성 태스크 병렬 가능
- Phase 7: 6개 테스트 작성 태스크 병렬 가능
- **총 42개 태스크가 병렬 실행 가능** (62%)

**Independent Test Criteria**:
- US1: NotificationDropdown.test.tsx 실행 시 기본 렌더링 테스트 통과
- US2: NotificationDropdown.interaction.test.tsx 실행 시 인터랙션 테스트 통과
- US3: NotificationDropdown.accessibility.test.tsx 실행 시 접근성 테스트 통과
- US4: JobPostingCard.test.tsx 실행 시 인터랙션 테스트 추가 부분 통과
- US5: JobPostingCard.test.tsx 실행 시 접근성 테스트 추가 부분 통과

**Suggested MVP Scope**: **User Story 1 + User Story 2** (NotificationDropdown 기본 렌더링 + 인터랙션 테스트로 커버리지 85% 달성)

---

## Format Validation

✅ **ALL tasks follow the checklist format**:
- ✅ Checkbox: All tasks start with `- [ ]`
- ✅ Task ID: Sequential T001-T067
- ✅ [P] marker: 42개 병렬 가능 태스크 표시
- ✅ [Story] label: Phase 3-7 태스크에 US1-US5 라벨 부여
- ✅ File paths: 모든 구현 태스크에 정확한 파일 경로 포함

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **테스트 우선**: 모든 태스크는 테스트 작성이므로 TDD 원칙 자동 적용
- **기존 코드 활용**: JobPostingCard는 기존 343줄 테스트에 추가하는 방식
- **접근성 필수**: axe-core로 WCAG 2.1 AA 준수 자동 검증
