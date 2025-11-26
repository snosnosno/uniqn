# SalarySection - 급여 정보 섹션

재사용 가능한 급여 정보 입력 컴포넌트

## 개요

`SalarySection`은 급여 정보 (급여 타입, 금액, 복리후생, 역할별 차등 급여)를 입력받는 재사용 가능한 섹션 컴포넌트입니다.

**주요 특징**:

- Props Grouping 패턴으로 명확한 인터페이스 제공
- React.memo 최적화로 불필요한 재렌더링 방지
- 다크모드 완전 지원
- TypeScript strict mode 100% 준수

## 설치 및 의존성

이 컴포넌트는 다음 파일들에 의존합니다:

```
app2/src/
├── components/
│   ├── ui/Input.tsx
│   ├── ui/Button.tsx
│   └── common/Select.tsx
├── types/jobPosting/salaryProps.ts
└── utils/jobPosting/
    ├── jobPostingHelpers.ts
    └── chipCalculator.ts
```

## 사용법

### 기본 사용 예시

```tsx
import React, { useState } from 'react';
import SalarySection from './components/jobPosting/JobPostingForm/sections/SalarySection';

function MyCustomForm() {
  const [salaryData, setSalaryData] = useState({
    salaryType: 'hourly' as const,
    salaryAmount: '20000',
    benefits: {
      meal: false,
      transportation: false,
      accommodation: false,
    },
    useRoleSalary: false,
    roleSalaries: {},
  });

  const salaryHandlers = {
    onSalaryTypeChange: (type) => {
      setSalaryData((prev) => ({ ...prev, salaryType: type }));
    },
    onSalaryAmountChange: (amount) => {
      setSalaryData((prev) => ({ ...prev, salaryAmount: amount.toString() }));
    },
    onBenefitToggle: (benefitType, enabled) => {
      setSalaryData((prev) => ({
        ...prev,
        benefits: { ...prev.benefits, [benefitType]: enabled },
      }));
    },
    onBenefitChange: (benefitType, amount) => {
      // 복리후생 금액 변경 로직
    },
    onRoleSalaryToggle: (enabled) => {
      setSalaryData((prev) => ({ ...prev, useRoleSalary: enabled }));
    },
    onAddRole: (role) => {
      setSalaryData((prev) => ({
        ...prev,
        roleSalaries: {
          ...prev.roleSalaries,
          [role]: { salaryType: 'hourly', salaryAmount: '0' },
        },
      }));
    },
    onRemoveRole: (roleIndex) => {
      const newRoleSalaries = { ...salaryData.roleSalaries };
      delete newRoleSalaries[roleIndex];
      setSalaryData((prev) => ({ ...prev, roleSalaries: newRoleSalaries }));
    },
    onRoleSalaryChange: (roleIndex, type, amount) => {
      setSalaryData((prev) => ({
        ...prev,
        roleSalaries: {
          ...prev.roleSalaries,
          [roleIndex]: {
            salaryType: type,
            salaryAmount: amount.toString(),
          },
        },
      }));
    },
  };

  return (
    <form>
      <SalarySection data={salaryData} handlers={salaryHandlers} />
    </form>
  );
}
```

### 검증과 함께 사용

```tsx
import React, { useState } from 'react';
import { z } from 'zod';
import SalarySection from './components/jobPosting/JobPostingForm/sections/SalarySection';
import { salarySchema } from './schemas/jobPosting/salary.schema';

function ValidatedSalaryForm() {
  const [salaryData, setSalaryData] = useState({
    // ... 위와 동일
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    try {
      salarySchema.parse(salaryData);
      setValidationErrors({});
      // 제출 로직
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = {};
        error.errors.forEach((err) => {
          errors[err.path.join('.')] = err.message;
        });
        setValidationErrors(errors);
      }
    }
  };

  const salaryValidation = {
    errors: {
      salaryType: validationErrors['salaryType'],
      salaryAmount: validationErrors['salaryAmount'],
    },
    touched: {
      salaryType: touchedFields['salaryType'],
      salaryAmount: touchedFields['salaryAmount'],
    },
  };

  return (
    <form onSubmit={handleSubmit}>
      <SalarySection data={salaryData} handlers={salaryHandlers} validation={salaryValidation} />
      <button type="submit">제출</button>
    </form>
  );
}
```

### 역할별 차등 급여 사용

```tsx
const [salaryData, setSalaryData] = useState({
  salaryType: undefined,
  salaryAmount: '',
  benefits: {
    meal: false,
    transportation: false,
    accommodation: false,
  },
  useRoleSalary: true, // 역할별 급여 활성화
  roleSalaries: {
    dealer: {
      salaryType: 'hourly',
      salaryAmount: '20000',
    },
    floorman: {
      salaryType: 'hourly',
      salaryAmount: '18000',
    },
    chipcounter: {
      salaryType: 'hourly',
      salaryAmount: '16000',
      customRoleName: '칩카운터',
    },
  },
});
```

## Props 인터페이스

### SalarySectionProps

```typescript
interface SalarySectionProps {
  data: SalaryData;
  handlers: SalaryHandlers;
  validation?: SalaryValidation;
}
```

### SalaryData

```typescript
interface SalaryData {
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;
  benefits?: {
    meal?: boolean;
    transportation?: boolean;
    accommodation?: boolean;
  };
  useRoleSalary?: boolean;
  roleSalaries?: {
    [role: string]: {
      salaryType: string;
      salaryAmount: string;
      customRoleName?: string;
    };
  };
}
```

### SalaryHandlers

```typescript
interface SalaryHandlers {
  onSalaryTypeChange: (type: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other') => void;
  onSalaryAmountChange: (amount: number) => void;
  onBenefitToggle: (
    benefitType: 'meal' | 'transportation' | 'accommodation',
    enabled: boolean
  ) => void;
  onBenefitChange: (
    benefitType: 'meal' | 'transportation' | 'accommodation',
    amount: number
  ) => void;
  onRoleSalaryToggle: (enabled: boolean) => void;
  onAddRole: (role: string) => void;
  onRemoveRole: (roleIndex: string | number) => void;
  onRoleSalaryChange: (roleIndex: string | number, type: string, amount: number) => void;
}
```

## 성능 최적화

- **React.memo**: Props가 변경되지 않으면 재렌더링 방지
- **useMemo**: Props 객체 메모이제이션으로 불필요한 객체 생성 방지
- **조건부 렌더링**: `useRoleSalary`에 따라 기본 급여 또는 역할별 급여 UI만 렌더링

## 다크모드

모든 UI 요소에 `dark:` Tailwind 클래스가 적용되어 자동으로 다크모드를 지원합니다.

```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">{/* ... */}</div>
```

## 주의사항

1. **필수 Props**: `data`와 `handlers`는 필수입니다.
2. **타입 안전성**: TypeScript strict mode를 사용하므로 모든 타입이 정확해야 합니다.
3. **메모이제이션**: 부모 컴포넌트에서 `useMemo`를 사용하여 props 객체를 메모이제이션하는 것을 권장합니다.

## 관련 파일

- **타입 정의**: `app2/src/types/jobPosting/salaryProps.ts`
- **스키마**: `app2/src/schemas/jobPosting/salary.schema.ts`
- **서브 컴포넌트**: `./RoleSalaryManager.tsx`
- **유틸리티**: `app2/src/utils/jobPosting/chipCalculator.ts`

## 라이선스

이 컴포넌트는 UNIQN 프로젝트의 일부입니다.
