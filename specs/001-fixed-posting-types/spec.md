# Feature Specification: 고정공고 타입 시스템 확장

**Feature Branch**: `001-fixed-posting-types`
**Created**: 2025-11-23
**Status**: Draft
**Input**: 고정공고 타입 시스템 확장 - WorkSchedule, RoleWithCount, FixedJobPostingData, FixedJobPosting 타입 정의 및 Zod 스키마 추가

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 타입 안전성을 통한 개발자 경험 개선 (Priority: P1)

개발자가 고정공고 데이터를 다룰 때 TypeScript의 타입 시스템을 활용하여 컴파일 타임에 오류를 발견하고 IDE 자동완성을 통해 생산성을 높일 수 있습니다.

**Why this priority**: 이 기능은 모든 고정공고 관련 기능의 기반이 되는 타입 시스템입니다. 타입 정의가 먼저 완료되어야 이후 UI 컴포넌트, API 통합, 데이터 검증 등 모든 기능을 안전하게 개발할 수 있습니다.

**Independent Test**: 타입 정의 파일만 작성하고 `npm run type-check`를 실행하여 TypeScript 컴파일 오류가 없는지 확인할 수 있습니다. 이 단계만으로도 타입 시스템의 정확성을 검증할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** JobPosting 타입이 정의되어 있을 때, **When** 개발자가 `postingType: 'fixed'`인 객체를 생성하면, **Then** IDE가 `fixedConfig`와 `fixedData` 필드를 필수로 요구해야 함
2. **Given** FixedJobPosting 타입의 변수가 있을 때, **When** 개발자가 `fixedData.workSchedule`에 접근하면, **Then** IDE가 `daysPerWeek`, `startTime`, `endTime` 필드를 자동완성으로 제안해야 함
3. **Given** isFixedJobPosting 타입 가드를 사용할 때, **When** 조건문 내부에서 posting 변수에 접근하면, **Then** TypeScript가 해당 변수를 FixedJobPosting 타입으로 좁혀야 함

---

### User Story 2 - 런타임 데이터 검증 (Priority: P2)

개발자가 외부에서 받은 고정공고 데이터(Firebase, API 등)를 Zod 스키마로 검증하여 런타임 오류를 방지할 수 있습니다.

**Why this priority**: 타입 정의가 완료된 후에는 실제 데이터 검증이 필요합니다. 특히 Firebase와 같은 외부 소스에서 받은 데이터는 타입이 보장되지 않으므로 런타임 검증이 필수입니다.

**Independent Test**: Zod 스키마를 작성하고 테스트 데이터를 `fixedJobPostingSchema.parse()`로 검증하여 유효한 데이터는 통과하고 잘못된 데이터는 오류를 발생시키는지 확인할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** 유효한 고정공고 데이터가 있을 때, **When** `fixedJobPostingSchema.parse(data)`를 호출하면, **Then** 데이터가 성공적으로 파싱되어야 함
2. **Given** `daysPerWeek`가 0인 잘못된 데이터가 있을 때, **When** `workScheduleSchema.parse(data)`를 호출하면, **Then** "최소값은 1입니다" 오류가 발생해야 함
3. **Given** `startTime`이 "25:00" 형식인 잘못된 데이터가 있을 때, **When** `workScheduleSchema.parse(data)`를 호출하면, **Then** "HH:mm 형식이 아닙니다" 오류가 발생해야 함
4. **Given** `requiredRolesWithCount`가 빈 배열인 데이터가 있을 때, **When** `fixedJobPostingDataSchema.parse(data)`를 호출하면, **Then** "최소 1개 이상의 역할이 필요합니다" 오류가 발생해야 함

---

### User Story 3 - 레거시 코드 호환성 유지 (Priority: P3)

기존 코드에서 사용하던 `type` 또는 `recruitmentType` 필드가 있는 데이터도 정상적으로 처리되어야 하며, 개발자는 deprecated 경고를 통해 새로운 필드로 마이그레이션할 수 있습니다.

**Why this priority**: 기존 시스템에 이미 저장된 데이터나 레거시 코드와의 호환성을 유지해야 합니다. 하지만 새로운 기능 개발에는 영향을 주지 않으므로 우선순위가 낮습니다.

**Independent Test**: 레거시 필드를 포함한 테스트 데이터를 생성하고 `normalizePostingType` 헬퍼를 사용하여 올바르게 변환되는지 확인할 수 있습니다.

**Acceptance Scenarios**:

1. **Given** `type: 'fixed'` 필드를 가진 레거시 데이터가 있을 때, **When** `normalizePostingType(data)`를 호출하면, **Then** `postingType: 'fixed'`로 변환되어야 함
2. **Given** `recruitmentType: 'application'` 필드를 가진 레거시 데이터가 있을 때, **When** `normalizePostingType(data)`를 호출하면, **Then** `postingType: 'regular'`로 변환되어야 함
3. **Given** IDE에서 JobPosting 타입을 사용할 때, **When** 개발자가 `type` 또는 `recruitmentType` 필드에 접근하면, **Then** deprecated 경고가 표시되어야 함

---

### Edge Cases

- **빈 데이터**: `requiredRolesWithCount`가 빈 배열일 때 어떻게 처리할 것인가? → Zod 스키마에서 `.min(1)` 검증으로 거부
- **시간 형식 오류**: `startTime`이 "9:00" (한 자리 시간) 또는 "09:00:00" (초 포함) 형식일 때? → 정규식 `/^\d{2}:\d{2}$/`로 검증하여 거부
- **주 출근일수 초과**: `daysPerWeek`가 8 이상일 때? → Zod 스키마에서 `.max(7)` 검증으로 거부
- **음수 값**: `count`가 0 이하일 때? → Zod 스키마에서 `.min(1)` 검증으로 거부
- **타입 가드 오용**: `postingType`이 'fixed'이지만 `fixedConfig`가 없는 불완전한 데이터? → `isFixedJobPosting`이 `false`를 반환하여 타입 좁히기 실패
- **레거시 필드 충돌**: `type: 'fixed'`와 `postingType: 'regular'`가 동시에 존재할 때? → `normalizePostingType`이 `postingType` 우선으로 처리

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 고정공고 근무 일정을 표현하는 `WorkSchedule` 인터페이스를 제공해야 함
  - `daysPerWeek`: 1-7 범위의 정수
  - `startTime`: HH:mm 형식의 문자열
  - `endTime`: HH:mm 형식의 문자열

- **FR-002**: 시스템은 역할별 모집 인원을 표현하는 `RoleWithCount` 인터페이스를 제공해야 함
  - `name`: 빈 문자열이 아닌 역할명
  - `count`: 1 이상의 정수

- **FR-003**: 시스템은 고정공고 전용 데이터를 표현하는 `FixedJobPostingData` 인터페이스를 제공해야 함
  - `workSchedule`: WorkSchedule 타입
  - `requiredRolesWithCount`: 최소 1개 이상의 RoleWithCount 배열 (Source of truth)
  - `viewCount`: 0 이상의 정수 (기본값 0)

- **FR-004**: 시스템은 JobPosting을 확장한 `FixedJobPosting` 인터페이스를 제공해야 함
  - `postingType`: 리터럴 타입 'fixed'
  - `fixedConfig`: 필수 FixedConfig 타입
  - `fixedData`: 필수 FixedJobPostingData 타입

- **FR-005**: 시스템은 `isFixedJobPosting` 타입 가드 함수를 제공해야 함
  - `postingType === 'fixed'` 검사
  - `fixedConfig !== undefined` 검사
  - `fixedData !== undefined` 검사
  - 반환 타입: `posting is FixedJobPosting`

- **FR-006**: 시스템은 레거시 필드 `type`과 `recruitmentType`을 deprecated로 표시해야 함
  - JSDoc `@deprecated` 주석 포함
  - 대체 필드 안내: "postingType을 사용하세요"
  - 기존 데이터 호환성 설명 포함

- **FR-007**: 시스템은 Zod 스키마 `workScheduleSchema`를 제공해야 함
  - `daysPerWeek`: 1-7 정수 검증
  - `startTime`: `/^\d{2}:\d{2}$/` 정규식 검증
  - `endTime`: `/^\d{2}:\d{2}$/` 정규식 검증

- **FR-008**: 시스템은 Zod 스키마 `roleWithCountSchema`를 제공해야 함
  - `name`: 최소 1글자 문자열 검증
  - `count`: 1 이상 정수 검증

- **FR-009**: 시스템은 Zod 스키마 `fixedJobPostingDataSchema`를 제공해야 함
  - `workSchedule`: workScheduleSchema로 검증
  - `requiredRolesWithCount`: 최소 1개 roleWithCountSchema 배열 검증
  - `viewCount`: 0 이상 정수, 기본값 0

- **FR-010**: 시스템은 Zod 스키마 `fixedJobPostingSchema`를 제공해야 함
  - `jobPostingFormSchema`를 확장
  - `postingType`: 리터럴 'fixed' 검증
  - `fixedConfig`: fixedConfigSchema로 검증
  - `fixedData`: fixedJobPostingDataSchema로 검증

- **FR-011**: 시스템은 TypeScript strict mode를 100% 준수해야 함
  - `any` 타입 사용 금지
  - 모든 타입 명시적 정의
  - null/undefined 체크 필수

- **FR-012**: 시스템은 기존 JobPosting 필드를 수정하지 않고 확장만 해야 함
  - 기존 필드의 타입 변경 금지
  - 기존 필드의 옵셔널 여부 변경 금지
  - 새로운 필드만 추가 가능

- **FR-013**: 시스템은 `normalizePostingType` 헬퍼 함수를 유지해야 함
  - 레거시 필드를 새로운 `postingType`으로 변환
  - 기존 동작 변경 없음

### Key Entities

- **WorkSchedule**: 고정공고의 주간 근무 일정
  - 주 출근일수, 시작/종료 시간 포함
  - 시간은 HH:mm 형식 (24시간제)

- **RoleWithCount**: 모집하려는 역할과 인원수
  - 역할명 (예: "딜러", "플로어 매니저")
  - 각 역할별 필요 인원수

- **FixedJobPostingData**: 고정공고 전용 메타데이터
  - 근무 일정, 역할별 인원, 조회수 통합
  - 고정공고 타입에서만 사용

- **FixedJobPosting**: 고정공고 타입의 완전한 정의
  - JobPosting의 모든 필드 상속
  - 고정공고 전용 설정 및 데이터 추가

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 개발자가 고정공고 관련 코드를 작성할 때 `npm run type-check` 실행 시 타입 오류가 0개여야 함
- **SC-002**: IDE에서 FixedJobPosting 타입을 사용할 때 모든 필수 필드에 대한 자동완성이 제공되어야 함
- **SC-003**: 잘못된 형식의 고정공고 데이터에 대해 Zod 스키마가 100% 오류를 감지해야 함
- **SC-004**: 타입 가드 `isFixedJobPosting` 사용 시 TypeScript 컴파일러가 타입을 올바르게 좁혀야 함 (타입 오류 0개)
- **SC-005**: 모든 새로운 타입과 스키마에 JSDoc 주석이 작성되어 IDE에서 호버 시 설명이 표시되어야 함
- **SC-006**: 레거시 필드 사용 시 IDE에서 deprecated 경고가 표시되어야 함
