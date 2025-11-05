# Type Contracts: useJobPostingForm Hook

**Phase**: 1 (Design & Contracts)
**Date**: 2025-11-05
**Purpose**: useJobPostingForm Hook의 타입 계약을 정의하여, 컴포넌트와 Hook 간의 인터페이스를 명확히 합니다.

## 개요

이 문서는 useJobPostingForm Hook이 외부에 노출하는 API의 타입 계약을 정의합니다. 이 계약은 Hook을 사용하는 컴포넌트(JobPostingForm.tsx, JobPostingCard.tsx)와의 인터페이스를 보장합니다.

---

## Hook API Contract

### useJobPostingForm

**함수 시그니처**:
```typescript
function useJobPostingForm(
  initialData?: Partial<JobPosting>
): UseJobPostingFormReturn
```

**매개변수**:
- `initialData` (선택): 기존 구인공고 데이터 (수정 모드에서 사용)
  - 타입: `Partial<JobPosting>`
  - 설명: Firebase에서 로드한 기존 공고 데이터
  - 기본값: `undefined` (신규 생성 모드)

**반환 타입**:
```typescript
interface UseJobPostingFormReturn {
  // 상태
  formData: JobPostingFormData;
  setFormData: React.Dispatch<React.SetStateAction<JobPostingFormData>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;

  // 기본 핸들러
  handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  resetForm: () => void;
  setFormDataFromTemplate: (templateData: unknown) => void;

  // 일자별 요구사항 핸들러
  handleDateSpecificTimeSlotChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
  handleDateSpecificTimeToBeAnnouncedToggle: (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => void;
  handleDateSpecificTentativeDescriptionChange: (dateIndex: number, timeSlotIndex: number, description: string) => void;
  handleDateSpecificRoleChange: (
    dateIndex: number,
    timeSlotIndex: number,
    roleIndex: number,
    field: 'name' | 'count',
    value: string | number
  ) => void;

  // 사전질문 핸들러
  handlePreQuestionsToggle: (enabled: boolean) => void;
  handlePreQuestionChange: (questionIndex: number, field: string, value: unknown) => void;
  handlePreQuestionOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
  addPreQuestion: () => void;
  removePreQuestion: (index: number) => void;
  addPreQuestionOption: (questionIndex: number) => void;
  removePreQuestionOption: (questionIndex: number, optionIndex: number) => void;

  // 날짜 핸들러 (레거시 호환성)
  handleStartDateChange: (value: { year?: string; month?: string; day?: string }) => void;
  handleEndDateChange: (value: { year?: string; month?: string; day?: string }) => void;

  // 지역 핸들러
  handleDistrictChange: (district: string) => void;

  // 급여 핸들러
  handleSalaryTypeChange: (salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other') => void;
  handleSalaryAmountChange: (salaryAmount: string) => void;

  // 복리후생 핸들러
  handleBenefitToggle: (benefitType: keyof Benefits, checked: boolean) => void;
  handleBenefitChange: (benefitType: keyof Benefits, value: string) => void;

  // 역할별 급여 핸들러
  handleRoleSalaryToggle: (enabled: boolean) => void;
  handleAddRoleToSalary: () => void;
  handleRemoveRoleFromSalary: (role: string) => void;
  handleRoleChange: (oldRole: string, newRole: string) => void;
  handleRoleSalaryTypeChange: (role: string, salaryType: string) => void;
  handleRoleSalaryAmountChange: (role: string, salaryAmount: string) => void;
  handleCustomRoleNameChange: (role: string, customName: string) => void;
}
```

---

## 입력 타입 계약

### React.ChangeEvent 핸들러

**handleFormChange**:
```typescript
(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
```

**계약**:
- `e.target.name`: 폼 필드명 (예: "title", "description", "location")
- `e.target.value`: 입력값 (문자열)
- **부작용**: `setFormData`를 통해 해당 필드 업데이트
- **예외**: 없음 (모든 입력을 허용)

---

### 일자별 요구사항 핸들러

**handleDateSpecificTimeSlotChange**:
```typescript
(dateIndex: number, timeSlotIndex: number, value: string) => void
```

**계약**:
- `dateIndex`: 날짜 배열의 인덱스 (0-based)
- `timeSlotIndex`: 시간대 배열의 인덱스 (0-based)
- `value`: 시간 문자열 (HH:mm 형식 또는 "미정")
- **전제조건**: 인덱스가 유효한 범위 내에 있어야 함
- **부작용**: `formData.dateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].time` 업데이트
- **예외**: 인덱스 범위를 벗어나면 런타임 에러 발생 가능

**handleDateSpecificRoleChange**:
```typescript
(
  dateIndex: number,
  timeSlotIndex: number,
  roleIndex: number,
  field: 'name' | 'count',
  value: string | number
) => void
```

**계약**:
- `field === 'name'`이면 `value`는 `string` 타입이어야 함
- `field === 'count'`이면 `value`는 `number` 타입으로 변환됨
- **부작용**: 해당 역할의 필드 업데이트

---

### 사전질문 핸들러

**handlePreQuestionChange**:
```typescript
(questionIndex: number, field: string, value: unknown) => void
```

**계약**:
- `field`: PreQuestion 인터페이스의 필드명
- `value`: 해당 필드의 값 (타입은 필드에 따라 다름)
- **특별 처리**: `field === 'type'`이고 `value !== 'select'`이면 `options` 배열 제거
- **부작용**: `formData.preQuestions[questionIndex][field]` 업데이트

**addPreQuestion**:
```typescript
() => void
```

**계약**:
- **부작용**: `createNewPreQuestion()` 함수로 생성된 새 질문을 배열에 추가
- **예외**: 없음

**removePreQuestion**:
```typescript
(index: number) => void
```

**계약**:
- `index`: 제거할 질문의 인덱스
- **부작용**: 해당 인덱스의 질문 제거
- **예외**: 인덱스 범위를 벗어나면 아무 동작도 하지 않음 (filter 함수의 동작)

---

### 급여 핸들러

**handleSalaryAmountChange**:
```typescript
(salaryAmount: string) => void
```

**계약**:
- `salaryAmount`: 입력 문자열 (숫자 아닌 문자 포함 가능)
- **처리 로직**: 숫자만 추출하여 저장 (정규식: `/[^0-9]/g`)
- **부작용**: `formData.salaryAmount` 업데이트 (숫자 문자열만 포함)
- **예외**: 없음 (빈 문자열 허용)

**handleRoleSalaryAmountChange**:
```typescript
(role: string, salaryAmount: string) => void
```

**계약**:
- 동일한 숫자 필터링 로직 적용
- **부작용**: `formData.roleSalaries[role].salaryAmount` 업데이트

---

### 복리후생 핸들러

**handleBenefitToggle**:
```typescript
(benefitType: keyof Benefits, checked: boolean) => void
```

**계약**:
- `benefitType`: Benefits 인터페이스의 필드명
- `checked`: 체크박스 상태 (true/false)
- **특별 처리**: `benefitType === 'meal'`이고 `checked === true`이면 기본값 "제공" 자동 입력
- **부작용**: 체크되면 필드 생성 (또는 기본값 설정), 체크 해제되면 필드 제거 (`undefined`)

---

## 출력 타입 계약

### formData

**타입**: `JobPostingFormData`

**계약**:
- 항상 유효한 `JobPostingFormData` 타입이어야 함
- 필수 필드는 항상 정의되어 있어야 함
- 선택적 필드는 `undefined` 가능
- **불변성**: 직접 수정 금지, `setFormData`를 통해서만 업데이트

---

### 핸들러 함수

**계약**:
- 모든 핸들러 함수는 메모이제이션되어 있음 (`useCallback`)
- 핸들러 함수는 안정적 참조를 유지함 (의존성 배열이 빈 배열)
- **예외**: 외부 변수에 의존하는 핸들러는 의존성 배열에 해당 변수 포함

---

## 타입 안전성 보장

### 컴파일 타임 보장

1. **명시적 타입 지정**:
   - 모든 `useState`에 제네릭 타입 지정
   - 모든 `setFormData` 콜백에 명시적 타입 지정

2. **타입 추론 활용**:
   - 핸들러 함수의 매개변수 타입은 자동 추론
   - IDE 자동완성 및 타입 체크 정상 작동

3. **타입 가드 사용 (선택)**:
   - `setFormDataFromTemplate`: 외부 데이터의 런타임 검증

### 런타임 보장

1. **입력 검증**:
   - 숫자 필드는 정규식으로 필터링
   - 인덱스는 배열 범위 확인 (암묵적)

2. **에러 처리**:
   - 타입 가드 실패 시 logger 및 toast 사용
   - 예외 발생 시 적절한 에러 메시지 제공

---

## 호환성 보장

### 기존 컴포넌트와의 호환성

**JobPostingForm.tsx**:
- Hook 반환 타입 변경 없음
- 모든 핸들러 함수 시그니처 유지
- `formData` 구조 변경 없음

**JobPostingCard.tsx**:
- `formData` 읽기 전용 접근
- 타입 변경 없음

### Firebase 데이터와의 호환성

**JobPosting → JobPostingFormData 변환**:
- `Partial<JobPosting>`을 `initialData`로 받아 초기화
- 필수 필드는 기본값으로 채움 (`createInitialFormData`)
- 선택적 필드는 `undefined` 허용

**JobPostingFormData → JobPosting 변환**:
- Firebase 저장 시 별도 변환 함수 사용 (이 작업의 범위 밖)
- 타입 구조는 동일하므로 추가 변환 불필요

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-11-05 | 초기 타입 계약 정의 (any 타입 제거) |

---

## 다음 단계

이 타입 계약을 기반으로:

1. ✅ **Phase 1 완료**: 모든 타입 계약 정의 완료
2. 🔄 **Phase 2 진행**: `/speckit.tasks` 명령어로 tasks.md 생성
3. 💻 **구현 시작**: tasks.md의 작업 항목 순서대로 진행

---

**참고**: 이 계약은 useJobPostingForm Hook의 외부 인터페이스를 정의하며, 내부 구현은 변경 가능합니다. 계약만 준수하면 컴포넌트 수정 없이 Hook을 개선할 수 있습니다.
