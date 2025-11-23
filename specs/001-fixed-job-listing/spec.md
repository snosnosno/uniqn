# Feature Specification: 고정공고 조회 Hook 및 카드 컴포넌트

**Feature Branch**: `001-fixed-job-listing`
**Created**: 2025-11-23
**Status**: Draft
**Input**: User description: "### **Phase 3: 고정공고 Hook & Card 컴포넌트** (Phase 2 완료 후) - 고정공고 목록을 조회하고 표시하는 기능을 구현합니다. Firestore 실시간 구독 및 무한 스크롤을 지원합니다."

## Clarifications

### Session 2025-11-23

- Q: 조회수 증가 시점 → A: 상세 페이지(`/job-postings/:id`)로 이동할 때
- Q: 무한 스크롤 구현 범위 → A: 이번 Phase 3에 무한 스크롤 전체 구현 포함 (IntersectionObserver + 페이지네이션)
- Q: Firestore 실시간 구독과 무한 스크롤 조합 → A: 초기 20개만 실시간 구독, 추가 페이지는 일회성 조회 (getDocs)
- Q: 에러 재시도 전략 → A: 수동 재시도만 허용 (재시도 버튼 클릭)
- Q: 조회수 중복 증가 방지 → A: 매번 증가 (동일 사용자도 방문할 때마다 카운트)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 고정공고 목록 실시간 조회 (Priority: P1)

구인자가 JobBoard 페이지에 접속하면 게시 중인 고정공고 목록을 실시간으로 확인할 수 있습니다. 새로운 공고가 등록되거나 기존 공고가 수정/삭제되면 자동으로 화면에 반영됩니다.

**Why this priority**: 사용자에게 최신 공고 정보를 제공하는 핵심 기능입니다. 실시간 구독이 없으면 사용자가 페이지를 새로고침해야 하므로 UX가 크게 저하됩니다.

**Independent Test**: JobBoard 페이지에 접속하여 고정공고 목록이 표시되는지 확인할 수 있습니다. Firestore에서 공고를 추가/수정/삭제했을 때 화면이 자동으로 업데이트되는지 검증합니다.

**Acceptance Scenarios**:

1. **Given** 사용자가 JobBoard 페이지에 접속, **When** 고정공고가 Firestore에 3개 존재, **Then** 3개의 고정공고 카드가 생성일 역순으로 표시됨
2. **Given** 고정공고 목록이 표시된 상태, **When** 새로운 고정공고가 Firestore에 추가됨, **Then** 새 공고가 목록 맨 위에 자동으로 나타남
3. **Given** 고정공고 목록이 표시된 상태, **When** 기존 공고의 상태가 'closed'로 변경됨, **Then** 해당 공고가 목록에서 자동으로 사라짐

---

### User Story 2 - 고정공고 상세 정보 표시 (Priority: P2)

사용자가 고정공고 카드를 통해 공고의 핵심 정보(제목, 근무 조건, 모집 역할, 조회수)를 한눈에 확인할 수 있습니다. 다크모드에서도 가독성이 유지됩니다.

**Why this priority**: 고정공고의 핵심 정보를 명확하게 전달하여 사용자가 빠르게 지원 여부를 판단할 수 있도록 합니다. P1 이후 구현하여 UI/UX를 점진적으로 개선합니다.

**Independent Test**: 고정공고 카드에 제목, 근무 일수/시간, 모집 역할(직무명 + 인원), 조회수가 모두 표시되는지 확인합니다. 다크모드 토글 후 텍스트와 배경색이 적절히 변경되는지 검증합니다.

**Acceptance Scenarios**:

1. **Given** 고정공고 카드가 표시된 상태, **When** 사용자가 카드를 확인, **Then** 제목, 주 N일 근무, 시작-종료 시간, 모집 역할 목록, 조회수가 모두 표시됨
2. **Given** 라이트모드에서 카드 표시 중, **When** 사용자가 다크모드로 전환, **Then** 카드 배경이 gray-800, 텍스트가 gray-100/300으로 변경됨
3. **Given** 여러 역할(딜러 2명, 토너먼트 매니저 1명)이 필요한 공고, **When** 카드가 렌더링됨, **Then** "딜러 2명", "토너먼트 매니저 1명" 배지가 각각 표시됨

---

### User Story 3 - 고정공고 상세보기 및 지원 (Priority: P3)

사용자가 고정공고 카드를 클릭하면 상세 페이지로 이동하거나, 지원 버튼을 클릭하여 바로 지원 프로세스를 시작할 수 있습니다.

**Why this priority**: 기본 정보 조회(P1, P2)가 완성된 후 사용자 액션을 추가하여 완전한 워크플로를 완성합니다.

**Independent Test**: 카드 클릭 시 상세 페이지로 라우팅되는지, 지원 버튼 클릭 시 적절한 핸들러가 호출되는지 확인합니다.

**Acceptance Scenarios**:

1. **Given** 고정공고 카드가 표시된 상태, **When** 사용자가 카드 본문을 클릭, **Then** 공고 상세 페이지(`/job-postings/:id`)로 이동함
2. **Given** 고정공고 카드가 표시된 상태, **When** 사용자가 "지원하기" 버튼 클릭, **Then** onApply 핸들러가 해당 공고 데이터를 인자로 호출됨

---

### User Story 4 - 무한 스크롤로 추가 공고 로드 (Priority: P4)

사용자가 고정공고 목록을 스크롤하여 하단에 도달하면 자동으로 다음 페이지의 공고들이 로드되어 끊김 없는 탐색 경험을 제공합니다.

**Why this priority**: 초기 20개 이후 추가 공고를 탐색하기 위한 필수 기능이지만, 기본 조회 및 표시(P1-P3)가 완성된 후 구현하여 점진적으로 UX를 개선합니다.

**Independent Test**: 20개 이상의 공고가 존재할 때, 목록 하단으로 스크롤하면 자동으로 다음 20개가 로드되는지 확인합니다. IntersectionObserver가 목록 끝 요소를 감지하는지 검증합니다.

**Acceptance Scenarios**:

1. **Given** 고정공고가 30개 존재하고 초기 20개가 표시된 상태, **When** 사용자가 목록 하단으로 스크롤, **Then** 추가 10개가 자동으로 로드되어 총 30개가 표시됨
2. **Given** 무한 스크롤로 추가 데이터 로딩 중, **When** 사용자가 로딩 인디케이터를 확인, **Then** "로딩 중..." 메시지가 표시됨
3. **Given** 모든 공고(20개)가 이미 로드된 상태, **When** 사용자가 하단으로 스크롤, **Then** 추가 로딩이 발생하지 않고 "모든 공고를 확인했습니다" 메시지가 표시됨

---

### Edge Cases

- 고정공고가 하나도 없을 때: 빈 상태 메시지("현재 모집 중인 고정공고가 없습니다") 표시
- Firestore 연결 실패/타임아웃 시: 에러 메시지 표시 및 logger.error로 로깅
- requiredRolesWithCount 배열이 비어있을 때: "모집 역할 정보 없음" 표시
- viewCount가 undefined/null일 때: 0으로 처리하여 "조회 0" 표시
- 공고 데이터가 타입 불일치 시: validateFixedJobPosting 함수로 검증 후 logger.warn으로 경고
- 무한 스크롤 중 네트워크 오류 발생 시: 에러 토스트 표시, 수동 재시도 버튼 제공 (자동 재시도 없음)
- 모든 공고를 로드한 상태에서 스크롤 시: "모든 공고를 확인했습니다" 메시지 표시
- 무한 스크롤 로딩 중 사용자가 빠르게 스크롤 시: 중복 요청 방지 (debounce/throttle)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: useFixedJobPostings Hook은 Firestore의 jobPostings 컬렉션에서 postingType이 'fixed'이고 status가 'open'인 문서의 초기 20개만 onSnapshot으로 실시간 구독해야 합니다.
- **FR-002**: 구독된 고정공고 데이터는 createdAt 필드 기준 내림차순으로 정렬되어야 하며, 초기 로딩 시 최대 20개로 제한되어야 합니다.
- **FR-002a**: 무한 스크롤 구현 시 IntersectionObserver를 사용하여 목록 하단 요소를 감지하고, 감지 시 getDocs를 사용한 일회성 조회로 다음 20개의 공고를 자동으로 로드해야 합니다.
- **FR-002b**: 무한 스크롤로 로드된 추가 페이지 데이터는 실시간 구독을 사용하지 않으며, 페이지 새로고침 시에만 업데이트됩니다.
- **FR-002c**: 무한 스크롤 중 네트워크 오류 발생 시 자동 재시도를 수행하지 않으며, 사용자가 재시도 버튼을 클릭해야만 재요청을 수행해야 합니다.
- **FR-003**: Hook은 postings(배열), loading(boolean), error(Error | null), hasMore(boolean), loadMore(함수) 상태 및 함수를 반환해야 합니다.
- **FR-004**: 고정공고 저장 시 requiredRoles 필드는 fixedData.requiredRolesWithCount에서 역할 이름(name)만 추출하여 자동으로 동기화되어야 합니다.
- **FR-005**: FixedJobCard 컴포넌트는 posting, onApply, onViewDetail prop을 받아 고정공고 정보를 렌더링해야 합니다.
- **FR-006**: FixedJobCard는 다크모드 적용을 위해 모든 배경/텍스트 요소에 dark: 클래스를 포함해야 합니다.
- **FR-007**: validateFixedJobPosting 함수는 fixedConfig, fixedData 필드 존재 여부와 requiredRoles 동기화 상태를 검증하여 boolean을 반환해야 합니다.
- **FR-008**: requiredRoles와 requiredRolesWithCount가 불일치할 경우 logger.warn으로 경고를 기록해야 합니다.
- **FR-009**: Firestore 구독 해제(unsubscribe)는 useEffect cleanup 함수에서 자동으로 처리되어야 합니다.
- **FR-010**: 모든 로깅은 logger 유틸리티를 사용해야 하며, console.log/error는 사용하지 않아야 합니다.
- **FR-011**: FixedJobCard는 React.memo로 메모이제이션되어야 하며, onApply/onViewDetail은 useCallback으로 최적화되어야 합니다.
- **FR-012**: 조회수(viewCount)는 사용자가 상세 페이지(`/job-postings/:id`)로 이동할 때마다 1 증가되어야 하며, 중복 방지 로직을 적용하지 않습니다.

### Key Entities

- **FixedJobPosting**: 고정공고 정보를 나타내는 엔티티. 주요 속성으로 id(문서 ID), title(제목), postingType('fixed'), status(공고 상태), fixedConfig(고정공고 설정), fixedData(근무 일정, 모집 역할, 조회수 등 실제 데이터), requiredRoles(역할 이름 배열, requiredRolesWithCount와 동기화), createdAt(생성 시각)을 포함합니다.
- **FixedData**: 고정공고의 실제 운영 데이터. workSchedule(근무 일정: daysPerWeek, startTime, endTime), requiredRolesWithCount(역할별 모집 인원: name, count), viewCount(조회수)를 포함합니다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자가 JobBoard 페이지에 접속 시 500ms 이내에 고정공고 목록 로딩 상태(loading: true)가 표시되어야 합니다.
- **SC-002**: Firestore에서 새로운 고정공고가 추가되면 3초 이내에 화면에 자동으로 나타나야 합니다.
- **SC-003**: 고정공고 카드는 다크모드 전환 시 즉시(100ms 이내) UI가 변경되어야 합니다.
- **SC-004**: npm run type-check 실행 시 타입 에러가 0개여야 합니다.
- **SC-005**: requiredRoles와 requiredRolesWithCount가 불일치하는 공고가 발견될 경우 logger.warn이 호출되고 로그에 기록되어야 합니다.
- **SC-006**: 고정공고가 20개 이상 존재할 때 초기 렌더링 시 정확히 20개의 카드만 표시되어야 합니다.
- **SC-007**: 무한 스크롤 트리거 시 1초 이내에 다음 페이지 로딩이 시작되어야 합니다.
- **SC-008**: 무한 스크롤로 추가 공고 로드 시 중복 요청이 발생하지 않아야 합니다 (동일 페이지 재요청 0회).
