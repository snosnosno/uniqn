# Feature Specification: ScheduleDetailModal.tsx 대형 파일 분리

**Feature Branch**: `001-schedule-modal-split`
**Created**: 2025-11-05
**Status**: Draft
**Input**: User description: "Phase 1-3: ScheduleDetailModal.tsx 대형 파일 분리 (1,123줄 → 5개 파일). 단일 파일에 6가지 책임이 혼재되어 있어 테스트 불가능하고 유지보수가 어려운 구조를 개선합니다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 탭별 독립 개발 및 테스트 (Priority: P1)

개발자로서, 각 탭(기본 정보, 근무 정보, 급여 계산)을 독립적인 파일로 분리하여 다른 탭에 영향을 주지 않고 개발하고 테스트할 수 있어야 합니다.

**Why this priority**: 현재 1,123줄의 단일 파일에서 특정 기능을 수정할 때 의도치 않은 부작용(side effect)이 발생할 위험이 높습니다. 파일 분리는 가장 기본적이면서도 중요한 개선사항으로, 이후 모든 개선 작업의 기반이 됩니다.

**Independent Test**: 각 탭 컴포넌트를 독립적으로 import하여 props만 전달하면 렌더링 및 동작 테스트가 가능해야 합니다. 예: `<BasicInfoTab />` 컴포넌트만 마운트하여 날짜 선택, 장소 입력 등의 기능을 테스트할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** ScheduleDetailModal이 5개 파일로 분리되어 있을 때, **When** 개발자가 BasicInfoTab.tsx만 수정하면, **Then** WorkInfoTab이나 CalculationTab의 동작에 영향을 주지 않아야 합니다.

2. **Given** 각 탭 컴포넌트가 독립된 파일로 존재할 때, **When** 개발자가 Jest로 BasicInfoTab만 테스트하면, **Then** 다른 탭 컴포넌트를 import하지 않고도 모든 UI 및 로직을 테스트할 수 있어야 합니다.

3. **Given** 컴포넌트 분리가 완료되었을 때, **When** 코드 리뷰어가 급여 계산 로직을 검토하면, **Then** CalculationTab.tsx 파일만 열어보면 되고 1,123줄 전체를 읽을 필요가 없어야 합니다.

---

### User Story 2 - 타입 안전성 강화 (Priority: P2)

개발자로서, 각 컴포넌트 간 데이터 전달 시 명확한 Props 인터페이스를 통해 타입 에러를 컴파일 타임에 발견하고 자동완성의 도움을 받을 수 있어야 합니다.

**Why this priority**: 현재 단일 파일에서는 내부 상태와 props의 경계가 불명확하여 타입 에러가 런타임에 발생할 위험이 있습니다. 명확한 인터페이스 정의는 코드 품질과 개발 속도를 모두 향상시킵니다.

**Independent Test**: types.ts 파일을 import하여 각 컴포넌트의 Props 타입이 올바르게 정의되어 있는지 검증할 수 있습니다. TypeScript 컴파일러(`npm run type-check`)로 타입 에러가 0개임을 확인할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** types.ts에 각 탭의 Props 인터페이스가 정의되어 있을 때, **When** 개발자가 잘못된 타입의 props를 전달하면, **Then** TypeScript 컴파일러가 에러를 표시해야 합니다.

2. **Given** 공통 타입들이 types.ts에 정의되어 있을 때, **When** 개발자가 IDE에서 코드를 작성하면, **Then** 자동완성으로 사용 가능한 필드와 타입을 제안받아야 합니다.

3. **Given** useScheduleData Hook이 반환하는 타입이 명확히 정의되어 있을 때, **When** 컴포넌트에서 해당 데이터를 사용하면, **Then** 타입 추론이 자동으로 동작하여 any 타입 없이 안전하게 사용할 수 있어야 합니다.

---

### User Story 3 - 파일 크기 제한 준수 (Priority: P3)

개발자로서, 모든 파일이 500줄 이하로 유지되어 코드 네비게이션이 쉽고 파일 전체를 한눈에 파악할 수 있어야 합니다.

**Why this priority**: 500줄 이하의 파일은 에디터 화면 1-2번 스크롤로 전체 구조를 파악할 수 있어 인지 부하를 줄여줍니다. 이는 코드 가독성과 직결되지만, 기능적 개선보다는 우선순위가 낮습니다.

**Independent Test**: 각 파일의 줄 수를 세어 500줄 이하인지 검증할 수 있습니다. `wc -l` 명령어나 IDE의 줄 수 표시 기능으로 즉시 확인 가능합니다.

**Acceptance Scenarios**:

1. **Given** 파일 분리가 완료되었을 때, **When** 각 파일의 줄 수를 확인하면, **Then** index.tsx는 200줄 이하, 각 탭 컴포넌트는 250줄 이하, types.ts는 50줄 이하여야 합니다.

2. **Given** 향후 새로운 기능이 추가될 때, **When** 특정 파일이 500줄을 초과하려고 하면, **Then** 추가 분리를 고려해야 한다는 것을 인지할 수 있어야 합니다.

---

### Edge Cases

- **이전 파일이 남아있는 경우**: 기존 ScheduleDetailModal.tsx 파일이 삭제되지 않고 새 구조와 공존하면 어떻게 되는가? → Git에서 파일 이동(mv)을 명확히 추적하도록 해야 합니다.

- **Import 경로 변경 누락**: MySchedulePage에서 기존 import 경로를 업데이트하지 않으면 어떻게 되는가? → 빌드 에러가 발생하므로, import 경로 변경을 체크리스트에 포함해야 합니다.

- **Memo/Callback 누락으로 성능 저하**: 컴포넌트 분리 시 메모이제이션을 제대로 적용하지 않으면 불필요한 리렌더링이 발생할 수 있습니다. → React DevTools Profiler로 성능 측정이 필요합니다.

- **다크모드 스타일 누락**: 일부 컴포넌트에서 `dark:` 클래스를 빼먹으면 다크모드에서 UI가 깨질 수 있습니다. → 각 탭을 다크모드에서 수동 테스트해야 합니다.

- **Context/Hook 의존성 변경**: 컴포넌트 분리 시 useScheduleData Hook의 반환값 구조를 변경하면 다른 곳에서 사용 중인 코드가 깨질 수 있습니다. → Hook API는 변경하지 않거나, 변경 시 전체 검색으로 영향 범위를 확인해야 합니다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 ScheduleDetailModal.tsx를 다음 5개 파일로 분리해야 합니다:
  - index.tsx (메인 컨테이너, 200줄 이하)
  - tabs/BasicInfoTab.tsx (기본 정보 탭, 150줄 이하)
  - tabs/WorkInfoTab.tsx (근무 정보 탭, 200줄 이하)
  - tabs/CalculationTab.tsx (급여 계산 탭, 250줄 이하)
  - types.ts (공통 타입 정의, 50줄 이하)

- **FR-002**: 각 탭 컴포넌트는 독립적으로 테스트 가능한 순수 컴포넌트여야 하며, Props를 통해서만 데이터를 받아야 합니다.

- **FR-003**: 모든 컴포넌트 Props는 types.ts에 명확한 TypeScript 인터페이스로 정의되어야 하며, any 타입을 사용해서는 안 됩니다.

- **FR-004**: 기존 useScheduleData Hook은 변경 없이 그대로 활용해야 하며, 새 컴포넌트 구조에서도 동일하게 동작해야 합니다.

- **FR-005**: 모든 컴포넌트는 다크모드 스타일(`dark:` 클래스)을 유지해야 하며, 라이트/다크 모드 전환 시 UI가 깨지지 않아야 합니다.

- **FR-006**: 컴포넌트 분리 후에도 메모이제이션(useMemo, useCallback)이 적절히 적용되어 불필요한 리렌더링이 발생하지 않아야 합니다.

- **FR-007**: MySchedulePage에서 ScheduleDetailModal을 호출하는 방식은 변경되지 않아야 하며, import 경로만 업데이트되어야 합니다.

- **FR-008**: 분리 후에도 모든 기존 기능이 동일하게 동작해야 합니다:
  - 탭 전환 (기본 정보, 근무 정보, 급여 계산)
  - 일정 정보 조회/수정
  - 근무 배정 및 출석 관리
  - 급여 계산 (시급, 수당, 정산)
  - 저장/삭제 기능

- **FR-009**: TypeScript strict mode 검사(`npm run type-check`)에서 에러가 0개여야 하며, ESLint 경고도 없어야 합니다.

- **FR-010**: 각 컴포넌트는 Props Drilling을 최소화하기 위해 적절한 패턴(Compound Component 또는 Context)을 사용할 수 있습니다.

### Key Entities

- **ScheduleDetailModal (Container)**: 전체 모달의 레이아웃과 탭 전환 로직을 담당하는 메인 컨테이너 컴포넌트. index.tsx로 구현되며, 하위 탭 컴포넌트들을 조합합니다.

- **BasicInfoTab (Component)**: 일정 기본 정보(날짜, 장소, 시간 등)를 표시하고 편집하는 탭 컴포넌트. 약 150줄 규모로 독립적으로 테스트 가능해야 합니다.

- **WorkInfoTab (Component)**: 근무 정보(스태프 배정, 출석 관리)를 표시하고 관리하는 탭 컴포넌트. 약 200줄 규모로 복잡한 상태 관리를 포함할 수 있습니다.

- **CalculationTab (Component)**: 급여 계산 로직(시급, 수당, 정산)을 포함하는 탭 컴포넌트. 약 250줄 규모로 가장 복잡한 비즈니스 로직을 담당합니다.

- **ComponentProps (Type)**: 각 컴포넌트가 받는 Props의 타입 정의. types.ts에 인터페이스로 정의되며, TypeScript 타입 안전성을 보장합니다.

- **SharedTypes (Type)**: 여러 컴포넌트에서 공통으로 사용하는 타입(예: Schedule, WorkLog, Calculation 등). types.ts에 중앙집중식으로 관리됩니다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 개발자가 특정 탭의 코드를 수정할 때, 해당 파일만 열어보면 되며 다른 파일을 열 필요가 없어야 합니다. (파일 네비게이션 횟수 80% 감소)

- **SC-002**: 각 파일의 줄 수가 다음 기준을 충족해야 합니다:
  - index.tsx: 200줄 이하
  - BasicInfoTab.tsx: 150줄 이하
  - WorkInfoTab.tsx: 200줄 이하
  - CalculationTab.tsx: 250줄 이하
  - types.ts: 50줄 이하

- **SC-003**: TypeScript 컴파일 검사(`npm run type-check`)에서 에러가 0개이고, ESLint 경고가 0개여야 합니다.

- **SC-004**: 기존 기능이 100% 동작해야 하며, 다음 시나리오가 모두 성공해야 합니다:
  - 모달 열기/닫기
  - 3개 탭 전환
  - 일정 정보 조회 및 수정
  - 근무 배정 및 출석 체크
  - 급여 계산 및 정산
  - 저장 및 삭제

- **SC-005**: 각 탭 컴포넌트에 대한 단위 테스트를 작성할 수 있어야 하며, 개별 컴포넌트를 마운트하여 독립적으로 테스트할 수 있어야 합니다.

- **SC-006**: 다크모드 전환 시 모든 탭에서 UI가 정상적으로 표시되어야 하며, 색상 대비가 기준을 충족해야 합니다.

- **SC-007**: 성능이 저하되지 않아야 하며, React DevTools Profiler로 측정 시 불필요한 리렌더링이 발생하지 않아야 합니다.

- **SC-008**: 코드 리뷰 시간이 기존 대비 50% 단축되어야 합니다. (1,123줄 전체 리뷰 vs. 개별 파일 리뷰)

## Assumptions

- 기존 useScheduleData Hook의 API(반환값 구조, 함수 시그니처)는 변경하지 않습니다. 이 Hook은 이미 잘 작동하고 있으며, 다른 곳에서도 사용 중일 수 있습니다.

- MySchedulePage는 ScheduleDetailModal의 내부 구조 변경에 대해 알 필요가 없으며, 단지 import 경로만 업데이트하면 됩니다.

- 각 탭은 read-only 모드와 edit 모드를 모두 지원해야 하며, 이는 기존 동작과 동일하게 유지됩니다.

- 모든 개발자는 TypeScript와 React Hooks에 익숙하며, Props drilling vs. Context 선택에 대한 기본 지식을 가지고 있습니다.

- 테스트는 Jest와 React Testing Library를 사용하며, 각 컴포넌트는 독립적으로 마운트하여 테스트할 수 있어야 합니다.

- 파일 분리 작업은 별도의 feature 브랜치에서 진행되며, PR 리뷰를 거쳐 master 브랜치에 병합됩니다.

- 배포 전에 staging 환경에서 충분한 테스트를 거쳐야 하며, 특히 급여 계산 정확성은 실제 데이터로 검증되어야 합니다.

## Dependencies

- **Phase 1-1, 1-2 완료**: 이 작업은 이전 단계의 타입 안전성 개선이 완료된 후에 진행됩니다. 타입 시스템이 안정적이지 않으면 파일 분리 시 더 많은 타입 에러가 발생할 수 있습니다.

- **useScheduleData Hook (app2/src/pages/MySchedulePage/hooks/useScheduleData.ts)**: 이 Hook은 이미 323줄로 분리되어 있으며, 새 컴포넌트 구조에서 그대로 활용됩니다.

- **MySchedulePage**: 이 페이지는 ScheduleDetailModal을 호출하는 부모 컴포넌트이므로, import 경로 변경이 필요합니다.

- **Context API 또는 Compound Component 패턴**: Props Drilling을 피하기 위해 적절한 패턴을 선택해야 하며, 프로젝트의 다른 부분과 일관성을 유지해야 합니다.

## Out of Scope

- **새로운 기능 추가**: 이 작업은 순수한 리팩토링이며, 새로운 탭이나 필드를 추가하지 않습니다.

- **API 변경**: Firebase API 호출 로직은 변경하지 않으며, 기존 onSnapshot 구독 방식을 그대로 유지합니다.

- **디자인 변경**: UI/UX는 픽셀 단위로 동일하게 유지되며, 사용자는 변경을 인지하지 못해야 합니다.

- **성능 최적화**: 메모이제이션은 유지하지만, 추가적인 성능 최적화(예: React.lazy, code splitting)는 이 작업의 범위를 벗어납니다.

- **테스트 코드 작성**: 테스트 가능한 구조로 변경하는 것이 목표이지만, 실제 테스트 코드 작성은 별도 작업으로 진행됩니다.

- **다른 Modal 컴포넌트**: 이 작업은 ScheduleDetailModal에만 집중하며, 프로젝트의 다른 대형 파일은 별도로 처리됩니다.
