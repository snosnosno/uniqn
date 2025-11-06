# Implementation Plan: UnifiedDataContext 테스트 작성

**Branch**: `002-unifieddatacontext-tests` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-unifieddatacontext-tests/spec.md`

## Summary

UnifiedDataContext는 782줄의 복잡한 코드로 5개의 Firebase 컬렉션(staff, workLogs, applications, scheduleEvents, jobPostings)을 통합 관리하는 핵심 컴포넌트입니다. 이 계획은 **70% 이상의 코드 커버리지**를 달성하기 위한 단위 테스트, 통합 테스트, 성능 테스트를 작성합니다. AuthContext 테스트 패턴을 참고하여 React Testing Library, renderHook, Firestore Emulator를 활용합니다.

## Technical Context

**Language/Version**: TypeScript 4.9 (Strict Mode)
**Primary Dependencies**:
- React 18.2
- @testing-library/react 14.0.0
- @testing-library/react-hooks (renderHook 내장)
- Firebase 11.9.1
- fake-indexeddb 6.2.2
- Jest 29.5.3

**Storage**: Firestore (5개 컬렉션: staff, workLogs, applications, scheduleEvents, jobPostings)

**Testing**: Jest + React Testing Library + renderHook

**Target Platform**: Web (React SPA)

**Project Type**: Single (React 애플리케이션)

**Performance Goals**:
- 메모이제이션 효과 80% 이상 (두 번째 조회부터 첫 번째 대비 80% 빠름)
- 1000개 데이터 처리 시간 100ms 이내
- 전체 테스트 실행 시간 10초 이내

**Constraints**:
- React strict mode 준수 (act() 올바른 사용)
- 프로덕션 코드 최소 수정 (테스트를 위한 변경만 허용)
- 테스트 간 격리(isolation) 보장 (cleanup 철저히 수행)

**Scale/Scope**:
- UnifiedDataContext: 782줄 (복잡도 높음)
- 5개 Firebase 컬렉션 동시 구독
- 10개 이상 조회 함수 (getStaffById, getWorkLogsByStaffId 등)
- 메모이제이션 기반 캐싱 시스템

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: 프로젝트에 constitution.md가 템플릿 상태로 존재합니다. 실제 프로젝트 원칙이 정의되지 않았으므로 기본 테스트 원칙을 적용합니다.

### 기본 테스트 원칙 (암묵적 규칙)
✅ **Test-First Approach**: AuthContext 테스트 패턴이 확립되어 있으므로 해당 패턴을 따릅니다
✅ **독립성**: 각 테스트는 독립적으로 실행 가능해야 합니다
✅ **타입 안전성**: TypeScript strict mode 준수
✅ **성능**: 테스트 실행 시간 최소화 (mock 활용)
✅ **유지보수성**: 명확한 테스트 구조와 네이밍

**결과**: 모든 기본 원칙을 준수합니다. Phase 0 진행 가능.

## Project Structure

### Documentation (this feature)

```text
specs/002-unifieddatacontext-tests/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app2/
├── src/
│   ├── contexts/
│   │   ├── UnifiedDataContext.tsx              # 테스트 대상 (782줄)
│   │   └── __tests__/
│   │       ├── UnifiedDataContext.test.tsx           # Phase 2: 단위 테스트
│   │       ├── UnifiedDataContext.integration.test.tsx  # Phase 2: 통합 테스트
│   │       ├── UnifiedDataContext.performance.test.tsx  # Phase 2: 성능 테스트
│   │       └── __mocks__/
│   │           ├── test-data.ts                      # Mock 데이터
│   │           ├── test-firestore.ts                 # Firestore Mock
│   │           └── test-helpers.ts                   # 테스트 헬퍼
│   ├── services/
│   │   └── OptimizedUnifiedDataService.ts      # 테스트 대상 서비스
│   └── types/
│       └── unifiedData.ts                      # 타입 정의
└── tests/                                       # 통합 테스트용 (필요시)
```

**Structure Decision**:
- `__tests__` 디렉토리를 UnifiedDataContext와 동일한 레벨에 배치 (AuthContext 패턴 참고)
- 테스트 타입별로 파일 분리 (단위/통합/성능)
- Mock 데이터와 헬퍼를 `__mocks__` 서브디렉토리로 구조화

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

이 프로젝트는 Constitution Check 위반 사항이 없으므로 이 섹션은 비워둡니다.

---

## Phase 0: Research & Best Practices

### 0.1 테스트 패턴 연구

**목표**: AuthContext 테스트 패턴을 분석하여 UnifiedDataContext에 적용 가능한 베스트 프랙티스를 도출합니다.

**연구 내용**:
1. **Mock 전략**
   - Firebase mock 구조 (`jest.mock('../../firebase')`)
   - logger, sentry, secureStorage mock 패턴
   - Mock 데이터 구조 (test-users.ts, test-tokens.ts, test-errors.ts)

2. **renderHook 사용법**
   - `renderHook(() => useAuth(), { wrapper: AuthProvider })`
   - `waitFor`를 사용한 비동기 상태 대기
   - `act()`를 사용한 상태 업데이트

3. **테스트 격리 (Isolation)**
   - `beforeEach`에서 localStorage, mockStorage 초기화
   - `jest.clearAllMocks()` 호출
   - cleanup 함수 검증

4. **에러 핸들링 테스트**
   - 다양한 Firebase 에러 시나리오 (wrongPasswordError, userNotFoundError 등)
   - 에러 메시지 검증
   - 에러 상태 전파 검증

**출처**: `app2/src/contexts/__tests__/AuthContext.test.tsx`

### 0.2 Firestore Emulator 연구

**목표**: Firestore Emulator를 사용한 통합 테스트 환경을 구축합니다.

**연구 내용**:
1. **Emulator 설정**
   - `firebase.json`에서 Firestore Emulator 포트 확인 (기본 8080)
   - `initializeTestEnvironment()` 사용 방법
   - `connectFirestoreEmulator()` 설정

2. **fake-indexeddb 통합**
   - IndexedDB 시뮬레이션을 위한 fake-indexeddb 설정
   - Jest setup 파일에서 전역 설정

3. **Firestore Rules 시뮬레이션**
   - admin vs staff 역할별 쿼리 필터링 테스트
   - Security Rules 시뮬레이션 방법

**참고 문서**:
- Firebase Testing Guide: https://firebase.google.com/docs/rules/unit-tests
- fake-indexeddb README: https://github.com/dumbmatter/fakeIndexedDB

### 0.3 메모이제이션 테스트 연구

**목표**: 메모이제이션 효과를 측정하는 성능 테스트 방법을 연구합니다.

**연구 내용**:
1. **Performance.now() 측정**
   - 첫 번째 호출 vs 두 번째 호출 시간 비교
   - 80% 성능 개선 검증 로직

2. **캐시 동작 검증**
   - Map 기반 캐시가 올바르게 작동하는지 확인
   - 캐시 크기 제한 (1000개) 검증
   - 캐시 무효화 시나리오

3. **메모리 사용량 측정**
   - `process.memoryUsage()` (Node.js 환경)
   - 반복적인 mount/unmount 시 메모리 누수 감지

**참고 패턴**:
- UnifiedDataContext의 `memoize` 함수 (line 36-60)
- 캐시 크기 제한 로직 (line 53-56)

### 0.4 React Testing Library 베스트 프랙티스

**목표**: React Testing Library의 최신 베스트 프랙티스를 적용합니다.

**연구 내용**:
1. **act() 사용법**
   - 언제 act()가 필요한가?
   - renderHook 내부에서 자동 처리되는 경우
   - 명시적으로 act()를 사용해야 하는 경우

2. **waitFor 최적화**
   - timeout 설정 (기본 1000ms)
   - interval 설정 (기본 50ms)
   - 불필요한 waitFor 제거

3. **cleanup**
   - `afterEach(cleanup)` 자동 호출 (React Testing Library 13+)
   - 명시적 cleanup이 필요한 경우 (Firestore 구독 등)

**참고 문서**:
- React Testing Library Docs: https://testing-library.com/docs/react-testing-library/intro
- React Hooks Testing Library: https://react-hooks-testing-library.com/

---

## Phase 1: Design & Contracts

### 1.1 데이터 모델 (data-model.md)

UnifiedDataContext가 관리하는 5개 컬렉션의 데이터 구조를 정의합니다.

**주요 엔티티**:
1. **Staff**: 스태프 정보
2. **WorkLog**: 근무 로그
3. **AttendanceRecord**: 출석 기록
4. **Application**: 지원서
5. **ScheduleEvent**: 일정 이벤트

**상태 구조**:
```typescript
interface UnifiedDataState {
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  attendanceRecords: Map<string, AttendanceRecord>;
  applications: Map<string, Application>;
  scheduleEvents: ScheduleEvent[];

  loading: {
    initial: boolean;
    staff: boolean;
    workLogs: boolean;
    applications: boolean;
    scheduleEvents: boolean;
    jobPostings: boolean;
  };

  error: {
    staff: Error | null;
    workLogs: Error | null;
    applications: Error | null;
    scheduleEvents: Error | null;
    jobPostings: Error | null;
  };

  performanceMetrics: PerformanceMetrics;
}
```

### 1.2 테스트 계약 (contracts/)

UnifiedDataContext가 제공하는 API와 테스트 시나리오를 정의합니다.

**테스트 계약 파일**:
1. `unit-tests.contract.md`: 단위 테스트 시나리오
2. `integration-tests.contract.md`: 통합 테스트 시나리오
3. `performance-tests.contract.md`: 성능 테스트 시나리오

**주요 API**:
```typescript
// 조회 함수
getStaffById(staffId: string): Staff | undefined
getWorkLogsByStaffId(staffId: string): WorkLog[]
getApplicationsByEventId(eventId: string): Application[]
getTodayScheduleEvents(): ScheduleEvent[]

// 상태 제공
staff: Map<string, Staff>
workLogs: Map<string, WorkLog>
loading: LoadingState
error: ErrorState
```

### 1.3 퀵스타트 가이드 (quickstart.md)

개발자가 테스트를 실행하고 작성하는 방법을 안내합니다.

**주요 내용**:
1. **환경 설정**: fake-indexeddb, Firestore Emulator 설정
2. **테스트 실행**: `npm test -- UnifiedDataContext.test.tsx`
3. **Mock 데이터 사용법**: test-data.ts 구조 설명
4. **새 테스트 작성 가이드**: renderHook, waitFor, act() 사용법
5. **커버리지 확인**: `npm run test:coverage`

### 1.4 Agent Context 업데이트

현재 기술 스택을 agent context 파일에 추가합니다.

**추가할 기술**:
- React Testing Library 14.0.0
- fake-indexeddb 6.2.2
- Firestore Emulator
- Jest + renderHook 패턴
- Performance.now() 측정 패턴

---

## Phase 2: Task Generation (NOT in this command)

Phase 2는 `/speckit.tasks` 명령으로 별도로 진행됩니다. 이 단계에서는:

1. **tasks.md 생성**: 우선순위와 의존성을 고려한 작업 분해
2. **병렬 작업 식별**: [P] 마커로 병렬 실행 가능 작업 표시
3. **예상 시간 산정**: 각 작업의 예상 소요 시간

---

## Next Steps

1. ✅ **Phase 0 완료 표시**: `research.md` 파일 생성
2. ✅ **Phase 1 완료 표시**: `data-model.md`, `contracts/`, `quickstart.md` 생성
3. ✅ **Agent Context 업데이트**: `.specify/scripts/powershell/update-agent-context.ps1` 실행
4. ⏳ **Phase 2 진행**: `/speckit.tasks` 명령으로 tasks.md 생성
5. ⏳ **Phase 3 구현**: `/speckit.implement` 명령으로 실제 테스트 코드 작성

---

**Status**: Phase 1 완료 준비 | **Next Command**: Phase 0 artifacts 생성
