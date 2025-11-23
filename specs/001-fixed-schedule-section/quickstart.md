# Quickstart: 고정공고 근무일정 입력 섹션

**Date**: 2025-11-23
**Feature**: 고정공고 근무일정 입력 섹션
**Branch**: 001-fixed-schedule-section

## 빠른 시작

이 가이드는 개발자가 고정공고 근무일정 섹션을 빠르게 이해하고 사용할 수 있도록 합니다.

## 1단계: 타입 정의 확인

```typescript
// app2/src/types/jobPosting/workSchedule.ts

// 역할 유형
type StaffRole = '딜러' | '플로어' | '칩러너' | '서빙' | '기타';

// 근무 일정
interface WorkSchedule {
  daysPerWeek: number;  // 1-7
  startTime: string;     // "HH:mm"
  endTime: string;       // "HH:mm"
}

// 역할별 인원
interface RoleWithCount {
  id: string;
  role: StaffRole;
  count: number;  // >= 1
}
```

## 2단계: 컴포넌트 사용

### 기본 사용법

```tsx
import React from 'react';
import { FixedWorkScheduleSection } from './sections';
import type { WorkSchedule, RoleWithCount } from '../../../types/jobPosting';

function JobPostingForm() {
  const [workSchedule, setWorkSchedule] = React.useState<WorkSchedule>({
    daysPerWeek: 5,
    startTime: '18:00',
    endTime: '02:00'
  });

  const [requiredRolesWithCount, setRequiredRolesWithCount] = React.useState<RoleWithCount[]>([]);

  const handleWorkScheduleChange = (schedule: WorkSchedule) => {
    setWorkSchedule(schedule);
  };

  const handleRolesChange = (roles: RoleWithCount[]) => {
    setRequiredRolesWithCount(roles);
  };

  return (
    <FixedWorkScheduleSection
      data={{
        workSchedule,
        requiredRolesWithCount
      }}
      handlers={{
        onWorkScheduleChange: handleWorkScheduleChange,
        onRolesChange: handleRolesChange
      }}
    />
  );
}
```

### useJobPostingForm Hook 통합

```typescript
// app2/src/hooks/useJobPostingForm.ts

export const useJobPostingForm = () => {
  const [formData, setFormData] = useState<JobPostingFormData>({
    // ... 기존 필드
    workSchedule: {
      daysPerWeek: 5,
      startTime: '18:00',
      endTime: '02:00'
    },
    requiredRolesWithCount: []
  });

  const handleWorkScheduleChange = useCallback((schedule: WorkSchedule) => {
    setFormData(prev => ({ ...prev, workSchedule: schedule }));
  }, []);

  const handleRolesChange = useCallback((roles: RoleWithCount[]) => {
    setFormData(prev => ({ ...prev, requiredRolesWithCount: roles }));
  }, []);

  return {
    formData,
    handleWorkScheduleChange,
    handleRolesChange,
    // ... 기타 핸들러
  };
};
```

## 3단계: 조건부 렌더링

```tsx
// app2/src/components/jobPosting/JobPostingForm/index.tsx

function JobPostingForm() {
  const {
    formData,
    handleWorkScheduleChange,
    handleRolesChange
  } = useJobPostingForm();

  return (
    <form>
      <BasicInfoSection {...basicProps} />

      {/* 공고 타입에 따라 섹션 전환 */}
      {formData.postingType === 'fixed' ? (
        <FixedWorkScheduleSection
          data={{
            workSchedule: formData.workSchedule,
            requiredRolesWithCount: formData.requiredRolesWithCount
          }}
          handlers={{
            onWorkScheduleChange: handleWorkScheduleChange,
            onRolesChange: handleRolesChange
          }}
        />
      ) : (
        <DateRequirementsSection {...dateProps} />
      )}

      <SalarySection {...salaryProps} />
    </form>
  );
}
```

## 4단계: 유효성 검증 추가

```typescript
import { validateWorkSchedule, validateRoles } from '../utils/jobPosting/validation';

function JobPostingForm() {
  const { formData } = useJobPostingForm();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    if (formData.postingType === 'fixed') {
      const scheduleErrors = validateWorkSchedule(formData.workSchedule);
      const rolesErrors = validateRoles(formData.requiredRolesWithCount);

      const allErrors = { ...scheduleErrors, ...rolesErrors };

      if (Object.keys(allErrors).length > 0) {
        setErrors(allErrors);
        return;
      }
    }

    // 제출 진행...
  };

  return (
    <FixedWorkScheduleSection
      data={...}
      handlers={...}
      validation={{
        errors,
        touched: {}  // 필요 시 구현
      }}
    />
  );
}
```

## 주요 기능

### 1. 주 출근일수 입력

```tsx
// HTML5 min/max 속성으로 1-7 범위 자동 제한
<input
  type="number"
  min="1"
  max="7"
  value={workSchedule.daysPerWeek}
  onChange={(e) => onWorkScheduleChange({
    ...workSchedule,
    daysPerWeek: parseInt(e.target.value, 10)
  })}
/>
```

### 2. 시간 입력

```tsx
// HTML5 time input (HH:mm)
<input
  type="time"
  value={workSchedule.startTime}
  onChange={(e) => onWorkScheduleChange({
    ...workSchedule,
    startTime: e.target.value
  })}
/>
```

### 3. 역할 동적 추가

```tsx
const handleAddRole = () => {
  const newRole: RoleWithCount = {
    id: Date.now().toString(),
    role: '딜러',
    count: 1
  };
  onRolesChange([...requiredRolesWithCount, newRole]);
};

<button onClick={handleAddRole}>역할 추가</button>
```

### 4. 역할 삭제

```tsx
const handleRemoveRole = (index: number) => {
  onRolesChange(requiredRolesWithCount.filter((_, i) => i !== index));
};

<button onClick={() => handleRemoveRole(index)}>삭제</button>
```

## 다크모드 지원

모든 UI 요소에 dark: 클래스가 적용되어 있습니다:

```tsx
<div className="bg-white dark:bg-gray-800">
  <label className="text-gray-700 dark:text-gray-200">
    주 출근일수
  </label>
  <input className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" />
</div>
```

## 접근성

모든 입력 필드는 label과 연결되어 있습니다:

```tsx
<label htmlFor="daysPerWeek" className="...">
  주 출근일수 <span className="text-red-500">*</span>
</label>
<input
  id="daysPerWeek"
  type="number"
  aria-label="주 출근일수"
  aria-required="true"
  min="1"
  max="7"
/>
```

## 테스트 예시

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { FixedWorkScheduleSection } from './FixedWorkScheduleSection';

describe('FixedWorkScheduleSection', () => {
  it('주 출근일수 입력 가능', () => {
    const onWorkScheduleChange = jest.fn();
    render(
      <FixedWorkScheduleSection
        data={{
          workSchedule: { daysPerWeek: 5, startTime: '18:00', endTime: '02:00' },
          requiredRolesWithCount: []
        }}
        handlers={{ onWorkScheduleChange, onRolesChange: jest.fn() }}
      />
    );

    const input = screen.getByLabelText(/주 출근일수/);
    fireEvent.change(input, { target: { value: '7' } });

    expect(onWorkScheduleChange).toHaveBeenCalled();
  });

  it('역할 추가 버튼 클릭 시 새 행 추가', () => {
    const onRolesChange = jest.fn();
    render(
      <FixedWorkScheduleSection
        data={{
          workSchedule: { daysPerWeek: 5, startTime: '18:00', endTime: '02:00' },
          requiredRolesWithCount: []
        }}
        handlers={{ onWorkScheduleChange: jest.fn(), onRolesChange }}
      />
    );

    const addButton = screen.getByText(/역할 추가/);
    fireEvent.click(addButton);

    expect(onRolesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: expect.any(String), count: expect.any(Number) })
      ])
    );
  });
});
```

## 문제 해결

### Q: 역할을 하나도 추가하지 않고 제출하면?

A: 폼 제출 시 유효성 검증에서 차단되며 오류 메시지가 표시됩니다:
```typescript
if (requiredRolesWithCount.length === 0) {
  errors.requiredRolesWithCount = '최소 1개 이상의 역할을 추가해야 합니다.';
}
```

### Q: 야간 근무 (종료시간 < 시작시간)는 어떻게 처리되나요?

A: 정상적으로 허용됩니다. 예를 들어 18:00 - 02:00는 유효한 야간 근무 시간입니다.

### Q: 인원수에 0이나 음수를 입력하면?

A: HTML5 `min="1"` 속성으로 물리적으로 차단됩니다.

### Q: 다크모드에서 색상 대비가 부족하면?

A: 모든 색상 조합은 WCAG 2.1 AA (4.5:1) 기준을 만족하도록 설정되어 있습니다.

## 다음 단계

- `/speckit.tasks` 명령으로 구현 태스크 생성
- `FixedWorkScheduleSection.tsx` 컴포넌트 구현
- `useJobPostingForm.ts` Hook 확장
- 단위 테스트 작성

## 참고 문서

- [spec.md](spec.md) - 기능 명세
- [data-model.md](data-model.md) - 데이터 모델 상세
- [research.md](research.md) - 기술 조사 결과
- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 개발 가이드
