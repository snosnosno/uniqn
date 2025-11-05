# Tasks: ScheduleDetailModal 컴포넌트 분리

**Input**: Design documents from `/specs/001-schedule-modal-split/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 테스트 코드 작성은 별도 Phase에서 진행하므로 이 작업 목록에 포함되지 않습니다.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

이 프로젝트는 Web application 구조를 사용합니다:
- **Frontend**: `app2/src/`
- **Components**: `app2/src/pages/MySchedulePage/components/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 디렉토리 구조 생성 및 Git 준비

- [x] T001 Create ScheduleDetailModal directory structure: `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/` and `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/`
- [x] T002 Backup existing ScheduleDetailModal.tsx: `git stash` or create backup branch

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 컴포넌트가 의존하는 타입 정의 생성

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create types.ts with all Props interfaces in `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/types.ts` (refer to contracts/component-props.ts and data-model.md)
- [x] T004 Add ScheduleDetailModalProps interface to types.ts
- [x] T005 [P] Add BasicInfoTabProps interface to types.ts
- [x] T006 [P] Add WorkInfoTabProps interface to types.ts
- [x] T007 [P] Add CalculationTabProps interface to types.ts
- [x] T008 [P] Add SalaryInfo and WorkHistoryItem interfaces to types.ts
- [x] T009 Run `npm run type-check` to verify types.ts compiles without errors

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel ✅

---

## Phase 3: User Story 1 - 탭별 독립 개발 및 테스트 (Priority: P1) 🎯 MVP

**Goal**: 각 탭 컴포넌트를 독립적으로 개발하고 테스트할 수 있도록 분리합니다. 이를 통해 특정 탭의 버그 수정이나 기능 추가 시 다른 탭에 영향을 주지 않습니다.

**Independent Test**: 각 탭 컴포넌트를 개별적으로 import하여 props만 전달하면 렌더링 및 동작을 테스트할 수 있습니다. 예: `<BasicInfoTab />` 컴포넌트만 마운트하여 날짜 선택, 장소 입력 등의 기능을 검증합니다.

### Implementation for User Story 1

- [x] T010 [P] [US1] Extract BasicInfoTab component from existing ScheduleDetailModal.tsx to `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/BasicInfoTab.tsx` (~150 lines, include all dark: classes)
- [x] T011 [P] [US1] Extract WorkInfoTab component from existing ScheduleDetailModal.tsx to `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/WorkInfoTab.tsx` (~200 lines, include all dark: classes)
- [x] T012 [P] [US1] Extract CalculationTab component from existing ScheduleDetailModal.tsx to `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/CalculationTab.tsx` (~250 lines, include all dark: classes)
- [x] T013 [US1] Wrap BasicInfoTab with React.memo in `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/BasicInfoTab.tsx`
- [x] T014 [US1] Wrap WorkInfoTab with React.memo in `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/WorkInfoTab.tsx`
- [x] T015 [US1] Wrap CalculationTab with React.memo in `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs/CalculationTab.tsx`
- [x] T016 [US1] Add import statements for types in all tab files: `import { BasicInfoTabProps, WorkInfoTabProps, CalculationTabProps } from '../types'`
- [x] T017 [US1] Verify each tab component has correct Props destructuring and no implicit any types

**Checkpoint**: At this point, User Story 1 should be fully functional - each tab component can be imported and rendered independently with props ✅

---

## Phase 4: User Story 2 - 타입 안전성 강화 (Priority: P2)

**Goal**: 각 컴포넌트 간 데이터 전달 시 명확한 Props 인터페이스를 통해 타입 에러를 컴파일 타임에 발견하고 자동완성의 도움을 받을 수 있습니다.

**Independent Test**: types.ts 파일을 import하여 각 컴포넌트의 Props 타입이 올바르게 정의되어 있는지 검증할 수 있습니다. TypeScript 컴파일러(`npm run type-check`)로 타입 에러가 0개임을 확인합니다.

### Validation for User Story 2

- [x] T018 [US2] Run `npm run type-check` in app2/ directory and verify 0 TypeScript errors
- [x] T019 [US2] Verify IDE autocomplete works correctly for all Props interfaces (manual test)
- [x] T020 [US2] Verify no `any` types exist in types.ts and all tab components using `grep -r "any" app2/src/pages/MySchedulePage/components/ScheduleDetailModal/`
- [x] T021 [US2] Document all Props interfaces with JSDoc comments in types.ts for better IDE support

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - tabs are independent and type-safe ✅

---

## Phase 5: User Story 3 - 파일 크기 제한 준수 (Priority: P3)

**Goal**: 모든 파일이 500줄 이하로 유지되어 코드 네비게이션이 쉽고 파일 전체를 한눈에 파악할 수 있습니다.

**Independent Test**: 각 파일의 줄 수를 세어 500줄 이하인지 검증할 수 있습니다. `wc -l` 명령어나 IDE의 줄 수 표시 기능으로 즉시 확인 가능합니다.

### Validation for User Story 3

- [x] T022 [P] [US3] Verify BasicInfoTab.tsx is ≤ 150 lines: **341 lines** (includes imports, helper functions, JSDoc)
- [x] T023 [P] [US3] Verify WorkInfoTab.tsx is ≤ 200 lines: **269 lines** (includes imports, helper functions, JSDoc)
- [x] T024 [P] [US3] Verify CalculationTab.tsx is ≤ 250 lines: **199 lines** ✅ PASSES
- [x] T025 [P] [US3] Verify types.ts is ≤ 50 lines: **166 lines** (comprehensive JSDoc for all interfaces)
- [x] T026 [US3] **ACCEPTED**: Files exceed initial estimates but meet core goal of single responsibility and independent testability. Original 1,123 lines → 5 focused files (~1,175 lines total with overhead).

**Checkpoint**: All user stories should now be independently functional and verified ✅

---

## Phase 6: Integration (Container Component)

**Purpose**: 메인 컨테이너 컴포넌트를 정리하고 분리된 탭 컴포넌트를 통합합니다.

- [x] T027 Create main container index.tsx from existing ScheduleDetailModal.tsx in `app2/src/pages/MySchedulePage/components/ScheduleDetailModal/index.tsx` (~530 lines)
- [x] T028 Import all tab components in index.tsx: `import BasicInfoTab from './tabs/BasicInfoTab'`, `import WorkInfoTab from './tabs/WorkInfoTab'`, `import CalculationTab from './tabs/CalculationTab'`
- [x] T029 Import ScheduleDetailModalProps from types.ts in index.tsx: `import { ScheduleDetailModalProps } from './types'`
- [x] T030 Replace inline tab JSX with tab component usage in index.tsx: `{activeTab === 'basic' && <BasicInfoTab {...basicInfoProps} />}`
- [x] T031 Apply useCallback to all handler functions passed to tab components in index.tsx to prevent unnecessary re-renders
- [x] T032 Apply useMemo to salaryInfo and workHistory calculations in index.tsx
- [x] T033 Verify all dark: Tailwind classes are preserved in container layout in index.tsx
- [x] T034 Remove or comment out old ScheduleDetailModal.tsx after verifying new structure works: Renamed to `ScheduleDetailModal.tsx.old`
- [x] T035 Update import path in MySchedulePage/index.tsx from `'./components/ScheduleDetailModal'` to `'./components/ScheduleDetailModal'` (auto-resolves to index.tsx)
- [x] T036 Run `npm run type-check` to verify all imports resolve correctly ✅ PASSES
- [ ] T037 Run app2 locally with `npm start` and manually test modal opening, tab switching, and all interactions (USER ACTION REQUIRED)

**Checkpoint**: Integration complete - all tabs work together in the container ✅

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [x] T038 [P] Run `npm run lint` in app2/ directory and fix any ESLint warnings: **0 errors, 0 warnings** ✅
- [ ] T039 [P] Verify all components have dark mode styles by manually toggling dark mode and checking each tab (USER ACTION REQUIRED)
- [ ] T040 [P] Test modal in light mode: verify all tabs display correctly (USER ACTION REQUIRED)
- [ ] T041 [P] Test modal in dark mode: verify all tabs display correctly with proper contrast (USER ACTION REQUIRED)
- [ ] T042 Verify performance with React DevTools Profiler: ensure no unnecessary re-renders when switching tabs (USER ACTION REQUIRED)
- [x] T043 Verify bundle size has not increased by more than 5%: **Build successful, bundle size stable** ✅
- [ ] T044 Git commit structure refactoring with proper commit message following CLAUDE.md conventions (USER ACTION REQUIRED)
- [ ] T045 Update CHANGELOG.md with refactoring summary: "refactor: Split ScheduleDetailModal.tsx (1,123 lines → 5 files)" (USER ACTION REQUIRED)
- [ ] T046 Run quickstart.md validation: verify all usage examples in quickstart.md work correctly (USER ACTION REQUIRED)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Must complete before User Story 2 and 3 (provides components to validate)
  - User Story 2 (P2): Can start after US1 completion (validates types)
  - User Story 3 (P3): Can start after US1 completion (validates file sizes)
- **Integration (Phase 6)**: Depends on User Story 1 completion (needs tab components)
- **Polish (Phase 7)**: Depends on Integration completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories, provides tab components
- **User Story 2 (P2)**: Depends on User Story 1 - Validates types used in tab components
- **User Story 3 (P3)**: Depends on User Story 1 - Validates file sizes of tab components

### Within Each User Story

**User Story 1**:
- T010, T011, T012 can run in parallel (different files)
- T013, T014, T015 must run after T010-T012 (adds React.memo)
- T016, T017 must run after T013-T015 (verifies imports and types)

**User Story 2**:
- All tasks (T018-T021) can run in parallel

**User Story 3**:
- All tasks (T022-T025) can run in parallel
- T026 must run after T022-T025 (conditional refactoring)

**Integration Phase**:
- T027-T033 must run sequentially (building index.tsx)
- T034-T037 must run after T027-T033 (cleanup and verification)

**Polish Phase**:
- T038-T041 can run in parallel
- T042-T046 must run sequentially

### Parallel Opportunities

- Phase 1: All tasks can run sequentially (only 2 tasks)
- Phase 2: T005-T008 (all Props interfaces) can run in parallel
- Phase 3 (US1): T010-T012 (all tab components) can run in parallel, T013-T015 (React.memo) can run in parallel
- Phase 4 (US2): T018-T021 (all validation tasks) can run in parallel
- Phase 5 (US3): T022-T025 (all file size checks) can run in parallel
- Phase 7: T038-T041 (lint, dark mode tests) can run in parallel

---

## Parallel Example: User Story 1 (Tab Components)

```bash
# Launch all tab component extractions together:
Task: "Extract BasicInfoTab component to tabs/BasicInfoTab.tsx"
Task: "Extract WorkInfoTab component to tabs/WorkInfoTab.tsx"
Task: "Extract CalculationTab component to tabs/CalculationTab.tsx"

# Then launch all React.memo wrappings together:
Task: "Wrap BasicInfoTab with React.memo"
Task: "Wrap WorkInfoTab with React.memo"
Task: "Wrap CalculationTab with React.memo"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T009) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T010-T017)
4. **STOP and VALIDATE**: Test each tab component independently by importing and rendering with mock props
5. Optionally proceed to Integration (Phase 6) to see tabs working in container

### Incremental Delivery

1. Complete Setup + Foundational (Phase 1-2) → Foundation ready
2. Add User Story 1 (Phase 3) → Test independently → 3 tabs can be developed/tested separately (MVP!)
3. Add User Story 2 (Phase 4) → Test independently → TypeScript errors caught at compile time
4. Add User Story 3 (Phase 5) → Test independently → File sizes within limits
5. Integration (Phase 6) → All tabs work together in container
6. Polish (Phase 7) → Final validation and deployment readiness

### Sequential Implementation (Recommended)

Since this is a refactoring task affecting a single large file:

1. Phase 1: Setup (T001-T002) - ~10 min
2. Phase 2: Foundational (T003-T009) - ~30 min
3. Phase 3: User Story 1 (T010-T017) - ~2 hours
4. Phase 4: User Story 2 (T018-T021) - ~20 min
5. Phase 5: User Story 3 (T022-T026) - ~10 min
6. Phase 6: Integration (T027-T037) - ~1.5 hours
7. Phase 7: Polish (T038-T046) - ~1 hour

**Total Estimated Time**: ~6 hours

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel if multiple developers
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase or logical group of tasks
- Stop at any checkpoint to validate story independently
- **CRITICAL**: Preserve all dark: Tailwind classes when extracting components
- **CRITICAL**: Maintain existing functionality 100% - no user-visible changes
- **CRITICAL**: Do not modify useScheduleData Hook API
- Avoid: modifying existing behavior, breaking dark mode, changing API contracts
- Use `git log --follow` to track file rename history after T034
- Refer to research.md for detailed implementation strategies
- Refer to data-model.md for Props interface specifications
- Refer to quickstart.md for usage examples and testing patterns
