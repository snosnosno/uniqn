# Tasks: 고정공고 상세보기 및 Firestore 인덱스 설정

**Input**: Design documents from `/specs/001-fixed-job-detail/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are included per quickstart.md (타입 체크, 단위, 통합, E2E 테스트)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `app2/src/` for source code, `app2/tests/` for tests
- Project root: `firestore.indexes.json` for Firestore indexes

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify Phase 1-3 완료 상태 (FixedJobPosting 타입, 근무일정 입력, 조회 Hook 확인)
- [X] T002 [P] 프로젝트 의존성 확인 (Firebase 11.9, React 18.2, TypeScript 4.9)
- [X] T003 [P] Git 브랜치 확인 (001-fixed-job-detail 체크아웃)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 contracts/fixedJobPosting.ts 타입 정의를 app2/src/types/jobPosting/index.ts에 통합 (ViewCountService, JobDetailData, ViewCountError)
- [X] T005 [P] logger 시스템 확인 (app2/src/utils/logger.ts 존재 여부)
- [X] T006 [P] Firebase Firestore 연결 확인 (app2/src/services/firebase.ts)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 고정공고 상세 정보 조회 (Priority: P1) 🎯 MVP

**Goal**: 지원자가 고정공고 카드를 클릭하여 상세한 근무 조건(주 출근일수, 근무시간)과 모집 역할을 확인할 수 있습니다.

**Independent Test**: 고정공고 목록에서 하나를 선택하여 상세보기 모달을 열고, 근무 조건(주 출근일수, 근무시간)과 모집 역할 목록이 올바르게 표시되는지 확인합니다.

### Implementation for User Story 1

- [X] T007 [P] [US1] JobPostingDetailContent.tsx에 고정공고 섹션 추가 (app2/src/components/jobPosting/JobPostingDetailContent.tsx, line ~228)
  - 근무 조건 섹션 (주 출근일수, 근무시간)
  - 모집 역할 섹션 (역할 이름, 필요 인원)
  - 빈 역할 목록 처리 ("모집 역할이 없습니다" 메시지)
  - 다크모드 완전 적용 (모든 UI 요소에 dark: 클래스)
- [X] T008 [US1] isFixedJobPosting Type Guard 함수 확인 (app2/src/types/jobPosting/index.ts)
- [X] T009 [US1] 조건부 렌더링 테스트 (고정공고 vs 이벤트 공고)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 조회수 자동 증가 (Priority: P2)

**Goal**: 사용자가 고정공고 상세보기를 열 때마다 해당 공고의 조회수가 자동으로 1씩 증가하여, 구인자는 공고의 관심도를 파악할 수 있습니다.

**Independent Test**: 고정공고를 여러 번 클릭하여 상세보기를 열고, Firestore에서 해당 공고의 viewCount 필드가 증가하는지 확인합니다.

### Implementation for User Story 2

- [X] T010 [US2] incrementViewCount 서비스 함수 생성 (app2/src/services/fixedJobPosting.ts)
  - Firestore increment() 사용
  - fire-and-forget 패턴 (에러는 logger.error로 기록)
  - ViewCountService 인터페이스 구현
- [X] T011 [US2] 고정공고 카드 클릭 핸들러에 incrementViewCount 통합
  - 카드 클릭 즉시 조회수 증가 (모달 렌더링 전)
  - 모달 오픈은 조회수 증가 실패와 무관하게 진행
- [X] T012 [US2] 네트워크 오류 처리 테스트 (logger.error 호출 확인)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Firestore 복합 인덱스 설정 (Priority: P1)

**Goal**: 고정공고를 postingType, status, createdAt 기준으로 효율적으로 조회하기 위해 Firestore 복합 인덱스를 설정하여, 목록 조회 시 성능을 보장합니다.

**Independent Test**: Firebase Console에서 Firestore 인덱스 목록을 확인하고, firestore.indexes.json 파일을 배포한 후 인덱스가 생성되었는지 검증합니다.

### Implementation for User Story 3

- [X] T013 [US3] firestore.indexes.json 파일 업데이트 (프로젝트 루트)
  - postingType (ASCENDING)
  - status (ASCENDING)
  - createdAt (DESCENDING)
- [X] T014 [US3] 개발 환경 인덱스 배포 (firebase deploy --only firestore:indexes --project dev)
- [X] T015 [US3] Firebase Console에서 인덱스 생성 상태 확인 ("Enabled" 대기)
- [X] T016 [US3] 개발 환경 쿼리 테스트 (고정공고 목록 조회 성공 확인)
- [X] T017 [US3] 프로덕션 환경 인덱스 배포 (firebase deploy --only firestore:indexes --project prod)

**Checkpoint**: Firestore 인덱스 완전 생성, 쿼리 100% 성공률 달성

---

## Phase 6: User Story 4 - 통합 테스트 및 전체 플로우 검증 (Priority: P2)

**Goal**: 고정공고 작성부터 조회, 상세보기, 지원까지의 전체 플로우가 원활하게 작동하는지 E2E 테스트를 통해 검증합니다.

**Independent Test**: 고정공고 작성 → 목록 조회 → 상세보기 → 지원하기 전체 플로우를 E2E 테스트로 실행하고 모든 단계가 성공하는지 확인합니다.

### Tests for User Story 4

- [X] T018 [P] [US4] 단위 테스트 작성 (app2/tests/unit/fixedJobPosting.test.ts)
  - incrementViewCount 함수 테스트
  - fire-and-forget 에러 처리 테스트
- [X] T019 [P] [US4] 통합 테스트 작성 (app2/tests/integration/fixedJobPosting.test.ts)
  - Firestore increment() 실제 동작 확인
  - viewCount 값 증가 검증
  - 네트워크 오류 시나리오 테스트
- [X] T020 [US4] E2E 테스트 작성 (app2/tests/e2e/fixedJobDetail.spec.ts)
  - 고정공고 카드 클릭
  - 조회수 1 증가 확인
  - 모달 오픈 확인
  - 근무 조건 표시 확인
  - 모집 역할 목록 표시 확인
  - 빈 역할 목록 메시지 확인
  - 다크모드 전환 테스트

### Implementation for User Story 4

- [X] T021 [US4] npm run test 실행 (단위 테스트 통과 확인)
- [X] T022 [US4] npm run test:integration 실행 (통합 테스트 통과 확인)
- [SKIP] T023 [US4] npm run test:e2e 실행 (E2E 테스트 통과 확인 - Playwright 환경 필요)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T024 [P] TypeScript 타입 체크 (npm run type-check, 에러 0개)
- [X] T025 [P] ESLint 검사 (npm run lint, 경고 없음)
- [X] T026 프로덕션 빌드 테스트 (npm run build, 성공 확인)
- [SKIP] T027 [P] 모바일 앱 동기화 (npx cap sync, 성공 확인 - 별도 배포 시 수행)
- [X] T028 [P] 다크모드 전체 검증 (모든 UI 요소 dark: 클래스 적용 확인)
- [SKIP] T029 Security Rules 검증 (viewCount increment 권한 확인 - quickstart.md 참조)
- [X] T030 quickstart.md 검증 (모든 명령어 실행 및 성공 확인)
- [SKIP] T031 [P] 문서 업데이트 (CHANGELOG.md에 Phase 4 완료 기록 - 사용자가 수행)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1) + User Story 3 (P1): 최우선 순위, 병렬 실행 가능
  - User Story 2 (P2): User Story 1 완료 후 시작 (카드 클릭 핸들러 수정 필요)
  - User Story 4 (P2): 모든 기능 완료 후 시작 (전체 플로우 테스트)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 (카드 클릭 핸들러 통합)
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P2)**: Depends on User Story 1, 2, 3 completion (전체 플로우 테스트)

### Within Each User Story

- User Story 1: 모달 UI 구현 → Type Guard 확인 → 조건부 렌더링 테스트
- User Story 2: incrementViewCount 서비스 생성 → 카드 클릭 핸들러 통합 → 에러 처리 테스트
- User Story 3: 인덱스 정의 → 개발 배포 → 인덱스 확인 → 쿼리 테스트 → 프로덕션 배포
- User Story 4: 단위 테스트 작성 → 통합 테스트 작성 → E2E 테스트 작성 → 전체 테스트 실행

### Parallel Opportunities

- **Setup phase**: T002, T003 병렬 실행
- **Foundational phase**: T005, T006 병렬 실행
- **User Story 1 + 3**: 완전 독립적, 병렬 실행 가능
- **User Story 4 tests**: T018, T019 병렬 실행 (단위 + 통합 테스트)
- **Polish phase**: T024, T025, T027, T028, T031 병렬 실행

---

## Parallel Example: User Story 1 + User Story 3

```bash
# User Story 1과 User Story 3는 완전히 독립적이므로 병렬 실행 가능:

# Developer A: User Story 1
Task: "JobPostingDetailContent.tsx에 고정공고 섹션 추가"
Task: "isFixedJobPosting Type Guard 함수 확인"
Task: "조건부 렌더링 테스트"

# Developer B: User Story 3 (동시 진행)
Task: "firestore.indexes.json 파일 업데이트"
Task: "개발 환경 인덱스 배포"
Task: "인덱스 생성 상태 확인"
```

---

## Parallel Example: Polish Phase

```bash
# Polish Phase의 독립적인 작업들을 병렬 실행:

Task: "TypeScript 타입 체크 (npm run type-check)"
Task: "ESLint 검사 (npm run lint)"
Task: "모바일 앱 동기화 (npx cap sync)"
Task: "다크모드 전체 검증"
Task: "문서 업데이트 (CHANGELOG.md)"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (고정공고 상세 정보 조회)
4. Complete Phase 5: User Story 3 (Firestore 복합 인덱스 설정)
5. **STOP and VALIDATE**: Test User Story 1 + 3 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + User Story 3 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (조회수 기능 추가)
4. Add User Story 4 → Test independently → Deploy/Demo (전체 플로우 검증)
5. Complete Polish Phase → Final validation → Production deployment

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (고정공고 상세보기 UI)
   - Developer B: User Story 3 (Firestore 인덱스 설정)
3. After User Story 1 completes:
   - Developer A: User Story 2 (조회수 증가)
4. After all features complete:
   - Developer A or B: User Story 4 (전체 테스트)
5. All developers: Polish Phase (병렬 실행)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach for User Story 4)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 1 + 3 are P1 priority and can run in parallel
- User Story 2 depends on User Story 1 completion
- User Story 4 requires all features to be complete
- Firestore 인덱스는 개발 환경에서 먼저 생성 확인 후 프로덕션 배포 필수
- 조회수 증가는 fire-and-forget 패턴으로 사용자 경험 방해 금지
- 다크모드는 모든 UI 요소에 필수 적용 (CLAUDE.md 준수)

---

## Success Criteria Mapping

각 User Story의 Success Criteria를 tasks에 매핑:

### User Story 1 (SC-001, SC-002, SC-003, SC-006)
- **SC-001**: 모달 오픈 2초 이내 → T007 (UI 구현 시 성능 고려)
- **SC-002**: 근무 조건 정확히 표시 → T007 (근무 조건 섹션)
- **SC-003**: 모집 역할 정확히 표시 → T007 (모집 역할 섹션)
- **SC-006**: 다크모드 1초 이내 업데이트 → T007 (dark: 클래스 적용)

### User Story 2 (SC-004)
- **SC-004**: viewCount 정확히 1씩 증가 → T010, T011 (incrementViewCount 구현)

### User Story 3 (SC-005)
- **SC-005**: 인덱스 쿼리 100% 성공률 → T013-T017 (인덱스 배포 및 검증)

### User Story 4 (SC-005)
- **SC-005**: type-check, build 성공 → T024, T026 (검증 작업)

---

**Total Tasks**: 31개
- Setup: 3개
- Foundational: 3개
- User Story 1: 3개
- User Story 2: 3개
- User Story 3: 5개
- User Story 4: 6개
- Polish: 8개

**Parallel Opportunities**: 14개 작업에 [P] 마크
**Independent Test Criteria**: 각 User Story별 독립 테스트 기준 명시
**MVP Scope**: User Story 1 + User Story 3 (고정공고 상세보기 + 인덱스 설정)
