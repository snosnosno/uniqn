# Feature Specification: 구인공고 타입 확장 시스템

**Feature Branch**: `001-job-posting-types`
**Created**: 2025-10-30
**Status**: Draft
**Input**: User description: "구인공고 시스템을 2가지 타입(application/fixed)에서 4가지 타입(regular/fixed/tournament/urgent)으로 확장하고, 향후 신규 타입 추가를 고려한 확장 가능한 아키텍처를 구축합니다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 일반 구인공고 작성 (Priority: P1)

일반 사용자가 무료로 일반 구인공고를 작성하여 특정 날짜에 필요한 스태프를 모집한다.

**Why this priority**: 가장 기본적이고 많이 사용되는 기능으로, 전체 시스템의 핵심 사용자 흐름을 대표한다. 이 기능만으로도 최소한의 구인공고 서비스 제공이 가능하다.

**Independent Test**: 사용자가 공고 작성 페이지에서 "지원" 타입을 선택하고, 필수 정보(제목, 설명, 위치, 날짜, 역할)를 입력하여 공고를 생성할 수 있으며, 생성된 공고가 "지원" 탭에 표시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 로그인되어 있고, **When** 공고 작성 폼에서 "지원(regular)" 타입을 선택하고 필수 정보를 입력하여 제출하면, **Then** 공고가 무료로 생성되고 "지원" 탭에 표시된다.
2. **Given** 지원 공고가 작성되어 있고, **When** 사용자가 동일한 날짜에 대해 다시 공고를 작성하면, **Then** 중복 날짜 공고가 정상적으로 생성된다.
3. **Given** 사용자가 지원 탭에 있고, **When** 날짜 슬라이더에서 특정 날짜(어제~+14일 범위)를 선택하면, **Then** 해당 날짜의 공고만 필터링되어 표시된다.
4. **Given** 사용자가 지원 탭에 있고, **When** 날짜 슬라이더에서 "오늘" 날짜를 선택하면, **Then** 오늘 날짜가 파란색으로 강조되어 표시된다.

---

### User Story 2 - 고정 공고 작성 및 기간 선택 (Priority: P2)

사용자가 유료 칩을 사용하여 고정 공고를 작성하고, 7일/30일/90일 중 기간을 선택하여 지속적으로 노출시킨다.

**Why this priority**: 수익화 모델의 핵심 기능으로, 사용자가 공고를 더 오래 노출시키고 싶을 때 사용하는 프리미엄 기능이다. P1 기능 이후에 추가되어도 서비스 운영에 지장이 없다.

**Independent Test**: 사용자가 공고 작성 시 "고정(fixed)" 타입을 선택하고, 노출 기간(7일/30일/90일)을 선택하면, 해당 기간 동안 "고정" 탭에 공고가 파란색 테두리와 📌 아이콘으로 표시되며, 칩 비용(3/5/10칩)이 명시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 로그인되어 있고, **When** 공고 작성 폼에서 "고정" 타입과 7일 기간을 선택하면, **Then** 3칩 비용이 표시되고, 공고 생성 시 칩 차감 여부(isChipDeducted: false)가 기록되며, 7일 동안 "고정" 탭에 노출된다.
2. **Given** 사용자가 고정 공고를 작성하고, **When** 30일 기간을 선택하면, **Then** 5칩 비용이 표시되고 공고가 30일 동안 노출된다.
3. **Given** 고정 공고가 생성되어 있고, **When** 사용자가 "고정" 탭을 조회하면, **Then** 공고가 파란색 좌측 테두리와 📌 아이콘으로 표시되고, 만료 날짜가 표시된다.
4. **Given** 고정 공고의 기간이 만료되었고, **When** 시스템이 자동으로 상태를 확인하면, **Then** 해당 공고가 "고정" 탭에서 제거되거나 만료 상태로 표시된다.

---

### User Story 3 - 대회 공고 작성 및 승인 요청 (Priority: P3)

사용자가 대규모 토너먼트 대회 공고를 무료로 작성하고, admin의 승인을 받아 "대회" 탭에 게시한다.

**Why this priority**: 특수한 이벤트성 공고로, 승인 프로세스가 필요하여 구현 복잡도가 높다. P1/P2 기능이 안정화된 후에 추가해도 서비스 운영에 큰 영향이 없다.

**Independent Test**: 사용자가 "대회(tournament)" 타입 공고를 작성하면 "승인 대기" 상태로 저장되고, admin이 승인하면 "대회" 탭에 보라색 테두리와 🏆 아이콘으로 표시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 로그인되어 있고, **When** 공고 작성 폼에서 "대회" 타입을 선택하고 제출하면, **Then** 공고가 "승인 대기" 상태로 저장되고, 게시판에는 표시되지 않는다.
2. **Given** 대회 공고가 승인 대기 상태이고, **When** admin이 승인 처리하면, **Then** 공고 상태가 "승인됨"으로 변경되고 "대회" 탭에 표시된다.
3. **Given** 대회 공고가 승인 대기 상태이고, **When** admin이 사유를 입력하여 거부하면, **Then** 공고 상태가 "거부됨"으로 변경되고, 작성자에게 거부 사유가 전달되며, 재신청이 가능해진다.
4. **Given** 대회 공고가 승인되어 있고, **When** 사용자가 "대회" 탭을 조회하면, **Then** 공고가 보라색 좌측 테두리와 🏆 아이콘으로 표시된다.

---

### User Story 4 - 긴급 공고 작성 및 즉시 노출 (Priority: P2)

사용자가 유료 칩(5칩 고정)을 사용하여 긴급 공고를 작성하고, "긴급" 탭에 빨간색으로 강조되어 즉시 노출시킨다.

**Why this priority**: 수익화 모델의 프리미엄 기능으로, 긴급하게 스태프를 구해야 하는 사용자를 위한 기능이다. 고정 공고(P2)와 함께 구현하면 수익화 전략을 완성할 수 있다.

**Independent Test**: 사용자가 "긴급(urgent)" 타입 공고를 작성하면, 5칩 비용이 표시되고, 공고가 "긴급" 탭에 빨간색 테두리, 깜빡이는 배지, 🚨 아이콘으로 표시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 로그인되어 있고, **When** 공고 작성 폼에서 "긴급" 타입을 선택하면, **Then** 5칩 고정 비용이 표시되고, 공고 생성 시 칩 차감 여부(isChipDeducted: false)가 기록된다.
2. **Given** 긴급 공고가 생성되어 있고, **When** 사용자가 "긴급" 탭을 조회하면, **Then** 공고가 빨간색 테두리, 깜빡이는 배지, 🚨 아이콘으로 표시되고, 칩 비용(5칩)이 명시된다.
3. **Given** 긴급 공고가 생성되어 있고, **When** 게시판에서 공고를 조회하면, **Then** 다른 타입보다 시각적으로 강조되어 표시된다.

---

### User Story 5 - 타입별 탭으로 공고 조회 (Priority: P1)

사용자가 게시판에서 5개 탭("지원", "고정", "대회", "긴급", "내지원")을 통해 공고를 타입별로 분류하여 조회한다.

**Why this priority**: 사용자가 공고를 효율적으로 탐색하고 찾을 수 있도록 하는 핵심 UI/UX 기능이다. 타입별 분류 없이는 공고 타입 확장의 의미가 없다.

**Independent Test**: 사용자가 각 탭을 클릭하면, 해당 타입의 공고만 필터링되어 표시되고, 각 공고가 타입별 시각적 스타일로 구분되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 게시판에 있고, **When** "지원" 탭을 클릭하면, **Then** regular 타입 공고만 표시되고, 날짜 슬라이더가 표시된다.
2. **Given** 사용자가 게시판에 있고, **When** "고정" 탭을 클릭하면, **Then** fixed 타입 공고만 파란색 테두리와 📌 아이콘으로 표시된다.
3. **Given** 사용자가 게시판에 있고, **When** "대회" 탭을 클릭하면, **Then** 승인된 tournament 타입 공고만 보라색 테두리와 🏆 아이콘으로 표시된다.
4. **Given** 사용자가 게시판에 있고, **When** "긴급" 탭을 클릭하면, **Then** urgent 타입 공고만 빨간색 테두리와 🚨 아이콘으로 표시된다.
5. **Given** 사용자가 게시판에 있고, **When** "내지원" 탭을 클릭하면, **Then** 사용자가 지원한 모든 타입의 공고가 표시된다.

---

### User Story 6 - 레거시 데이터 자동 변환 (Priority: P1)

기존의 application/fixed 타입 공고가 시스템 업데이트 후 자동으로 regular/fixed 타입으로 변환되어 정상 작동한다.

**Why this priority**: 시스템 마이그레이션의 필수 요구사항으로, 기존 데이터의 무결성과 하위 호환성을 보장해야 한다. 이 기능이 없으면 기존 사용자의 데이터가 손실되거나 오작동할 수 있다.

**Independent Test**: 기존 type/recruitmentType 필드를 가진 공고를 조회하면, normalizePostingType 함수가 자동으로 postingType 필드로 변환하여 정상 표시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 기존 공고의 type 필드가 'application'이고, **When** 시스템이 공고를 조회하면, **Then** postingType이 'regular'로 자동 변환되어 "지원" 탭에 표시된다.
2. **Given** 기존 공고의 recruitmentType 필드가 'fixed'이고, **When** 시스템이 공고를 조회하면, **Then** postingType이 'fixed'로 자동 변환되어 "고정" 탭에 표시된다.
3. **Given** 레거시 공고가 변환되어 있고, **When** 사용자가 해당 공고를 수정하면, **Then** 새로운 postingType 필드로 정상 저장되고, 기존 필드는 유지된다.

---

### Edge Cases

- **타입 필드 누락**: postingType 필드가 없거나 잘못된 값일 때, 시스템이 기본값(regular)으로 설정하고 경고 로그를 기록한다.
- **칩 부족**: 사용자가 고정/긴급 공고 작성 시 칩이 부족하면, 명확한 에러 메시지를 표시하고 공고 생성을 차단한다. (현재는 칩 차감 미구현이므로 UI 경고만 표시)
- **승인 대기 중 수정**: 대회 공고가 승인 대기 상태일 때 사용자가 수정하면, 승인 상태가 초기화되고 다시 승인 대기 상태가 된다.
- **만료된 고정 공고**: 고정 공고의 기간이 만료되었을 때, 자동으로 "고정" 탭에서 제거되거나 만료 상태로 표시되어야 한다.
- **날짜 슬라이더 범위 초과**: 사용자가 +14일 이후의 공고를 조회하려고 하면, 날짜 슬라이더 범위 외 공고는 표시되지 않는다.
- **중복 날짜 공고**: 지원 공고의 경우 동일 날짜에 여러 번 등록 가능하지만, 고정/대회/긴급 공고는 제한이 필요한지 확인해야 한다.
- **타입별 config 검증 실패**: fixedConfig, tournamentConfig, urgentConfig가 누락되거나 잘못된 값일 때, 공고 생성을 차단하고 명확한 에러 메시지를 표시한다.
- **admin 권한 없는 승인 시도**: 일반 사용자가 승인 API를 호출하면, 403 에러를 반환하고 로그를 기록한다.
- **XSS 공격**: 공고 제목/설명에 스크립트 태그를 입력하면, sanitizeInput 함수가 자동으로 제거하여 저장한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 4가지 공고 타입(regular, fixed, tournament, urgent)을 지원해야 한다.
- **FR-002**: 시스템은 postingType 필드를 사용하여 공고 타입을 단일화하고, 기존 type/recruitmentType 필드는 하위 호환성을 위해 유지해야 한다.
- **FR-003**: 사용자는 공고 작성 시 4가지 타입 중 하나를 선택할 수 있어야 한다.
- **FR-004**: 지원(regular) 공고는 무료이며, 단일 날짜에 여러 번 등록할 수 있어야 한다.
- **FR-005**: 고정(fixed) 공고는 유료이며, 7일(3칩), 30일(5칩), 90일(10칩) 중 기간을 선택할 수 있어야 한다.
- **FR-006**: 고정 공고는 fixedConfig 객체에 기간(durationDays), 칩 비용(chipCost), 만료일(expiresAt)을 포함해야 한다.
- **FR-007**: 대회(tournament) 공고는 무료이며, admin 승인이 필요해야 한다.
- **FR-008**: 대회 공고는 tournamentConfig 객체에 승인 상태(approvalStatus: pending/approved/rejected), 승인자(approvedBy), 승인일(approvedAt), 거부 사유(rejectionReason)를 포함해야 한다.
- **FR-009**: 긴급(urgent) 공고는 5칩 고정 비용이며, 즉시 노출되어야 한다.
- **FR-010**: 긴급 공고는 urgentConfig 객체에 칩 비용(chipCost: 5), 생성일(createdAt)을 포함해야 한다.
- **FR-011**: 게시판은 5개 탭(지원, 고정, 대회, 긴급, 내지원)으로 구성되어야 한다.
- **FR-012**: 각 탭은 해당 타입의 공고만 필터링하여 표시해야 한다.
- **FR-013**: "지원" 탭에는 날짜 슬라이더가 표시되어, 어제부터 +14일까지 총 16일 범위의 날짜별 필터링이 가능해야 한다.
- **FR-014**: 날짜 슬라이더는 상단에 "어제/오늘" 레이블, 하단에 "10.30, 10.31" 형식으로 표시되어야 한다.
- **FR-015**: 오늘 날짜는 파란색 배경으로 강조되어야 한다.
- **FR-016**: 날짜 슬라이더는 가로 스크롤을 지원하며, "전체" 버튼으로 필터를 해제할 수 있어야 한다.
- **FR-017**: 각 공고 타입은 고유한 시각적 스타일로 구분되어야 한다:
  - 지원: 회색 테두리, 📋 아이콘
  - 고정: 파란색 좌측 테두리, 📌 아이콘
  - 대회: 보라색 좌측 테두리, 🏆 아이콘
  - 긴급: 빨간색 테두리, 깜빡이는 배지, 🚨 아이콘
- **FR-018**: 고정 공고와 긴급 공고는 chipCost 필드를 포함하고, isChipDeducted 필드는 false로 설정되어야 한다. (실제 칩 차감은 나중에 구현)
- **FR-019**: 대회 공고의 승인은 admin 권한을 가진 사용자만 수행할 수 있어야 한다.
- **FR-020**: 대회 공고를 거부할 때 admin은 사유를 입력해야 하며, 작성자는 거부 사유를 확인하고 재신청할 수 있어야 한다.
- **FR-021**: 시스템은 기존 type/recruitmentType 필드를 가진 레거시 공고를 normalizePostingType 함수로 자동 변환하여 정상 작동시켜야 한다:
  - type='application' → postingType='regular'
  - recruitmentType='fixed' → postingType='fixed'
- **FR-022**: postingType 필드가 없거나 잘못된 값일 때, 시스템은 기본값 'regular'로 설정하고 경고 로그를 기록해야 한다.
- **FR-023**: 시스템은 타입별 config 검증을 수행하고, 검증 실패 시 공고 생성을 차단하고 명확한 에러 메시지를 표시해야 한다.
- **FR-024**: 시스템은 공고 제목/설명에 대한 XSS 방지를 위해 sanitizeInput 함수를 적용해야 한다.
- **FR-025**: 시스템은 chipCost 값 검증을 수행해야 한다:
  - fixed: 3, 5, 10 중 하나
  - urgent: 5 고정
- **FR-026**: 시스템은 향후 신규 타입 추가를 고려하여 확장 가능한 아키텍처를 구축해야 한다:
  - 중앙 집중식 칩 가격 관리 (config/chipPricing.ts)
  - 동적 탭 생성 시스템 (config/boardTabs.ts)
  - 타입별 검증 함수 분리 (Security Rules)
  - Feature Flag 기반 점진적 롤아웃
  - 타입별 메트릭 자동 수집
- **FR-027**: 시스템은 타입별 쿼리를 분리하여 성능을 최적화해야 한다. (전체 조회 금지)
- **FR-028**: 날짜 필터링은 클라이언트 측에서 처리하여 Firestore 쿼리 비용을 절감해야 한다.
- **FR-029**: 시스템은 3개의 Firestore 인덱스를 추가하여 쿼리 성능을 최적화해야 한다.
- **FR-030**: 시스템은 캐싱 전략(5분 TTL)을 적용하여 불필요한 Firestore 조회를 줄여야 한다.
- **FR-031**: 모든 UI 요소는 다크모드를 완벽하게 지원해야 한다. (dark: 클래스 적용)
- **FR-032**: TypeScript strict mode를 100% 준수하고, any 타입을 사용하지 않아야 한다.

### Key Entities

- **JobPosting**: 구인공고 엔티티
  - **핵심 속성**: id, title, description, location, postingType (regular/fixed/tournament/urgent), status (open/closed), createdAt, createdBy
  - **타입별 config**: fixedConfig, tournamentConfig, urgentConfig (선택적, 해당 타입일 때만 존재)
  - **칩 관련**: chipCost (고정/긴급 타입일 때), isChipDeducted (false로 설정, 나중에 구현)
  - **하위 호환성**: type, recruitmentType (레거시 필드, 읽기 전용)
  - **관계**: 여러 Application과 연결됨

- **FixedConfig**: 고정 공고 설정
  - **핵심 속성**: durationDays (7/30/90), chipCost (3/5/10), expiresAt (만료일)

- **TournamentConfig**: 대회 공고 설정
  - **핵심 속성**: approvalStatus (pending/approved/rejected), approvedBy (admin userId), approvedAt (승인일), rejectionReason (거부 사유)

- **UrgentConfig**: 긴급 공고 설정
  - **핵심 속성**: chipCost (5 고정), createdAt (생성일)

- **Application**: 지원서 엔티티
  - **핵심 속성**: id, jobPostingId, applicantId, status (pending/confirmed/cancelled), appliedAt
  - **관계**: 하나의 JobPosting에 속함

- **BoardTab**: 게시판 탭 설정 (동적 탭 생성 시스템용)
  - **핵심 속성**: id (regular/fixed/tournament/urgent/myApplications), label (한글/영어), icon, filterType, order (표시 순서)

- **ChipPricing**: 칩 가격 설정 (중앙 집중식 관리)
  - **핵심 속성**: postingType, durationDays (고정 공고일 때), chipCost

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자는 공고 작성 시 4가지 타입(regular, fixed, tournament, urgent) 중 하나를 선택할 수 있다.
- **SC-002**: 게시판에서 5개 탭(지원, 고정, 대회, 긴급, 내지원)으로 공고가 타입별로 분류되어 표시된다.
- **SC-003**: "지원" 탭에서 날짜 슬라이더를 사용하여 어제부터 +14일까지 16일 범위의 날짜별 공고를 조회할 수 있다.
- **SC-004**: 오늘 날짜가 파란색으로 강조되어 사용자가 쉽게 식별할 수 있다.
- **SC-005**: 대회 공고는 admin 승인 후에만 "대회" 탭에 노출되며, 승인 대기/승인됨/거부됨 상태가 명확히 표시된다.
- **SC-006**: 긴급 공고는 빨간색 테두리, 깜빡이는 배지, 🚨 아이콘으로 시각적으로 구분되며, 5칩 비용이 명시된다.
- **SC-007**: 고정 공고는 선택한 기간(7/30/90일) 동안 "고정" 탭에 노출되며, 파란색 테두리와 📌 아이콘으로 표시되고, 3/5/10칩 비용이 명시된다.
- **SC-008**: 기존 공고(레거시 데이터)는 자동으로 regular/fixed 타입으로 변환되어 정상 작동하며, 데이터 손실이 없다.
- **SC-009**: 향후 신규 타입(premium, sponsored 등) 추가 시 최소한의 코드 변경으로 확장 가능하다. (새 타입 추가 체크리스트 12단계를 따라 1시간 이내 추가 가능)
- **SC-010**: TypeScript strict mode 에러가 0개이며, any 타입이 사용되지 않는다.
- **SC-011**: 모든 UI 요소가 다크모드를 완벽하게 지원하며, dark: 클래스가 누락되지 않는다.
- **SC-012**: 타입별 쿼리 분리로 Firestore 조회 성능이 개선되며, 전체 조회가 발생하지 않는다.
- **SC-013**: 날짜 필터링은 클라이언트 측에서 처리되어 Firestore 쿼리 비용이 절감된다.
- **SC-014**: 캐싱 전략(5분 TTL) 적용으로 불필요한 Firestore 조회가 50% 이상 감소한다.
- **SC-015**: 보안 검증(postingType 필수, chipCost 값 검증, admin 권한 체크, XSS 방지)이 모두 적용되어 취약점이 없다.
