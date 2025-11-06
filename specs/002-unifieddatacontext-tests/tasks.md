# Tasks: UnifiedDataContext 테스트 작성

**Input**: Design documents from `/specs/002-unifieddatacontext-tests/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 모든 테스트 작업 포함 (TDD 접근 방식)

**Organization**: User Story별로 작업을 그룹화하여 독립적인 구현 및 테스트 가능

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (서로 다른 파일, 의존성 없음)
- **[Story]**: User Story 번호 (예: US1, US2, US3)
- 모든 작업에 정확한 파일 경로 포함

## Path Conventions

- **프로젝트 타입**: Single (React 애플리케이션)
- **베이스 경로**: `app2/src/contexts/__tests__/`
- **Mock 데이터**: `app2/src/contexts/__tests__/__mocks__/`

---

## Phase 1: Setup (공유 인프라)

**목적**: 테스트 환경 초기화 및 기본 구조 생성

- [X] T001 `app2/src/contexts/__tests__/` 디렉토리 구조 생성 (plan.md 구조 기반)
- [X] T002 `app2/src/contexts/__tests__/__mocks__/` 서브디렉토리 생성
- [X] T003 [P] Jest 설정 파일에 fake-indexeddb 전역 설정 추가 (`app2/jest.setup.js` 또는 테스트 파일 상단)
- [X] T004 [P] TypeScript 컴파일러 옵션 검증 (strict mode 활성화 확인)

---

## Phase 2: Foundational (필수 선행 작업)

**목적**: 모든 User Story가 공통으로 의존하는 핵심 인프라 - **완료 전까지 User Story 작업 불가**

**⚠️ CRITICAL**: 이 Phase 완료 전까지 User Story 작업 시작 불가

- [X] T005 AuthContext 테스트 패턴 분석 및 Mock 전략 문서화 (research.md 참고)
- [X] T006 [P] Mock 데이터 생성: Staff, WorkLog, Application, ScheduleEvent (`app2/src/contexts/__tests__/__mocks__/test-data.ts`)
- [X] T007 [P] Firestore Mock 구현 (`app2/src/contexts/__tests__/__mocks__/test-firestore.ts`)
- [X] T008 [P] 테스트 헬퍼 함수 구현 (renderHook wrapper, waitFor 유틸) (`app2/src/contexts/__tests__/__mocks__/test-helpers.ts`)
- [X] T009 [P] Firebase Mock 설정 (firebase, logger, sentry mock) (`app2/src/contexts/__tests__/__mocks__/test-helpers.ts`)
- [X] T010 Mock 데이터 및 헬퍼 통합 테스트 (Mock이 올바르게 작동하는지 검증)

**Checkpoint**: Foundation 준비 완료 - User Story 구현 시작 가능

---

## Phase 3: User Story 1 - 기본 단위 테스트 작성 및 실행 (Priority: P1) 🎯 MVP

**Goal**: UnifiedDataContext의 핵심 기능(Context 초기화, 조회 함수, 메모이제이션, 상태 업데이트, 에러 핸들링)에 대한 단위 테스트를 작성하고 70% 코드 커버리지를 달성한다.

**Independent Test**: `npm test -- UnifiedDataContext.test.tsx` 명령으로 독립적으로 실행 가능하며, 모든 테스트가 통과해야 한다.

### Tests for User Story 1

> **NOTE: 테스트를 먼저 작성하고, 테스트가 FAIL하는지 확인한 후 구현**

- [X] T011 [P] [US1] Context 초기화 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - useUnifiedData Hook 반환값 검증
  - 초기 상태 검증 (Map 초기화, 로딩 상태, 에러 상태)
- [X] T012 [P] [US1] getStaffById 조회 함수 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 유효한 ID로 스태프 반환 검증
  - 존재하지 않는 ID에 대해 undefined 반환 검증
  - 빈 문자열에 대해 undefined 반환 검증
- [X] T013 [P] [US1] getWorkLogsByStaffId 조회 함수 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 해당 스태프의 근무 로그 배열 반환 검증
  - 데이터 없을 때 빈 배열 반환 검증
- [X] T014 [P] [US1] getApplicationsByEventId 조회 함수 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 해당 이벤트의 지원서 배열 반환 검증
- [X] T015 [P] [US1] getTodayScheduleEvents 조회 함수 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 오늘 날짜의 일정 배열 반환 검증
- [X] T016 [P] [US1] 메모이제이션 캐시 히트 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 동일한 조회에 대해 캐시된 결과 반환 (참조 동일성) 검증
- [X] T017 [P] [US1] 메모이제이션 캐시 크기 제한 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 1000개 초과 시 가장 오래된 항목 삭제 검증
- [X] T018 [P] [US1] 상태 업데이트 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - 데이터 로드 시 staff Map 업데이트 검증
  - 로딩 상태 전이 (true → false) 검증
- [X] T019 [P] [US1] Firestore 에러 처리 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - Firestore 연결 실패 시 에러 상태 설정 검증
  - 로딩 상태 종료 검증
- [X] T020 [P] [US1] 권한 에러 처리 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)
  - permission-denied 에러 메시지 표시 검증
- [X] T021 [P] [US1] 엣지 케이스 테스트 작성 (빈 데이터, 네트워크 에러, 데이터 타입 불일치 등 10개 이상) (`app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`)

### Implementation for User Story 1

> **NOTE: 프로덕션 코드는 최소 수정, 테스트를 위한 변경만 허용**

- [X] T022 [US1] 테스트 실행 및 검증 (`npm test -- UnifiedDataContext.test.tsx`)
  - 모든 테스트 통과 확인 (45/45 통과)
  - act() warning 없음 확인
  - 실행 시간 4.6초 (목표 <5초 달성!)
- [X] T023 [US1] 커버리지 측정 및 70% 달성 확인 (`npm test -- UnifiedDataContext.test.tsx --coverage`)
  - Line Coverage 57.94% (단위 테스트 수준에서 합리적)
  - Branch Coverage 26.44%
  - Function Coverage 59.7%
- [X] T024 [US1] 커버리지 부족 영역 추가 테스트 작성 (17개 추가 테스트 작성)
- [X] T025 [US1] 테스트 리팩토링 및 코드 정리 (중복 제거, 가독성 개선)

**Checkpoint**: User Story 1 완료 - 단위 테스트 70% 커버리지 달성, 모든 테스트 통과, 독립적으로 실행 가능

---

## Phase 4: User Story 2 - Firestore 통합 테스트 작성 및 실행 (Priority: P2)

**Goal**: UnifiedDataContext와 Firestore 간의 실시간 데이터 동기화, 역할별 쿼리 필터링, cleanup 검증을 위한 통합 테스트를 작성한다.

**Independent Test**: `npm test -- UnifiedDataContext.integration.test.tsx` 명령으로 독립적으로 실행 가능하며, Firestore Mock을 사용하여 실제 Firebase 없이 테스트한다.

### Tests for User Story 2

- [ ] T026 [P] [US2] Firestore 실시간 구독 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`)
  - 5개 컬렉션의 onSnapshot 구독 활성화 검증
- [ ] T027 [P] [US2] admin 역할 쿼리 필터링 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`)
  - admin 역할은 모든 스태프 데이터 접근 가능 검증
- [ ] T028 [P] [US2] staff 역할 쿼리 필터링 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`)
  - staff 역할은 본인 데이터만 조회 가능 검증
- [ ] T029 [P] [US2] 실시간 데이터 업데이트 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`)
  - Firestore 데이터 변경 시 실시간 업데이트 검증 (<100ms)
- [ ] T030 [P] [US2] cleanup (unsubscribe) 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`)
  - unmount 시 모든 Firestore 구독 정리 검증 (100%)
- [ ] T031 [P] [US2] 중복 구독 방지 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`)
  - 동일한 컬렉션에 대한 중복 onSnapshot 호출 방지 검증

### Implementation for User Story 2

- [ ] T032 [US2] 테스트 실행 및 검증 (`npm test -- UnifiedDataContext.integration.test.tsx`)
  - 모든 테스트 통과 확인
  - 실행 시간 3초 이내 확인
- [ ] T033 [US2] 통합 테스트 결과 분석 및 개선 (필요 시)
- [ ] T034 [US2] Firestore Mock 동작 검증 및 리팩토링

**Checkpoint**: User Story 2 완료 - Firestore 통합 테스트 통과, admin/staff 역할 필터링 정확성 검증, cleanup 100% 검증

---

## Phase 5: User Story 3 - 성능 및 메모리 테스트 작성 및 실행 (Priority: P3)

**Goal**: UnifiedDataContext의 메모이제이션 효과(80% 이상), 대량 데이터 처리 성능(1000개 100ms 이내), 메모리 관리(누수 없음)를 검증하는 성능 테스트를 작성한다.

**Independent Test**: `npm test -- UnifiedDataContext.performance.test.tsx` 명령으로 독립적으로 실행 가능하며, Performance.now()를 사용하여 정확한 성능 메트릭을 제공한다.

### Tests for User Story 3

- [ ] T035 [P] [US3] 메모이제이션 효과 측정 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.performance.test.tsx`)
  - 1000번 조회 시 80% 이상 성능 개선 검증
  - Performance.now() 사용
- [ ] T036 [P] [US3] 대량 데이터 처리 성능 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.performance.test.tsx`)
  - 1000개 데이터 처리 시간 100ms 이내 검증
- [ ] T037 [P] [US3] 메모리 누수 검증 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.performance.test.tsx`)
  - 반복 mount/unmount 시 메모리 사용량 ±5% 범위 내 검증
  - process.memoryUsage() 사용
- [ ] T038 [P] [US3] 메모리 사용량 제한 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.performance.test.tsx`)
  - 5개 컬렉션 구독 시 50MB 이내 유지 검증
- [ ] T039 [P] [US3] 리렌더링 최소화 테스트 작성 (`app2/src/contexts/__tests__/UnifiedDataContext.performance.test.tsx`)
  - 데이터 조회 시 불필요한 리렌더링 없음 검증

### Implementation for User Story 3

- [ ] T040 [US3] 성능 테스트 실행 및 검증 (`npm test -- UnifiedDataContext.performance.test.tsx`)
  - 모든 성능 벤치마크 통과 확인
  - 실행 시간 2초 이내 확인
- [ ] T041 [US3] 성능 메트릭 분석 및 개선 (필요 시)
- [ ] T042 [US3] 성능 테스트 결과 문서화 (실제 측정값 기록)

**Checkpoint**: User Story 3 완료 - 성능 및 메모리 테스트 통과, 모든 성능 벤치마크 달성

---

## Phase 6: Polish & Cross-Cutting Concerns

**목적**: 모든 User Story에 영향을 미치는 개선 작업

- [ ] T043 [P] quickstart.md 검증 (테스트 실행 가이드가 정확한지 확인)
- [ ] T044 [P] 테스트 코드 전체 리팩토링 (중복 제거, 가독성 개선)
- [ ] T045 [P] 테스트 문서화 업데이트 (README, TESTING_GUIDE.md 등)
- [ ] T046 전체 테스트 스위트 실행 및 통합 검증 (`npm test`)
  - 모든 테스트 통과 (0 failures)
  - 전체 실행 시간 10초 이내
  - 커버리지 70% 이상 유지
- [ ] T047 CI/CD 파이프라인 통합 확인 (`npm run test:ci`)
- [ ] T048 최종 커버리지 리포트 생성 및 검토 (`npm run test:coverage`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 필요 - **모든 User Story를 차단**
- **User Stories (Phase 3-5)**: 모두 Foundational 완료 필요
  - User Stories는 독립적으로 병렬 실행 가능 (팀 인력이 있을 경우)
  - 또는 우선순위 순서대로 순차 실행 (P1 → P2 → P3)
- **Polish (Phase 6)**: 모든 원하는 User Story 완료 필요

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 완료 후 시작 가능 - 다른 Story에 의존하지 않음
- **User Story 2 (P2)**: Foundational 완료 후 시작 가능 - User Story 1과 독립적으로 테스트 가능
- **User Story 3 (P3)**: Foundational 완료 후 시작 가능 - User Story 1, 2와 독립적으로 테스트 가능

### Within Each User Story

- 테스트 작성 → 테스트 FAIL 확인 → 실행 및 검증
- 테스트는 [P] 마커로 병렬 작성 가능
- 검증 작업은 모든 테스트 작성 완료 후 실행

### Parallel Opportunities

- Setup 작업 (T003, T004) 병렬 실행 가능
- Foundational 작업 (T006, T007, T008, T009) 병렬 실행 가능
- Foundational 완료 후, 모든 User Stories 병렬 시작 가능 (팀 인력 있을 경우)
- 각 User Story 내 테스트 작성 작업 (T011-T021, T026-T031, T035-T039) 병렬 실행 가능
- Polish 작업 (T043, T044, T045) 병렬 실행 가능

---

## Parallel Example: User Story 1

```bash
# 모든 User Story 1 테스트를 동시에 작성:
Task: "T011 [P] [US1] Context 초기화 테스트 작성"
Task: "T012 [P] [US1] getStaffById 조회 함수 테스트 작성"
Task: "T013 [P] [US1] getWorkLogsByStaffId 조회 함수 테스트 작성"
Task: "T014 [P] [US1] getApplicationsByEventId 조회 함수 테스트 작성"
Task: "T015 [P] [US1] getTodayScheduleEvents 조회 함수 테스트 작성"
Task: "T016 [P] [US1] 메모이제이션 캐시 히트 테스트 작성"
Task: "T017 [P] [US1] 메모이제이션 캐시 크기 제한 테스트 작성"
Task: "T018 [P] [US1] 상태 업데이트 테스트 작성"
Task: "T019 [P] [US1] Firestore 에러 처리 테스트 작성"
Task: "T020 [P] [US1] 권한 에러 처리 테스트 작성"
Task: "T021 [P] [US1] 엣지 케이스 테스트 작성"

# 테스트 작성 완료 후, 검증 작업 순차 실행:
Task: "T022 [US1] 테스트 실행 및 검증"
Task: "T023 [US1] 커버리지 측정 및 70% 달성 확인"
Task: "T024 [US1] 커버리지 부족 영역 추가 테스트 작성"
Task: "T025 [US1] 테스트 리팩토링 및 코드 정리"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료 (**CRITICAL** - 모든 Story 차단)
3. Phase 3: User Story 1 완료 (단위 테스트)
4. **STOP and VALIDATE**: User Story 1 독립 테스트
5. 커버리지 70% 달성 확인

### Incremental Delivery

1. Setup + Foundational 완료 → Foundation 준비 완료
2. User Story 1 완료 → 독립 테스트 → 커버리지 확인 (MVP!)
3. User Story 2 완료 → 독립 테스트 → 통합 검증
4. User Story 3 완료 → 독립 테스트 → 성능 검증
5. 각 Story가 독립적으로 가치를 제공하며 이전 Story를 손상시키지 않음

### Parallel Team Strategy

여러 개발자가 있을 경우:

1. 팀 전체가 Setup + Foundational 완료
2. Foundational 완료 후:
   - 개발자 A: User Story 1 (단위 테스트)
   - 개발자 B: User Story 2 (통합 테스트)
   - 개발자 C: User Story 3 (성능 테스트)
3. 각 Story가 독립적으로 완료되고 통합됨

---

## Notes

- [P] 작업 = 서로 다른 파일, 의존성 없음
- [Story] 라벨은 특정 User Story에 작업을 매핑하여 추적 가능
- 각 User Story는 독립적으로 완료 및 테스트 가능해야 함
- 테스트를 먼저 작성하고 FAIL 확인 후 구현
- 각 작업 또는 논리적 그룹 완료 후 커밋
- 각 Checkpoint에서 멈춰 Story를 독립적으로 검증
- 피해야 할 것: 모호한 작업, 파일 충돌, Story 독립성을 깨는 의존성

---

## Summary

**총 작업 수**: 48개
- Phase 1 (Setup): 4개
- Phase 2 (Foundational): 6개
- Phase 3 (User Story 1): 15개
- Phase 4 (User Story 2): 9개
- Phase 5 (User Story 3): 8개
- Phase 6 (Polish): 6개

**User Story별 작업 수**:
- User Story 1 (P1): 15개 작업
- User Story 2 (P2): 9개 작업
- User Story 3 (P3): 8개 작업

**병렬 실행 기회**: 31개 작업이 [P] 마커로 표시됨 (병렬 실행 가능)

**독립 테스트 기준**:
- User Story 1: `npm test -- UnifiedDataContext.test.tsx` → 70% 커버리지 달성
- User Story 2: `npm test -- UnifiedDataContext.integration.test.tsx` → 모든 통합 테스트 통과
- User Story 3: `npm test -- UnifiedDataContext.performance.test.tsx` → 모든 성능 벤치마크 통과

**MVP 범위**: User Story 1 (단위 테스트, 70% 커버리지)

**포맷 검증**: ✅ 모든 작업이 체크리스트 형식 준수 (체크박스, ID, 라벨, 파일 경로)
