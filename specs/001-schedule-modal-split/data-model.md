# Data Model: ScheduleDetailModal 컴포넌트

**Feature**: 001-schedule-modal-split
**Created**: 2025-11-05
**Purpose**: ScheduleDetailModal 컴포넌트 및 탭 컴포넌트의 Props 인터페이스 및 공통 타입 정의

## Overview

이 문서는 ScheduleDetailModal 및 하위 탭 컴포넌트의 데이터 구조를 정의합니다. 모든 인터페이스는 TypeScript strict mode를 준수하며, `any` 타입을 사용하지 않습니다.

## Component Hierarchy

```
ScheduleDetailModal (Container)
├── BasicInfoTab (Presentational)
├── WorkInfoTab (Presentational)
└── CalculationTab (Presentational)
```

## Container Component

### ScheduleDetailModalProps

메인 컨테이너 컴포넌트의 Props 인터페이스입니다.

```typescript
interface ScheduleDetailModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;

  /** 모달 닫기 핸들러 */
  onClose: () => void;

  /** 표시할 일정 데이터 (null이면 모달 숨김) */
  schedule: ScheduleEvent | null;

  /** 퇴근 처리 핸들러 (선택적) */
  onCheckOut?: (scheduleId: string) => void;

  /** 지원 취소 핸들러 (선택적) */
  onCancel?: (scheduleId: string) => void;

  /** 일정 삭제 핸들러 (선택적, 향후 구현) */
  onDelete?: (scheduleId: string) => void;
}
```

**Validation Rules**:
- `isOpen`과 `schedule`이 모두 true/non-null일 때만 모달 표시
- `schedule`이 null이면 모든 탭 숨김
- `onCheckOut`, `onCancel`, `onDelete`는 선택적 핸들러 (제공되지 않으면 해당 버튼 숨김)

**State Transitions**:
```
closed (isOpen: false) → open (isOpen: true, schedule: ScheduleEvent)
open → closed (onClose 호출)
open → closed (onCheckOut/onCancel 호출 후 자동)
```

## Tab Components

### BasicInfoTab

기본 정보 탭 컴포넌트의 Props 인터페이스입니다.

```typescript
interface BasicInfoTabProps {
  /** 일정 데이터 */
  schedule: ScheduleEvent;

  /** JobPosting 데이터 (null이면 스냅샷 사용) */
  jobPosting: JobPosting | null;

  /** 필드 업데이트 핸들러 (향후 편집 기능용, 현재 미사용) */
  onUpdate?: (field: keyof ScheduleEvent, value: unknown) => void;

  /** 읽기 전용 모드 (현재 항상 true) */
  isReadOnly: boolean;
}
```

**Responsibilities**:
- 일정 기본 정보 표시 (제목, 날짜, 장소, 시간)
- 상태 표시 (applied, approved, confirmed, completed, cancelled)
- 급여 정보 표시 (급여 타입, 기본 급여)
- 스냅샷 우선, JobPosting 폴백 로직

**Data Dependencies**:
- `schedule.snapshotData` 우선 사용
- 없으면 `jobPosting` 데이터 사용
- 모두 없으면 `schedule` 기본값 사용

### WorkInfoTab

근무 정보 탭 컴포넌트의 Props 인터페이스입니다.

```typescript
interface WorkInfoTabProps {
  /** 일정 데이터 */
  schedule: ScheduleEvent;

  /** 실시간 WorkLog 리스트 */
  workLogs: UnifiedWorkLog[];

  /** 퇴근 처리 핸들러 */
  onCheckOut: (scheduleId: string) => void;

  /** 읽기 전용 모드 */
  isReadOnly: boolean;
}
```

**Responsibilities**:
- 근무 정보 표시 (배정된 스태프, 역할, 출석 상태)
- 출석 체크 표시 (출석, 결석, 대기)
- 퇴근 가능 여부 판단 및 버튼 표시
- 근무 기록 히스토리 표시

**Business Logic**:
```typescript
// 퇴근 가능 조건
const canCheckOut =
  schedule.type === 'approved' &&
  targetWorkLog?.attended === true &&
  !targetWorkLog?.checkOutTime;

// 출석 상태 표시
const attendanceStatus = targetWorkLog
  ? (targetWorkLog.attended ? 'attended' : 'absent')
  : 'pending';
```

### CalculationTab

급여 계산 탭 컴포넌트의 Props 인터페이스입니다.

```typescript
interface CalculationTabProps {
  /** 급여 정보 (계산된 데이터) */
  salaryInfo: SalaryInfo;

  /** 근무 내역 리스트 */
  workHistory: WorkHistoryItem[];
}
```

**Responsibilities**:
- 급여 계산 상세 정보 표시
- 기본급, 수당, 세금 breakdown
- 총 지급 예정 금액 표시
- 급여 계산 안내 메시지

**Data Structure**:
```typescript
interface SalaryInfo {
  /** 급여 타입 */
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';

  /** 기본 급여 (시급/일급/월급) */
  baseSalary: number;

  /** 총 근무 시간 */
  totalHours: number;

  /** 총 근무 일수 (일정은 항상 1) */
  totalDays: number;

  /** 기본급 계산 결과 (baseSalary × totalHours 또는 baseSalary × totalDays) */
  basePay: number;

  /** 수당 (식비, 교통비, 숙박비, 보너스, 기타) */
  allowances: {
    meal: number;
    transportation: number;
    accommodation: number;
    bonus: number;
    other: number;
  };

  /** 세금 (선택적, 세금 설정이 있을 때만) */
  tax?: number;

  /** 세율 (선택적, 세율 기반 계산일 때만) */
  taxRate?: number;

  /** 세후 금액 (선택적, 세금이 있을 때만) */
  afterTaxAmount?: number;
}

interface WorkHistoryItem {
  /** 항목 라벨 */
  label: string;

  /** 항목 값 */
  value: string | number;

  /** 표시 타입 (선택적) */
  type?: 'info' | 'warning' | 'success' | 'error';
}
```

**Calculation Logic**:
```typescript
// 총 금액 계산
const totalBeforeTax = basePay +
  allowances.meal +
  allowances.transportation +
  allowances.accommodation +
  allowances.bonus +
  allowances.other;

// 세금 계산
const tax = taxSettings.enabled
  ? (taxRate ? totalBeforeTax * (taxRate / 100) : taxAmount)
  : 0;

// 최종 금액
const finalAmount = totalBeforeTax - tax;
```

## Shared Types

### ScheduleEvent

기존 타입 사용 (`src/types/schedule.ts`에서 import).

```typescript
// 프로젝트 전역 타입 (변경 없음)
import { ScheduleEvent } from '../../../types/schedule';
```

**Key Fields**:
- `id`: string (일정 고유 ID)
- `eventId`: string (연결된 JobPosting ID)
- `date`: string (YYYY-MM-DD)
- `startTime`: string | Timestamp
- `endTime`: string | Timestamp
- `type`: 'applied' | 'approved' | 'confirmed' | 'completed' | 'cancelled'
- `role`: string (역할, 예: 'dealer', 'staff')
- `snapshotData`: JobPosting | null (스냅샷 데이터)
- `sourceCollection`: 'jobPostings' | 'schedules'

### JobPosting

기존 타입 사용 (`src/types/jobPosting/jobPosting.ts`에서 import).

```typescript
// 프로젝트 전역 타입 (변경 없음)
import { JobPosting } from '../../../types/jobPosting/jobPosting';
```

**Key Fields**:
- `id`: string
- `title`: string
- `location`: string
- `detailedAddress`: string
- `salaryType`: 'hourly' | 'daily' | 'monthly'
- `salary`: number
- `useRoleSalary`: boolean
- `roleSalaries`: Record<string, number>
- `taxSettings`: { enabled: boolean; taxRate?: number; taxAmount?: number }

### UnifiedWorkLog

기존 타입 사용 (`src/types/unified/workLog.ts`에서 import).

```typescript
// 프로젝트 전역 타입 (변경 없음)
import { UnifiedWorkLog } from '../../../types/unified/workLog';
```

**Key Fields**:
- `id`: string
- `staffId`: string (표준 필드명)
- `eventId`: string (표준 필드명)
- `date`: string
- `role`: string
- `attended`: boolean
- `scheduledStartTime`: string | Timestamp
- `scheduledEndTime`: string | Timestamp
- `checkInTime`: string | Timestamp | null
- `checkOutTime`: string | Timestamp | null
- `hourlyRate`: number

## Data Flow

### Container → Tabs

```
ScheduleDetailModal (Container)
├── Props 받음: schedule, onClose, onCheckOut, onCancel, onDelete
├── State 관리: activeTab, jobPosting, realTimeWorkLogs
├── Data 계산: salaryInfo (useMemo), workHistory (useMemo)
└── Props 전달:
    ├── BasicInfoTab: schedule, jobPosting, isReadOnly
    ├── WorkInfoTab: schedule, workLogs, onCheckOut, isReadOnly
    └── CalculationTab: salaryInfo, workHistory
```

### Tabs → Container

```
탭 컴포넌트는 순수 Presentational Component이므로,
데이터를 컨테이너로 전달하지 않습니다.
모든 데이터는 Props로 받아서 렌더링만 합니다.

향후 편집 기능 추가 시:
BasicInfoTab → onUpdate(field, value) → Container
WorkInfoTab → onCheckOut(scheduleId) → Container
```

## Validation Rules

### Required Fields

모든 탭 컴포넌트는 다음 필드를 필수로 받아야 합니다:
- `schedule`: ScheduleEvent (null 불가)
- `isReadOnly`: boolean

### Optional Fields

- `onUpdate`: 향후 편집 기능용 (현재 미사용)
- `onCheckOut`: WorkInfoTab에만 필요
- `jobPosting`: BasicInfoTab에만 필요 (null 허용)

### Type Safety

모든 Props는 TypeScript strict mode를 준수해야 합니다:
- `any` 타입 사용 금지
- 모든 필드에 명시적 타입 지정
- Optional 필드는 `?` 또는 `| undefined` 사용
- Union 타입은 명시적으로 정의 (예: `'hourly' | 'daily' | 'monthly' | 'other'`)

## File Organization

```
app2/src/pages/MySchedulePage/components/ScheduleDetailModal/
├── types.ts              # 모든 Props 인터페이스 정의
├── index.tsx             # Container Component (ScheduleDetailModalProps 사용)
└── tabs/
    ├── BasicInfoTab.tsx  # BasicInfoTabProps 사용
    ├── WorkInfoTab.tsx   # WorkInfoTabProps 사용
    └── CalculationTab.tsx # CalculationTabProps 사용
```

**Import Pattern**:
```typescript
// types.ts
export interface ScheduleDetailModalProps { /* ... */ }
export interface BasicInfoTabProps { /* ... */ }
export interface WorkInfoTabProps { /* ... */ }
export interface CalculationTabProps { /* ... */ }
export interface SalaryInfo { /* ... */ }
export interface WorkHistoryItem { /* ... */ }

// index.tsx
import { ScheduleDetailModalProps } from './types';

// BasicInfoTab.tsx
import { BasicInfoTabProps } from '../types';

// WorkInfoTab.tsx
import { WorkInfoTabProps } from '../types';

// CalculationTab.tsx
import { CalculationTabProps, SalaryInfo, WorkHistoryItem } from '../types';
```

## Next Steps

1. **contracts/ 파일 생성**: TypeScript 인터페이스 파일
2. **quickstart.md 생성**: 컴포넌트 사용법 및 예제
3. **Agent Context Update**: Claude agent-context.md 업데이트
4. **tasks.md 생성**: `/speckit.tasks` 명령어로 구현 작업 목록 생성
