# Tasks: 고정공고 조회 Hook 및 카드 컴포넌트

**Input**: Design documents from `/specs/001-fixed-job-listing/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Tests**: 테스트는 spec.md에 명시되지 않았으므로 구현 작업만 포함합니다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Project root**: `app2/src/`
- **Tests**: `app2/src/__tests__/`
- All paths are relative to repository root: `C:/Users/user/Desktop/T-HOLDEM`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Firebase 인덱스 생성 및 기존 타입 확인

- [ ] T001 Firestore 복합 인덱스 생성: jobPostings 컬렉션에 postingType (ASC) + status (ASC) + createdAt (DESC) 인덱스 추가
- [ ] T002 기존 타입 정의 확인: app2/src/types/jobPosting/jobPosting.ts에서 FixedJobPosting, WorkSchedule, RoleWithCount, FixedJobPostingData 타입 존재 확인
- [ ] T003 기존 logger 유틸리티 확인: app2/src/utils/logger.ts 존재 및 사용법 확인

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 의존하는 검증 로직 구현

**⚠️ CRITICAL**: 이 Phase가 완료되어야 User Story 구현을 시작할 수 있습니다.

- [ ] T004 validateFixedJobPosting 함수 구현: app2/src/utils/jobPosting/validation.ts에 FixedJobPosting 데이터 무결성 검증 함수 작성 (fixedConfig/fixedData 존재 여부, requiredRoles 동기화 상태, workSchedule.daysPerWeek 범위 1-7, viewCount >=0 검증)
- [ ] T005 validateFixedJobPosting에서 logger.warn 사용: requiredRoles 불일치 시 logger.warn으로 경고 로깅 (console.log 금지)

**Checkpoint**: Foundation ready - User Story 구현 시작 가능

---

## Phase 3: User Story 1 - 고정공고 목록 실시간 조회 (Priority: P1) 🎯 MVP

**Goal**: 구인자가 JobBoard 페이지에 접속하면 게시 중인 고정공고 목록을 실시간으로 확인할 수 있습니다. 새로운 공고가 등록되거나 기존 공고가 수정/삭제되면 자동으로 화면에 반영됩니다.

**Independent Test**: JobBoard 페이지에 접속하여 고정공고 목록이 표시되는지 확인할 수 있습니다. Firestore에서 공고를 추가/수정/삭제했을 때 화면이 자동으로 업데이트되는지 검증합니다.

**Why this priority**: 사용자에게 최신 공고 정보를 제공하는 핵심 기능입니다. 실시간 구독이 없으면 사용자가 페이지를 새로고침해야 하므로 UX가 크게 저하됩니다.

### Implementation for User Story 1

- [ ] T006 [US1] useFixedJobPostings Hook 기본 구조 생성: app2/src/hooks/useFixedJobPostings.ts에 Hook 파일 생성 및 기본 상태 정의 (postings: FixedJobPosting[], loading: boolean, error: Error | null, hasMore: boolean, lastDoc: QueryDocumentSnapshot | null)
- [ ] T007 [US1] Firestore 쿼리 설정: useFixedJobPostings에서 jobPostings 컬렉션 쿼리 생성 (where('postingType', '==', 'fixed'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(20))
- [ ] T008 [US1] onSnapshot 실시간 구독 구현: useEffect에서 초기 20개 공고를 onSnapshot으로 구독하고 postings 상태 업데이트, 로딩 상태 관리, 에러 처리 추가
- [ ] T009 [US1] unsubscribe cleanup 구현: useEffect cleanup 함수에서 onSnapshot unsubscribe 호출하여 메모리 누수 방지
- [ ] T010 [US1] lastDoc 커서 저장: onSnapshot 콜백에서 snapshot.docs[snapshot.docs.length - 1]를 lastDoc 상태로 저장 (무한 스크롤 준비)
- [ ] T011 [US1] 에러 로깅 추가: Firestore 에러 발생 시 logger.error로 로깅 (console.log 금지)
- [ ] T012 [US1] 빈 상태 처리: postings 배열이 비어있을 때 hasMore를 false로 설정

**Checkpoint**: useFixedJobPostings Hook이 Firestore에서 초기 20개 공고를 실시간 구독하여 postings 배열로 반환하는지 확인. Firestore에서 공고 추가/삭제 시 자동 업데이트 검증.

---

## Phase 4: User Story 2 - 고정공고 상세 정보 표시 (Priority: P2)

**Goal**: 사용자가 고정공고 카드를 통해 공고의 핵심 정보(제목, 근무 조건, 모집 역할, 조회수)를 한눈에 확인할 수 있습니다. 다크모드에서도 가독성이 유지됩니다.

**Independent Test**: 고정공고 카드에 제목, 근무 일수/시간, 모집 역할(직무명 + 인원), 조회수가 모두 표시되는지 확인합니다. 다크모드 토글 후 텍스트와 배경색이 적절히 변경되는지 검증합니다.

**Why this priority**: 고정공고의 핵심 정보를 명확하게 전달하여 사용자가 빠르게 지원 여부를 판단할 수 있도록 합니다. P1 이후 구현하여 UI/UX를 점진적으로 개선합니다.

### Implementation for User Story 2

- [ ] T013 [US2] FixedJobCard 컴포넌트 파일 생성: app2/src/components/jobPosting/FixedJobCard.tsx 생성 및 기본 구조 작성 (Props: posting, onApply, onViewDetail)
- [ ] T014 [US2] FixedJobCard Props 타입 정의: FixedJobCardProps 인터페이스 정의 (posting: FixedJobPosting, onApply: (posting: FixedJobPosting) => void, onViewDetail: (postingId: string) => void)
- [ ] T015 [US2] 카드 레이아웃 구현: div 컨테이너에 Tailwind 클래스 적용 (bg-white dark:bg-gray-800, rounded-lg, shadow-md dark:shadow-lg, p-6, border border-gray-200 dark:border-gray-700)
- [ ] T016 [US2] 제목 렌더링: posting.title을 h3 태그로 렌더링 (text-xl font-bold text-gray-900 dark:text-gray-100 mb-2)
- [ ] T017 [US2] 근무 일정 렌더링: posting.fixedData.workSchedule에서 daysPerWeek, startTime, endTime을 "주 N일 근무", "HH:mm - HH:mm" 형식으로 표시 (text-gray-600 dark:text-gray-300)
- [ ] T018 [US2] 모집 역할 배지 렌더링: posting.fixedData.requiredRolesWithCount를 map으로 순회하여 "{역할명} {인원}명" 배지 생성 (bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-3 py-1 rounded-full text-sm)
- [ ] T019 [US2] 조회수 표시: posting.fixedData.viewCount를 "조회 N" 형식으로 렌더링 (text-gray-500 dark:text-gray-400 text-sm), viewCount가 undefined/null이면 0으로 처리
- [ ] T020 [US2] React.memo 적용: FixedJobCard 컴포넌트를 React.memo로 래핑하여 불필요한 리렌더링 방지 (커스텀 비교 함수 불필요)
- [ ] T021 [US2] Edge Case 처리: requiredRolesWithCount 배열이 비어있을 때 "모집 역할 정보 없음" 메시지 표시

**Checkpoint**: FixedJobCard 컴포넌트가 고정공고 정보를 올바르게 렌더링하고, 다크모드 전환 시 UI가 즉시 변경되는지 확인. 배지, 조회수, 근무 일정이 모두 표시되는지 검증.

---

## Phase 5: User Story 3 - 고정공고 상세보기 및 지원 (Priority: P3)

**Goal**: 사용자가 고정공고 카드를 클릭하면 상세 페이지로 이동하거나, 지원 버튼을 클릭하여 바로 지원 프로세스를 시작할 수 있습니다.

**Independent Test**: 카드 클릭 시 상세 페이지로 라우팅되는지, 지원 버튼 클릭 시 적절한 핸들러가 호출되는지 확인합니다.

**Why this priority**: 기본 정보 조회(P1, P2)가 완성된 후 사용자 액션을 추가하여 완전한 워크플로를 완성합니다.

### Implementation for User Story 3

- [ ] T022 [US3] 상세보기 버튼 추가: FixedJobCard에 "상세보기" 버튼 추가 (onClick에 onViewDetail(posting.id) 연결, bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600)
- [ ] T023 [US3] 지원하기 버튼 추가: FixedJobCard에 "지원하기" 버튼 추가 (onClick에 onApply(posting) 연결, bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600)
- [ ] T024 [US3] 버튼 레이아웃 구성: flex 컨테이너로 두 버튼을 가로 배치 (flex gap-2)
- [ ] T025 [US3] JobBoardPage 수정 - useFixedJobPostings Hook 사용: app2/src/pages/JobBoardPage.tsx에서 useFixedJobPostings Hook import 및 호출
- [ ] T026 [US3] JobBoardPage 수정 - 콜백 함수 메모이제이션: handleApply, handleViewDetail 함수를 useCallback으로 래핑 (navigate를 의존성 배열에 포함)
- [ ] T027 [US3] JobBoardPage 수정 - FixedJobCard 렌더링: postings.map으로 FixedJobCard 컴포넌트 렌더링 (key={posting.id}, posting, onApply={handleApply}, onViewDetail={handleViewDetail})
- [ ] T028 [US3] JobBoardPage 수정 - 로딩 및 에러 상태 처리: loading이 true일 때 "로딩 중..." 표시, error가 있을 때 에러 메시지 표시
- [ ] T029 [US3] JobBoardPage 수정 - 빈 상태 처리: postings.length === 0이고 loading === false일 때 "현재 모집 중인 고정공고가 없습니다" 메시지 표시

**Checkpoint**: JobBoardPage에서 FixedJobCard 목록이 정상 렌더링되고, 상세보기 버튼 클릭 시 navigate가 호출되며, 지원하기 버튼 클릭 시 handleApply가 실행되는지 확인.

---

## Phase 6: User Story 4 - 무한 스크롤로 추가 공고 로드 (Priority: P4)

**Goal**: 사용자가 고정공고 목록을 스크롤하여 하단에 도달하면 자동으로 다음 페이지의 공고들이 로드되어 끊김 없는 탐색 경험을 제공합니다.

**Independent Test**: 20개 이상의 공고가 존재할 때, 목록 하단으로 스크롤하면 자동으로 다음 20개가 로드되는지 확인합니다. IntersectionObserver가 목록 끝 요소를 감지하는지 검증합니다.

**Why this priority**: 초기 20개 이후 추가 공고를 탐색하기 위한 필수 기능이지만, 기본 조회 및 표시(P1-P3)가 완성된 후 구현하여 점진적으로 UX를 개선합니다.

### Implementation for User Story 4

- [ ] T030 [US4] loadMore 함수 구현: useFixedJobPostings에 loadMore 함수 추가 (isFetching 플래그로 중복 방지, getDocs로 다음 20개 조회, startAfter(lastDoc) 커서 사용)
- [ ] T031 [US4] loadMore에서 페이지 데이터 추가: getDocs 결과를 기존 postings 배열에 추가 (setPostings(prev => [...prev, ...newDocs]))
- [ ] T032 [US4] hasMore 상태 업데이트: getDocs 결과가 20개 미만이면 hasMore를 false로 설정
- [ ] T033 [US4] loadMore 에러 처리: 네트워크 오류 발생 시 logger.error로 로깅, error 상태 설정, 자동 재시도 없음
- [ ] T034 [US4] JobBoardPage에 IntersectionObserver 구현: useRef로 observerRef 및 loadMoreRef 생성, useEffect에서 IntersectionObserver 생성 (threshold: 0.1)
- [ ] T035 [US4] IntersectionObserver 콜백 설정: entry.isIntersecting이 true일 때 loadMore 호출
- [ ] T036 [US4] IntersectionObserver cleanup: useEffect cleanup 함수에서 observer.disconnect() 호출
- [ ] T037 [US4] 무한 스크롤 트리거 요소 추가: JobBoardPage에 div 요소 추가 (ref={loadMoreRef}, hasMore가 true일 때만 렌더링)
- [ ] T038 [US4] 로딩 인디케이터 추가: 무한 스크롤 트리거 요소 내부에 loading 상태에 따라 "로딩 중..." 또는 "스크롤하여 더 보기" 메시지 표시
- [ ] T039 [US4] 모든 공고 로드 완료 메시지: hasMore가 false이고 postings.length > 0일 때 "모든 공고를 확인했습니다" 메시지 표시

**Checkpoint**: 20개 이상의 공고가 존재할 때, 목록 하단으로 스크롤하면 자동으로 다음 20개가 로드되는지 확인. 중복 요청이 발생하지 않는지, 모든 공고 로드 완료 시 메시지가 표시되는지 검증.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전체 기능을 아우르는 개선 사항 및 검증

- [ ] T040 [P] TypeScript 타입 체크: npm run type-check 실행 및 타입 에러 0개 확인
- [ ] T041 [P] ESLint 검사: npm run lint 실행 및 경고 수정
- [ ] T042 validateFixedJobPosting 활용: useFixedJobPostings에서 각 공고 데이터를 validateFixedJobPosting으로 검증 후 렌더링
- [ ] T043 [P] 성능 측정: React DevTools Profiler로 20개 카드 렌더링 시간 측정 (목표: <100ms)
- [ ] T044 [P] Firestore 쿼리 성능 확인: Firebase Console에서 초기 로딩 쿼리 시간 확인 (목표: <500ms)
- [ ] T045 quickstart.md 검증: quickstart.md의 개발 환경 설정 가이드 및 사용 예시 검증
- [ ] T046 [P] 코드 정리: 사용하지 않는 import 제거, 코드 포맷팅 (npm run format)
- [ ] T047 최종 빌드 테스트: npm run build 실행 및 성공 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (Phase 3): Foundational 이후 시작 가능 - 다른 Story 의존성 없음 (독립적)
  - User Story 2 (Phase 4): Foundational 이후 시작 가능 - User Story 1과 독립적 (카드 컴포넌트만 구현)
  - User Story 3 (Phase 5): User Story 1, 2 완료 후 시작 (Hook + 카드 컴포넌트 통합)
  - User Story 4 (Phase 6): User Story 1 완료 후 시작 (Hook에 무한 스크롤 추가)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 이후 독립적 구현 가능 ✅ MVP
- **User Story 2 (P2)**: Foundational 이후 독립적 구현 가능
- **User Story 3 (P3)**: User Story 1, 2 완료 필요 (Hook + 카드 통합)
- **User Story 4 (P4)**: User Story 1 완료 필요 (Hook 확장)

### Within Each User Story

- **User Story 1**: T006 → T007 → T008 → T009 → T010 → T011 → T012 (순차 실행)
- **User Story 2**: T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 (순차 실행)
- **User Story 3**: T022-T024 (카드 수정, 순차) → T025-T029 (페이지 수정, 순차)
- **User Story 4**: T030-T033 (Hook 수정, 순차) → T034-T039 (페이지 수정, 순차)

### Parallel Opportunities

- **Phase 1 (Setup)**: T001, T002, T003 모두 병렬 실행 가능
- **Phase 2 (Foundational)**: T004, T005 순차 실행 (T005가 T004 의존)
- **User Stories**: Phase 2 완료 후 User Story 1, 2는 병렬 실행 가능 (독립적 파일)
- **Phase 7 (Polish)**: T040, T041, T043, T044, T046 병렬 실행 가능

---

## Parallel Example: Phase 1 (Setup)

```bash
# Launch all setup tasks in parallel:
Task T001: "Firestore 복합 인덱스 생성"
Task T002: "기존 타입 정의 확인"
Task T003: "기존 logger 유틸리티 확인"
```

## Parallel Example: User Story 1 & 2 (독립적 구현)

```bash
# Phase 2 완료 후:
Developer A - User Story 1: T006-T012 (useFixedJobPostings Hook)
Developer B - User Story 2: T013-T021 (FixedJobCard 컴포넌트)

# 각 Story는 다른 파일을 수정하므로 병렬 작업 가능
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005) - CRITICAL
3. Complete Phase 3: User Story 1 (T006-T012)
4. **STOP and VALIDATE**: useFixedJobPostings Hook이 Firestore에서 초기 20개 공고를 실시간 구독하는지 테스트
5. Demo/Validate if ready

### Incremental Delivery

1. **Foundation**: Setup + Foundational → 검증 로직 완성
2. **US1 (MVP)**: User Story 1 구현 → Hook 단독 테스트 → Deploy/Demo 🎯
3. **US1 + US2**: User Story 2 추가 → 카드 렌더링 테스트 → Deploy/Demo
4. **US1 + US2 + US3**: User Story 3 추가 → 전체 워크플로 테스트 → Deploy/Demo
5. **US1 + US2 + US3 + US4**: User Story 4 추가 → 무한 스크롤 테스트 → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T006-T012)
   - Developer B: User Story 2 (T013-T021) - 병렬 작업 가능
3. User Story 1, 2 완료 후:
   - Developer A: User Story 3 (T022-T029)
   - Developer B: User Story 4 (T030-T039) - 일부 병렬 가능
4. Both complete → Phase 7: Polish together

---

## Task Count Summary

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 2 tasks
- **Phase 3 (User Story 1)**: 7 tasks
- **Phase 4 (User Story 2)**: 9 tasks
- **Phase 5 (User Story 3)**: 8 tasks
- **Phase 6 (User Story 4)**: 10 tasks
- **Phase 7 (Polish)**: 8 tasks
- **Total**: 47 tasks

## Parallel Opportunities Identified

- **Phase 1**: 3 tasks (T001, T002, T003)
- **User Story 1 & 2**: 병렬 구현 가능 (독립적 파일)
- **Phase 7**: 5 tasks (T040, T041, T043, T044, T046)

## Independent Test Criteria

- **User Story 1**: useFixedJobPostings Hook이 Firestore에서 초기 20개 공고를 실시간 구독하고, 공고 추가/삭제 시 자동 업데이트되는지 검증
- **User Story 2**: FixedJobCard 컴포넌트가 제목, 근무 일정, 모집 역할, 조회수를 올바르게 렌더링하고, 다크모드 전환 시 UI가 즉시 변경되는지 검증
- **User Story 3**: JobBoardPage에서 카드 클릭 시 상세 페이지로 이동하고, 지원하기 버튼 클릭 시 핸들러가 호출되는지 검증
- **User Story 4**: 무한 스크롤로 하단 도달 시 자동으로 다음 20개가 로드되고, 중복 요청이 발생하지 않으며, 모든 공고 로드 완료 시 메시지가 표시되는지 검증

## Suggested MVP Scope

**User Story 1 (Priority: P1)** - 고정공고 목록 실시간 조회
- **Includes**: T001-T012 (Setup, Foundational, User Story 1)
- **Deliverable**: useFixedJobPostings Hook이 Firestore에서 초기 20개 공고를 실시간 구독하여 반환
- **Validation**: Firestore에서 공고 추가/수정/삭제 시 자동 업데이트 확인

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- TypeScript strict mode 필수 (타입 에러 0개)
- 다크모드 100% 지원 (모든 UI 요소에 dark: 클래스)
- logger 사용 필수 (console.log 금지)
- React.memo + useCallback 최적화 적용
