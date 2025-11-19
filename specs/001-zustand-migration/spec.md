# Feature Specification: UnifiedDataContext를 Zustand Store로 전면 교체

**Feature Branch**: `001-zustand-migration`
**Created**: 2025-11-14
**Status**: Draft
**Input**: User description: "Phase 3-1: UnifiedDataContext를 Zustand Store로 전면 교체"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 개발자가 Zustand Store로 데이터 조회 가능 (Priority: P1)

개발자가 Context API 대신 Zustand Store를 통해 staff, workLogs, applications, attendanceRecords, jobPostings 데이터를 조회할 수 있다.

**Why this priority**: 가장 핵심적인 기능으로, 이것이 작동하지 않으면 다른 모든 기능도 작동하지 않는다. 모든 페이지가 데이터 조회에 의존하므로 최우선 구현이 필요하다.

**Independent Test**: Zustand Store hook을 호출하여 데이터를 성공적으로 조회하고, Map 형태로 반환되는지 확인한다. 단일 컴포넌트에서 `useUnifiedDataStore`를 import하고 staff 데이터를 읽어서 화면에 표시하면 독립적으로 테스트 가능하다.

**Acceptance Scenarios**:

1. **Given** Zustand Store가 초기화되어 있을 때, **When** 개발자가 `useUnifiedDataStore(state => state.staff)`를 호출하면, **Then** staff 데이터를 Map 형태로 반환한다
2. **Given** 여러 컬렉션 데이터가 필요할 때, **When** 개발자가 shallow 비교와 함께 여러 state를 조회하면, **Then** 불필요한 리렌더링 없이 데이터를 반환한다
3. **Given** 특정 staffId로 데이터 조회가 필요할 때, **When** 개발자가 `getStaffById` selector를 호출하면, **Then** 해당 staff 객체 또는 undefined를 반환한다

---

### User Story 2 - Firebase 실시간 구독이 정상 작동 (Priority: P1)

Zustand Store로 교체 후에도 Firebase의 onSnapshot 실시간 구독이 정상적으로 작동하여 데이터 변경 시 자동으로 Store가 업데이트된다.

**Why this priority**: 실시간 데이터 동기화는 UNIQN 플랫폼의 핵심 기능이다. 실시간 구독이 작동하지 않으면 사용자는 최신 데이터를 보지 못하고 수동 새로고침이 필요하게 된다.

**Independent Test**: Firebase Firestore에서 staff 문서를 직접 수정하고, 몇 초 내에 UI에 자동으로 반영되는지 확인한다. 별도의 테스트 페이지에서 실시간 구독만 검증할 수 있다.

**Acceptance Scenarios**:

1. **Given** Zustand Store가 Firebase에 구독되어 있을 때, **When** Firestore에서 staff 문서가 추가되면, **Then** Store의 staff Map에 자동으로 새 항목이 추가된다
2. **Given** 실시간 구독이 활성화된 상태에서, **When** workLog 문서가 업데이트되면, **Then** 3초 이내에 Store의 workLogs Map이 업데이트된다
3. **Given** 여러 컬렉션을 구독 중일 때, **When** 사용자가 로그아웃하면, **Then** 모든 구독이 정리(cleanup)되고 메모리 누수가 발생하지 않는다

---

### User Story 3 - 개발자가 Redux DevTools로 상태 디버깅 가능 (Priority: P2)

개발자가 브라우저의 Redux DevTools를 통해 Zustand Store의 상태 변화를 실시간으로 추적하고 디버깅할 수 있다.

**Why this priority**: 개발 생산성을 크게 향상시키는 기능이지만, 애플리케이션의 핵심 동작에는 직접적인 영향을 주지 않는다. 개발 단계에서 버그를 빠르게 찾을 수 있게 해준다.

**Independent Test**: 브라우저에서 Redux DevTools 확장을 열고, Zustand Store의 상태 변화가 타임라인에 기록되는지 확인한다. 임의로 action을 dispatch하고 상태가 변경되는 것을 DevTools에서 확인한다.

**Acceptance Scenarios**:

1. **Given** Redux DevTools가 설치된 브라우저에서, **When** Zustand Store가 초기화되면, **Then** DevTools에 "UnifiedDataStore"라는 이름으로 연결된다
2. **Given** DevTools가 연결된 상태에서, **When** staff 데이터가 업데이트되면, **Then** DevTools 타임라인에 action과 상태 변화가 기록된다
3. **Given** DevTools에서 과거 상태를 선택했을 때, **When** time-travel 디버깅을 수행하면, **Then** 해당 시점의 상태로 Store가 복원된다

---

### User Story 4 - 기존 컴포넌트가 마이그레이션 후에도 정상 작동 (Priority: P1)

MySchedulePage, JobPostingPage, ApplicantListPage 등 기존 20개+ 컴포넌트가 Zustand Store로 교체 후에도 동일하게 작동한다.

**Why this priority**: 기존 기능의 회귀(regression)를 방지하는 것이 필수적이다. 사용자 경험에 직접적인 영향을 미치므로 반드시 보장되어야 한다.

**Independent Test**: 각 페이지를 개별적으로 열고, 기존에 작동하던 모든 기능(조회, 생성, 수정, 삭제)을 수동으로 테스트한다. E2E 테스트 스위트를 실행하여 자동으로 검증한다.

**Acceptance Scenarios**:

1. **Given** MySchedulePage가 로드되었을 때, **When** 사용자가 스케줄 이벤트 목록을 확인하면, **Then** 기존과 동일하게 staff 및 workLog 데이터가 표시된다
2. **Given** StaffManagementPage에서, **When** 사용자가 새 staff를 추가하면, **Then** Firebase에 저장되고 Zustand Store에 자동으로 반영된다
3. **Given** AttendancePage에서, **When** 출석 상태를 변경하면, **Then** optimistic update가 적용되고 실시간 구독으로 최종 확인된다

---

### User Story 5 - TypeScript 타입 안전성 100% 유지 (Priority: P2)

Zustand Store로 교체 후에도 모든 타입이 strict mode에서 에러 없이 통과하고, any 타입 사용이 없다.

**Why this priority**: 타입 안전성은 버그 예방과 개발자 경험에 중요하지만, 런타임 동작에는 직접적인 영향을 주지 않는다. 코드 품질을 높이는 데 기여한다.

**Independent Test**: `npm run type-check` 명령어를 실행하여 TypeScript 컴파일 에러가 0개인지 확인한다. ESLint로 any 타입 사용을 검사한다.

**Acceptance Scenarios**:

1. **Given** Zustand Store 타입 정의가 완료되었을 때, **When** `npm run type-check`를 실행하면, **Then** 에러 0개로 통과한다
2. **Given** 개발자가 Store를 사용할 때, **When** selector를 작성하면, **Then** IDE에서 자동완성과 타입 검사가 제공된다
3. **Given** strict mode에서 컴파일할 때, **When** any 타입이 사용되었다면, **Then** ESLint 에러가 발생한다

---

### User Story 6 - 성능 동일 또는 향상 (Priority: P2)

Zustand Store 교체 후 리렌더링 횟수가 감소하거나 동일하며, 메모리 사용량이 증가하지 않는다.

**Why this priority**: 성능 최적화는 사용자 경험에 영향을 주지만, 기능적으로는 동일하게 작동하므로 P2로 분류한다. 장기적인 유지보수성과 확장성에 기여한다.

**Independent Test**: React DevTools Profiler를 사용하여 리렌더링 횟수를 측정하고, 브라우저 메모리 프로파일러로 메모리 사용량을 비교한다.

**Acceptance Scenarios**:

1. **Given** 기존 Context API와 Zustand Store 버전이 있을 때, **When** 동일한 페이지를 로드하면, **Then** Zustand 버전의 리렌더링 횟수가 동일하거나 적다
2. **Given** 대량의 데이터(staff 100개, workLogs 500개)가 로드되었을 때, **When** 10분간 메모리를 모니터링하면, **Then** 메모리 누수가 발생하지 않는다
3. **Given** 여러 컴포넌트가 동일한 데이터를 구독할 때, **When** 데이터가 업데이트되면, **Then** 필요한 컴포넌트만 리렌더링된다 (shallow 비교 덕분)

---

### Edge Cases

- **메모리 관리**: 대량의 데이터(1000개+ staff)가 로드될 때 메모리 사용량이 제한을 초과하지 않는가?
- **동시성 제어**: 여러 사용자가 동시에 동일한 staff를 수정할 때 마지막 업데이트가 올바르게 반영되는가?
- **구독 실패**: Firebase 연결이 끊겼을 때 재연결 시 데이터 동기화가 복구되는가?
- **로그아웃/로그인**: 사용자가 로그아웃 후 다른 계정으로 로그인할 때 이전 계정의 데이터가 남아있지 않은가?
- **빈 데이터**: Firebase에 데이터가 없을 때 빈 Map이 반환되고 에러가 발생하지 않는가?
- **타입 불일치**: Firebase에서 잘못된 타입의 데이터가 들어왔을 때 TypeScript가 이를 감지하는가?
- **초기화 타이밍**: Store 초기화 전에 컴포넌트가 데이터를 요청하면 어떻게 처리되는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Zustand Store는 staff, workLogs, applications, attendanceRecords, jobPostings 5개 컬렉션을 Map 형태로 관리해야 한다
- **FR-002**: Zustand Store는 Firebase onSnapshot을 통해 실시간 구독을 지원해야 한다
- **FR-003**: 개발자는 selector를 통해 특정 데이터만 조회하여 불필요한 리렌더링을 방지할 수 있어야 한다
- **FR-004**: Zustand Store는 immer 미들웨어를 사용하여 불변성을 자동으로 처리해야 한다
- **FR-005**: Zustand Store는 devtools 미들웨어를 통해 Redux DevTools와 연동되어야 한다
- **FR-006**: Store는 `subscribeAll(userId, role)` action을 통해 모든 Firebase 구독을 시작해야 한다
- **FR-007**: Store는 `unsubscribeAll()` action을 통해 모든 구독을 정리(cleanup)해야 한다
- **FR-008**: Store는 `getStaffById(id)`, `getWorkLogsByStaffId(staffId)` 등의 selector를 제공해야 한다
- **FR-009**: Store는 `setStaff`, `setWorkLogs`, `updateStaff`, `deleteStaff` 등의 action을 제공해야 한다
- **FR-010**: 기존 Context API를 사용하는 모든 컴포넌트(20개+)가 Zustand Store로 마이그레이션되어야 한다
- **FR-011**: 마이그레이션 후 UnifiedDataContext.tsx 파일과 UnifiedDataProvider가 완전히 제거되어야 한다
- **FR-012**: 모든 import 문이 Context에서 Zustand Store로 변경되어야 한다
- **FR-013**: TypeScript strict mode에서 에러 없이 컴파일되어야 한다
- **FR-014**: any 타입 사용이 없어야 한다
- **FR-015**: 기존 기능(조회, 생성, 수정, 삭제)이 모두 동일하게 작동해야 한다
- **FR-016**: Firebase 실시간 구독의 cleanup 로직이 완벽하게 구현되어 메모리 누수가 발생하지 않아야 한다
- **FR-017**: Zustand Store는 loading 상태(isLoading)와 error 상태(error)를 관리해야 한다
- **FR-018**: shallow 비교를 통해 리렌더링 최적화가 적용되어야 한다
- **FR-019**: 메모이제이션이 유지되어 동일한 쿼리에 대해 캐싱된 결과를 반환해야 한다
- **FR-020**: 코드 라인 수가 782줄에서 약 400줄로 감소해야 한다 (50% 목표)

### Key Entities *(include if feature involves data)*

- **Staff**: 스태프 정보를 담는 엔티티. Map<string, Staff> 형태로 저장되며, staffId가 키로 사용된다. name, role, contact 등의 속성을 포함한다.
- **WorkLog**: 근무 기록을 담는 엔티티. Map<string, WorkLog> 형태로 저장되며, workLogId가 키로 사용된다. staffId, eventId, date, hours 등의 속성을 포함하며, Staff 및 Event와 관계를 맺는다.
- **Application**: 지원서를 담는 엔티티. Map<string, Application> 형태로 저장되며, applicationId가 키로 사용된다. applicantId, eventId, status, submittedAt 등의 속성을 포함한다.
- **AttendanceRecord**: 출석 기록을 담는 엔티티. Map<string, AttendanceRecord> 형태로 저장되며, recordId가 키로 사용된다. staffId, eventId, status, checkInTime 등의 속성을 포함한다.
- **JobPosting**: 구인 공고를 담는 엔티티. Map<string, JobPosting> 형태로 저장되며, postingId가 키로 사용된다. title, description, location, deadline 등의 속성을 포함한다.
- **UnifiedDataStore**: Zustand로 관리되는 전역 상태 저장소. 위 5개 컬렉션과 loading/error 상태를 포함하며, actions 및 selectors를 제공한다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 개발자가 Zustand Store를 통해 데이터를 조회할 때, Context API 대비 코드 라인 수가 30% 감소한다 (예: 10줄 → 7줄)
- **SC-002**: 모든 페이지에서 리렌더링 횟수가 기존 대비 동일하거나 감소한다 (React DevTools Profiler로 측정)
- **SC-003**: TypeScript 타입 체크(`npm run type-check`)가 에러 0개로 통과한다
- **SC-004**: ESLint 검사(`npm run lint`)가 에러 0개로 통과한다
- **SC-005**: 빌드(`npm run build`)가 성공적으로 완료된다
- **SC-006**: 전체 코드 라인 수가 782줄에서 400줄 이하로 감소한다 (50% 감소)
- **SC-007**: 기존 20개+ 컴포넌트의 모든 기능이 수동 테스트 시 정상 작동한다
- **SC-008**: Redux DevTools에서 Zustand Store의 상태 변화가 실시간으로 추적된다
- **SC-009**: Firebase 실시간 구독이 3초 이내에 데이터 변경을 반영한다
- **SC-010**: 메모리 누수 없이 10분간 안정적으로 작동한다 (Chrome DevTools Memory Profiler로 측정)
- **SC-011**: 단위 테스트 커버리지가 70% 이상 달성된다
- **SC-012**: 성능 벤치마크에서 Context API 대비 동등하거나 향상된 결과를 보인다 (초기 로딩 시간, 업데이트 시간)

### Business Value

- **개발 생산성 향상**: 개발자가 Redux DevTools를 통해 상태를 쉽게 디버깅할 수 있어, 버그 수정 시간이 단축된다
- **코드 유지보수성 개선**: 코드 라인 수가 50% 감소하여, 신규 개발자가 코드를 이해하고 수정하는 시간이 줄어든다
- **장기적 기술 부채 감소**: Context API의 복잡도 문제를 해결하여, 향후 기능 추가 시 안정성이 향상된다
- **성능 최적화**: 불필요한 리렌더링이 감소하여, 사용자 경험이 개선되고 서버 비용이 절감될 수 있다

## Assumptions *(mandatory)*

- Zustand 5.0이 이미 프로젝트에 설치되어 있다 (package.json 확인 필요)
- 기존 Context API를 사용하는 컴포넌트 목록은 grep 검색으로 정확히 파악할 수 있다
- Firebase 실시간 구독 로직은 Context에서 Zustand Store로 이동 시 동일하게 작동한다
- 개발자는 Zustand의 기본 사용법을 숙지하고 있다
- Redux DevTools 브라우저 확장이 개발 환경에 설치되어 있다
- 기존 테스트 스위트가 마이그레이션 후에도 동일하게 실행 가능하다
- Phase 2가 완료되어 프로젝트가 안정적인 상태이다

## Dependencies *(mandatory)*

- **Phase 2 완료**: 이전 단계의 작업이 완료되어야 안전하게 마이그레이션을 진행할 수 있다
- **Zustand 5.0**: 라이브러리가 설치되어 있어야 한다
- **immer 라이브러리**: Zustand immer 미들웨어 사용을 위해 필요하다
- **TypeScript 4.9+**: strict mode 지원을 위해 필요하다
- **Firebase SDK**: 실시간 구독 기능을 위해 필요하다
- **React 18.2**: Zustand와의 호환성을 위해 필요하다
- **기존 컴포넌트 20개+**: 마이그레이션 대상 컴포넌트들이 정상 작동하는 상태여야 한다

## Out of Scope *(mandatory)*

- 새로운 기능 추가: 이 작업은 순수하게 리팩토링이며, 새 기능은 포함하지 않는다
- UI/UX 변경: 사용자가 보는 화면은 변경되지 않는다
- 다른 Context 마이그레이션: UnifiedDataContext만 대상이며, AuthContext, TournamentContext 등은 포함하지 않는다
- 성능 최적화를 위한 추가 작업: 기본적인 최적화(shallow 비교, 메모이제이션)만 적용하며, 추가적인 성능 튜닝은 별도 작업으로 진행한다
- 데이터 스키마 변경: Firebase 데이터 구조는 변경하지 않는다
- E2E 테스트 추가: 기존 테스트 유지만 하며, 새 E2E 테스트는 작성하지 않는다 (단위 테스트는 추가)

## Risks & Mitigation *(optional)*

### 리스크 1: 리렌더링 성능 저하
**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- React DevTools Profiler로 마이그레이션 전후 리렌더링 횟수를 측정한다
- shallow 비교를 적극 활용하여 불필요한 리렌더링을 방지한다
- 문제 발생 시 useMemo, useCallback으로 추가 최적화한다

### 리스크 2: 실시간 구독 로직 이전 시 버그 발생
**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- Context의 구독 로직을 한 줄 한 줄 검토하며 이전한다
- 단위 테스트를 작성하여 구독/구독 해제가 정상 작동하는지 검증한다
- 개발 환경에서 충분히 테스트 후 프로덕션에 배포한다

### 리스크 3: 20개+ 컴포넌트 마이그레이션 중 누락 발생
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- grep으로 모든 사용처를 자동 검색하여 목록을 만든다
- 체크리스트를 작성하여 하나씩 마이그레이션 여부를 확인한다
- 마이그레이션 후 전체 페이지를 수동으로 테스트한다

### 리스크 4: TypeScript 타입 에러 발생
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- 마이그레이션 과정에서 자주 `npm run type-check`를 실행한다
- 타입 정의를 먼저 완성한 후 구현을 시작한다
- any 타입 사용을 절대 금지하고, ESLint 규칙으로 강제한다

### 리스크 5: 메모리 누수
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- unsubscribeAll() 로직을 철저히 구현한다
- Chrome DevTools Memory Profiler로 메모리 사용량을 모니터링한다
- 로그아웃/로그인 시나리오를 반복 테스트한다

## Implementation Notes *(optional)*

### 단계별 작업 순서

**Step 1: Zustand Store 완전 구현 (3일)**
1. `app2/src/stores/unifiedDataStore.ts` 파일 생성
2. 인터페이스 정의: UnifiedDataStore, State, Actions, Selectors
3. immer 및 devtools 미들웨어 설정
4. Firebase 실시간 구독 로직 이전 (subscribeAll, unsubscribeAll)
5. 모든 selectors 구현 (getStaffById, getWorkLogsByStaffId 등)
6. 모든 actions 구현 (setStaff, updateStaff, deleteStaff 등)
7. TypeScript 타입 정의 완성 및 `npm run type-check` 통과

**Step 2: 모든 사용처 일괄 변경 (3일)**
1. grep으로 `useUnifiedData` 사용처 전체 검색
2. 각 컴포넌트를 하나씩 마이그레이션:
   - import 문 변경: Context → Zustand Store
   - hook 사용법 변경: `useUnifiedData()` → `useUnifiedDataStore(selector, shallow)`
   - 타입 체크 및 린트 검사
3. 주요 컴포넌트 목록:
   - MySchedulePage/index.tsx
   - JobPostingPage/index.tsx
   - ApplicantListPage/index.tsx
   - StaffManagementPage/index.tsx
   - AttendancePage/index.tsx
   - ScheduleDetailModal/index.tsx
   - StaffSelector.tsx
   - WorkLogList.tsx
   - ApplicationList.tsx
   - AttendanceRecordList.tsx
   - (그 외 10개+)
4. 각 페이지별 수동 테스트 수행

**Step 3: Context 완전 제거 (0.5일)**
1. UnifiedDataContext.tsx 파일 삭제
2. App.tsx에서 UnifiedDataProvider 제거
3. 불필요한 import 문 정리
4. `npm run type-check` 및 `npm run lint` 통과 확인

**Step 4: 테스트 및 검증 (2일)**
1. 단위 테스트 작성:
   - `app2/src/stores/__tests__/unifiedDataStore.test.ts`
   - selectors 테스트
   - actions 테스트
   - 실시간 구독 mock 테스트
2. 통합 테스트: 전체 페이지 수동 테스트
3. 성능 벤치마크:
   - React DevTools Profiler로 리렌더링 횟수 측정
   - Chrome Memory Profiler로 메모리 사용량 측정
   - Firebase 구독 성능 확인
4. Redux DevTools 연동 확인
5. 최종 빌드 테스트: `npm run build`

### 코드 예시

**Zustand Store 기본 구조**:
```typescript
// stores/unifiedDataStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

interface UnifiedDataStore {
  // State
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  applications: Map<string, Application>;
  attendanceRecords: Map<string, AttendanceRecord>;
  jobPostings: Map<string, JobPosting>;
  isLoading: boolean;
  error: string | null;

  // Selectors
  getStaffById: (id: string) => Staff | undefined;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];

  // Actions
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;
  setStaff: (staff: Map<string, Staff>) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
}

export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // 초기 상태
      staff: new Map(),
      workLogs: new Map(),
      applications: new Map(),
      attendanceRecords: new Map(),
      jobPostings: new Map(),
      isLoading: false,
      error: null,

      // Selectors
      getStaffById: (id) => get().staff.get(id),
      getWorkLogsByStaffId: (staffId) => {
        const logs = Array.from(get().workLogs.values());
        return logs.filter(log => log.staffId === staffId);
      },

      // Actions
      subscribeAll: (userId, role) => {
        // Firebase onSnapshot 구독 로직
      },
      unsubscribeAll: () => {
        // cleanup 로직
      },
      setStaff: (staff) => set({ staff }),
      updateStaff: (staff) => set((state) => {
        state.staff.set(staff.id, staff);
      }),
      deleteStaff: (id) => set((state) => {
        state.staff.delete(id);
      }),
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

**컴포넌트 사용 예시**:
```typescript
// 기존 (Context API)
import { useUnifiedData } from '../contexts/UnifiedDataContext';
const { staff, workLogs } = useUnifiedData();

// 신규 (Zustand Store)
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { shallow } from 'zustand/shallow';

// 단일 값
const staff = useUnifiedDataStore((state) => state.staff);

// 여러 값
const { staff, workLogs, getStaffById } = useUnifiedDataStore(
  (state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
    getStaffById: state.getStaffById,
  }),
  shallow
);
```

### 검증 방법

1. **타입 체크**: `npm run type-check` (에러 0개 목표)
2. **린트 체크**: `npm run lint` (에러 0개 목표)
3. **빌드 테스트**: `npm run build` (성공 목표)
4. **단위 테스트**: `npm run test` (커버리지 70% 이상 목표)
5. **전체 페이지 수동 테스트**: 20개+ 컴포넌트 개별 테스트
6. **Redux DevTools 확인**: 브라우저에서 상태 추적 확인
7. **성능 벤치마크**:
   - React DevTools Profiler로 리렌더링 횟수 측정
   - Chrome Memory Profiler로 메모리 사용량 비교
   - Firebase 구독 성능 확인 (3초 이내 반영)

### 참고 문서

- [Zustand 공식 문서](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [immer 미들웨어](https://docs.pmnd.rs/zustand/integrations/immer-middleware)
- [devtools 미들웨어](https://docs.pmnd.rs/zustand/integrations/redux-devtools)
- [프로젝트 CLAUDE.md](../../CLAUDE.md) - UNIQN 프로젝트 개발 가이드

## Additional Context *(optional)*

### 현재 UnifiedDataContext 구조 분석

**파일 정보**:
- 경로: `app2/src/contexts/UnifiedDataContext.tsx`
- 라인 수: 782줄
- 구조: Context API + useReducer
- 주요 기능:
  - 5개 Firebase 컬렉션 관리 (staff, workLogs, applications, attendanceRecords, jobPostings)
  - 실시간 구독 (onSnapshot)
  - 메모이제이션 기반 캐싱
  - Optimistic Update 지원
  - 성능 모니터링

**문제점**:
- Context 복잡도 높음 (782줄)
- 리렌더링 최적화 어려움 (Context 값 변경 시 모든 구독자 리렌더링)
- 디버깅 어려움 (상태 변화 추적 불가)
- 코드 가독성 저하 (reducer 로직 복잡)

**개선 목표**:
- Zustand Store로 완전 교체하여 코드 간결화 (782줄 → 400줄)
- 리렌더링 최적화 (selector 기반)
- Redux DevTools 연동으로 디버깅 개선
- 타입 안전성 향상

### 프로젝트 컨텍스트

- **프로젝트**: UNIQN (홀덤 포커 토너먼트 관리 플랫폼)
- **기술 스택**: React 18.2, TypeScript 4.9, Firebase 11.9, Zustand 5.0
- **현재 상태**: Production Ready (v0.2.3)
- **개발 원칙**:
  - 항상 한글로 답변
  - TypeScript strict mode 100% 준수
  - any 타입 사용 금지
  - logger 사용 (console.log 금지)
  - 다크모드 필수 적용
  - 메모이제이션 활용

### 성공 기준 체크리스트

마이그레이션 완료 후 다음 항목들이 모두 만족되어야 한다:

- [ ] Context 코드 완전 제거 (UnifiedDataContext.tsx 삭제)
- [ ] 모든 기능 정상 작동 (20개+ 페이지 테스트)
- [ ] 성능 동일 또는 향상 (React Profiler로 측정)
- [ ] 테스트 커버리지 70% 이상
- [ ] Redux DevTools 연동 확인
- [ ] `npm run type-check` 에러 0개
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 코드 라인 수 782 → 400 이하 (50% 감소)
- [ ] 리렌더링 횟수 감소 확인 (React DevTools Profiler)
- [ ] 메모리 누수 없음 (Chrome Memory Profiler)
