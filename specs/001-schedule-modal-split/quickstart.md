# Quick Start Guide: ScheduleDetailModal

**Feature**: 001-schedule-modal-split
**Created**: 2025-11-05
**Purpose**: ScheduleDetailModal 컴포넌트 사용 가이드 및 예제

## Overview

ScheduleDetailModal은 일정 상세 정보를 표시하는 모달 컴포넌트입니다. 3개 탭(기본 정보, 근무 정보, 급여 계산)으로 구성되어 있으며, 각 탭은 독립적으로 테스트 가능합니다.

## Installation

이 컴포넌트는 프로젝트 내부 컴포넌트이므로 별도 설치가 필요 없습니다.

## Basic Usage

### 1. 기본 사용법 (부모 페이지에서 호출)

```tsx
import React, { useState } from 'react';
import ScheduleDetailModal from './components/ScheduleDetailModal';
import { ScheduleEvent } from '../../../types/schedule';

function MySchedulePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);

  const handleOpenModal = (schedule: ScheduleEvent) => {
    setSelectedSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSchedule(null);
  };

  const handleCheckOut = (scheduleId: string) => {
    console.log('퇴근 처리:', scheduleId);
    // 퇴근 처리 로직
  };

  const handleCancel = (scheduleId: string) => {
    console.log('지원 취소:', scheduleId);
    // 지원 취소 로직
  };

  return (
    <>
      {/* 일정 목록 */}
      <div>
        {/* ... */}
        <button onClick={() => handleOpenModal(someSchedule)}>
          일정 보기
        </button>
      </div>

      {/* 일정 상세 모달 */}
      <ScheduleDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        schedule={selectedSchedule}
        onCheckOut={handleCheckOut}
        onCancel={handleCancel}
      />
    </>
  );
}

export default MySchedulePage;
```

### 2. 최소 구성 (읽기 전용)

퇴근/취소 기능 없이 일정 정보만 표시하는 경우:

```tsx
<ScheduleDetailModal
  isOpen={isModalOpen}
  onClose={handleCloseModal}
  schedule={selectedSchedule}
/>
```

### 3. 모든 핸들러 포함

```tsx
<ScheduleDetailModal
  isOpen={isModalOpen}
  onClose={handleCloseModal}
  schedule={selectedSchedule}
  onCheckOut={handleCheckOut}
  onCancel={handleCancel}
  onDelete={handleDelete}  // 향후 구현
/>
```

## Tab Components (Independent Usage)

각 탭 컴포넌트는 독립적으로 사용할 수 있습니다. 주로 테스트 또는 Storybook에서 활용됩니다.

### BasicInfoTab

```tsx
import { BasicInfoTab } from './components/ScheduleDetailModal/tabs/BasicInfoTab';
import { ScheduleEvent } from '../../../types/schedule';
import { JobPosting } from '../../../types/jobPosting/jobPosting';

function TestBasicInfoTab() {
  const mockSchedule: ScheduleEvent = {
    id: 'schedule-1',
    eventId: 'event-1',
    eventName: '테스트 이벤트',
    date: '2025-11-05',
    startTime: '09:00',
    endTime: '18:00',
    location: '서울시 강남구',
    type: 'approved',
    role: 'dealer',
    // ... 기타 필드
  };

  const mockJobPosting: JobPosting | null = {
    id: 'event-1',
    title: '포커 토너먼트',
    location: '서울시 강남구',
    salaryType: 'hourly',
    salary: 15000,
    // ... 기타 필드
  };

  return (
    <div className="p-4">
      <BasicInfoTab
        schedule={mockSchedule}
        jobPosting={mockJobPosting}
        isReadOnly={true}
      />
    </div>
  );
}
```

### WorkInfoTab

```tsx
import { WorkInfoTab } from './components/ScheduleDetailModal/tabs/WorkInfoTab';
import { UnifiedWorkLog } from '../../../types/unified/workLog';

function TestWorkInfoTab() {
  const mockSchedule: ScheduleEvent = { /* ... */ };

  const mockWorkLogs: UnifiedWorkLog[] = [
    {
      id: 'worklog-1',
      staffId: 'staff-1',
      eventId: 'event-1',
      date: '2025-11-05',
      role: 'dealer',
      attended: true,
      scheduledStartTime: '09:00',
      scheduledEndTime: '18:00',
      checkInTime: '09:00',
      checkOutTime: null,
      hourlyRate: 15000,
      // ... 기타 필드
    }
  ];

  const handleCheckOut = (scheduleId: string) => {
    console.log('퇴근:', scheduleId);
  };

  return (
    <div className="p-4">
      <WorkInfoTab
        schedule={mockSchedule}
        workLogs={mockWorkLogs}
        onCheckOut={handleCheckOut}
        isReadOnly={false}
      />
    </div>
  );
}
```

### CalculationTab

```tsx
import { CalculationTab } from './components/ScheduleDetailModal/tabs/CalculationTab';
import { SalaryInfo, WorkHistoryItem } from './components/ScheduleDetailModal/types';

function TestCalculationTab() {
  const mockSalaryInfo: SalaryInfo = {
    salaryType: 'hourly',
    baseSalary: 15000,
    totalHours: 8,
    totalDays: 1,
    basePay: 120000,
    allowances: {
      meal: 10000,
      transportation: 5000,
      accommodation: 0,
      bonus: 0,
      other: 0
    },
    tax: 13500,
    taxRate: 10,
    afterTaxAmount: 121500
  };

  const mockWorkHistory: WorkHistoryItem[] = [
    { label: '예정 근무 시간', value: '09:00 - 18:00', type: 'info' },
    { label: '실제 근무 시간', value: '8시간', type: 'success' },
    { label: '시급', value: '15,000원', type: 'info' }
  ];

  return (
    <div className="p-4">
      <CalculationTab
        salaryInfo={mockSalaryInfo}
        workHistory={mockWorkHistory}
      />
    </div>
  );
}
```

## Props Reference

### ScheduleDetailModalProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | boolean | Yes | - | 모달 열림 상태 |
| `onClose` | () => void | Yes | - | 모달 닫기 핸들러 |
| `schedule` | ScheduleEvent \| null | Yes | - | 일정 데이터 |
| `onCheckOut` | (scheduleId: string) => void | No | - | 퇴근 처리 핸들러 |
| `onCancel` | (scheduleId: string) => void | No | - | 지원 취소 핸들러 |
| `onDelete` | (scheduleId: string) => void | No | - | 일정 삭제 핸들러 (향후) |

### BasicInfoTabProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `schedule` | ScheduleEvent | Yes | - | 일정 데이터 |
| `jobPosting` | JobPosting \| null | Yes | - | JobPosting 데이터 |
| `onUpdate` | (field, value) => void | No | - | 필드 업데이트 핸들러 (향후) |
| `isReadOnly` | boolean | Yes | - | 읽기 전용 모드 |

### WorkInfoTabProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `schedule` | ScheduleEvent | Yes | - | 일정 데이터 |
| `workLogs` | UnifiedWorkLog[] | Yes | - | WorkLog 리스트 |
| `onCheckOut` | (scheduleId: string) => void | Yes | - | 퇴근 처리 핸들러 |
| `isReadOnly` | boolean | Yes | - | 읽기 전용 모드 |

### CalculationTabProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `salaryInfo` | SalaryInfo | Yes | - | 급여 정보 |
| `workHistory` | WorkHistoryItem[] | Yes | - | 근무 내역 |

## Common Patterns

### 1. 조건부 렌더링

```tsx
{selectedSchedule && (
  <ScheduleDetailModal
    isOpen={isModalOpen}
    onClose={handleCloseModal}
    schedule={selectedSchedule}
  />
)}
```

### 2. 퇴근 가능 여부 확인

```tsx
const canCheckOut =
  schedule?.type === 'approved' &&
  targetWorkLog?.attended === true &&
  !targetWorkLog?.checkOutTime;

{canCheckOut && (
  <ScheduleDetailModal
    isOpen={isModalOpen}
    onClose={handleCloseModal}
    schedule={selectedSchedule}
    onCheckOut={handleCheckOut}
  />
)}
```

### 3. 지원 취소 가능 여부 확인

```tsx
const canCancel = schedule?.type === 'applied';

{canCancel && (
  <ScheduleDetailModal
    isOpen={isModalOpen}
    onClose={handleCloseModal}
    schedule={selectedSchedule}
    onCancel={handleCancel}
  />
)}
```

## Testing

### Unit Testing (Jest + React Testing Library)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BasicInfoTab } from './BasicInfoTab';

describe('BasicInfoTab', () => {
  const mockSchedule = {
    id: 'schedule-1',
    eventId: 'event-1',
    eventName: '테스트 이벤트',
    date: '2025-11-05',
    startTime: '09:00',
    endTime: '18:00',
    location: '서울시 강남구',
    type: 'approved' as const,
    role: 'dealer',
    // ... 기타 필드
  };

  it('일정 정보를 올바르게 표시한다', () => {
    render(
      <BasicInfoTab
        schedule={mockSchedule}
        jobPosting={null}
        isReadOnly={true}
      />
    );

    expect(screen.getByText('테스트 이벤트')).toBeInTheDocument();
    expect(screen.getByText('서울시 강남구')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 18:00')).toBeInTheDocument();
  });

  it('다크모드에서 올바른 스타일을 적용한다', () => {
    const { container } = render(
      <BasicInfoTab
        schedule={mockSchedule}
        jobPosting={null}
        isReadOnly={true}
      />
    );

    const element = container.querySelector('.dark\\:bg-gray-800');
    expect(element).toBeInTheDocument();
  });
});
```

### Integration Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScheduleDetailModal from './ScheduleDetailModal';

describe('ScheduleDetailModal', () => {
  const mockSchedule = { /* ... */ };
  const mockOnClose = jest.fn();
  const mockOnCheckOut = jest.fn();

  it('탭 전환이 정상 작동한다', async () => {
    render(
      <ScheduleDetailModal
        isOpen={true}
        onClose={mockOnClose}
        schedule={mockSchedule}
        onCheckOut={mockOnCheckOut}
      />
    );

    // 기본 정보 탭이 기본으로 표시됨
    expect(screen.getByText('테스트 이벤트')).toBeInTheDocument();

    // 근무 정보 탭으로 전환
    fireEvent.click(screen.getByText('근무 정보'));
    await waitFor(() => {
      expect(screen.getByText('출석 상태')).toBeInTheDocument();
    });

    // 급여 계산 탭으로 전환
    fireEvent.click(screen.getByText('급여 계산'));
    await waitFor(() => {
      expect(screen.getByText('기본급')).toBeInTheDocument();
    });
  });

  it('퇴근 버튼 클릭 시 핸들러가 호출된다', async () => {
    render(
      <ScheduleDetailModal
        isOpen={true}
        onClose={mockOnClose}
        schedule={mockSchedule}
        onCheckOut={mockOnCheckOut}
      />
    );

    // 근무 정보 탭으로 이동
    fireEvent.click(screen.getByText('근무 정보'));

    // 퇴근 버튼 클릭
    const checkOutButton = screen.getByText('퇴근하기');
    fireEvent.click(checkOutButton);

    expect(mockOnCheckOut).toHaveBeenCalledWith('schedule-1');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
```

## Performance Optimization

### 1. React.memo 사용

모든 탭 컴포넌트는 React.memo로 래핑되어 있어, Props가 변경되지 않으면 리렌더링하지 않습니다.

```tsx
export const BasicInfoTab = React.memo<BasicInfoTabProps>((props) => {
  // ...
});
```

### 2. useCallback 사용

컨테이너에서 핸들러 함수를 useCallback으로 메모이제이션하여 불필요한 리렌더링을 방지합니다.

```tsx
const handleCheckOut = useCallback((scheduleId: string) => {
  // 퇴근 처리 로직
}, [/* deps */]);
```

### 3. useMemo 사용

비용이 큰 계산(급여 계산, 근무 내역 생성)은 useMemo로 메모이제이션합니다.

```tsx
const salaryInfo = useMemo(() => {
  // 급여 계산 로직
}, [schedule, workLogs, jobPosting]);
```

## Troubleshooting

### 1. 모달이 열리지 않아요

- `isOpen` prop이 `true`인지 확인하세요.
- `schedule` prop이 `null`이 아닌지 확인하세요.

### 2. 탭 전환이 동작하지 않아요

- 탭 버튼의 `onClick` 핸들러가 올바르게 연결되어 있는지 확인하세요.
- `activeTab` state가 올바르게 업데이트되는지 확인하세요.

### 3. 다크모드가 적용되지 않아요

- 모든 요소에 `dark:` Tailwind 클래스가 있는지 확인하세요.
- ThemeContext가 올바르게 제공되는지 확인하세요.

### 4. 퇴근 버튼이 보이지 않아요

- `onCheckOut` prop이 전달되었는지 확인하세요.
- 일정 타입이 `'approved'`인지 확인하세요.
- WorkLog의 `attended`가 `true`인지 확인하세요.
- WorkLog의 `checkOutTime`이 `null`인지 확인하세요.

## Next Steps

- **Implementation**: tasks.md에 따라 실제 코드 작성
- **Testing**: 각 탭 컴포넌트 단위 테스트 작성
- **Validation**: 품질 게이트 통과 확인
