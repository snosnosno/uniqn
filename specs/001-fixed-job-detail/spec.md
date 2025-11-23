# Feature Specification: 고정공고 상세보기 및 Firestore 인덱스 설정

**Feature Branch**: `001-fixed-job-detail`
**Created**: 2025-11-23
**Status**: Draft
**Input**: User description: "Phase 4: 고정공고 상세보기 및 Firestore 인덱스 설정 - 고정공고 상세 정보 표시 및 Firestore 복합 인덱스 설정을 완료합니다."

## Clarifications

### Session 2025-11-23

- Q: requiredRolesWithCount가 비어있는 경우 상세보기에서 어떻게 표시되는가? → A: "모집 역할이 없습니다" 메시지 표시 (사용자에게 명확한 피드백 제공)
- Q: 조회수 증가 시점(타이밍)은 언제인가? → A: 모달 오픈 시도 시 즉시 조회수 증가 (카드 클릭 직후, 모달 렌더링 전)
- Q: 인덱스 생성 대기 시간 동안의 시스템 동작은 어떻게 되는가? → A: 인덱스 생성 중 쿼리 실패, 임시 오류 메시지 표시 (Firebase 표준 동작, 개발/스테이징에서 인덱스 미리 생성 권장)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 고정공고 상세 정보 조회 (Priority: P1)

구인자(사업자)가 게시한 고정공고를 지원자가 클릭하여 상세한 근무 조건과 모집 역할을 확인할 수 있습니다. 상세보기 모달에서는 주 출근일수, 근무시간, 모집하는 역할별 인원수 등을 명확하게 보여줍니다.

**Why this priority**: 지원자가 공고의 상세 조건을 파악하지 못하면 적절한 지원 판단을 할 수 없으므로, 이 기능은 가장 핵심적인 사용자 가치를 제공합니다.

**Independent Test**: 고정공고 목록에서 하나를 선택하여 상세보기 모달을 열고, 근무 조건(주 출근일수, 근무시간)과 모집 역할 목록이 올바르게 표시되는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** 고정공고 목록 페이지에서 고정공고 카드가 표시되어 있을 때, **When** 사용자가 카드를 클릭하면, **Then** 상세보기 모달이 열리고 근무 조건 섹션에 주 출근일수와 근무시간이 표시됩니다.
2. **Given** 상세보기 모달이 열렸을 때, **When** 사용자가 모집 역할 섹션을 확인하면, **Then** 각 역할 이름과 필요 인원수가 목록으로 표시됩니다.
3. **Given** requiredRolesWithCount가 비어있는 고정공고의 상세보기를 열었을 때, **When** 사용자가 모집 역할 섹션을 확인하면, **Then** "모집 역할이 없습니다" 메시지가 표시됩니다.
4. **Given** 상세보기 모달이 표시 중일 때, **When** 사용자가 다크모드를 활성화/비활성화하면, **Then** 모든 텍스트와 배경색이 해당 테마에 맞게 적절히 표시됩니다.

---

### User Story 2 - 조회수 자동 증가 (Priority: P2)

사용자가 고정공고 상세보기를 열 때마다 해당 공고의 조회수가 자동으로 1씩 증가하여, 구인자는 공고의 관심도를 파악할 수 있습니다.

**Why this priority**: 조회수는 공고의 인기도와 도달 범위를 측정하는 부가 지표로, 핵심 기능은 아니지만 구인자에게 유용한 정보를 제공합니다.

**Independent Test**: 고정공고를 여러 번 클릭하여 상세보기를 열고, Firestore에서 해당 공고의 viewCount 필드가 증가하는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** 조회수가 0인 고정공고가 있을 때, **When** 사용자가 카드를 클릭하면, **Then** 모달 렌더링 전에 Firestore의 해당 공고 문서에서 fixedData.viewCount가 즉시 1로 증가합니다.
2. **Given** 조회수가 이미 5인 공고가 있을 때, **When** 사용자가 카드를 다시 클릭하면, **Then** viewCount가 즉시 6으로 증가합니다.
3. **Given** 상세보기 열기 중 네트워크 오류가 발생할 때, **When** 조회수 증가 요청이 실패하면, **Then** 오류가 로그에 기록되고 사용자에게는 상세보기가 여전히 표시됩니다(조회수 증가 실패가 사용자 경험을 방해하지 않음).

---

### User Story 3 - Firestore 복합 인덱스 설정 (Priority: P1)

고정공고를 postingType, status, createdAt 기준으로 효율적으로 조회하기 위해 Firestore 복합 인덱스를 설정하여, 목록 조회 시 성능을 보장합니다.

**Why this priority**: 인덱스가 없으면 Firestore 쿼리가 실패하거나 성능이 저하되므로, 시스템의 안정성과 성능을 위해 필수적입니다.

**Independent Test**: Firebase Console에서 Firestore 인덱스 목록을 확인하고, firestore.indexes.json 파일을 배포한 후 인덱스가 생성되었는지 검증합니다.

**Acceptance Scenarios**:

1. **Given** firestore.indexes.json 파일이 업데이트되었을 때, **When** Firebase 배포 명령을 실행하면, **Then** Firebase Console의 인덱스 목록에 postingType, status, createdAt 필드를 포함하는 복합 인덱스가 생성됩니다.
2. **Given** 인덱스 생성이 진행 중일 때, **When** 고정공고 목록 조회 쿼리를 실행하면, **Then** Firestore가 오류를 반환하고 사용자에게 임시 오류 메시지가 표시됩니다.
3. **Given** 복합 인덱스가 완전히 생성된 후, **When** 고정공고 목록 조회 쿼리를 실행하면, **Then** 쿼리가 성공적으로 실행되고 결과가 반환됩니다.

---

### User Story 4 - 통합 테스트 및 전체 플로우 검증 (Priority: P2)

고정공고 작성부터 조회, 상세보기, 지원까지의 전체 플로우가 원활하게 작동하는지 E2E 테스트를 통해 검증합니다.

**Why this priority**: 개별 기능이 작동하더라도 전체 플로우가 통합되지 않으면 사용자 경험이 저하되므로, 전체 시스템의 신뢰성을 보장하기 위해 중요합니다.

**Independent Test**: 고정공고를 생성하고, 목록에서 조회하고, 상세보기를 열어 정보를 확인한 후, 지원 프로세스를 완료하는 전체 시나리오를 순차적으로 실행합니다.

**Acceptance Scenarios**:

1. **Given** 사용자가 고정공고 작성 폼을 작성하고 제출했을 때, **When** 폼이 유효성 검사를 통과하면, **Then** Firestore에 고정공고가 저장되고 requiredRoles 필드가 자동 생성됩니다.
2. **Given** 고정공고가 저장된 후, **When** 사용자가 고정 탭을 클릭하면, **Then** 고정공고만 필터링되어 목록에 표시되고 각 카드에 근무 조건이 표시됩니다.
3. **Given** 고정공고 목록에서 카드를 클릭했을 때, **When** 상세보기 모달이 열리면, **Then** 조회수가 증가하고 역할별 인원 정보가 표시됩니다.
4. **Given** 상세보기 모달에서 지원하기 버튼을 클릭했을 때, **When** 사용자가 지원 정보를 입력하고 제출하면, **Then** 기존 지원 플로우와 동일하게 지원 처리가 완료됩니다.

---

### Edge Cases

- **네트워크 오류 시나리오**: 조회수 증가 요청 중 네트워크 오류가 발생할 때 어떻게 처리되는가?
  - 시스템은 오류를 로그에 기록하고, 사용자에게는 상세보기 모달을 정상적으로 표시합니다.
- **인덱스 미생성 상태**: Firestore 인덱스가 아직 생성되지 않은 상태에서 쿼리를 실행하면 어떻게 되는가?
  - Firestore는 오류를 반환하고 사용자에게 임시 오류 메시지가 표시됩니다. Firebase Console에 인덱스 생성 링크가 표시되며, 개발/스테이징 환경에서 인덱스를 미리 생성한 후 프로덕션 배포를 진행해야 합니다.
- **다크모드 전환**: 상세보기 모달이 열린 상태에서 다크모드를 전환할 때 모든 UI 요소가 올바르게 업데이트되는가?
  - 모든 텍스트, 배경, 테두리 색상이 dark: 클래스에 의해 즉시 업데이트됩니다.
- **빈 역할 목록**: requiredRolesWithCount가 비어있는 경우 상세보기에서 어떻게 표시되는가?
  - "모집 역할이 없습니다" 메시지가 표시되어 사용자에게 명확한 상태를 전달합니다.
- **동시 조회**: 여러 사용자가 동시에 같은 공고를 조회할 때 조회수가 정확히 증가하는가?
  - Firestore의 increment() 함수는 원자적 연산을 보장하므로 조회수가 정확히 증가합니다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 고정공고 상세보기 모달에서 주 출근일수(daysPerWeek)를 표시해야 합니다.
- **FR-002**: 시스템은 고정공고 상세보기 모달에서 근무시간(startTime, endTime)을 표시해야 합니다.
- **FR-003**: 시스템은 고정공고 상세보기 모달에서 모집 역할 목록(requiredRolesWithCount)을 역할 이름과 필요 인원수와 함께 표시해야 합니다.
- **FR-004**: 시스템은 사용자가 고정공고 카드를 클릭하는 즉시(모달 렌더링 전), Firestore의 해당 공고 문서에서 fixedData.viewCount를 1 증가시켜야 합니다.
- **FR-005**: 시스템은 조회수 증가 요청 중 오류가 발생하면 로그에 기록하고, 사용자에게는 상세보기 모달을 정상적으로 표시해야 합니다.
- **FR-006**: 시스템은 Firestore의 jobPostings 컬렉션에 대해 postingType(오름차순), status(오름차순), createdAt(내림차순) 필드를 포함하는 복합 인덱스를 가져야 합니다.
- **FR-007**: 시스템은 기존 JobDetailModal 컴포넌트를 최소한으로 수정하고, 고정공고 여부를 확인하는 조건부 렌더링을 통해 고정공고 전용 섹션을 추가해야 합니다.
- **FR-008**: 시스템은 다크모드 전환 시 상세보기 모달의 모든 UI 요소(텍스트, 배경, 테두리)가 dark: 클래스에 의해 적절히 스타일링되어야 합니다.
- **FR-009**: 시스템은 requiredRolesWithCount가 비어있는 경우 "모집 역할이 없습니다" 메시지를 표시해야 합니다.
- **FR-010**: 시스템은 Firestore 인덱스 생성 중 쿼리 실패 시 사용자에게 임시 오류 메시지를 표시해야 합니다.

### Key Entities

- **FixedJobPosting**: 고정공고 데이터 (postingType='fixed', fixedData 포함)
  - 주요 속성: id, title, location, status, createdAt, fixedData(workSchedule, requiredRolesWithCount, viewCount 등)
- **WorkSchedule**: 근무 일정 정보
  - 주요 속성: daysPerWeek(주 출근일수), startTime(근무 시작시간), endTime(근무 종료시간)
- **RequiredRoleWithCount**: 모집 역할 및 인원
  - 주요 속성: name(역할 이름), count(필요 인원수)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자가 고정공고 카드를 클릭한 후 2초 이내에 상세보기 모달이 열리고 근무 조건 정보가 표시됩니다.
- **SC-002**: 고정공고 상세보기를 열 때마다 Firestore의 viewCount가 정확히 1씩 증가합니다.
- **SC-003**: Firestore 복합 인덱스 배포 후 고정공고 목록 조회 쿼리가 100% 성공률로 실행됩니다.
- **SC-004**: 고정공고 작성부터 상세보기, 지원까지의 전체 E2E 테스트 시나리오가 오류 없이 통과합니다.
- **SC-005**: npm run type-check 및 npm run build 명령이 에러 없이 성공합니다.
- **SC-006**: 다크모드 전환 시 상세보기 모달의 모든 UI 요소가 1초 이내에 적절한 테마로 업데이트됩니다.

## Assumptions

- 고정공고 타입 시스템(Phase 1)과 근무일정 입력 섹션(Phase 2), 조회 Hook 및 카드 컴포넌트(Phase 3)가 이미 완료되어 있습니다.
- 기존 JobDetailModal 컴포넌트는 이벤트 공고를 표시하는 기본 구조를 가지고 있으며, 조건부 렌더링을 통해 고정공고 전용 섹션을 추가할 수 있습니다.
- Firestore increment() 함수는 원자적 연산을 보장하므로, 동시성 문제 없이 조회수를 안전하게 증가시킬 수 있습니다.
- 인덱스 배포는 Firebase Console에서 확인하며, 인덱스 생성에는 몇 분이 소요될 수 있습니다. 인덱스 생성 중에는 쿼리가 실패하므로, 개발/스테이징 환경에서 인덱스를 미리 생성한 후 프로덕션 배포를 진행해야 합니다.
- 조회수 증가 실패는 치명적인 오류가 아니므로, 로그에 기록하고 사용자 경험을 방해하지 않습니다.
- 기존 지원 플로우는 이미 구현되어 있으며, 고정공고에 대한 지원도 동일한 방식으로 처리됩니다.

## Dependencies

- Phase 1: 고정공고 타입 시스템 구현 완료
- Phase 2: 고정공고 근무일정 입력 섹션 구현 완료
- Phase 3: 고정공고 조회 Hook 및 카드 컴포넌트 구현 완료
- Firestore 인덱스 배포를 위한 Firebase CLI 및 배포 권한

## Out of Scope

- 조회수 기반 인기 순위 정렬 기능 (향후 Phase에서 고려)
- 사용자별 조회 이력 추적 (중복 조회 방지)
- 고정공고 수정 기능 (기존 공고 편집 플로우와 별도)
- 고정공고 마감 자동화 (모집 인원 충족 시 자동 마감)
