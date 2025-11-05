# Feature Specification: JobPostingForm Component Refactoring

**Feature Branch**: `001-job-posting-form-split`
**Created**: 2025-11-05
**Status**: Draft
**Input**: User description: "Phase 1-4: JobPostingForm.tsx 대형 파일 분리 (993줄 → 5개 파일)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Independently Testable Form Sections (Priority: P1)

개발자는 각 폼 섹션을 독립적으로 테스트할 수 있어야 합니다. 현재 993줄의 단일 파일로 인해 특정 섹션의 테스트가 어렵고, 버그 발생 시 원인 파악이 지연됩니다.

**Why this priority**: 테스트 가능성은 코드 품질과 유지보수성의 핵심입니다. 각 섹션을 독립적으로 테스트할 수 있으면 버그를 조기에 발견하고 수정할 수 있습니다.

**Independent Test**: 각 섹션 컴포넌트(BasicInfoSection, DateRequirementsSection, PreQuestionsSection, SalarySection)를 개별적으로 렌더링하고, props를 전달하여 올바르게 동작하는지 확인할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** BasicInfoSection 컴포넌트가 독립적으로 존재할 때, **When** 개발자가 해당 컴포넌트만 테스트할 때, **Then** 제목/장소/설명 입력 기능이 정상 작동해야 합니다.
2. **Given** DateRequirementsSection 컴포넌트가 분리되어 있을 때, **When** 날짜별 인원 요구사항을 추가/수정/삭제할 때, **Then** 해당 기능만 독립적으로 테스트 가능해야 합니다.
3. **Given** 각 섹션이 독립된 파일로 존재할 때, **When** TypeScript 타입 체크를 실행할 때, **Then** 각 섹션의 타입 오류를 명확하게 식별할 수 있어야 합니다.

---

### User Story 2 - Reusable Form Components (Priority: P2)

개발자는 폼 섹션을 다른 컨텍스트에서 재사용할 수 있어야 합니다. 현재 모든 로직이 하나의 파일에 결합되어 있어, 특정 섹션만 필요한 경우에도 전체 폼을 가져와야 합니다.

**Why this priority**: 컴포넌트 재사용성은 코드 중복을 줄이고 개발 속도를 향상시킵니다. 예를 들어, SalarySection은 다른 급여 관련 폼에서도 사용될 수 있습니다.

**Independent Test**: 각 섹션 컴포넌트를 다른 페이지나 폼에 import하여 독립적으로 사용할 수 있는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** SalarySection이 독립된 컴포넌트로 분리되어 있을 때, **When** 개발자가 다른 급여 관련 폼에서 SalarySection을 import할 때, **Then** 추가 수정 없이 바로 사용 가능해야 합니다.
2. **Given** 각 섹션이 명확한 Props 인터페이스를 가질 때, **When** 개발자가 섹션을 새로운 컨텍스트에 통합할 때, **Then** TypeScript가 필요한 props를 명확하게 알려줘야 합니다.

---

### User Story 3 - Easy Maintenance and Navigation (Priority: P3)

유지보수 담당자는 특정 폼 섹션을 쉽게 찾아 수정할 수 있어야 합니다. 현재 993줄의 단일 파일에서는 특정 기능을 찾기 위해 많은 시간이 소요됩니다.

**Why this priority**: 코드 내비게이션과 수정 속도는 유지보수 비용과 직결됩니다. 명확한 파일 구조는 신규 개발자의 온보딩도 빠르게 합니다.

**Independent Test**: 특정 섹션(예: 사전 질문 섹션)의 버그를 수정해야 할 때, 해당 파일만 열어서 수정하고 테스트할 수 있는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** 폼 섹션이 sections/ 디렉토리 내 개별 파일로 분리되어 있을 때, **When** 개발자가 날짜별 인원 요구사항 로직을 수정해야 할 때, **Then** DateRequirementsSection.tsx 파일만 열어서 수정할 수 있어야 합니다.
2. **Given** 각 파일이 300줄 이하로 유지될 때, **When** 개발자가 코드 리뷰를 진행할 때, **Then** 한 화면에서 전체 파일을 파악할 수 있어야 합니다.

---

### Edge Cases

- **대형 폼 데이터 처리**: 날짜별 인원 요구사항이 50개 이상일 때 DateRequirementsSection의 성능이 저하되지 않아야 합니다.
- **메모리 누수 방지**: 각 섹션 컴포넌트가 언마운트될 때 이벤트 리스너와 타이머가 정리되어야 합니다.
- **순환 의존성**: 섹션 간 import 순환 참조가 발생하지 않도록 해야 합니다.
- **Props 불일치**: 메인 폼과 각 섹션 간 props 인터페이스 불일치로 인한 런타임 오류가 발생하지 않아야 합니다.
- **다크모드 스타일 누락**: 분리 과정에서 다크모드 Tailwind 클래스(`dark:`)가 누락되지 않아야 합니다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 기존 JobPostingForm.tsx의 모든 기능을 100% 유지해야 합니다 (구인공고 생성, 수정, 검증, 저장, 불러오기).
- **FR-002**: 각 폼 섹션(BasicInfoSection, DateRequirementsSection, PreQuestionsSection, SalarySection)은 독립된 React 컴포넌트로 분리되어야 합니다.
- **FR-003**: 각 섹션 컴포넌트는 명확한 Props 인터페이스를 정의해야 하며, Controlled Components 패턴을 유지해야 합니다.
- **FR-004**: 메인 컨테이너(JobPostingForm/index.tsx)는 각 섹션을 조합하고, 전체 폼 상태를 useJobPostingForm Hook으로 관리해야 합니다.
- **FR-005**: 폼 검증 로직은 useJobPostingForm Hook에 통합되어야 하며, 각 섹션에서 호출 가능해야 합니다.
- **FR-006**: 모든 컴포넌트는 다크모드 스타일(`dark:` Tailwind 클래스)을 유지해야 합니다.
- **FR-007**: 성능 최적화를 위해 메모이제이션(`useMemo`, `useCallback`)이 적절히 적용되어야 합니다.
- **FR-008**: TypeScript strict mode를 100% 준수해야 하며, `any` 타입 사용이 금지됩니다.
- **FR-009**: 각 파일은 300줄 이하로 유지되어야 합니다.
- **FR-010**: API 호출 방식과 데이터 구조는 변경되지 않아야 합니다.

### Key Entities

- **JobPostingFormData**: 구인공고 폼의 전체 데이터 구조 (제목, 장소, 설명, 날짜별 요구사항, 사전 질문, 급여 정보 포함)
- **DateRequirement**: 특정 날짜의 인원 요구사항 (날짜, 필요 인원 수, 역할)
- **PreQuestion**: 지원자에게 묻는 사전 질문 (질문 텍스트, 필수 여부)
- **SalaryInfo**: 급여 정보 (급여 타입, 금액, 지급 방식)
- **SectionProps**: 각 섹션 컴포넌트가 받는 props 인터페이스 (formData, onChange, errors, validation)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: JobPostingForm/index.tsx는 300줄 이하, 각 섹션 파일은 250줄 이하로 유지됩니다.
- **SC-002**: `npm run type-check` 실행 시 TypeScript 에러가 0개여야 합니다.
- **SC-003**: `npm run lint` 실행 시 ESLint 경고가 0개여야 합니다.
- **SC-004**: 기존 구인공고 생성 워크플로우가 변경 없이 100% 동일하게 작동해야 합니다 (사용자가 차이를 느끼지 못함).
- **SC-005**: 기존 구인공고 수정 워크플로우가 변경 없이 100% 동일하게 작동해야 합니다.
- **SC-006**: 폼 검증 로직이 기존과 동일하게 작동해야 합니다 (모든 필수 필드 검증, 형식 검증).
- **SC-007**: 다크모드 전환 시 모든 폼 섹션이 올바른 다크모드 스타일을 표시해야 합니다.
- **SC-008**: 각 섹션 컴포넌트가 독립적으로 import 및 렌더링 가능해야 합니다 (단위 테스트 작성 가능).
- **SC-009**: useJobPostingForm Hook을 통한 폼 상태 관리가 정상 작동해야 합니다 (Phase 1-1의 개선 사항 활용).
- **SC-010**: 번들 크기가 기존 대비 5% 이상 증가하지 않아야 합니다 (코드 분할 효과 유지).

## Assumptions

- Phase 1-1에서 useJobPostingForm.ts Hook이 이미 타입 안전성과 재사용성이 개선되어 있다고 가정합니다.
- SalarySection.tsx가 이미 별도 파일로 분리되어 있을 가능성이 있으나, 확인 후 필요 시 리팩토링합니다.
- 기존 폼의 모든 테스트 케이스(있다면)는 리팩토링 후에도 통과해야 합니다.
- 폼 섹션 간 데이터 의존성은 최소화되어 있으며, 대부분의 데이터는 메인 폼 상태에서 관리됩니다.
- 현재 다크모드 구현이 Tailwind CSS `dark:` 클래스를 사용한다고 가정합니다.

## Dependencies

- **Phase 1-1 완료 필수**: useJobPostingForm.ts Hook의 타입 안전성 및 인터페이스 개선이 완료되어야 합니다.
- React 18.2+, TypeScript 4.9+, Tailwind CSS 3.3+ 환경이 구성되어 있어야 합니다.
- Firebase Firestore 연동 코드는 수정하지 않습니다 (API 호출 방식 유지).

## Out of Scope

- 폼의 UI/UX 개선은 포함하지 않습니다 (기존 디자인 유지).
- 새로운 폼 필드 추가는 이 작업의 범위를 벗어납니다.
- 폼 검증 로직의 변경이나 개선은 포함하지 않습니다 (기존 로직 유지).
- 성능 최적화를 위한 추가적인 메모이제이션 개선은 선택 사항입니다.
- E2E 테스트 작성은 별도 Phase에서 진행합니다.
