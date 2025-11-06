# Feature Specification: Phase 2-4 Critical UI Component Tests

**Feature Branch**: `003-ui-component-tests`
**Created**: 2025-11-06
**Status**: Draft
**Input**: User description: "Phase 2-4: Critical UI 컴포넌트 테스트 작성 (JobPostingCard, NotificationDropdown). 2개 핵심 컴포넌트에 대한 렌더링, 인터랙션, 다크모드, 접근성 테스트 작성"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - NotificationDropdown 기본 렌더링 및 상태 관리 테스트 (Priority: P1)

QA 엔지니어가 알림 드롭다운 컴포넌트의 기본 동작이 올바른지 검증하고자 합니다. 사용자가 알림 아이콘을 클릭했을 때 드롭다운이 정상적으로 열리고, 알림 목록이 표시되며, 읽음/안읽음 상태가 시각적으로 구분되는지 확인해야 합니다.

**Why this priority**: 알림 시스템은 사용자 경험의 핵심 기능이며, 기본 렌더링 실패 시 전체 알림 기능이 무용지물이 되므로 최우선 순위입니다.

**Independent Test**: 알림 드롭다운을 렌더링하고 기본 UI 요소(알림 목록, 배지, 빈 상태)가 표시되는지 검증함으로써 독립적으로 테스트 가능하며, 이 테스트만으로도 렌더링 계층의 기본 품질을 보장할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** 사용자에게 3개의 안읽은 알림과 2개의 읽은 알림이 있을 때, **When** NotificationDropdown을 렌더링하면, **Then** 5개의 알림 아이템이 목록에 표시되어야 함
2. **Given** 드롭다운이 닫혀있을 때, **When** 알림 벨 아이콘을 클릭하면, **Then** 드롭다운이 열리고 알림 목록이 표시되어야 함
3. **Given** 사용자에게 알림이 없을 때, **When** 드롭다운을 열면, **Then** "알림이 없습니다" 빈 상태 메시지가 표시되어야 함
4. **Given** 안읽은 알림이 3개 있을 때, **When** NotificationBadge를 확인하면, **Then** 숫자 3이 배지에 표시되어야 함
5. **Given** 드롭다운이 열려있을 때, **When** 외부 영역을 클릭하면, **Then** 드롭다운이 자동으로 닫혀야 함

---

### User Story 2 - NotificationDropdown 인터랙션 및 읽음 처리 테스트 (Priority: P1)

QA 엔지니어가 사용자의 알림 인터랙션이 올바르게 동작하는지 검증하고자 합니다. 알림 클릭 시 상세 페이지로 이동하고, 읽음 처리가 정확하게 수행되며, 전체 읽음 처리 기능이 작동하는지 확인해야 합니다.

**Why this priority**: 알림의 핵심 기능은 사용자를 적절한 페이지로 유도하고 읽음 상태를 관리하는 것이므로, 기본 렌더링과 동등한 우선순위입니다.

**Independent Test**: 알림 클릭, 읽음 처리, 전체 읽음 처리 각각을 독립적으로 테스트할 수 있으며, mock 함수를 통해 실제 라우팅 및 Firebase 호출 없이 검증 가능합니다.

**Acceptance Scenarios**:

1. **Given** 안읽은 알림이 표시되어 있을 때, **When** 특정 알림을 클릭하면, **Then** 해당 알림의 읽음 처리 함수가 호출되고 관련 페이지로 라우팅되어야 함
2. **Given** 5개의 안읽은 알림이 있을 때, **When** "모두 읽음" 버튼을 클릭하면, **Then** markAllAsRead 함수가 호출되어야 함
3. **Given** 드롭다운이 열려있을 때, **When** "모두 보기" 버튼을 클릭하면, **Then** `/app/notifications` 경로로 이동하고 드롭다운이 닫혀야 함
4. **Given** 드롭다운이 열려있을 때, **When** 설정 아이콘을 클릭하면, **Then** `/app/notification-settings` 경로로 이동해야 함
5. **Given** 드롭다운이 열려있을 때, **When** ESC 키를 누르면, **Then** 드롭다운이 닫혀야 함

---

### User Story 3 - NotificationDropdown 다크모드 및 접근성 테스트 (Priority: P2)

QA 엔지니어가 알림 드롭다운이 다크모드 환경에서 올바르게 표시되고, 접근성 표준을 준수하는지 검증하고자 합니다. 다크모드 클래스 적용 여부, 색상 대비, 키보드 네비게이션, 스크린 리더 호환성을 확인해야 합니다.

**Why this priority**: 다크모드와 접근성은 사용자 경험을 향상시키지만, 기본 기능(P1)이 먼저 작동해야 하므로 P2로 설정합니다.

**Independent Test**: axe-core 라이브러리를 사용한 자동화된 접근성 테스트와 다크모드 클래스 검증을 통해 독립적으로 테스트 가능합니다.

**Acceptance Scenarios**:

1. **Given** 다크모드가 활성화된 상태에서, **When** NotificationDropdown을 렌더링하면, **Then** 모든 주요 UI 요소에 `dark:` 클래스가 적용되어야 함
2. **Given** 드롭다운이 렌더링되었을 때, **When** axe-core 접근성 테스트를 실행하면, **Then** 0개의 접근성 위반 사항이 보고되어야 함
3. **Given** 알림 목록이 표시되어 있을 때, **When** Tab 키로 네비게이션하면, **Then** 각 알림 아이템에 순차적으로 포커스가 이동해야 함
4. **Given** 알림 아이템에 포커스가 있을 때, **When** Enter 또는 Space 키를 누르면, **Then** 알림 클릭과 동일한 동작이 실행되어야 함
5. **Given** 드롭다운이 렌더링되었을 때, **When** 스크린 리더로 읽으면, **Then** 모든 중요 정보(알림 제목, 시간, 상태)가 올바르게 전달되어야 함

---

### User Story 4 - JobPostingCard 향상된 인터랙션 테스트 (Priority: P2)

QA 엔지니어가 JobPostingCard의 사용자 인터랙션(클릭, 지원, 북마크, 공유)이 올바르게 동작하는지 검증하고자 합니다. 기존 테스트는 렌더링과 스타일에 집중했으나, 실제 사용자 액션에 대한 검증이 필요합니다.

**Why this priority**: JobPostingCard의 기본 렌더링 테스트는 이미 존재하므로, 인터랙션 테스트는 추가적인 품질 보장 수단으로 P2 우선순위입니다.

**Independent Test**: 각 인터랙션(클릭, 지원, 북마크, 공유)을 독립적으로 테스트할 수 있으며, mock 함수를 통해 실제 API 호출 없이 검증 가능합니다.

**Acceptance Scenarios**:

1. **Given** JobPostingCard가 렌더링되었을 때, **When** 카드 본문을 클릭하면, **Then** 구인공고 상세 페이지로 라우팅되어야 함
2. **Given** 사용자가 로그인 상태이고 지원하지 않은 공고일 때, **When** "지원하기" 버튼을 클릭하면, **Then** 지원 처리 함수가 호출되어야 함
3. **Given** 북마크되지 않은 공고일 때, **When** 북마크 아이콘을 클릭하면, **Then** 북마크 추가 함수가 호출되고 아이콘이 채워진 형태로 변경되어야 함
4. **Given** 북마크된 공고일 때, **When** 북마크 아이콘을 다시 클릭하면, **Then** 북마크 제거 함수가 호출되고 아이콘이 빈 형태로 변경되어야 함
5. **Given** 공유 기능이 활성화된 환경에서, **When** 공유 버튼을 클릭하면, **Then** 공유 API가 호출되거나 공유 모달이 표시되어야 함

---

### User Story 5 - JobPostingCard 접근성 향상 테스트 (Priority: P3)

QA 엔지니어가 JobPostingCard가 WCAG 2.1 AA 기준을 충족하는지 검증하고자 합니다. 키보드 네비게이션, 스크린 리더 호환성, 색상 대비를 확인해야 합니다.

**Why this priority**: JobPostingCard의 기본 렌더링과 다크모드 테스트는 이미 존재하므로, 추가적인 접근성 검증은 P3 우선순위로 설정합니다.

**Independent Test**: axe-core를 사용한 자동화된 접근성 테스트와 키보드 네비게이션 시나리오를 통해 독립적으로 검증 가능합니다.

**Acceptance Scenarios**:

1. **Given** JobPostingCard가 렌더링되었을 때, **When** axe-core 테스트를 실행하면, **Then** 접근성 위반 사항이 0개여야 함
2. **Given** 카드가 포커스 가능한 상태일 때, **When** Tab 키로 네비게이션하면, **Then** 카드와 내부 액션 버튼들에 순차적으로 포커스가 이동해야 함
3. **Given** 카드에 포커스가 있을 때, **When** Enter 키를 누르면, **Then** 상세 페이지로 이동해야 함
4. **Given** 지원 버튼에 포커스가 있을 때, **When** Space 키를 누르면, **Then** 지원 처리가 실행되어야 함
5. **Given** 카드가 렌더링되었을 때, **When** 스크린 리더로 읽으면, **Then** 공고 제목, 위치, 급여, 상태가 올바르게 전달되어야 함

---

### Edge Cases

- **NotificationDropdown**: 알림 개수가 100개 이상일 때 드롭다운 스크롤이 정상 작동하는가?
- **NotificationDropdown**: 네트워크 오류로 알림 로딩 실패 시 적절한 에러 메시지가 표시되는가?
- **NotificationDropdown**: 드롭다운이 열린 상태에서 새 알림이 도착하면 실시간으로 업데이트되는가?
- **JobPostingCard**: 긴 제목(100자 이상)이나 특수문자가 포함된 제목이 올바르게 표시되는가?
- **JobPostingCard**: 이미지 로딩 실패 시 대체 이미지나 플레이스홀더가 표시되는가?
- **JobPostingCard**: 여러 상태(모집중, 마감, 임박)가 동시에 해당하는 경우 우선순위가 올바른가?
- **다크모드**: 다크모드와 라이트모드 전환 시 깜빡임 없이 부드럽게 전환되는가?
- **접근성**: 고대비 모드에서 색상 대비가 WCAG AA 기준(4.5:1)을 충족하는가?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: NotificationDropdown은 MUST 알림 목록을 Firestore에서 실시간으로 구독하고 표시해야 함
- **FR-002**: NotificationDropdown은 MUST 안읽은 알림 개수를 배지로 표시해야 함
- **FR-003**: NotificationDropdown은 MUST 알림 클릭 시 해당 알림을 읽음으로 표시하고 관련 페이지로 라우팅해야 함
- **FR-004**: NotificationDropdown은 MUST "모두 읽음" 기능을 제공하여 모든 안읽은 알림을 한 번에 읽음 처리해야 함
- **FR-005**: NotificationDropdown은 MUST 드롭다운 외부 클릭 또는 ESC 키 입력 시 자동으로 닫혀야 함
- **FR-006**: NotificationDropdown은 MUST 알림이 없을 때 적절한 빈 상태 메시지를 표시해야 함
- **FR-007**: NotificationDropdown은 MUST 모든 주요 UI 요소에 다크모드 스타일(`dark:` 클래스)을 적용해야 함
- **FR-008**: NotificationDropdown은 MUST WCAG 2.1 AA 접근성 기준을 준수해야 함
- **FR-009**: JobPostingCard는 MUST 카드 클릭 시 구인공고 상세 페이지로 라우팅하는 인터랙션을 제공해야 함
- **FR-010**: JobPostingCard는 MUST 지원, 북마크, 공유 등의 액션 버튼 인터랙션을 지원해야 함
- **FR-011**: JobPostingCard는 MUST 키보드 네비게이션(Tab, Enter, Space)을 통한 접근성을 제공해야 함
- **FR-012**: JobPostingCard는 MUST 스크린 리더가 공고의 핵심 정보(제목, 위치, 급여, 상태)를 올바르게 읽을 수 있도록 시맨틱 마크업을 제공해야 함
- **FR-013**: 테스트는 MUST React Testing Library의 권장 패턴(사용자 중심 쿼리)을 따라야 함
- **FR-014**: 테스트는 MUST Jest의 명확한 설명(describe, it)을 사용하여 가독성을 보장해야 함
- **FR-015**: 테스트는 MUST 컴포넌트의 외부 의존성(Firebase, React Router)을 mock 처리해야 함

### Key Entities

- **NotificationDropdown**: 알림 목록을 표시하는 드롭다운 컴포넌트 (props: className)
- **NotificationItem**: 개별 알림 아이템 컴포넌트 (props: notification, onRead, onNavigate)
- **NotificationBadge**: 안읽은 알림 개수를 표시하는 배지 컴포넌트 (props: count)
- **JobPostingCard**: 구인공고 정보를 표시하는 카드 컴포넌트 (props: post, variant, renderActions, renderExtra, showStatus, showApplicationCount, className)
- **Test Suite**: 각 컴포넌트에 대한 테스트 모음 (구조: describe > it, mock 설정, assertions)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: NotificationDropdown 테스트 커버리지가 85% 이상 달성되어야 함 (라인, 브랜치, 함수 커버리지 포함)
- **SC-002**: JobPostingCard 인터랙션 및 접근성 테스트 추가로 기존 커버리지가 90% 이상으로 향상되어야 함
- **SC-003**: 모든 테스트가 `npm run test` 실행 시 통과해야 함 (0 failures)
- **SC-004**: axe-core 접근성 테스트에서 0개의 위반 사항이 보고되어야 함 (WCAG 2.1 AA 기준)
- **SC-005**: 각 테스트 스위트의 실행 시간이 3초 이내여야 함 (빠른 피드백 보장)
- **SC-006**: 테스트 코드의 가독성 점수가 80점 이상이어야 함 (명확한 describe/it, 의미 있는 테스트명)
- **SC-007**: 모든 다크모드 관련 테스트가 통과하여 UI 일관성이 검증되어야 함
