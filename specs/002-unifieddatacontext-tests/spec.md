# Feature Specification: UnifiedDataContext 테스트 작성

**Feature Branch**: `002-unifieddatacontext-tests`
**Created**: 2025-11-06
**Status**: Draft
**Input**: User description: "Phase 2-2: UnifiedDataContext 테스트 작성 (복잡한 상태 관리 테스트)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 기본 단위 테스트 작성 및 실행 (Priority: P1)

개발자가 UnifiedDataContext의 핵심 기능에 대한 단위 테스트를 작성하고 실행하여 코드 품질을 검증한다.

**Why this priority**: UnifiedDataContext는 782줄의 복잡한 코드로 5개의 Firebase 컬렉션을 관리하는 핵심 컴포넌트입니다. 기본 단위 테스트가 없으면 리팩토링이나 기능 추가 시 regression이 발생할 위험이 높습니다.

**Independent Test**:
- `npm test -- UnifiedDataContext.test.tsx` 명령으로 단위 테스트만 독립적으로 실행 가능
- Map 기반 상태 관리, 메모이제이션, 조회 함수의 정확성을 검증
- 각 테스트는 독립적으로 실행되며 다른 테스트에 의존하지 않음

**Acceptance Scenarios**:

1. **Given** UnifiedDataContext가 초기화되었을 때, **When** 개발자가 getStaffById 함수를 호출하면, **Then** 올바른 스태프 정보를 반환해야 한다
2. **Given** 동일한 데이터 조회가 반복될 때, **When** 메모이제이션이 적용되면, **Then** 두 번째 호출부터는 캐시된 결과를 반환해야 한다
3. **Given** Map 기반 상태에 데이터가 추가될 때, **When** 상태가 업데이트되면, **Then** 모든 관련 컴포넌트에 변경사항이 전파되어야 한다
4. **Given** scheduleEvents 변환 로직이 실행될 때, **When** 원본 데이터가 제공되면, **Then** 올바른 형식으로 변환된 이벤트 목록을 반환해야 한다
5. **Given** 잘못된 데이터가 입력될 때, **When** 에러 핸들링이 실행되면, **Then** 적절한 에러 메시지와 함께 실패해야 한다

---

### User Story 2 - Firestore 통합 테스트 작성 및 실행 (Priority: P2)

개발자가 UnifiedDataContext와 Firestore 간의 실시간 데이터 동기화를 검증하는 통합 테스트를 작성하고 실행한다.

**Why this priority**: 실시간 구독(onSnapshot)과 5개 컬렉션 동시 관리는 UnifiedDataContext의 핵심 가치입니다. Firestore와의 통합이 올바르게 작동하지 않으면 전체 애플리케이션이 불안정해집니다.

**Independent Test**:
- Firestore Emulator를 사용하여 실제 Firebase 없이 독립적으로 테스트 가능
- `npm test -- UnifiedDataContext.integration.test.tsx`로 통합 테스트만 실행
- 역할별 쿼리 필터링(admin vs staff)을 검증하여 권한 시스템 안정성 확보

**Acceptance Scenarios**:

1. **Given** Firestore Emulator가 실행 중일 때, **When** UnifiedDataContext가 onSnapshot을 시작하면, **Then** 5개 컬렉션(staff, workLogs, applications 등)의 실시간 구독이 활성화되어야 한다
2. **Given** admin 역할의 사용자가 로그인했을 때, **When** 데이터 조회가 실행되면, **Then** 모든 스태프의 데이터에 접근할 수 있어야 한다
3. **Given** staff 역할의 사용자가 로그인했을 때, **When** 데이터 조회가 실행되면, **Then** 자신의 데이터만 조회할 수 있어야 한다
4. **Given** Firestore에 새로운 데이터가 추가될 때, **When** onSnapshot이 변경을 감지하면, **Then** Context 상태가 실시간으로 업데이트되어야 한다
5. **Given** 컴포넌트가 unmount될 때, **When** cleanup 함수가 실행되면, **Then** 모든 Firestore 구독이 정리(unsubscribe)되어야 한다

---

### User Story 3 - 성능 및 메모리 테스트 작성 및 실행 (Priority: P3)

개발자가 UnifiedDataContext의 성능 최적화(메모이제이션)와 메모리 관리를 검증하는 테스트를 작성하고 실행한다.

**Why this priority**: 메모이제이션 기반 캐싱은 성능 최적화의 핵심이지만, 잘못 구현되면 메모리 누수를 유발할 수 있습니다. 성능과 메모리 안정성을 검증하여 프로덕션 환경의 안정성을 확보합니다.

**Independent Test**:
- `npm test -- UnifiedDataContext.performance.test.tsx`로 성능 테스트만 실행
- Performance.now()를 사용하여 측정 가능한 성능 메트릭 제공
- 메모리 프로파일링으로 누수 여부를 독립적으로 검증

**Acceptance Scenarios**:

1. **Given** 동일한 데이터 조회가 1000번 반복될 때, **When** 메모이제이션이 적용되면, **Then** 두 번째 조회부터는 첫 번째 조회 대비 80% 이상 빠른 응답 시간을 보여야 한다
2. **Given** 1000개의 스태프 데이터가 로드될 때, **When** 데이터 변환 로직이 실행되면, **Then** 처리 시간이 100ms 이내여야 한다
3. **Given** 컴포넌트가 반복적으로 mount/unmount될 때, **When** 메모리 사용량을 측정하면, **Then** 메모리 누수가 발생하지 않아야 한다 (±5% 범위 내)
4. **Given** 5개 컬렉션의 구독이 활성화될 때, **When** 메모리 사용량을 측정하면, **Then** 기준치(50MB) 이내로 유지되어야 한다
5. **Given** Context가 렌더링될 때, **When** React DevTools Profiler로 측정하면, **Then** 불필요한 리렌더링이 발생하지 않아야 한다

---

### Edge Cases

- **빈 데이터 처리**: Firebase 컬렉션이 비어있을 때 Context가 빈 배열/Map을 반환하고 에러를 발생시키지 않는가?
- **네트워크 에러**: Firestore 연결이 끊어졌을 때 적절한 에러 처리와 재연결 로직이 작동하는가?
- **Firestore 권한 에러**: 권한이 없는 컬렉션에 접근할 때 적절한 에러 메시지를 표시하고 앱이 중단되지 않는가?
- **중복 구독 방지**: 동일한 컬렉션에 대한 중복 onSnapshot 호출이 방지되는가?
- **데이터 타입 불일치**: Firebase에서 예상치 못한 데이터 형식이 반환될 때 타입 검증과 에러 처리가 작동하는가?
- **대량 데이터 처리**: 10,000개 이상의 문서가 있을 때 성능 저하 없이 처리되는가?
- **동시성 문제**: 여러 컴포넌트가 동시에 Context를 업데이트할 때 상태 충돌이 발생하지 않는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 테스트 시스템은 UnifiedDataContext의 70% 이상 코드 커버리지를 달성해야 한다
- **FR-002**: 테스트는 React Testing Library와 renderHook을 사용하여 작성되어야 한다
- **FR-003**: 통합 테스트는 Firestore Emulator를 사용하여 실제 Firebase 없이 실행 가능해야 한다
- **FR-004**: 성능 테스트는 Performance.now()를 사용하여 메모이제이션 효과를 측정해야 한다
- **FR-005**: 모든 테스트는 act()를 올바르게 사용하여 React warning을 발생시키지 않아야 한다
- **FR-006**: 각 테스트는 cleanup을 철저히 수행하여 테스트 간 격리(isolation)를 보장해야 한다
- **FR-007**: 메모리 누수 테스트는 컴포넌트의 반복적인 mount/unmount 시나리오를 검증해야 한다
- **FR-008**: 통합 테스트는 5개 컬렉션(staff, workLogs, applications, scheduleEvents 등)의 동시 구독을 검증해야 한다
- **FR-009**: 역할별 쿼리 필터링(admin vs staff) 테스트는 권한 시스템의 정확성을 검증해야 한다
- **FR-010**: cleanup(unsubscribe) 검증은 모든 Firestore 구독이 정리되는지 100% 확인해야 한다
- **FR-011**: 테스트 실행은 `npm run test` 명령으로 통합되어야 하며 CI/CD 파이프라인에서 실행 가능해야 한다
- **FR-012**: 에러 핸들링 테스트는 최소 10개 이상의 엣지 케이스를 커버해야 한다
- **FR-013**: 테스트는 fake-indexeddb를 사용하여 로컬 환경에서 독립적으로 실행 가능해야 한다

### Key Entities

- **테스트 스위트**: UnifiedDataContext의 기능을 검증하는 테스트 그룹 (단위, 통합, 성능)
- **Mock 데이터**: 테스트에 사용되는 스태프, 근무 로그, 지원서 등의 fixture 데이터
- **Firestore Emulator**: 실제 Firebase 없이 Firestore 기능을 시뮬레이션하는 로컬 환경
- **성능 메트릭**: 메모이제이션 효과, 처리 시간, 메모리 사용량 등의 측정 가능한 지표
- **커버리지 리포트**: 테스트가 커버하는 코드 범위를 나타내는 보고서

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: UnifiedDataContext의 테스트 커버리지가 70% 이상 달성되어야 한다
- **SC-002**: 모든 테스트가 통과(pass)해야 하며 실패(fail) 또는 건너뛰기(skip)가 없어야 한다
- **SC-003**: 전체 테스트 실행 시간이 10초 이내여야 한다 (복잡도를 고려한 제한 시간)
- **SC-004**: 메모이제이션 효과가 80% 이상 측정되어야 한다 (두 번째 조회부터 첫 번째 대비 80% 빠름)
- **SC-005**: 메모리 누수가 발생하지 않아야 한다 (반복 mount/unmount 시 메모리 사용량 ±5% 범위 내)
- **SC-006**: 구독 cleanup이 100% 검증되어야 한다 (모든 onSnapshot unsubscribe 확인)
- **SC-007**: 최소 10개 이상의 엣지 케이스(빈 데이터, 네트워크 에러 등)가 테스트되어야 한다
- **SC-008**: CI/CD 파이프라인에서 `npm run test` 명령으로 통합 실행 가능해야 한다
- **SC-009**: 1000개 데이터 처리 시간이 100ms 이내여야 한다 (성능 벤치마크)
- **SC-010**: 프로덕션 코드 수정이 최소화되어야 한다 (테스트를 위한 코드 변경만 허용)

## Assumptions

- React Testing Library와 @testing-library/react-hooks가 이미 프로젝트에 설치되어 있다고 가정
- Firebase Emulator Suite가 로컬 개발 환경에 설치되어 있다고 가정
- UnifiedDataContext의 현재 코드가 테스트 가능한 구조로 작성되어 있다고 가정 (필요시 최소한의 리팩토링 허용)
- fake-indexeddb 라이브러리는 필요시 추가 설치 가능하다고 가정
- 테스트 실행 환경은 Node.js 18 이상을 사용한다고 가정
- Jest가 테스트 프레임워크로 이미 설정되어 있다고 가정

## Dependencies

- **Phase 2-1 완료**: AuthContext 단위 테스트 및 통합 테스트가 완료되어 테스트 패턴과 Mock 전략이 확립되어 있어야 함
- Firestore Emulator Suite 설치 및 설정
- fake-indexeddb 패키지 (로컬 테스트용)
- React Testing Library 최신 버전
- @testing-library/react-hooks 패키지

## Out of Scope

- E2E 테스트 작성 (별도의 Phase에서 진행)
- 다른 Context(TournamentContext, ThemeContext 등)의 테스트는 이 Phase에 포함되지 않음
- 성능 최적화를 위한 코드 리팩토링 (테스트 작성만 포함)
- 프로덕션 배포는 모든 테스트가 통과한 이후 별도 Phase에서 진행
- UI 컴포넌트의 시각적 회귀 테스트