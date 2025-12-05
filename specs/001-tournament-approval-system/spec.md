# Feature Specification: 대회공고 승인 시스템 완성

**Feature Branch**: `001-tournament-approval-system`
**Created**: 2025-12-01
**Completed**: 2025-12-05
**Status**: ✅ Completed (Merged to master)
**Input**: 대회공고(postingType: 'tournament') 작성 시 관리자 승인이 필요하며, 승인된 공고만 구인구직 페이지의 대회탭에 표시된다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 대회탭에서 승인된 공고만 조회 (Priority: P1)

일반 사용자가 구인구직 페이지의 대회탭을 클릭하면, 관리자가 승인한 대회공고만 목록에 표시된다. 승인 대기 중(pending)이거나 거부된(rejected) 공고는 대회탭에 표시되지 않는다.

**Why this priority**: 승인 시스템의 핵심 목적이 승인된 공고만 공개하는 것이므로, 이 기능이 작동하지 않으면 전체 시스템이 무의미함

**Independent Test**: 대회탭 클릭 시 approvalStatus가 'approved'인 공고만 표시되는지 확인. pending/rejected 공고가 목록에 없어야 함

**Acceptance Scenarios**:

1. **Given** 대회공고 3개가 존재 (approved 1개, pending 1개, rejected 1개), **When** 사용자가 대회탭을 클릭, **Then** approved 상태인 1개의 공고만 목록에 표시됨
2. **Given** 승인된 대회공고가 없음, **When** 사용자가 대회탭을 클릭, **Then** "등록된 대회 공고가 없습니다" 메시지 표시
3. **Given** 관리자가 pending 공고를 승인함, **When** 사용자가 대회탭을 새로고침, **Then** 새로 승인된 공고가 목록에 즉시 표시됨

---

### User Story 2 - 대회공고 작성 시 자동 pending 상태 설정 (Priority: P1)

업주가 대회공고를 작성하고 저장하면, 해당 공고는 자동으로 '승인 대기(pending)' 상태로 설정되고, 관리자 승인 페이지에 표시된다.

**Why this priority**: 공고 생성 시 pending 상태가 설정되지 않으면 승인 워크플로우가 작동하지 않음

**Independent Test**: 대회공고 생성 후 Firestore에서 tournamentConfig.approvalStatus가 'pending'이고 submittedAt이 설정되었는지 확인

**Acceptance Scenarios**:

1. **Given** 업주가 공고작성 페이지에서 대회공고 타입 선택, **When** 필수 정보 입력 후 저장, **Then** 공고가 approvalStatus: 'pending', submittedAt: 현재시간으로 저장됨
2. **Given** 대회공고가 pending 상태로 저장됨, **When** 관리자가 승인 관리 페이지 접속, **Then** 해당 공고가 승인 대기 목록에 표시됨
3. **Given** 업주가 대회공고 저장 완료, **When** 구인구직 대회탭 확인, **Then** 본인의 pending 공고는 대회탭에 표시되지 않음

---

### User Story 3 - 거부된 공고의 사유 확인 (Priority: P2)

업주가 자신의 공고가 거부되었을 때, 거부 사유를 확인할 수 있어야 한다. 알림 또는 내 공고 목록에서 거부 상태와 사유를 확인할 수 있다.

**Why this priority**: 거부 사유를 모르면 재제출 시 같은 실수를 반복할 수 있음. 사용자 경험 향상에 중요

**Independent Test**: 거부된 공고가 있는 업주가 알림 센터 또는 내 공고 목록에서 거부 사유를 확인할 수 있는지 테스트

**Acceptance Scenarios**:

1. **Given** 관리자가 대회공고를 거부하며 사유 입력, **When** 업주가 알림 센터 확인, **Then** "공고가 거부되었습니다. 사유: [거부사유]" 알림 표시
2. **Given** 업주의 대회공고가 거부됨, **When** 업주가 내 공고 관리 페이지 접속, **Then** 해당 공고에 "거부됨" 배지와 거부 사유가 표시됨
3. **Given** 공고가 거부 상태, **When** 업주가 거부 사유 확인, **Then** 거부 사유 전문이 표시되고 거부일시도 함께 표시됨

---

### User Story 4 - 거부된 공고 재제출 (Priority: P2)

업주가 거부된 공고를 수정하여 다시 승인 요청할 수 있다. 재제출된 공고는 다시 pending 상태가 되어 관리자 검토를 받는다.

**Why this priority**: 재제출 기능이 없으면 거부 후 처음부터 새로 작성해야 하므로 사용자 경험 저하

**Independent Test**: 거부된 공고의 재제출 버튼 클릭 후 approvalStatus가 pending으로 변경되고 resubmittedAt이 기록되는지 확인

**Acceptance Scenarios**:

1. **Given** 업주의 대회공고가 거부됨, **When** 업주가 공고 수정 후 "재제출" 버튼 클릭, **Then** approvalStatus가 'pending'으로 변경되고 resubmittedAt 기록
2. **Given** 공고가 재제출됨, **When** 관리자가 승인 관리 페이지 접속, **Then** 재제출된 공고가 "재제출" 표시와 함께 목록에 표시됨
3. **Given** 거부된 공고 존재, **When** 업주가 내용 수정 없이 재제출 시도, **Then** 재제출이 정상 처리됨 (내용 수정은 선택사항)

---

### User Story 5 - Firestore 쿼리 성능 최적화 (Priority: P3)

대회탭에서 승인된 공고를 조회할 때 빠른 응답 속도를 보장하기 위해 적절한 인덱스가 설정되어야 한다.

**Why this priority**: 기능적으로는 인덱스 없이도 동작하지만, 데이터 증가 시 성능 저하 발생 가능

**Independent Test**: 대회탭 로딩 시간이 1초 이내인지 확인, Firestore 콘솔에서 인덱스 경고가 없는지 확인

**Acceptance Scenarios**:

1. **Given** 복합 인덱스가 설정됨 (postingType + approvalStatus + createdAt), **When** 대회탭 조회, **Then** Firestore 콘솔에 인덱스 누락 경고 없음
2. **Given** 대회공고 100개 이상 존재, **When** 대회탭 첫 로딩, **Then** 1초 이내에 목록 표시

---

### Edge Cases

- 관리자가 승인 처리 중 네트워크 오류 발생 시 어떻게 되는가? → 에러 메시지 표시 후 재시도 가능
- 동시에 두 관리자가 같은 공고를 승인/거부 시도 시 어떻게 되는가? → 먼저 처리된 액션만 반영, 후속 시도는 "이미 처리됨" 오류
- 업주가 pending 상태의 공고를 삭제하면 어떻게 되는가? → 정상 삭제 처리, 승인 대기 목록에서 자동 제거
- 거부 사유가 10자 미만일 때 어떻게 되는가? → 프론트엔드/백엔드에서 검증 후 에러 메시지 표시

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 대회탭에서 approvalStatus가 'approved'인 공고만 표시되어야 함
- **FR-002**: 대회공고 생성 시 자동으로 tournamentConfig.approvalStatus: 'pending' 설정
- **FR-003**: 대회공고 생성 시 자동으로 tournamentConfig.submittedAt에 현재 시간 설정
- **FR-004**: 거부된 공고의 업주는 알림 또는 내 공고 페이지에서 거부 사유를 확인할 수 있어야 함
- **FR-005**: 거부된 공고에는 "거부됨" 상태 배지와 거부 사유가 표시되어야 함
- **FR-006**: 업주는 거부된 공고를 수정 후 재제출할 수 있어야 함
- **FR-007**: 재제출 시 approvalStatus는 'pending'으로 변경되고 resubmittedAt이 기록되어야 함
- **FR-008**: 재제출된 공고는 관리자 승인 페이지에서 "재제출" 표시와 함께 표시되어야 함
- **FR-009**: Firestore에 postingType + tournamentConfig.approvalStatus + createdAt 복합 인덱스 추가

### Key Entities

- **TournamentConfig**: 대회공고의 승인 관련 상태를 관리. approvalStatus(pending/approved/rejected), submittedAt, approvedBy, approvedAt, rejectedBy, rejectedAt, rejectionReason, resubmittedAt 속성 포함
- **JobPosting**: 구인공고 정보. postingType이 'tournament'일 때 tournamentConfig 필드 사용
- **Notification**: 사용자 알림. 거부 시 userId, type, message, data(거부사유 포함) 저장

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 대회탭에서 pending/rejected 상태의 공고가 0개 표시됨 (100% 필터링 정확도)
- **SC-002**: 대회공고 생성 후 100% 확률로 pending 상태 및 submittedAt이 자동 설정됨
- **SC-003**: 거부된 공고의 업주가 거부 사유를 2클릭 이내에 확인 가능
- **SC-004**: 재제출 기능 사용 시 pending 상태로 전환 성공률 100%
- **SC-005**: 대회탭 로딩 시간 1초 이내 (100개 공고 기준)
- **SC-006**: 관리자가 승인/거부 후 업주에게 알림이 10초 이내 전달됨

## Assumptions

- 기존 ApprovalManagementPage, useJobPostingApproval Hook, Firebase Functions(approveJobPosting, rejectJobPosting), onTournamentApprovalChange 트리거가 정상 작동함
- TournamentConfig 타입 및 관련 필드가 이미 정의되어 있음
- 알림 시스템(notifications 컬렉션, NotificationsPage)이 구현되어 있음
- 업주는 자신이 작성한 공고만 수정/재제출 가능 (기존 권한 체계 활용)

## Out of Scope

- 승인 이력 관리 (향후 기능)
- 대량 승인/거부 기능
- 승인 자동화 규칙
- 승인 통계 대시보드
