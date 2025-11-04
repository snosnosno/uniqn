# Research: useJobPostingForm.ts any 타입 제거

**Phase**: 0 (Outline & Research)
**Date**: 2025-11-05
**Purpose**: Technical Context의 모든 불명확한 사항을 해결하고, 타입 안전성 확보를 위한 모범 사례를 조사합니다.

## 연구 질문 및 답변

### 1. TypeScript Strict Mode에서 useState 타입 지정 모범 사례

**질문**: React Hook에서 복잡한 중첩 객체 상태를 타입 안전하게 관리하는 방법은?

**조사 결과**:

**Decision**: `useState<JobPostingFormData>()` 형태로 제네릭 타입을 명시적으로 지정합니다.

**Rationale**:
- TypeScript는 초기값으로부터 타입을 추론하지만, 복잡한 객체는 명시적 타입이 필요합니다.
- 제네릭 타입 지정 시 IDE가 자동완성과 타입 체크를 정확히 수행합니다.
- Partial 타입이나 선택적 필드가 많은 경우 초기값 추론만으로는 부족합니다.

**Best Practices**:
```typescript
// ✅ 올바른 예시
const [formData, setFormData] = useState<JobPostingFormData>(() =>
  initialData ? initialData : createInitialFormData()
);

// ✅ Partial 타입 사용 (일부 필드만 있는 경우)
const [formData, setFormData] = useState<Partial<JobPostingFormData>>({});

// ❌ 잘못된 예시 (any 사용)
const [formData, setFormData] = useState<any>({});
```

**Alternatives Considered**:
- **타입 추론에 의존**: 복잡한 중첩 객체에서는 부정확할 수 있음
- **as 타입 단언**: 런타임 검증 없이 컴파일러만 속이는 것으로 위험함
- **Zod 스키마 사용**: 런타임 검증까지 가능하지만, 이 작업의 범위를 벗어남 (선택 사항으로 남김)

---

### 2. setFormData 콜백에서 prev 매개변수 타입 지정

**질문**: `setFormData((prev: any) => ...)` 패턴에서 `any`를 제거하고 타입 안전성을 확보하는 방법은?

**조사 결과**:

**Decision**: `(prev: JobPostingFormData) => JobPostingFormData` 형태로 명시적 타입을 지정합니다.

**Rationale**:
- useState 제네릭 타입이 명시되면, 콜백의 prev 매개변수는 자동으로 해당 타입으로 추론됩니다.
- 명시적 타입 지정은 가독성을 높이고, 실수를 방지합니다.
- Spread 연산자(`...prev`)를 사용할 때 타입 체크가 정확히 작동합니다.

**Best Practices**:
```typescript
// ✅ 올바른 예시 (명시적 타입)
setFormData((prev: JobPostingFormData): JobPostingFormData => ({
  ...prev,
  title: '새로운 제목'
}));

// ✅ 올바른 예시 (타입 추론 활용)
setFormData(prev => ({
  ...prev,
  title: '새로운 제목'
}));

// ❌ 잘못된 예시 (any 사용)
setFormData((prev: any) => ({ ...prev, title: '새로운 제목' }));
```

**Alternatives Considered**:
- **타입 추론에만 의존**: 가능하지만, 명시적 타입이 더 명확함
- **Immutable.js 사용**: 과도한 의존성 추가로 불필요함

---

### 3. 중첩 배열/객체 타입 정의 전략

**질문**: `dateSpecificRequirements`, `preQuestions`, `roleSalaries` 같은 중첩 구조를 어떻게 타입 안전하게 정의할까?

**조사 결과**:

**Decision**: 각 중첩 구조를 별도 인터페이스로 정의하고, 메인 인터페이스에서 참조합니다.

**Rationale**:
- 타입 재사용성 향상: `DateSpecificRequirement[]` 형태로 명확히 표현
- 타입 복잡도 관리: 인터페이스 분리로 각 타입의 역할이 명확해짐
- IDE 자동완성 향상: 중첩 레벨에서도 정확한 타입 정보 제공
- 기존 타입 정의와의 일관성: `app2/src/types/jobPosting/base.ts`에 이미 정의된 타입 활용

**Best Practices**:
```typescript
// ✅ 올바른 예시 (별도 인터페이스)
interface DateSpecificRequirement {
  date: string;
  timeSlots: TimeSlot[];
}

interface TimeSlot {
  time: string;
  roles: RoleRequirement[];
}

interface JobPostingFormData {
  dateSpecificRequirements: DateSpecificRequirement[];
}

// ❌ 잘못된 예시 (인라인 타입)
interface JobPostingFormData {
  dateSpecificRequirements: {
    date: string;
    timeSlots: {
      time: string;
      roles: { name: string; count: number }[];
    }[];
  }[];
}
```

**Alternatives Considered**:
- **인라인 타입 정의**: 가독성이 떨어지고 재사용 불가능
- **타입 앨리어스 사용**: 인터페이스보다 확장성이 낮음

---

### 4. useCallback 의존성 배열 최적화

**질문**: 타입 변경 후에도 메모이제이션 성능을 유지하려면?

**조사 결과**:

**Decision**: 의존성 배열을 명시적으로 정의하고, ESLint `react-hooks/exhaustive-deps` 규칙을 활용합니다.

**Rationale**:
- React Hook의 성능 최적화는 의존성 배열의 정확성에 달려 있습니다.
- 빈 배열(`[]`)은 함수가 변경되지 않음을 의미하며, 불필요한 리렌더링을 방지합니다.
- 타입 변경은 의존성 배열에 영향을 주지 않아야 합니다.

**Best Practices**:
```typescript
// ✅ 올바른 예시 (의존성 없는 경우)
const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData((prev: JobPostingFormData) => ({ ...prev, [name]: value }));
}, []); // 빈 배열: setFormData는 React가 보장하는 안정적 참조

// ✅ 올바른 예시 (의존성 있는 경우)
const handleRoleChange = useCallback((oldRole: string, newRole: string) => {
  setFormData((prev: JobPostingFormData) => {
    const { [oldRole]: oldSalary, ...rest } = prev.roleSalaries || {};
    return {
      ...prev,
      roleSalaries: {
        ...rest,
        [newRole]: oldSalary || { salaryType: 'hourly', salaryAmount: '20000' }
      }
    };
  });
}, []); // 외부 변수를 사용하지 않으므로 빈 배열

// ❌ 잘못된 예시 (불필요한 의존성)
const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData((prev: JobPostingFormData) => ({ ...prev, [e.target.name]: e.target.value }));
}, [formData]); // formData를 의존성으로 추가하면 매번 재생성됨
```

**Alternatives Considered**:
- **useMemo 사용**: 함수 생성에는 useCallback이 더 적합
- **의존성 배열 생략**: React가 경고하고, 예상치 못한 동작 발생 가능

---

### 5. 타입 가드 함수 구현 패턴

**질문**: Firebase 데이터나 외부 입력을 런타임에 검증하려면?

**조사 결과**:

**Decision**: TypeScript 타입 가드 함수(`is` 키워드)를 사용하여 런타임 검증을 수행합니다.

**Rationale**:
- 타입 가드는 런타임 검증과 컴파일 타임 타입 좁히기를 동시에 제공합니다.
- Firebase 데이터는 외부 소스이므로, 타입 안전성을 보장할 수 없습니다.
- 타입 가드 함수는 명시적 검증 로직을 제공하여 디버깅이 용이합니다.

**Best Practices**:
```typescript
// ✅ 올바른 예시 (타입 가드)
function isValidJobPostingFormData(data: unknown): data is JobPostingFormData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  return (
    typeof d.title === 'string' &&
    typeof d.description === 'string' &&
    typeof d.location === 'string' &&
    Array.isArray(d.dateSpecificRequirements)
  );
}

// 사용 예시
const loadFormData = (data: unknown) => {
  if (isValidJobPostingFormData(data)) {
    setFormData(data); // TypeScript가 data를 JobPostingFormData로 인식
  } else {
    logger.error('Invalid form data', { data });
    toast.error('데이터 형식이 올바르지 않습니다');
  }
};

// ❌ 잘못된 예시 (타입 단언만 사용)
const loadFormData = (data: unknown) => {
  setFormData(data as JobPostingFormData); // 런타임 검증 없이 위험
};
```

**Alternatives Considered**:
- **Zod 스키마**: 더 강력하지만, 이 작업의 범위를 벗어남 (선택 사항으로 남김)
- **Class-validator**: NestJS 등에서 사용되지만, React Hook에는 과도함

---

### 6. Firebase Timestamp 타입 처리

**질문**: Firebase Timestamp와 JavaScript Date 객체 간 타입 불일치를 어떻게 해결할까?

**조사 결과**:

**Decision**: Firestore의 `Timestamp` 타입을 명시적으로 import하여 사용하고, 필요 시 `.toDate()`로 변환합니다.

**Rationale**:
- Firebase Firestore는 자체 Timestamp 객체를 사용합니다.
- TypeScript는 `firebase/firestore`의 Timestamp 타입을 제공합니다.
- 날짜 필드는 `string | Timestamp | { seconds: number }` Union 타입으로 처리할 수 있습니다.

**Best Practices**:
```typescript
import { Timestamp } from 'firebase/firestore';

// ✅ 올바른 예시 (Union 타입)
interface DateSpecificRequirement {
  date: string | Timestamp | { seconds: number };
  timeSlots: TimeSlot[];
}

// 변환 함수
const convertToDate = (date: string | Timestamp | { seconds: number }): Date => {
  if (typeof date === 'string') {
    return new Date(date);
  }
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  return new Date(date.seconds * 1000);
};

// ❌ 잘못된 예시 (any 사용)
interface DateSpecificRequirement {
  date: any; // 타입 안전성 상실
}
```

**Alternatives Considered**:
- **항상 string으로 변환**: Firestore와의 호환성 문제 발생 가능
- **Date 객체만 사용**: Firestore 데이터 로드 시 변환 필요

---

### 7. Optional vs Required 필드 구분

**질문**: 폼 데이터에서 필수 필드와 선택 필드를 어떻게 구분할까?

**조사 결과**:

**Decision**: TypeScript의 `?` 연산자를 사용하여 선택적 필드를 명시하고, 필수 필드는 기본값을 제공합니다.

**Rationale**:
- 타입 시스템이 필수/선택 필드를 명확히 구분합니다.
- 컴파일 타임에 누락된 필수 필드를 감지할 수 있습니다.
- 기존 코드와의 호환성을 유지하면서 타입 안전성을 확보합니다.

**Best Practices**:
```typescript
// ✅ 올바른 예시
interface JobPostingFormData {
  // 필수 필드
  title: string;
  description: string;
  location: string;
  status: 'open' | 'closed';
  dateSpecificRequirements: DateSpecificRequirement[];
  postingType: PostingType;

  // 선택적 필드
  contactPhone?: string;
  detailedAddress?: string;
  district?: string;
  preQuestions?: PreQuestion[];
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;
  benefits?: Benefits;
  useRoleSalary?: boolean;
  roleSalaries?: {
    [role: string]: {
      salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
      salaryAmount: string;
      customRoleName?: string;
    }
  };
}

// 기본값 제공
const createInitialFormData = (): JobPostingFormData => ({
  title: '',
  description: '',
  location: '',
  status: 'open',
  dateSpecificRequirements: [],
  postingType: 'regular',
  // 선택적 필드는 생략 가능
});
```

**Alternatives Considered**:
- **모든 필드를 필수로**: 불필요한 기본값 설정으로 코드 복잡도 증가
- **Partial<T> 사용**: 모든 필드가 선택적이 되어 필수 필드 검증 불가능

---

## 요약

이 연구를 통해 다음을 확인했습니다:

1. **useState 제네릭 타입 지정**이 복잡한 폼 상태 관리의 핵심입니다.
2. **setFormData 콜백에서 명시적 타입**을 사용하여 타입 안전성을 확보합니다.
3. **중첩 구조는 별도 인터페이스로 분리**하여 재사용성과 가독성을 높입니다.
4. **useCallback 의존성 배열**을 정확히 지정하여 성능을 최적화합니다.
5. **타입 가드 함수**로 런타임 검증을 수행하여 Firebase 데이터의 무결성을 보장합니다.
6. **Firebase Timestamp**는 Union 타입으로 처리하여 호환성을 유지합니다.
7. **Optional vs Required 필드**를 명확히 구분하여 타입 안전성을 확보합니다.

이러한 모범 사례를 적용하면, `any` 타입 없이도 완전한 타입 안전성을 확보할 수 있습니다.
