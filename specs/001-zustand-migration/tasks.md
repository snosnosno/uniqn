# Tasks: UnifiedDataContext를 Zustand Store로 전면 교체

**Input**: Design documents from `/specs/001-zustand-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/unifiedDataStore.interface.ts

**Tests**: 단위 테스트는 각 User Story 구현과 함께 작성됩니다 (70% 커버리지 목표)

**Organization**: Tasks는 User Story별로 그룹화되어 각 Story를 독립적으로 구현하고 테스트할 수 있습니다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 어떤 User Story에 속하는지 (US1, US2, US3, US4, US5, US6)
- 설명에 정확한 파일 경로 포함

## Path Conventions

- **프로젝트 구조**: `app2/` 디렉토리 (Web application)
- **Stores**: `app2/src/stores/`
- **Tests**: `app2/src/stores/__tests__/`
- **Pages**: `app2/src/pages/`
- **Components**: `app2/src/components/`
- **Contexts**: `app2/src/contexts/` (삭제 예정)

---

## Phase 1: Setup (공유 인프라)

**Purpose**: 프로젝트 초기화 및 기본 구조

- [X] T001 Zustand 및 필요한 미들웨어 의존성 확인 및 설치 (package.json)
- [X] T002 [P] app2/src/stores/ 디렉토리 생성
- [X] T003 [P] app2/src/stores/__tests__/ 디렉토리 생성

---

## Phase 2: Foundational (필수 선행 작업)

**Purpose**: 모든 User Story가 의존하는 핵심 인프라 구현 완료 필요

**⚠️ CRITICAL**: 이 Phase가 완료되기 전에는 User Story 작업 시작 불가

- [X] T004 TypeScript 인터페이스 정의 작성 in app2/src/stores/unifiedDataStore.ts (State, Actions, Selectors 타입)
- [X] T005 [P] Zustand Store 기본 구조 생성 (immer + devtools 미들웨어 설정) in app2/src/stores/unifiedDataStore.ts
- [X] T006 [P] 5개 컬렉션 초기 상태 정의 (staff, workLogs, applications, attendanceRecords, jobPostings) in app2/src/stores/unifiedDataStore.ts
- [X] T007 loading 및 error 상태 관리 로직 추가 in app2/src/stores/unifiedDataStore.ts

**Checkpoint**: Foundation 준비 완료 ✅ - 이제 User Story 구현을 병렬로 시작 가능

---

## Phase 3: User Story 1 - 개발자가 Zustand Store로 데이터 조회 가능 (Priority: P1) 🎯 MVP

**Goal**: Zustand Store를 통해 5개 Firebase 컬렉션 데이터를 Map 형태로 조회 가능

**Independent Test**:
1. 단일 컴포넌트에서 `useUnifiedDataStore`를 import하고 staff 데이터를 읽어서 화면에 표시
2. `npm run type-check` 실행하여 TypeScript 에러 0개 확인
3. Redux DevTools에서 Store 연결 확인

### Implementation for User Story 1

- [X] T008 [P] [US1] getStaffById selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T009 [P] [US1] getWorkLogsByStaffId selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T010 [P] [US1] getWorkLogsByEventId selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T011 [P] [US1] getApplicationsByEventId selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T012 [P] [US1] getApplicationsByApplicantId selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T013 [P] [US1] getAttendanceByStaffId selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T014 [P] [US1] getAttendanceByEventId selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T015 [P] [US1] getActiveJobPostings selector 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T016 [P] [US1] getScheduleEvents computed selector 구현 in app2/src/stores/unifiedDataStore.ts
- [ ] T017 [US1] Selector 단위 테스트 작성 in app2/src/stores/__tests__/unifiedDataStore.test.ts (최소 9개 selector 테스트)
- [X] T018 [US1] TypeScript strict mode 검증 (`npm run type-check` 에러 0개)

**Checkpoint**: User Story 1 거의 완료 ✅ - Selector를 통한 데이터 조회 기능이 독립적으로 작동 (테스트 작성 필요)

---

## Phase 4: User Story 2 - Firebase 실시간 구독이 정상 작동 (Priority: P1)

**Goal**: Firebase onSnapshot 실시간 구독이 Zustand Store와 통합되어 자동 업데이트

**Independent Test**:
1. Firebase Firestore에서 staff 문서 수정
2. 3초 이내에 UI에 자동 반영 확인
3. 로그아웃 시 모든 구독 정리 확인 (메모리 누수 없음)

### Implementation for User Story 2

- [X] T019 [US2] subscribeAll action 구현 (userId, role 파라미터) in app2/src/stores/unifiedDataStore.ts
- [X] T020 [US2] Firebase onSnapshot 구독 로직 통합 (5개 컬렉션) in app2/src/stores/unifiedDataStore.ts
- [X] T021 [US2] unsubscribeAll action 구현 (cleanup 로직) in app2/src/stores/unifiedDataStore.ts
- [X] T022 [US2] setStaff, setWorkLogs, setApplications, setAttendanceRecords, setJobPostings actions 구현 in app2/src/stores/unifiedDataStore.ts
- [X] T023 [US2] updateStaff, updateWorkLog, updateApplication, updateAttendanceRecord, updateJobPosting actions 구현 (immer로 불변성 처리) in app2/src/stores/unifiedDataStore.ts
- [X] T024 [US2] deleteStaff, deleteWorkLog, deleteApplication, deleteAttendanceRecord, deleteJobPosting actions 구현 in app2/src/stores/unifiedDataStore.ts
- [ ] T025 [US2] Firebase 구독 mock 테스트 작성 in app2/src/stores/__tests__/unifiedDataStore.test.ts
- [ ] T026 [US2] cleanup 로직 테스트 (메모리 누수 방지) in app2/src/stores/__tests__/unifiedDataStore.test.ts
- [ ] T027 [US2] 실시간 구독 통합 테스트 (3초 이내 반영 확인)

**Checkpoint**: User Story 2 거의 완료 ✅ - Firebase 실시간 구독이 독립적으로 작동 (테스트 작성 필요)

---

## Phase 5: User Story 3 - Redux DevTools로 상태 디버깅 가능 (Priority: P2)

**Goal**: Redux DevTools를 통해 Zustand Store의 상태 변화를 실시간으로 추적

**Independent Test**:
1. 브라우저에서 Redux DevTools 확장 열기
2. Store 초기화 시 "UnifiedDataStore" 연결 확인
3. action dispatch 시 타임라인에 기록 확인
4. Time-travel 디버깅 테스트

### Implementation for User Story 3

- [X] T028 [US3] devtools 미들웨어 설정 확인 (이미 T005에서 설정, 검증만 수행) in app2/src/stores/unifiedDataStore.ts
- [ ] T029 [US3] Action 이름 명시적 지정 (DevTools 추적 용이성) in app2/src/stores/unifiedDataStore.ts
- [X] T030 [US3] 개발 환경에서만 devtools 활성화 설정 (`process.env.NODE_ENV === 'development'`) in app2/src/stores/unifiedDataStore.ts
- [ ] T031 [US3] Redux DevTools 연동 수동 테스트 (브라우저에서 확인)
- [ ] T032 [US3] Time-travel 디버깅 테스트

**Checkpoint**: User Story 3 거의 완료 ✅ - Redux DevTools 연동이 독립적으로 작동 (수동 테스트 필요)

---

## Phase 6: User Story 4 - 기존 컴포넌트가 마이그레이션 후에도 정상 작동 (Priority: P1) ✅

**Goal**: 20개+ 컴포넌트를 Context API에서 Zustand Store로 마이그레이션

**Independent Test**:
1. 각 페이지 개별 로드하여 데이터 조회 확인
2. CRUD 기능 수동 테스트
3. E2E 테스트 스위트 실행

### Implementation for User Story 4

#### 4.1. 주요 페이지 마이그레이션 (5개)

- [ ] T033 [P] [US4] MySchedulePage 마이그레이션 (Context → Zustand) in app2/src/pages/MySchedulePage/index.tsx
- [ ] T034 [P] [US4] JobPostingPage 마이그레이션 in app2/src/pages/JobPostingPage/index.tsx
- [ ] T035 [P] [US4] ApplicantListPage 마이그레이션 in app2/src/pages/ApplicantListPage/index.tsx
- [ ] T036 [P] [US4] StaffManagementPage 마이그레이션 in app2/src/pages/StaffManagementPage/index.tsx
- [ ] T037 [P] [US4] AttendancePage 마이그레이션 in app2/src/pages/AttendancePage/index.tsx

#### 4.2. 주요 컴포넌트 마이그레이션 (5개)

- [ ] T038 [P] [US4] ScheduleDetailModal 마이그레이션 in app2/src/pages/MySchedulePage/components/ScheduleDetailModal/index.tsx
- [ ] T039 [P] [US4] StaffSelector 마이그레이션 in app2/src/components/StaffSelector.tsx
- [ ] T040 [P] [US4] WorkLogList 마이그레이션 in app2/src/components/WorkLogList.tsx
- [ ] T041 [P] [US4] ApplicationList 마이그레이션 in app2/src/components/ApplicationList.tsx
- [ ] T042 [P] [US4] AttendanceRecordList 마이그레이션 in app2/src/components/AttendanceRecordList.tsx

#### 4.3. 나머지 컴포넌트 마이그레이션 (grep 검색으로 발견된 10개+)

- [ ] T043 [US4] grep으로 `useUnifiedData` 사용처 전체 검색 및 목록 작성
- [ ] T044 [P] [US4] 검색된 나머지 컴포넌트 일괄 마이그레이션 (10개+, 병렬 처리 가능)

#### 4.4. 검증

- [ ] T045 [US4] 각 페이지별 수동 테스트 (조회, 생성, 수정, 삭제)
- [ ] T046 [US4] TypeScript 에러 확인 (`npm run type-check` 에러 0개)
- [ ] T047 [US4] ESLint 에러 확인 (`npm run lint` 통과)

**Checkpoint**: User Story 4 완료 - 모든 컴포넌트가 Zustand Store를 사용하며 기존 기능 정상 작동

---

## Phase 7: User Story 5 - TypeScript 타입 안전성 100% 유지 (Priority: P2)

**Goal**: TypeScript strict mode에서 에러 없이 컴파일, any 타입 사용 없음

**Independent Test**:
1. `npm run type-check` 실행하여 에러 0개 확인
2. ESLint로 any 타입 사용 검사
3. IDE에서 자동완성 및 타입 검사 확인

### Implementation for User Story 5

- [ ] T048 [US5] 모든 타입 정의 검증 (State, Actions, Selectors) in app2/src/stores/unifiedDataStore.ts
- [ ] T049 [US5] any 타입 사용 제거 (ESLint 규칙 강제) in app2/src/stores/unifiedDataStore.ts
- [ ] T050 [US5] 타입 가드 함수 구현 (isStaff, isWorkLog, isApplication, isAttendanceRecord, isJobPosting) in app2/src/stores/unifiedDataStore.ts
- [ ] T051 [US5] TypeScript strict mode 최종 검증 (`npm run type-check` 에러 0개)
- [ ] T052 [US5] ESLint any 타입 검사 (`npm run lint` 통과)

**Checkpoint**: User Story 5 완료 - TypeScript 타입 안전성 100% 달성

---

## Phase 8: User Story 6 - 성능 동일 또는 향상 (Priority: P2)

**Goal**: 리렌더링 횟수 감소, 메모리 사용량 안정적

**Independent Test**:
1. React DevTools Profiler로 리렌더링 횟수 측정
2. Chrome Memory Profiler로 메모리 사용량 측정
3. 10분간 메모리 누수 없음 확인

### Implementation for User Story 6

- [ ] T053 [US6] shallow 비교 최적화 적용 (여러 값 선택 시 useShallow hook 사용)
- [ ] T054 [US6] 복잡한 selector에 내부 캐싱 적용 (메모이제이션)
- [ ] T055 [US6] React DevTools Profiler로 리렌더링 횟수 측정 및 비교 (Context vs Zustand)
- [ ] T056 [US6] Chrome Memory Profiler로 메모리 사용량 측정 및 비교
- [ ] T057 [US6] 10분간 메모리 누수 테스트 (로그아웃/로그인 반복)
- [ ] T058 [US6] 성능 벤치마크 결과 문서화

**Checkpoint**: User Story 6 완료 - 성능이 기존 대비 동등하거나 향상됨

---

## Phase 9: Context 완전 제거 및 최종 검증

**Purpose**: 기존 Context API 코드 제거 및 전체 시스템 검증

- [ ] T059 UnifiedDataContext.tsx 파일 삭제 in app2/src/contexts/UnifiedDataContext.tsx
- [ ] T060 App.tsx에서 UnifiedDataProvider 제거 in app2/src/App.tsx
- [ ] T061 불필요한 import 문 정리 (전체 프로젝트)
- [ ] T062 `npm run type-check` 최종 검증 (에러 0개)
- [ ] T063 `npm run lint` 최종 검증 (통과)
- [ ] T064 `npm run build` 최종 검증 (성공)

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 모든 User Story에 영향을 주는 개선 사항

- [ ] T065 [P] 단위 테스트 커버리지 확인 (70% 이상 목표) in app2/src/stores/__tests__/unifiedDataStore.test.ts
- [ ] T066 [P] 코드 라인 수 확인 (782줄 → 400줄 이하, 50% 감소)
- [ ] T067 [P] quickstart.md 문서 검증 (예시 코드 실행 확인)
- [ ] T068 [P] research.md 결정 사항 적용 확인
- [ ] T069 성능 벤치마크 최종 보고서 작성
- [ ] T070 전체 페이지 수동 테스트 (20개+ 컴포넌트)
- [ ] T071 E2E 테스트 스위트 실행
- [ ] T072 최종 Success Criteria 체크리스트 검증

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 필요 - 모든 User Story를 차단
- **User Stories (Phase 3-8)**: 모두 Foundational Phase 완료 필요
  - User Story 1, 2, 4 (P1): 병렬 진행 가능
  - User Story 3, 5, 6 (P2): User Story 1, 2 완료 후 병렬 진행 가능
- **Context 제거 (Phase 9)**: 모든 User Story 완료 필요
- **Polish (Phase 10)**: Context 제거 완료 필요

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 완료 후 시작 가능 - 다른 Story 의존성 없음 ✅
- **User Story 2 (P1)**: Foundational 완료 후 시작 가능 - 다른 Story 의존성 없음 ✅
- **User Story 3 (P2)**: User Story 1, 2 완료 후 시작 (DevTools는 동작하는 Store 필요)
- **User Story 4 (P1)**: User Story 1, 2 완료 후 시작 (컴포넌트 마이그레이션은 동작하는 Store 필요)
- **User Story 5 (P2)**: User Story 1, 2, 4 완료 후 시작 (모든 코드 완성 후 타입 검증)
- **User Story 6 (P2)**: User Story 1, 2, 4 완료 후 시작 (성능 측정은 마이그레이션 완료 후)

### Within Each User Story

- **User Story 1**: Selectors 구현 (T008-T016) → 테스트 (T017-T018)
- **User Story 2**: Actions 구현 (T019-T024) → 테스트 (T025-T027)
- **User Story 3**: DevTools 설정 (T028-T030) → 테스트 (T031-T032)
- **User Story 4**: 페이지 마이그레이션 (T033-T037) → 컴포넌트 마이그레이션 (T038-T042) → 나머지 (T043-T044) → 검증 (T045-T047)
- **User Story 5**: 타입 정의 (T048-T050) → 검증 (T051-T052)
- **User Story 6**: 최적화 (T053-T054) → 측정 (T055-T058)

### Parallel Opportunities

- **Setup (Phase 1)**: T002, T003 병렬 실행 가능
- **Foundational (Phase 2)**: T005, T006 병렬 실행 가능
- **User Story 1**: T008-T016 (9개 selectors) 병렬 실행 가능
- **User Story 4**: T033-T037 (5개 페이지), T038-T042 (5개 컴포넌트) 각각 병렬 실행 가능
- **User Story 1, 2, 4 (모두 P1)**: Foundational 완료 후 동시 진행 가능 (팀 역량 허용 시)
- **User Story 3, 5, 6 (모두 P2)**: User Story 1, 2, 4 완료 후 동시 진행 가능
- **Polish (Phase 10)**: T065-T068 병렬 실행 가능

---

## Parallel Example: User Story 1

```bash
# User Story 1의 모든 selector를 병렬로 구현:
Task: "getStaffById selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getWorkLogsByStaffId selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getWorkLogsByEventId selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getApplicationsByEventId selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getApplicationsByApplicantId selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getAttendanceByStaffId selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getAttendanceByEventId selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getActiveJobPostings selector 구현 in app2/src/stores/unifiedDataStore.ts"
Task: "getScheduleEvents computed selector 구현 in app2/src/stores/unifiedDataStore.ts"
```

---

## Parallel Example: User Story 4

```bash
# User Story 4의 모든 페이지 마이그레이션을 병렬로 수행:
Task: "MySchedulePage 마이그레이션 in app2/src/pages/MySchedulePage/index.tsx"
Task: "JobPostingPage 마이그레이션 in app2/src/pages/JobPostingPage/index.tsx"
Task: "ApplicantListPage 마이그레이션 in app2/src/pages/ApplicantListPage/index.tsx"
Task: "StaffManagementPage 마이그레이션 in app2/src/pages/StaffManagementPage/index.tsx"
Task: "AttendancePage 마이그레이션 in app2/src/pages/AttendancePage/index.tsx"

# 컴포넌트 마이그레이션도 병렬로 수행:
Task: "ScheduleDetailModal 마이그레이션 in app2/src/pages/MySchedulePage/components/ScheduleDetailModal/index.tsx"
Task: "StaffSelector 마이그레이션 in app2/src/components/StaffSelector.tsx"
Task: "WorkLogList 마이그레이션 in app2/src/components/WorkLogList.tsx"
Task: "ApplicationList 마이그레이션 in app2/src/components/ApplicationList.tsx"
Task: "AttendanceRecordList 마이그레이션 in app2/src/components/AttendanceRecordList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2만 구현)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007) - **CRITICAL** - 모든 Story 차단
3. Complete Phase 3: User Story 1 (T008-T018) - 데이터 조회 기능
4. Complete Phase 4: User Story 2 (T019-T027) - Firebase 실시간 구독
5. **STOP and VALIDATE**: User Story 1, 2 독립적으로 테스트
6. MVP 배포/데모 가능

### Incremental Delivery (권장)

1. **Foundation**: Setup + Foundational → Store 기본 구조 완성
2. **MVP**: User Story 1 + 2 → 테스트 → 배포/데모 (핵심 기능 완성!)
3. **Enhancement 1**: User Story 3 → 테스트 → 배포/데모 (DevTools 디버깅)
4. **Enhancement 2**: User Story 4 → 테스트 → 배포/데모 (컴포넌트 마이그레이션)
5. **Quality**: User Story 5 + 6 → 테스트 → 배포/데모 (타입 안전성 + 성능)
6. **Finalize**: Context 제거 + Polish → 최종 검증 → Production 배포

각 단계마다 독립적으로 가치를 제공하며, 이전 Story를 깨지 않음

### Parallel Team Strategy

팀이 여러 명일 경우:

1. **함께**: Setup + Foundational 완료
2. **Foundational 완료 후**:
   - Developer A: User Story 1 (Selectors)
   - Developer B: User Story 2 (Firebase 구독)
   - Developer C: User Story 4 준비 (컴포넌트 목록 작성)
3. **User Story 1, 2 완료 후**:
   - Developer A: User Story 3 (DevTools)
   - Developer B: User Story 4 (컴포넌트 마이그레이션)
   - Developer C: User Story 5 (TypeScript)
4. **독립적으로 완료 및 통합**

---

## Notes

- **[P] 작업**: 다른 파일, 의존성 없음 → 병렬 실행 가능
- **[Story] 라벨**: User Story 추적성 확보
- **각 User Story는 독립적으로 완성 및 테스트 가능**
- **테스트 우선**: 구현 전 테스트 실패 확인 (TDD)
- **체크포인트**: 각 User Story 완료 후 독립적으로 검증
- **Commit 전략**: 각 작업 또는 논리적 그룹 완료 후 커밋
- **피해야 할 것**: 모호한 작업, 파일 충돌, Story 독립성을 깨는 교차 의존성

---

## Summary

**총 작업 수**: 72개 (T001-T072)

**User Story별 작업 수**:
- Setup (Phase 1): 3개
- Foundational (Phase 2): 4개
- User Story 1 (P1): 11개 (T008-T018)
- User Story 2 (P1): 9개 (T019-T027)
- User Story 3 (P2): 5개 (T028-T032)
- User Story 4 (P1): 15개 (T033-T047)
- User Story 5 (P2): 5개 (T048-T052)
- User Story 6 (P2): 6개 (T053-T058)
- Context 제거 (Phase 9): 6개 (T059-T064)
- Polish (Phase 10): 8개 (T065-T072)

**병렬 실행 기회**:
- Setup: 2개 작업 병렬 가능 (T002, T003)
- Foundational: 2개 작업 병렬 가능 (T005, T006)
- User Story 1: 9개 selectors 병렬 구현 가능 (T008-T016)
- User Story 4: 10개 컴포넌트 병렬 마이그레이션 가능 (T033-T042)
- User Stories (P1): 3개 Story 동시 진행 가능 (US1, US2, US4)
- User Stories (P2): 3개 Story 동시 진행 가능 (US3, US5, US6)
- Polish: 4개 작업 병렬 가능 (T065-T068)

**권장 MVP 범위**: User Story 1 + 2 (데이터 조회 + Firebase 실시간 구독)

**예상 작업 시간**: 약 60-68시간 (1.5-2주)
- Setup + Foundational: 8시간
- User Story 1 + 2 (MVP): 24시간
- User Story 3 + 4: 20시간
- User Story 5 + 6: 8시간
- Context 제거 + Polish: 8시간

**Format 검증**: ✅ 모든 작업이 체크리스트 형식 준수 (checkbox, ID, labels, file paths)
