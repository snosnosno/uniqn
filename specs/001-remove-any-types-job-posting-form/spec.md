# Feature Specification: useJobPostingForm.ts any 타입 완전 제거

**Feature Branch**: `001-remove-any-types-job-posting-form`
**Created**: 2025-11-05
**Status**: Draft
**Input**: User description: "Phase 1-1: useJobPostingForm.ts any 타입 완전 제거 및 타입 안전성 확보"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 개발자의 안전한 폼 데이터 조작 (Priority: P1)

구인공고 폼을 관리하는 개발자는 타입 안전성이 보장된 Hook을 사용하여 런타임 에러를 사전에 방지하고, IDE의 자동완성과 타입 검사 기능을 통해 생산성을 향상시킬 수 있어야 합니다.

**Why this priority**: 타입 안전성은 전체 폼 시스템의 신뢰성과 직결되며, 런타임 에러를 컴파일 타임에 발견할 수 있게 합니다. 현재 28회의 `any` 타입 사용은 심각한 타입 무결성 문제를 야기하고 있습니다.

**Independent Test**:
- TypeScript 컴파일러를 통해 `any` 타입 사용 0회 확인 가능
- `npm run type-check` 명령어로 타입 에러 0개 검증 가능
- IDE에서 자동완성 및 타입 추론 정상 작동 확인 가능

**Acceptance Scenarios**:

1. **Given** 개발자가 useJobPostingForm Hook을 사용할 때, **When** 폼 데이터를 수정하는 핸들러를 호출하면, **Then** TypeScript가 올바른 타입을 추론하고 잘못된 타입 사용 시 컴파일 에러를 발생시켜야 함
2. **Given** 개발자가 중첩 객체(dateSpecificRequirements, preQuestions 등)를 조작할 때, **When** 필드에 접근하면, **Then** IDE가 정확한 자동완성을 제공하고 타입 체크가 정상 작동해야 함
3. **Given** 폼 데이터의 초기값을 설정할 때, **When** JobPostingFormData 타입으로 초기화하면, **Then** 모든 필수 필드가 명시적으로 정의되어야 하며, 타입 불일치 시 에러가 발생해야 함
4. **Given** 폼 핸들러가 실행될 때, **When** 상태 업데이트 함수가 호출되면, **Then** 이전 상태(prev)의 타입이 명시적으로 정의되어 안전한 타입 체크가 이루어져야 함

---

### User Story 2 - 런타임 타입 검증 (Priority: P2)

시스템은 폼 데이터의 런타임 무결성을 보장하기 위해 타입 가드 함수를 제공하여, Firebase에서 로드된 데이터나 외부 입력 데이터가 올바른 형식인지 검증할 수 있어야 합니다.

**Why this priority**: 컴파일 타임 타입 체크는 정적 코드에만 유효하며, Firebase 데이터나 사용자 입력처럼 런타임에 결정되는 데이터는 추가 검증이 필요합니다.

**Independent Test**:
- 타입 가드 함수에 유효/무효 데이터를 전달하여 올바른 결과 반환 확인
- 잘못된 형식의 데이터 로드 시 적절한 에러 처리 확인
- 단위 테스트로 각 타입 가드 함수 독립적 검증 가능

**Acceptance Scenarios**:

1. **Given** Firebase에서 JobPosting 데이터를 로드할 때, **When** 데이터 구조가 예상 타입과 다르면, **Then** 타입 가드 함수가 false를 반환하고 적절한 에러 메시지를 제공해야 함
2. **Given** 사용자가 템플릿 데이터를 불러올 때, **When** 필수 필드가 누락되었으면, **Then** 시스템이 기본값으로 필드를 채우거나 에러를 발생시켜야 함
3. **Given** 중첩 배열 데이터(preQuestions, dateSpecificRequirements)를 검증할 때, **When** 배열 요소의 타입이 올바르지 않으면, **Then** 검증 함수가 구체적인 오류 위치를 알려줘야 함

---

### User Story 3 - 기존 기능 호환성 유지 (Priority: P3)

타입 시스템 개선은 기존에 정상 작동하던 폼 저장, 로드, 수정 기능에 영향을 주지 않아야 하며, JobPostingForm.tsx와 JobPostingCard.tsx 컴포넌트는 수정 없이 계속 사용 가능해야 합니다.

**Why this priority**: 하위 호환성을 유지하면서 타입 안전성을 확보하는 것이 중요하며, 광범위한 리팩토링은 리스크를 증가시킵니다.

**Independent Test**:
- 기존 E2E 테스트 스위트 실행하여 폼 기능 정상 작동 확인
- 실제 Firebase 데이터로 폼 로드/저장 테스트
- 사용자 시나리오 기반 수동 테스트 수행

**Acceptance Scenarios**:

1. **Given** 기존 구인공고 데이터가 Firebase에 저장되어 있을 때, **When** 수정 페이지에서 데이터를 로드하면, **Then** 모든 필드가 올바르게 표시되어야 함
2. **Given** 사용자가 폼을 작성하여 저장할 때, **When** 새로운 타입 시스템을 거쳐 데이터가 저장되면, **Then** Firebase에 기존 스키마와 동일한 형식으로 저장되어야 함
3. **Given** JobPostingForm 컴포넌트가 useJobPostingForm Hook을 사용할 때, **When** Hook의 반환 타입이 변경되지 않았다면, **Then** 컴포넌트 코드 수정 없이 정상 작동해야 함

---

### Edge Cases

- **타입 변환 에러**: Firebase Timestamp와 JavaScript Date 객체 간 변환 시 타입 불일치 처리
- **부분적 데이터**: 일부 optional 필드만 있는 Partial<JobPostingFormData> 처리
- **레거시 데이터**: 이전 스키마 버전의 데이터를 새 타입 시스템으로 마이그레이션할 때 누락 필드 처리
- **빈 배열 vs undefined**: preQuestions, dateSpecificRequirements 등 배열 필드의 빈 상태 표현 통일
- **중첩 Optional 체인**: roleSalaries?.[role]?.salaryAmount처럼 깊은 중첩 객체의 타입 안전성 보장
- **타입 좁히기 실패**: Union 타입(예: salaryType)을 조건문에서 좁힐 때 타입스크립트가 인식하지 못하는 경우
- **잘못된 JSON 데이터**: 외부에서 받은 JSON 데이터가 타입과 맞지 않을 때 안전한 파싱

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 useJobPostingForm.ts 파일에서 모든 `any` 타입 사용을 제거해야 함 (28회 → 0회)
- **FR-002**: 시스템은 JobPostingFormData 인터페이스를 완전히 정의하여 모든 필드에 명시적 타입을 부여해야 함
- **FR-003**: 시스템은 중첩 객체 타입을 별도 인터페이스로 정의해야 함:
  - DateSpecificRequirement (날짜별 인원 요구사항)
  - PreQuestion (사전 질문)
  - Benefits (복리후생)
  - RoleRequirement (역할 요구사항)
  - TimeSlot (시간대 정보)
- **FR-004**: 시스템은 모든 useState Hook에 명시적 제네릭 타입을 지정해야 함 (예: `useState<JobPostingFormData>`)
- **FR-005**: 시스템은 모든 setFormData 콜백의 prev 매개변수에 명시적 타입을 지정해야 함 (예: `(prev: JobPostingFormData) => ...`)
- **FR-006**: 시스템은 useCallback의 의존성 배열을 정확히 명시하여 타입 안전성과 메모이제이션 최적화를 보장해야 함
- **FR-007**: 시스템은 타입 가드 함수를 제공하여 런타임 타입 검증을 수행해야 함:
  - isValidJobPostingFormData(data: unknown): data is JobPostingFormData
  - isValidPreQuestion(question: unknown): question is PreQuestion
  - isValidDateSpecificRequirement(req: unknown): req is DateSpecificRequirement
- **FR-008**: 시스템은 기존 컴포넌트 API(반환 타입, 함수 시그니처)를 변경하지 않아야 함
- **FR-009**: 시스템은 Firebase 필드명 표준(staffId, eventId)을 유지하고 타입 정의에 반영해야 함
- **FR-010**: 시스템은 다크모드 관련 코드에 영향을 주지 않아야 함
- **FR-011**: 시스템은 console.log 대신 logger를 사용하는 기존 규칙을 준수해야 함

### Key Entities *(include if feature involves data)*

- **JobPostingFormData**: 구인공고 폼의 전체 데이터 구조를 정의하는 핵심 인터페이스. 기존에 `any` 타입으로 처리되던 모든 필드를 명시적으로 정의함. 필수 필드(title, description, location 등)와 선택적 필드(contactPhone, detailedAddress 등)를 명확히 구분함.

- **DateSpecificRequirement**: 특정 날짜의 인원 요구사항을 나타내는 타입. date(날짜), timeSlots(시간대 배열) 필드를 포함하며, 각 시간대는 TimeSlot 타입으로 정의됨.

- **TimeSlot**: 각 시간대별 근무 정보를 정의. time(시작 시간), roles(역할별 필요 인원), isTimeToBeAnnounced(미정 여부), tentativeDescription(미정 설명) 필드를 포함함.

- **PreQuestion**: 지원자에게 추가로 물어보는 사전 질문. id(고유 ID), question(질문 내용), required(필수 여부), type(질문 타입: text/textarea/select), options(선택형 옵션 배열) 필드를 포함함.

- **Benefits**: 복리후생 정보. guaranteedHours(보장시간), clothing(복장 지원), meal(식사 제공), transportation(교통비), mealAllowance(식비), accommodation(숙소), isPerDay(일당 기반 여부) 필드를 포함함.

- **RoleRequirement**: 역할별 필요 인원 정의. name(역할명), count(필요 인원 수) 필드로 구성됨.

- **SalaryInfo**: 급여 정보 타입. salaryType(급여 유형: hourly/daily/monthly/negotiable/other), salaryAmount(급여 금액), customRoleName(기타 역할명) 필드를 포함함.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: TypeScript 컴파일러가 useJobPostingForm.ts에서 `any` 타입 사용을 0회로 보고해야 함 (현재 28회 → 목표 0회)
- **SC-002**: `npm run type-check` 실행 시 에러가 0개여야 함
- **SC-003**: `npm run lint` 실행 시 타입 관련 경고가 0개여야 함
- **SC-004**: 기존 구인공고 폼 저장/로드 기능이 100% 정상 작동해야 함 (수동 테스트 통과)
- **SC-005**: JobPostingForm.tsx와 JobPostingCard.tsx 파일이 수정 없이 정상 동작해야 함 (변경 사항 0줄)
- **SC-006**: IDE에서 폼 데이터 필드 접근 시 자동완성이 100% 제공되어야 함 (any 타입으로 인한 자동완성 실패 0건)
- **SC-007**: 타입 가드 함수가 유효한 데이터에 대해 true를 반환하고, 무효한 데이터에 대해 false를 반환해야 함 (정확도 100%)
- **SC-008**: 코드 리뷰에서 타입 안전성 관련 승인을 받아야 함
- **SC-009**: 메모이제이션 성능이 기존과 동일하거나 향상되어야 함 (useCallback 의존성 배열 정확도 100%)

### Definition of Done

- 모든 `any` 타입 제거 완료
- TypeScript strict mode 100% 통과
- 기존 기능 정상 작동 확인
- 코드 리뷰 승인
- 문서 업데이트 완료

## Assumptions

- 기존 JobPosting 타입 정의(jobPosting.ts, base.ts)는 이미 정확하며 수정이 필요 없다고 가정
- Firebase Firestore 스키마는 현재 타입 정의와 일치한다고 가정
- 기존 구인공고 데이터는 모두 유효한 형식으로 저장되어 있다고 가정
- 성능 저하 없이 타입 안전성을 확보할 수 있다고 가정 (메모이제이션 유지)
- Zod 스키마 추가는 선택 사항이며, 우선순위가 낮다고 가정
- 타입 변경으로 인한 Breaking Change는 발생하지 않는다고 가정 (기존 API 유지)

## Out of Scope

- JobPostingForm.tsx, JobPostingCard.tsx 파일의 리팩토링
- Zod 스키마 추가 (선택 사항으로 남김)
- Firebase Firestore 스키마 변경
- 새로운 폼 기능 추가
- UI/UX 개선
- 다크모드 관련 수정
- 다른 Hook 파일의 타입 개선 (별도 Phase로 진행)
- E2E 테스트 추가 (기존 테스트만 통과하면 됨)
- 성능 최적화 (기존 성능 유지만 목표)

## Dependencies

- TypeScript 4.9+ (Strict Mode 지원)
- 기존 타입 정의 파일:
  - app2/src/types/jobPosting/jobPosting.ts
  - app2/src/types/jobPosting/base.ts
- 기존 유틸리티 함수:
  - app2/src/utils/jobPosting/jobPostingHelpers.ts
- 테스트 환경:
  - npm run type-check
  - npm run lint
  - 수동 폼 테스트 환경

## Notes

- 이 작업은 전체 타입 안전성 확보 프로젝트의 Phase 1-1에 해당함
- 다음 단계(Phase 1-2)에서는 JobPostingForm.tsx 등 컴포넌트 파일의 타입 개선을 진행할 예정
- 타입 가드 함수는 선택 사항이지만, Firebase 데이터 검증에 유용하므로 추가 권장
- logger 사용 규칙은 기존 프로젝트 컨벤션을 따름 (console.log 금지)
