# Data Model: useJobPostingForm.ts 타입 정의

**Phase**: 1 (Design & Contracts)
**Date**: 2025-11-05
**Purpose**: useJobPostingForm Hook의 타입 구조를 명확히 정의하고, 기존 타입 정의와의 관계를 문서화합니다.

## 개요

이 문서는 useJobPostingForm Hook에서 사용하는 모든 타입을 정의하고, any 타입을 제거하기 위한 명시적 타입 구조를 제공합니다.

## 핵심 엔티티

### 1. JobPostingFormData (Main Entity)

구인공고 폼의 전체 데이터를 관리하는 핵심 인터페이스입니다.

```typescript
interface JobPostingFormData {
  // 필수 필드
  title: string;
  type: string;
  description: string;
  location: string;
  status: 'open' | 'closed';
  postingType: PostingType; // 'regular' | 'fixed' | 'tournament' | 'urgent'
  dateSpecificRequirements: DateSpecificRequirement[];

  // 선택적 필드
  detailedAddress?: string;
  district?: string;
  contactPhone?: string;
  requiredRoles?: string[];

  // 사전질문 관련
  usesPreQuestions?: boolean;
  preQuestions?: PreQuestion[];

  // 급여 정보
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;

  // 복리후생
  benefits?: Benefits;

  // 역할별 급여
  useRoleSalary?: boolean;
  roleSalaries?: RoleSalaries;

  // 세금 설정
  taxSettings?: TaxSettings;

  // 공고 타입별 설정
  fixedConfig?: FixedConfig;
  tournamentConfig?: TournamentConfig;
  urgentConfig?: UrgentConfig;
}
```

**관계**:
- `dateSpecificRequirements`: DateSpecificRequirement[] (1:N)
- `preQuestions`: PreQuestion[] (1:N)
- `benefits`: Benefits (1:1)
- `roleSalaries`: RoleSalaries (1:N)

**검증 규칙**:
- `title`: 비어있지 않아야 함 (길이 > 0)
- `description`: 비어있지 않아야 함 (길이 > 0)
- `location`: 비어있지 않아야 함 (길이 > 0)
- `dateSpecificRequirements`: 최소 1개 이상의 날짜 요구사항 필요
- `postingType`: 반드시 'regular', 'fixed', 'tournament', 'urgent' 중 하나
- `salaryAmount`: 숫자 문자열만 허용 (정규식: /^[0-9]+$/)

**상태 전이**:
- `status`: 'open' ⇄ 'closed' (양방향 전환 가능)

---

### 2. DateSpecificRequirement (Nested Entity)

특정 날짜의 인원 요구사항을 나타냅니다.

```typescript
interface DateSpecificRequirement {
  date: string | Timestamp | { seconds: number };
  timeSlots: TimeSlot[];
  isMainDate?: boolean;
  displayOrder?: number;
  description?: string;
}
```

**필드 설명**:
- `date`: 날짜 (yyyy-MM-dd 형식 문자열, Firebase Timestamp, 또는 초 단위 객체)
- `timeSlots`: 해당 날짜의 시간대별 요구사항 배열
- `isMainDate`: 메인 행사 날짜 여부 (선택)
- `displayOrder`: 표시 순서 (선택)
- `description`: 날짜 설명 (예: "Day 1", "예선전") (선택)

**관계**:
- `timeSlots`: TimeSlot[] (1:N)

**검증 규칙**:
- `timeSlots`: 최소 1개 이상의 시간대 필요

---

### 3. TimeSlot (Nested Entity)

각 시간대별 근무 정보를 정의합니다.

```typescript
interface TimeSlot {
  time: string;
  roles: RoleRequirement[];
  date?: string;

  // 미정 기능
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;

  // 종료 시간 및 날짜
  endTime?: string;
  endDate?: string;
  isFullDay?: boolean;
  endsNextDay?: boolean;

  // 기간 설정
  duration?: {
    type: 'single' | 'multi';
    endDate?: string;
  };
}
```

**필드 설명**:
- `time`: 시작 시간 (HH:mm 형식)
- `roles`: 역할별 필요 인원 배열
- `date`: 특정 날짜 (yyyy-MM-dd 형식) (선택)
- `isTimeToBeAnnounced`: 시간 미정 여부 (선택)
- `tentativeDescription`: 미정 시 추가 설명 (선택)
- `endTime`: 종료 시간 (HH:mm 형식) (선택)
- `endDate`: 종료 날짜 (선택)
- `isFullDay`: 당일 전체 운영 여부 (선택)
- `endsNextDay`: 다음날 종료 여부 (선택)
- `duration`: 기간 설정 (선택)

**관계**:
- `roles`: RoleRequirement[] (1:N)

**검증 규칙**:
- `time`: HH:mm 형식 (정규식: /^([01]\d|2[0-3]):([0-5]\d)$/) 또는 "미정"
- `roles`: 최소 1개 이상의 역할 필요
- `isTimeToBeAnnounced`가 true이면 `time`은 "미정"이어야 함

---

### 4. RoleRequirement (Nested Entity)

역할별 필요 인원을 정의합니다.

```typescript
interface RoleRequirement {
  name: string;
  count: number;
}
```

**필드 설명**:
- `name`: 역할명 (예: "딜러", "플로어", "서빙")
- `count`: 필요 인원 수

**검증 규칙**:
- `name`: 비어있지 않아야 함
- `count`: 양의 정수 (> 0)

---

### 5. PreQuestion (Nested Entity)

지원자에게 추가로 물어보는 사전 질문을 정의합니다.

```typescript
interface PreQuestion {
  id: string;
  question: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}
```

**필드 설명**:
- `id`: 질문 고유 ID
- `question`: 질문 내용
- `required`: 필수 응답 여부
- `type`: 질문 타입
- `options`: 선택형 질문의 옵션 배열 (type이 'select'일 때만 사용)

**검증 규칙**:
- `question`: 비어있지 않아야 함
- `type`이 'select'이면 `options` 배열이 필수이며, 최소 1개 이상의 옵션 필요
- `type`이 'text' 또는 'textarea'이면 `options`는 빈 배열 또는 undefined

---

### 6. Benefits (Nested Entity)

복리후생 정보를 정의합니다.

```typescript
interface Benefits {
  guaranteedHours?: string;
  clothing?: string;
  meal?: string;
  transportation?: string;
  mealAllowance?: string;
  accommodation?: string;
  isPerDay?: boolean;
}
```

**필드 설명**:
- `guaranteedHours`: 보장시간 (선택)
- `clothing`: 복장 관련 지원 (선택)
- `meal`: 식사 제공 여부 (선택)
- `transportation`: 교통비 지원 (일당) (선택)
- `mealAllowance`: 식비 지원 (일당) (선택)
- `accommodation`: 숙소 제공 여부 (일당) (선택)
- `isPerDay`: 일당 기반 계산 여부 (기본값: true) (선택)

**검증 규칙**:
- 모든 필드는 선택 사항이지만, 사용 시 비어있지 않은 문자열이어야 함

---

### 7. RoleSalaries (Nested Entity)

역할별 급여 정보를 정의합니다.

```typescript
type RoleSalaries = {
  [role: string]: RoleSalaryInfo;
};

interface RoleSalaryInfo {
  salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount: string;
  customRoleName?: string;
}
```

**필드 설명**:
- `role` (key): 역할 ID (예: "dealer", "floor", "serving")
- `salaryType`: 급여 유형
- `salaryAmount`: 급여 금액
- `customRoleName`: 기타 선택 시 직접 입력한 역할명 (선택)

**검증 규칙**:
- `salaryType`이 'negotiable'이 아니면 `salaryAmount`는 숫자 문자열이어야 함
- `salaryType`이 'negotiable'이면 `salaryAmount`는 빈 문자열 가능

---

### 8. TaxSettings (Nested Entity)

세금 설정을 정의합니다.

```typescript
interface TaxSettings {
  enabled: boolean;
  taxRate?: number;
  taxAmount?: number;
}
```

**필드 설명**:
- `enabled`: 세금 적용 여부
- `taxRate`: 세율 (%) - 비율 기반 계산 (선택)
- `taxAmount`: 고정 세금 - 고정 금액 계산 (선택)

**검증 규칙**:
- `enabled`가 true이면 `taxRate` 또는 `taxAmount` 중 하나는 반드시 있어야 함
- `taxRate`와 `taxAmount`는 동시에 사용할 수 없음 (상호 배타적)

---

### 9. 공고 타입별 설정 (Nested Entities)

#### FixedConfig
```typescript
interface FixedConfig {
  durationDays: 7 | 30 | 90;
  chipCost: 3 | 5 | 10;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}
```

#### TournamentConfig
```typescript
interface TournamentConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  resubmittedAt?: Timestamp;
  submittedAt: Timestamp;
}
```

#### UrgentConfig
```typescript
interface UrgentConfig {
  chipCost: 5;
  createdAt: Timestamp;
  priority: 'high';
}
```

---

## 타입 가드 함수 (선택 사항)

런타임 타입 검증을 위한 타입 가드 함수들입니다.

### isValidJobPostingFormData

```typescript
function isValidJobPostingFormData(data: unknown): data is JobPostingFormData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  return (
    typeof d.title === 'string' &&
    typeof d.description === 'string' &&
    typeof d.location === 'string' &&
    typeof d.status === 'string' &&
    (d.status === 'open' || d.status === 'closed') &&
    Array.isArray(d.dateSpecificRequirements) &&
    d.dateSpecificRequirements.length > 0
  );
}
```

### isValidPreQuestion

```typescript
function isValidPreQuestion(question: unknown): question is PreQuestion {
  if (!question || typeof question !== 'object') return false;
  const q = question as Record<string, unknown>;

  const validType = q.type === 'text' || q.type === 'textarea' || q.type === 'select';
  const hasOptionsIfSelect = q.type !== 'select' || (Array.isArray(q.options) && q.options.length > 0);

  return (
    typeof q.id === 'string' &&
    typeof q.question === 'string' &&
    typeof q.required === 'boolean' &&
    validType &&
    hasOptionsIfSelect
  );
}
```

### isValidDateSpecificRequirement

```typescript
function isValidDateSpecificRequirement(req: unknown): req is DateSpecificRequirement {
  if (!req || typeof req !== 'object') return false;
  const r = req as Record<string, unknown>;

  const validDate =
    typeof r.date === 'string' ||
    r.date instanceof Timestamp ||
    (typeof r.date === 'object' && r.date !== null && typeof (r.date as any).seconds === 'number');

  return (
    validDate &&
    Array.isArray(r.timeSlots) &&
    r.timeSlots.length > 0
  );
}
```

---

## 타입 관계 다이어그램

```
JobPostingFormData
├── dateSpecificRequirements: DateSpecificRequirement[]
│   └── timeSlots: TimeSlot[]
│       └── roles: RoleRequirement[]
├── preQuestions: PreQuestion[]
├── benefits: Benefits
├── roleSalaries: RoleSalaries
│   └── [role]: RoleSalaryInfo
├── taxSettings: TaxSettings
└── Config (postingType에 따라)
    ├── fixedConfig: FixedConfig
    ├── tournamentConfig: TournamentConfig
    └── urgentConfig: UrgentConfig
```

---

## 기존 타입 정의와의 관계

이 문서의 타입은 기존 타입 정의 파일과 다음과 같이 연결됩니다:

- **`app2/src/types/jobPosting/jobPosting.ts`**:
  - `JobPostingFormData` (이미 정의됨, 참조 전용)
  - `PostingType`, `FixedConfig`, `TournamentConfig`, `UrgentConfig` (이미 정의됨)

- **`app2/src/types/jobPosting/base.ts`**:
  - `PreQuestion` (이미 정의됨, 참조 전용)
  - `DateSpecificRequirement` (이미 정의됨, 참조 전용)
  - `TimeSlot` (이미 정의됨, 참조 전용)
  - `RoleRequirement` (이미 정의됨, 참조 전용)
  - `Benefits` (이미 정의됨, 참조 전용)

**중요**: 이 작업에서는 새로운 타입을 정의하지 않고, 기존 타입 정의를 참조하여 useJobPostingForm Hook에서 명시적으로 사용합니다.

---

## 마이그레이션 전략

### 단계별 타입 적용

1. **useState 타입 지정**:
   ```typescript
   const [formData, setFormData] = useState<JobPostingFormData>(() =>
     initialData ? initialData : createInitialFormData()
   );
   ```

2. **setFormData 콜백 타입 지정**:
   ```typescript
   setFormData((prev: JobPostingFormData): JobPostingFormData => ({
     ...prev,
     title: '새로운 제목'
   }));
   ```

3. **useCallback 매개변수 타입 지정**:
   ```typescript
   const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
     const { name, value } = e.target;
     setFormData((prev: JobPostingFormData) => ({ ...prev, [name]: value }));
   }, []);
   ```

4. **타입 가드 적용 (선택)**:
   ```typescript
   const setFormDataFromTemplate = useCallback((templateData: unknown) => {
     if (isValidJobPostingFormData(templateData)) {
       setFormData(templateData);
     } else {
       logger.error('Invalid template data', { templateData });
       toast.error('템플릿 데이터 형식이 올바르지 않습니다');
     }
   }, []);
   ```

---

## 검증 체크리스트

- [ ] 모든 `any` 타입이 명시적 타입으로 대체되었는가?
- [ ] useState 제네릭 타입이 지정되었는가?
- [ ] setFormData 콜백에 명시적 타입이 지정되었는가?
- [ ] useCallback 의존성 배열이 정확한가?
- [ ] 타입 가드 함수가 필요한 곳에 적용되었는가?
- [ ] 기존 컴포넌트 API가 변경되지 않았는가?
- [ ] `npm run type-check` 에러가 0개인가?
- [ ] ESLint 경고가 0개인가?

---

**다음 단계**: Phase 1에서 contracts/ 디렉토리를 생성하고, quickstart.md를 작성합니다.
