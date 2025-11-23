# Data Model: 고정공고 근무일정 입력 섹션

**Date**: 2025-11-23
**Feature**: 고정공고 근무일정 입력 섹션
**Branch**: 001-fixed-schedule-section

## 개요

고정공고 근무일정 섹션에서 사용하는 데이터 모델과 TypeScript 타입 정의를 문서화합니다.

## 엔티티 정의

### 1. WorkSchedule (근무 일정)

주 출근일수와 근무 시간대 정보를 포함합니다.

```typescript
/**
 * 근무 일정 정보
 *
 * @property {number} daysPerWeek - 주 출근일수 (1-7)
 * @property {string} startTime - 근무 시작시간 (HH:mm 형식, 예: "18:00")
 * @property {string} endTime - 근무 종료시간 (HH:mm 형식, 예: "02:00")
 *
 * @example
 * ```typescript
 * const schedule: WorkSchedule = {
 *   daysPerWeek: 5,
 *   startTime: '18:00',
 *   endTime: '02:00'
 * };
 * ```
 */
export interface WorkSchedule {
  /** 주 출근일수 (1-7 범위) */
  daysPerWeek: number;

  /** 근무 시작시간 (HH:mm) */
  startTime: string;

  /** 근무 종료시간 (HH:mm, 익일 새벽 시간 허용) */
  endTime: string;
}
```

**Validation Rules**:
- `daysPerWeek`: 1 ≤ value ≤ 7 (정수)
- `startTime`: HH:mm 형식 (00:00 ~ 23:59)
- `endTime`: HH:mm 형식 (00:00 ~ 23:59, 시작시간보다 이른 경우 야간 근무로 간주)

**State Transitions**: N/A (단순 데이터 구조)

### 2. RoleWithCount (역할별 인원)

필요한 역할과 해당 역할의 인원수 정보를 포함합니다.

```typescript
/**
 * 스태프 역할 유형
 */
export type StaffRole = '딜러' | '플로어' | '칩러너' | '서빙' | '기타';

/**
 * 역할 목록 상수
 */
export const STAFF_ROLES: StaffRole[] = [
  '딜러',
  '플로어',
  '칩러너',
  '서빙',
  '기타'
];

/**
 * 역할별 필요 인원 정보
 *
 * @property {string} id - 고유 식별자 (동적 추가/삭제를 위한 React key)
 * @property {StaffRole} role - 역할 유형
 * @property {number} count - 필요 인원수 (양의 정수)
 *
 * @example
 * ```typescript
 * const roleWithCount: RoleWithCount = {
 *   id: '1732348800000',
 *   role: '딜러',
 *   count: 3
 * };
 * ```
 */
export interface RoleWithCount {
  /** 고유 식별자 (timestamp 또는 UUID) */
  id: string;

  /** 역할 유형 */
  role: StaffRole;

  /** 필요 인원수 (최소 1명) */
  count: number;
}
```

**Validation Rules**:
- `id`: 빈 문자열 아님, 고유값
- `role`: STAFF_ROLES 배열 내 값 중 하나
- `count`: count ≥ 1 (양의 정수)

**State Transitions**:
```
[초기 상태] → 빈 배열 []
[역할 추가] → [...prev, { id: newId, role: selected, count: 1 }]
[역할 수정] → prev.map((item, i) => i === index ? updated : item)
[역할 삭제] → prev.filter((_, i) => i !== index)
```

## 컴포넌트 Props 타입

### FixedWorkScheduleSectionProps

섹션 컴포넌트의 Props 정의 (Props Grouping 패턴)

```typescript
/**
 * FixedWorkScheduleSection Props
 *
 * Props Grouping 패턴:
 * - data: 근무일정 데이터
 * - handlers: 이벤트 핸들러
 * - validation: 검증 에러 (선택)
 */
export interface FixedWorkScheduleSectionProps {
  /** 근무일정 데이터 */
  data: {
    /** 근무 일정 (주 출근일수, 시간대) */
    workSchedule: WorkSchedule;

    /** 역할별 필요 인원 목록 */
    requiredRolesWithCount: RoleWithCount[];
  };

  /** 이벤트 핸들러 */
  handlers: {
    /** 근무일정 변경 핸들러 */
    onWorkScheduleChange: (schedule: WorkSchedule) => void;

    /** 역할 목록 변경 핸들러 */
    onRolesChange: (roles: RoleWithCount[]) => void;
  };

  /** 유효성 검증 (선택) */
  validation?: {
    /** 필드별 에러 메시지 */
    errors: Record<string, string>;

    /** 필드 터치 여부 */
    touched: Record<string, boolean>;
  };
}
```

## 데이터 흐름

### 1. 초기 상태

```typescript
// useJobPostingForm Hook 내부
const [formData, setFormData] = useState<JobPostingFormData>({
  // ... 기존 필드
  workSchedule: {
    daysPerWeek: 5,        // 기본값: 주 5일
    startTime: '18:00',    // 기본값: 오후 6시
    endTime: '02:00'       // 기본값: 새벽 2시
  },
  requiredRolesWithCount: [] // 빈 배열로 시작
});
```

### 2. 상태 업데이트 흐름

```
[사용자 입력]
    ↓
[FixedWorkScheduleSection]
    ↓
[handlers.onWorkScheduleChange / handlers.onRolesChange]
    ↓
[useJobPostingForm Hook]
    ↓
[formData 상태 업데이트]
    ↓
[FixedWorkScheduleSection 리렌더링]
```

### 3. 폼 제출 시 데이터 구조

```typescript
// formData.postingType === 'fixed'일 때
const submitData = {
  // ... 기본 정보 (title, location, description 등)
  postingType: 'fixed',
  workSchedule: {
    daysPerWeek: 5,
    startTime: '18:00',
    endTime: '02:00'
  },
  requiredRolesWithCount: [
    { id: '1732348800000', role: '딜러', count: 3 },
    { id: '1732348800001', role: '플로어', count: 1 },
    { id: '1732348800002', role: '서빙', count: 2 }
  ]
  // ... 기타 정보
};
```

## Firestore 스키마 (참고용)

고정공고 데이터가 Firestore에 저장될 때의 스키마입니다.

```typescript
// jobPostings/{postingId}
interface JobPostingDocument {
  // ... 기존 필드
  postingType: 'regular' | 'urgent' | 'premium' | 'fixed';

  // 고정공고 전용 필드 (postingType === 'fixed'일 때만 존재)
  workSchedule?: {
    daysPerWeek: number;      // 1-7
    startTime: string;         // "HH:mm"
    endTime: string;           // "HH:mm"
  };

  requiredRolesWithCount?: Array<{
    role: '딜러' | '플로어' | '칩러너' | '서빙' | '기타';
    count: number;             // >= 1
  }>;
  // ... 기타 필드
}
```

**Note**: Firestore 저장 시 `id` 필드는 제거됩니다 (React UI 전용).

## 유효성 검증 로직

### 클라이언트 검증 (실시간)

```typescript
/**
 * 근무일정 유효성 검증
 */
export const validateWorkSchedule = (schedule: WorkSchedule): Record<string, string> => {
  const errors: Record<string, string> = {};

  // 주 출근일수
  if (schedule.daysPerWeek < 1 || schedule.daysPerWeek > 7) {
    errors.daysPerWeek = '주 출근일수는 1-7 범위여야 합니다.';
  }

  // 시간 형식 (HH:mm)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(schedule.startTime)) {
    errors.startTime = '시작시간 형식이 올바르지 않습니다 (HH:mm).';
  }
  if (!timeRegex.test(schedule.endTime)) {
    errors.endTime = '종료시간 형식이 올바르지 않습니다 (HH:mm).';
  }

  return errors;
};

/**
 * 역할 목록 유효성 검증
 */
export const validateRoles = (roles: RoleWithCount[]): Record<string, string> => {
  const errors: Record<string, string> = {};

  // 최소 1개 역할 필요
  if (roles.length === 0) {
    errors.requiredRolesWithCount = '최소 1개 이상의 역할을 추가해야 합니다.';
  }

  // 각 역할의 인원수 검증
  roles.forEach((role, index) => {
    if (role.count < 1) {
      errors[`role_${index}_count`] = '인원수는 1명 이상이어야 합니다.';
    }
  });

  return errors;
};
```

### 폼 제출 시 검증

```typescript
// useJobPostingForm Hook 내부
const handleSubmit = () => {
  if (formData.postingType === 'fixed') {
    const scheduleErrors = validateWorkSchedule(formData.workSchedule);
    const rolesErrors = validateRoles(formData.requiredRolesWithCount);

    if (Object.keys(scheduleErrors).length > 0 || Object.keys(rolesErrors).length > 0) {
      // 에러 표시
      return;
    }
  }

  // 제출 진행...
};
```

## 타입 파일 위치

```
app2/src/types/jobPosting/
├── index.ts                    # (수정) 타입 export
├── workSchedule.ts             # (신규) WorkSchedule, RoleWithCount, STAFF_ROLES
└── basicInfoProps.ts           # (기존) BasicInfoSectionProps 등
```

**workSchedule.ts**:
```typescript
export type StaffRole = '딜러' | '플로어' | '칩러너' | '서빙' | '기타';
export const STAFF_ROLES: StaffRole[];
export interface WorkSchedule { ... }
export interface RoleWithCount { ... }
export interface FixedWorkScheduleSectionProps { ... }
```

**index.ts**:
```typescript
export type { StaffRole, WorkSchedule, RoleWithCount, FixedWorkScheduleSectionProps } from './workSchedule';
export { STAFF_ROLES } from './workSchedule';
```

## 마이그레이션 고려사항

**None**: 신규 필드이므로 기존 데이터 마이그레이션 불필요.

단, 기존 'fixed' 타입 공고가 있다면 Optional로 처리:
```typescript
workSchedule?: WorkSchedule;
requiredRolesWithCount?: RoleWithCount[];
```

## 다음 단계

✅ Phase 1-1 완료: 데이터 모델 정의
➡️ Phase 1-2 진행: quickstart.md 작성
