# Implementation Tasks: 고정공고 근무일정 입력 섹션

**Branch**: `001-fixed-schedule-section` | **Date**: 2025-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Implementation plan from `/specs/001-fixed-schedule-section/plan.md`

## Summary

고정공고 작성 폼에 근무일정 입력 섹션을 추가합니다. 주 출근일수, 근무 시간대, 역할별 필요 인원을 입력할 수 있는 UI 컴포넌트를 구현하며, 기존 JobPostingForm의 Props Grouping 패턴을 준수합니다.

## Task Breakdown

### Phase 1: Setup (프로젝트 구조 및 타입 정의)

#### T001: 브랜치 생성 및 초기 구조 확인
**Priority**: P1 | **Estimate**: 15min | **Dependencies**: None

**Description**:
- 브랜치 `001-fixed-schedule-section` 생성 확인 (이미 생성됨)
- 프로젝트 구조 확인 및 작업 디렉토리 검증

**Acceptance Criteria**:
- [X] 브랜치 `001-fixed-schedule-section`에서 작업 중
- [X] `app2/src/components/jobPosting/JobPostingForm/sections/` 디렉토리 확인
- [X] `app2/src/types/jobPosting/` 디렉토리 확인
- [X] `app2/tests/components/jobPosting/JobPostingForm/sections/` 디렉토리 확인

**Success Metrics**:
- 모든 작업 디렉토리 접근 가능
- 기존 섹션 컴포넌트 구조 확인 완료

**Related**: spec.md (전체 요구사항)

---

#### T002: TypeScript 타입 정의 파일 생성
**Priority**: P1 | **Estimate**: 30min | **Dependencies**: T001

**Description**:
`app2/src/types/jobPosting/workSchedule.ts` 파일 생성하여 근무일정 관련 타입 정의

**Implementation**:
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
 * 근무 일정 정보
 */
export interface WorkSchedule {
  /** 주 출근일수 (1-7 범위) */
  daysPerWeek: number;

  /** 근무 시작시간 (HH:mm) */
  startTime: string;

  /** 근무 종료시간 (HH:mm, 익일 새벽 시간 허용) */
  endTime: string;
}

/**
 * 역할별 필요 인원 정보
 */
export interface RoleWithCount {
  /** 고유 식별자 (timestamp 또는 UUID) */
  id: string;

  /** 역할 유형 */
  role: StaffRole;

  /** 필요 인원수 (최소 1명) */
  count: number;
}

/**
 * FixedWorkScheduleSection Props
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

**Acceptance Criteria**:
- [X] `workSchedule.ts` 파일 생성
- [X] 모든 인터페이스에 JSDoc 주석 작성
- [X] TypeScript strict mode 준수 (any 타입 없음)
- [X] `npm run type-check` 통과

**Success Metrics**:
- TypeScript 컴파일 에러 0개
- 모든 타입에 명확한 문서화

**Related**: data-model.md, spec.md (FR-001, FR-002)

---

#### T003: 타입 export 추가
**Priority**: P1 | **Estimate**: 10min | **Dependencies**: T002

**Description**:
`app2/src/types/jobPosting/index.ts`에 신규 타입 export 추가

**Implementation**:
```typescript
// 기존 exports...
export type {
  StaffRole,
  WorkSchedule,
  RoleWithCount,
  FixedWorkScheduleSectionProps
} from './workSchedule';
export { STAFF_ROLES } from './workSchedule';
```

**Acceptance Criteria**:
- [ ] `index.ts`에 타입 export 추가
- [ ] Named export 사용 (default export 금지)
- [ ] `npm run type-check` 통과

**Success Metrics**:
- 타입을 프로젝트 전역에서 import 가능

**Related**: data-model.md

---

### Phase 2: Foundational (폼 Hook 및 섹션 export)

#### T004: useJobPostingForm Hook 상태 추가
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T003

**Description**:
`app2/src/hooks/useJobPostingForm.ts`에 근무일정 상태 추가

**Implementation**:
```typescript
import type { WorkSchedule, RoleWithCount } from '@/types/jobPosting';

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

**Acceptance Criteria**:
- [X] `workSchedule` 상태 추가
- [X] `requiredRolesWithCount` 상태 추가
- [X] 기본값 설정 완료
- [X] TypeScript 타입 추론 정상 동작

**Success Metrics**:
- `npm run type-check` 통과
- 기존 폼 기능 정상 동작

**Related**: data-model.md, spec.md (FR-001, FR-002)

---

#### T005: workSchedule 변경 핸들러 구현
**Priority**: P1 | **Estimate**: 15min | **Dependencies**: T004

**Description**:
`useJobPostingForm` Hook에 근무일정 변경 핸들러 추가

**Implementation**:
```typescript
const handleWorkScheduleChange = useCallback((schedule: WorkSchedule) => {
  setFormData(prev => ({ ...prev, workSchedule: schedule }));
}, []);
```

**Acceptance Criteria**:
- [X] `handleWorkScheduleChange` 함수 구현
- [X] `useCallback`으로 메모이제이션
- [X] 불변성 유지 (immutable update)
- [X] TypeScript 타입 체크 통과

**Success Metrics**:
- React DevTools에서 불필요한 리렌더링 없음
- 상태 업데이트 정상 동작

**Related**: research.md (성능 최적화)

---

#### T006: roles 변경 핸들러 구현
**Priority**: P1 | **Estimate**: 15min | **Dependencies**: T004

**Description**:
`useJobPostingForm` Hook에 역할 목록 변경 핸들러 추가

**Implementation**:
```typescript
const handleRolesChange = useCallback((roles: RoleWithCount[]) => {
  setFormData(prev => ({ ...prev, requiredRolesWithCount: roles }));
}, []);
```

**Acceptance Criteria**:
- [X] `handleRolesChange` 함수 구현
- [X] `useCallback`으로 메모이제이션
- [X] 불변성 유지 (immutable update)
- [X] TypeScript 타입 체크 통과

**Success Metrics**:
- React DevTools에서 불필요한 리렌더링 없음
- 상태 업데이트 정상 동작

**Related**: research.md (성능 최적화)

---

#### T007: Hook에서 핸들러 반환
**Priority**: P1 | **Estimate**: 10min | **Dependencies**: T005, T006

**Description**:
`useJobPostingForm` Hook의 반환값에 핸들러 추가

**Implementation**:
```typescript
return {
  // ... 기존 반환값
  handleWorkScheduleChange,
  handleRolesChange
};
```

**Acceptance Criteria**:
- [X] 핸들러 반환 추가
- [X] 기존 반환값 유지
- [X] TypeScript 타입 추론 정상 동작

**Success Metrics**:
- `npm run type-check` 통과
- 컴포넌트에서 핸들러 사용 가능

**Related**: data-model.md

---

#### T008: 섹션 export 준비
**Priority**: P1 | **Estimate**: 5min | **Dependencies**: None

**Description**:
`app2/src/components/jobPosting/JobPostingForm/sections/index.ts` 파일 확인 (섹션 구현 후 export 추가 예정)

**Implementation**:
```typescript
// 기존 exports...
// export { default as FixedWorkScheduleSection } from './FixedWorkScheduleSection';  // T017에서 추가
```

**Acceptance Criteria**:
- [ ] `index.ts` 파일 확인
- [ ] export 패턴 파악

**Success Metrics**:
- 파일 구조 이해 완료

**Related**: plan.md (프로젝트 구조)

---

#### T009: 유효성 검증 함수 작성 (선택)
**Priority**: P2 | **Estimate**: 30min | **Dependencies**: T003

**Description**:
`app2/src/utils/jobPosting/validation.ts`에 근무일정 검증 로직 추가 (필요 시)

**Implementation**:
```typescript
import type { WorkSchedule, RoleWithCount } from '@/types/jobPosting';

/**
 * 근무일정 유효성 검증
 */
export const validateWorkSchedule = (schedule: WorkSchedule): Record<string, string> => {
  const errors: Record<string, string> = {};

  // 주 출근일수 (HTML5에서 차단하지만 서버 검증용)
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

  // 각 역할의 인원수 검증 (HTML5에서 차단하지만 서버 검증용)
  roles.forEach((role, index) => {
    if (role.count < 1) {
      errors[`role_${index}_count`] = '인원수는 1명 이상이어야 합니다.';
    }
  });

  return errors;
};
```

**Acceptance Criteria**:
- [ ] `validateWorkSchedule` 함수 구현
- [ ] `validateRoles` 함수 구현
- [ ] 모든 검증 케이스 커버
- [ ] JSDoc 주석 작성

**Success Metrics**:
- `npm run type-check` 통과
- 유효성 검증 테스트 통과

**Related**: data-model.md (검증 로직), spec.md (FR-006)

---

### Phase 3: User Story 1 구현 (P1 - 기본 근무 일정 입력)

**User Story**: 관리자가 고정공고를 작성할 때, 주 출근일수와 근무 시간대를 입력할 수 있어야 합니다.

#### T010: FixedWorkScheduleSection 컴포넌트 파일 생성
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T003, T007

**Description**:
`app2/src/components/jobPosting/JobPostingForm/sections/FixedWorkScheduleSection.tsx` 파일 생성 및 기본 구조 작성

**Implementation**:
```typescript
import React, { memo, useCallback } from 'react';
import type { FixedWorkScheduleSectionProps } from '@/types/jobPosting';

/**
 * 고정공고 근무일정 입력 섹션
 *
 * Props Grouping 패턴: data, handlers, validation
 */
const FixedWorkScheduleSection: React.FC<FixedWorkScheduleSectionProps> = memo(
  ({ data, handlers, validation }) => {
    // TODO: 구현
    return (
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          근무 일정
        </h3>
        {/* TODO: 입력 필드 추가 */}
      </section>
    );
  }
);

FixedWorkScheduleSection.displayName = 'FixedWorkScheduleSection';

export default FixedWorkScheduleSection;
```

**Acceptance Criteria**:
- [ ] 컴포넌트 파일 생성
- [ ] Props Grouping 패턴 적용
- [ ] `React.memo` 적용
- [ ] `displayName` 설정
- [ ] JSDoc 주석 작성
- [ ] 다크모드 클래스 적용 (`dark:`)

**Success Metrics**:
- `npm run type-check` 통과
- React DevTools에서 컴포넌트 확인

**Related**: research.md (Props Grouping 패턴), spec.md (US-001)

---

#### T011: 주 출근일수 입력 필드 구현
**Priority**: P1 | **Estimate**: 30min | **Dependencies**: T010

**Description**:
주 출근일수 입력 필드 (1-7 범위) 구현

**Implementation**:
```typescript
const handleDaysChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDays = parseInt(e.target.value, 10);
    handlers.onWorkScheduleChange({
      ...data.workSchedule,
      daysPerWeek: newDays
    });
  },
  [data.workSchedule, handlers]
);

// JSX
<div className="space-y-2">
  <label
    htmlFor="daysPerWeek"
    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
  >
    주 출근일수
  </label>
  <input
    type="number"
    id="daysPerWeek"
    name="daysPerWeek"
    min="1"
    max="7"
    required
    value={data.workSchedule.daysPerWeek}
    onChange={handleDaysChange}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
               bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
               focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
  />
</div>
```

**Acceptance Criteria**:
- [ ] HTML5 `min="1" max="7"` 속성 적용
- [ ] `required` 속성 적용
- [ ] `useCallback`으로 핸들러 메모이제이션
- [ ] 다크모드 클래스 적용
- [ ] label과 input `id` 연결 (접근성)

**Success Metrics**:
- 범위 외 값 입력 차단 (HTML5)
- 다크모드 정상 동작
- 접근성 테스트 통과 (`getByLabelText`)

**Related**: spec.md (FR-001), research.md (HTML5 검증)

---

#### T012: 시작시간 입력 필드 구현
**Priority**: P1 | **Estimate**: 25min | **Dependencies**: T010

**Description**:
근무 시작시간 입력 필드 (HH:mm 형식) 구현

**Implementation**:
```typescript
const handleStartTimeChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    handlers.onWorkScheduleChange({
      ...data.workSchedule,
      startTime: e.target.value
    });
  },
  [data.workSchedule, handlers]
);

// JSX
<div className="space-y-2">
  <label
    htmlFor="startTime"
    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
  >
    시작시간
  </label>
  <input
    type="time"
    id="startTime"
    name="startTime"
    required
    value={data.workSchedule.startTime}
    onChange={handleStartTimeChange}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
               bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
               focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
  />
</div>
```

**Acceptance Criteria**:
- [ ] HTML5 `type="time"` 사용
- [ ] `required` 속성 적용
- [ ] `useCallback`으로 핸들러 메모이제이션
- [ ] 다크모드 클래스 적용
- [ ] label과 input `id` 연결

**Success Metrics**:
- HH:mm 형식 자동 적용 (브라우저)
- 모바일에서 time picker 표시

**Related**: spec.md (FR-001), research.md (시간 입력 처리)

---

#### T013: 종료시간 입력 필드 구현
**Priority**: P1 | **Estimate**: 25min | **Dependencies**: T010

**Description**:
근무 종료시간 입력 필드 (HH:mm 형식) 구현

**Implementation**:
```typescript
const handleEndTimeChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    handlers.onWorkScheduleChange({
      ...data.workSchedule,
      endTime: e.target.value
    });
  },
  [data.workSchedule, handlers]
);

// JSX
<div className="space-y-2">
  <label
    htmlFor="endTime"
    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
  >
    종료시간
  </label>
  <input
    type="time"
    id="endTime"
    name="endTime"
    required
    value={data.workSchedule.endTime}
    onChange={handleEndTimeChange}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
               bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
               focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
  />
  <p className="text-xs text-gray-500 dark:text-gray-400">
    * 익일 새벽 시간도 입력 가능합니다 (예: 02:00)
  </p>
</div>
```

**Acceptance Criteria**:
- [ ] HTML5 `type="time"` 사용
- [ ] `required` 속성 적용
- [ ] 야간 근무 안내 메시지 추가
- [ ] `useCallback`으로 핸들러 메모이제이션
- [ ] 다크모드 클래스 적용

**Success Metrics**:
- HH:mm 형식 자동 적용
- 야간 근무 (18:00 - 02:00) 정상 처리

**Related**: spec.md (FR-001), research.md (야간 근무 처리)

---

#### T014: 근무일정 섹션 레이아웃 구성
**Priority**: P1 | **Estimate**: 15min | **Dependencies**: T011, T012, T013

**Description**:
주 출근일수와 시간 입력 필드를 그리드 레이아웃으로 배치

**Implementation**:
```typescript
<section className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
    근무 일정
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* 주 출근일수 */}
    {/* 시작시간 */}
    {/* 종료시간 */}
  </div>
</section>
```

**Acceptance Criteria**:
- [ ] Tailwind CSS 그리드 레이아웃 사용
- [ ] 반응형 디자인 (모바일: 1열, 데스크톱: 3열)
- [ ] 다크모드 배경색 적용
- [ ] 그림자 효과 적용

**Success Metrics**:
- 모바일/데스크톱 레이아웃 정상 동작
- 다크모드 스타일 정상 적용

**Related**: research.md (다크모드 지원)

---

#### T015: US-001 수동 테스트
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T014

**Description**:
주 출근일수 및 시간대 입력 기능 수동 테스트

**Test Cases**:
1. 주 출근일수 1-7 입력 확인
2. 주 출근일수 0, 8 입력 시 차단 확인 (HTML5)
3. 시작시간 HH:mm 형식 확인
4. 종료시간 HH:mm 형식 확인
5. 야간 근무 (18:00 - 02:00) 정상 처리 확인
6. 다크모드 전환 시 스타일 확인

**Acceptance Criteria**:
- [ ] 모든 테스트 케이스 통과
- [ ] 브라우저 콘솔 에러 없음
- [ ] React DevTools 경고 없음

**Success Metrics**:
- 6개 테스트 케이스 모두 통과
- 사용자 경험 자연스러움

**Related**: spec.md (US-001, SC-001)

---

#### T016: US-001 자동 테스트 작성
**Priority**: P1 | **Estimate**: 45min | **Dependencies**: T014

**Description**:
주 출근일수 및 시간대 입력 기능 자동 테스트 작성

**Implementation**:
```typescript
// tests/components/jobPosting/JobPostingForm/sections/FixedWorkScheduleSection.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FixedWorkScheduleSection from '@/components/jobPosting/JobPostingForm/sections/FixedWorkScheduleSection';

describe('FixedWorkScheduleSection - User Story 1', () => {
  const mockHandlers = {
    onWorkScheduleChange: jest.fn(),
    onRolesChange: jest.fn()
  };

  const defaultData = {
    workSchedule: { daysPerWeek: 5, startTime: '18:00', endTime: '02:00' },
    requiredRolesWithCount: []
  };

  it('주 출근일수 1-7 범위 입력 가능', async () => {
    render(<FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />);

    const input = screen.getByLabelText('주 출근일수');
    await userEvent.clear(input);
    await userEvent.type(input, '3');

    expect(mockHandlers.onWorkScheduleChange).toHaveBeenCalledWith(
      expect.objectContaining({ daysPerWeek: 3 })
    );
  });

  it('주 출근일수 범위 외 입력 차단 (HTML5 min/max)', () => {
    render(<FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />);

    const input = screen.getByLabelText('주 출근일수') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('7');
  });

  it('시작/종료 시간 HH:mm 형식 입력', async () => {
    render(<FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />);

    const startInput = screen.getByLabelText('시작시간') as HTMLInputElement;
    const endInput = screen.getByLabelText('종료시간') as HTMLInputElement;

    expect(startInput.type).toBe('time');
    expect(endInput.type).toBe('time');
  });
});
```

**Acceptance Criteria**:
- [ ] 테스트 파일 생성
- [ ] 주 출근일수 입력 테스트
- [ ] 시간 형식 테스트
- [ ] HTML5 속성 검증 테스트
- [ ] `npm test` 통과

**Success Metrics**:
- 모든 테스트 통과
- 커버리지 ≥80%

**Related**: research.md (테스트 전략), spec.md (US-001)

---

#### T017: 섹션 export 추가
**Priority**: P1 | **Estimate**: 5min | **Dependencies**: T010

**Description**:
`app2/src/components/jobPosting/JobPostingForm/sections/index.ts`에 섹션 export 추가

**Implementation**:
```typescript
// 기존 exports...
export { default as BasicInfoSection } from './BasicInfoSection';
export { default as SalarySection } from './SalarySection';
export { default as DateRequirementsSection } from './DateRequirementsSection';
export { default as FixedWorkScheduleSection } from './FixedWorkScheduleSection';  // 추가
```

**Acceptance Criteria**:
- [X] FixedWorkScheduleSection export 추가
- [X] Named export 사용
- [X] `npm run type-check` 통과

**Success Metrics**:
- JobPostingForm에서 섹션 import 가능

**Related**: plan.md (프로젝트 구조)

---

### Phase 4: User Story 2 구현 (P1 - 역할별 필요 인원 설정)

**User Story**: 관리자가 고정공고를 작성할 때, 필요한 역할(딜러, 플로어 등)과 각 역할의 필요 인원수를 동적으로 추가/삭제할 수 있어야 합니다.

#### T018: 역할 추가 버튼 구현
**Priority**: P1 | **Estimate**: 25min | **Dependencies**: T010

**Description**:
역할 추가 버튼 및 핸들러 구현

**Implementation**:
```typescript
const handleAddRole = useCallback(() => {
  handlers.onRolesChange([
    ...data.requiredRolesWithCount,
    { id: Date.now().toString(), role: '딜러', count: 1 }
  ]);
}, [data.requiredRolesWithCount, handlers]);

// JSX
<button
  type="button"
  onClick={handleAddRole}
  className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md
             hover:bg-blue-700 dark:hover:bg-blue-800
             focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
>
  + 역할 추가
</button>
```

**Acceptance Criteria**:
- [ ] 역할 추가 버튼 UI 구현
- [ ] `handleAddRole` 함수 구현
- [ ] 고유 ID 생성 (`Date.now()`)
- [ ] `useCallback` 메모이제이션
- [ ] 다크모드 스타일 적용

**Success Metrics**:
- 버튼 클릭 시 역할 추가 동작
- 불변성 유지

**Related**: spec.md (FR-002), research.md (동적 역할 UI)

---

#### T019: RoleInputRow 서브 컴포넌트 구현
**Priority**: P1 | **Estimate**: 40min | **Dependencies**: T010

**Description**:
개별 역할 입력 행 컴포넌트 구현 (역할 선택 + 인원수 입력 + 삭제 버튼)

**Implementation**:
```typescript
import { STAFF_ROLES } from '@/types/jobPosting';

interface RoleInputRowProps {
  role: RoleWithCount;
  index: number;
  onUpdate: (index: number, updated: RoleWithCount) => void;
  onRemove: (index: number) => void;
}

const RoleInputRow: React.FC<RoleInputRowProps> = memo(
  ({ role, index, onUpdate, onRemove }) => {
    const handleRoleChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdate(index, { ...role, role: e.target.value as StaffRole });
      },
      [index, role, onUpdate]
    );

    const handleCountChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, { ...role, count: parseInt(e.target.value, 10) });
      },
      [index, role, onUpdate]
    );

    return (
      <div className="flex items-center gap-4">
        <select
          value={role.role}
          onChange={handleRoleChange}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          {STAFF_ROLES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <input
          type="number"
          min="1"
          required
          value={role.count}
          onChange={handleCountChange}
          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />

        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-3 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md
                     hover:bg-red-700 dark:hover:bg-red-800"
        >
          삭제
        </button>
      </div>
    );
  }
);

RoleInputRow.displayName = 'RoleInputRow';
```

**Acceptance Criteria**:
- [ ] 역할 선택 드롭다운 구현 (STAFF_ROLES 사용)
- [ ] 인원수 입력 필드 구현 (min="1")
- [ ] 삭제 버튼 구현
- [ ] `React.memo` 적용
- [ ] `useCallback` 메모이제이션
- [ ] 다크모드 스타일 적용

**Success Metrics**:
- React DevTools에서 불필요한 리렌더링 없음
- 입력 필드 정상 동작

**Related**: spec.md (FR-002), research.md (동적 역할 UI)

---

#### T020: 역할 업데이트 핸들러 구현
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T019

**Description**:
역할 수정 핸들러 구현

**Implementation**:
```typescript
const handleUpdateRole = useCallback(
  (index: number, updated: RoleWithCount) => {
    handlers.onRolesChange(
      data.requiredRolesWithCount.map((item, i) => (i === index ? updated : item))
    );
  },
  [data.requiredRolesWithCount, handlers]
);
```

**Acceptance Criteria**:
- [ ] `handleUpdateRole` 함수 구현
- [ ] 불변성 유지 (`map` 사용)
- [ ] `useCallback` 메모이제이션
- [ ] TypeScript 타입 체크 통과

**Success Metrics**:
- 역할 수정 시 상태 정상 업데이트
- 불필요한 리렌더링 없음

**Related**: research.md (동적 역할 UI)

---

#### T021: 역할 삭제 핸들러 구현
**Priority**: P1 | **Estimate**: 15min | **Dependencies**: T019

**Description**:
역할 삭제 핸들러 구현

**Implementation**:
```typescript
const handleRemoveRole = useCallback(
  (index: number) => {
    handlers.onRolesChange(
      data.requiredRolesWithCount.filter((_, i) => i !== index)
    );
  },
  [data.requiredRolesWithCount, handlers]
);
```

**Acceptance Criteria**:
- [ ] `handleRemoveRole` 함수 구현
- [ ] 불변성 유지 (`filter` 사용)
- [ ] `useCallback` 메모이제이션
- [ ] TypeScript 타입 체크 통과

**Success Metrics**:
- 역할 삭제 시 상태 정상 업데이트
- 불필요한 리렌더링 없음

**Related**: research.md (동적 역할 UI)

---

#### T022: 역할 목록 렌더링
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T019, T020, T021

**Description**:
역할 목록을 반복 렌더링 (key 사용)

**Implementation**:
```typescript
<div className="space-y-4">
  <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">
    필요 역할 및 인원
  </h4>

  <div className="space-y-3">
    {data.requiredRolesWithCount.map((role, index) => (
      <RoleInputRow
        key={role.id}
        role={role}
        index={index}
        onUpdate={handleUpdateRole}
        onRemove={handleRemoveRole}
      />
    ))}
  </div>

  <button
    type="button"
    onClick={handleAddRole}
    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md
               hover:bg-blue-700 dark:hover:bg-blue-800"
  >
    + 역할 추가
  </button>

  {data.requiredRolesWithCount.length === 0 && (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      역할을 추가해주세요.
    </p>
  )}
</div>
```

**Acceptance Criteria**:
- [ ] 역할 목록 반복 렌더링
- [ ] 고유 `key` 사용 (`role.id`)
- [ ] 빈 상태 메시지 표시
- [ ] 다크모드 스타일 적용

**Success Metrics**:
- React 경고 없음 (key prop)
- 역할 추가/삭제/수정 정상 동작

**Related**: spec.md (FR-002)

---

#### T023: US-002 수동 테스트
**Priority**: P1 | **Estimate**: 25min | **Dependencies**: T022

**Description**:
역할 추가/수정/삭제 기능 수동 테스트

**Test Cases**:
1. 역할 추가 버튼 클릭 시 새 입력 필드 생성
2. 역할 드롭다운에서 다른 역할 선택
3. 인원수 입력 (1 이상)
4. 인원수 0 입력 차단 (HTML5 min)
5. 역할 삭제 버튼 클릭 시 항목 제거
6. 빈 상태 메시지 표시 확인

**Acceptance Criteria**:
- [ ] 모든 테스트 케이스 통과
- [ ] 브라우저 콘솔 에러 없음
- [ ] React DevTools 경고 없음

**Success Metrics**:
- 6개 테스트 케이스 모두 통과
- 사용자 경험 자연스러움

**Related**: spec.md (US-002, SC-002)

---

#### T024: US-002 자동 테스트 작성
**Priority**: P1 | **Estimate**: 50min | **Dependencies**: T022

**Description**:
역할 추가/수정/삭제 기능 자동 테스트 작성

**Implementation**:
```typescript
describe('FixedWorkScheduleSection - User Story 2', () => {
  it('역할 추가 버튼 클릭 시 새 입력 필드 추가', async () => {
    render(<FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />);

    const addButton = screen.getByRole('button', { name: /역할 추가/i });
    await userEvent.click(addButton);

    expect(mockHandlers.onRolesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: '딜러', count: 1 })
      ])
    );
  });

  it('역할 삭제 버튼 클릭 시 해당 항목 제거', async () => {
    const dataWithRoles = {
      ...defaultData,
      requiredRolesWithCount: [
        { id: '1', role: '딜러' as StaffRole, count: 3 }
      ]
    };

    render(<FixedWorkScheduleSection data={dataWithRoles} handlers={mockHandlers} />);

    const deleteButton = screen.getByRole('button', { name: /삭제/i });
    await userEvent.click(deleteButton);

    expect(mockHandlers.onRolesChange).toHaveBeenCalledWith([]);
  });

  it('인원수 0 또는 음수 입력 차단 (HTML5 min)', () => {
    const dataWithRoles = {
      ...defaultData,
      requiredRolesWithCount: [
        { id: '1', role: '딜러' as StaffRole, count: 1 }
      ]
    };

    render(<FixedWorkScheduleSection data={dataWithRoles} handlers={mockHandlers} />);

    const countInput = screen.getByDisplayValue('1') as HTMLInputElement;
    expect(countInput.min).toBe('1');
  });
});
```

**Acceptance Criteria**:
- [ ] 역할 추가 테스트
- [ ] 역할 삭제 테스트
- [ ] HTML5 min 속성 검증 테스트
- [ ] `npm test` 통과

**Success Metrics**:
- 모든 테스트 통과
- 커버리지 ≥80%

**Related**: research.md (테스트 전략), spec.md (US-002)

---

### Phase 5: User Story 3 구현 (P2 - 다크모드 지원)

**User Story**: 모든 입력 필드와 버튼이 다크모드에서 올바르게 표시되어야 합니다.

#### T025: 다크모드 클래스 전수 검사
**Priority**: P2 | **Estimate**: 30min | **Dependencies**: T022

**Description**:
모든 UI 요소에 `dark:` 클래스 적용 여부 검사

**Checklist**:
- [ ] 섹션 배경: `bg-white dark:bg-gray-800`
- [ ] 제목: `text-gray-900 dark:text-gray-100`
- [ ] label: `text-gray-700 dark:text-gray-200`
- [ ] input: `bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600`
- [ ] button (추가): `bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800`
- [ ] button (삭제): `bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800`
- [ ] 안내 메시지: `text-gray-500 dark:text-gray-400`

**Acceptance Criteria**:
- [ ] 모든 요소에 `dark:` 클래스 적용
- [ ] WCAG 2.1 AA 색상 대비 준수 (4.5:1)

**Success Metrics**:
- 다크모드 수동 테스트 통과
- 색상 대비 검증 도구 통과

**Related**: spec.md (US-003, NFR-003), research.md (다크모드 지원)

---

#### T026: 다크모드 수동 테스트
**Priority**: P2 | **Estimate**: 15min | **Dependencies**: T025

**Description**:
다크모드 전환 시 모든 요소 스타일 확인

**Test Cases**:
1. 라이트모드에서 모든 요소 가독성 확인
2. 다크모드로 전환
3. 다크모드에서 모든 요소 가독성 확인
4. 색상 대비 4.5:1 이상 확인 (브라우저 DevTools)

**Acceptance Criteria**:
- [ ] 라이트/다크 모드 모두 가독성 우수
- [ ] 색상 대비 WCAG 2.1 AA 준수
- [ ] 전환 시 깜빡임 없음

**Success Metrics**:
- 4개 테스트 케이스 모두 통과
- 사용자 피드백 긍정적

**Related**: spec.md (US-003, SC-003)

---

#### T027: 다크모드 자동 테스트 작성
**Priority**: P2 | **Estimate**: 35min | **Dependencies**: T025

**Description**:
다크모드 클래스 적용 여부 자동 테스트 작성

**Implementation**:
```typescript
describe('FixedWorkScheduleSection - User Story 3 (Dark Mode)', () => {
  it('다크모드 클래스 정상 적용', () => {
    render(<FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />);

    const section = screen.getByRole('region', { name: /근무 일정/i });
    expect(section).toHaveClass('dark:bg-gray-800');

    const labels = screen.getAllByText(/시간|일수/i);
    labels.forEach(label => {
      expect(label).toHaveClass('dark:text-gray-200');
    });
  });
});
```

**Acceptance Criteria**:
- [ ] 다크모드 클래스 검증 테스트 작성
- [ ] `npm test` 통과

**Success Metrics**:
- 테스트 통과
- 커버리지 ≥80%

**Related**: research.md (테스트 전략), spec.md (US-003)

---

#### T028: 접근성 테스트 (jest-axe)
**Priority**: P2 | **Estimate**: 40min | **Dependencies**: T025

**Description**:
jest-axe를 사용한 자동화된 접근성 테스트 작성

**Implementation**:
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('FixedWorkScheduleSection - Accessibility', () => {
  it('접근성 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('모든 input에 label 연결 (getByLabelText)', () => {
    render(<FixedWorkScheduleSection data={defaultData} handlers={mockHandlers} />);

    expect(screen.getByLabelText('주 출근일수')).toBeInTheDocument();
    expect(screen.getByLabelText('시작시간')).toBeInTheDocument();
    expect(screen.getByLabelText('종료시간')).toBeInTheDocument();
  });
});
```

**Acceptance Criteria**:
- [ ] jest-axe 테스트 작성
- [ ] label 연결 테스트 작성
- [ ] `npm test` 통과

**Success Metrics**:
- 접근성 위반 0개
- 모든 input에 label 연결

**Related**: research.md (접근성 테스트), spec.md (NFR-004)

---

### Phase 6: Polish & Cross-Cutting Concerns

#### T029: JobPostingForm에 섹션 조건부 렌더링 추가
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T017

**Description**:
`app2/src/components/jobPosting/JobPostingForm/index.tsx`에서 `postingType === 'fixed'`일 때 섹션 렌더링

**Implementation**:
```typescript
import { FixedWorkScheduleSection } from './sections';

// JSX 내부
{formData.postingType === 'fixed' && (
  <FixedWorkScheduleSection
    data={{
      workSchedule: formData.workSchedule,
      requiredRolesWithCount: formData.requiredRolesWithCount
    }}
    handlers={{
      onWorkScheduleChange: handleWorkScheduleChange,
      onRolesChange: handleRolesChange
    }}
    validation={validation}  // 필요 시
  />
)}
```

**Acceptance Criteria**:
- [ ] 조건부 렌더링 추가
- [ ] Props Grouping 패턴으로 데이터 전달
- [ ] TypeScript 타입 체크 통과
- [ ] `npm run type-check` 통과

**Success Metrics**:
- 고정공고 선택 시 섹션 표시
- 다른 타입 선택 시 섹션 숨김

**Related**: spec.md (FR-004)

---

#### T030: 폼 제출 시 검증 추가 (선택)
**Priority**: P2 | **Estimate**: 30min | **Dependencies**: T009, T029

**Description**:
폼 제출 시 근무일정 및 역할 검증 로직 추가 (T009 구현 시)

**Implementation**:
```typescript
// useJobPostingForm.ts 내부
const handleSubmit = () => {
  if (formData.postingType === 'fixed') {
    const scheduleErrors = validateWorkSchedule(formData.workSchedule);
    const rolesErrors = validateRoles(formData.requiredRolesWithCount);

    if (Object.keys(scheduleErrors).length > 0 || Object.keys(rolesErrors).length > 0) {
      // Toast 에러 표시
      toast.error('입력 내용을 확인해주세요.');
      return;
    }
  }

  // 제출 진행...
};
```

**Acceptance Criteria**:
- [ ] 검증 함수 호출 추가
- [ ] 검증 실패 시 에러 메시지 표시
- [ ] Toast 시스템 사용

**Success Metrics**:
- 잘못된 입력 제출 차단
- 사용자에게 명확한 에러 메시지 표시

**Related**: spec.md (FR-006)

---

#### T031: 문서 업데이트
**Priority**: P2 | **Estimate**: 20min | **Dependencies**: T029

**Description**:
프로젝트 문서에 신규 기능 추가 내용 반영

**Files to Update**:
- `CHANGELOG.md`: 버전 히스토리에 신규 기능 추가
- `README.md`: 기능 목록에 "고정공고 근무일정 입력" 추가

**Acceptance Criteria**:
- [ ] CHANGELOG.md 업데이트
- [ ] README.md 업데이트
- [ ] 마크다운 형식 오류 없음

**Success Metrics**:
- 문서 가독성 우수
- 기능 설명 명확

**Related**: spec.md (전체 요구사항)

---

#### T032: 최종 통합 테스트
**Priority**: P1 | **Estimate**: 30min | **Dependencies**: T029, T030

**Description**:
전체 폼 흐름에서 고정공고 근무일정 섹션 통합 테스트

**Test Cases**:
1. 공고 타입 '고정공고' 선택
2. 근무일정 섹션 표시 확인
3. 주 출근일수, 시간대 입력
4. 역할 추가 (3개)
5. 폼 제출
6. Firestore에 데이터 저장 확인

**Acceptance Criteria**:
- [ ] 모든 테스트 케이스 통과
- [ ] Firestore에 데이터 정상 저장
- [ ] 브라우저 콘솔 에러 없음

**Success Metrics**:
- 6개 테스트 케이스 모두 통과
- 엔드투엔드 흐름 정상 동작

**Related**: spec.md (SC-004, SC-005)

---

#### T033: 프로덕션 빌드 및 검증
**Priority**: P1 | **Estimate**: 20min | **Dependencies**: T032

**Description**:
프로덕션 빌드 생성 및 번들 크기 확인

**Commands**:
```bash
cd app2
npm run type-check   # TypeScript 에러 체크
npm run lint         # ESLint 검사
npm run build        # 프로덕션 빌드
```

**Acceptance Criteria**:
- [ ] `npm run type-check` 통과 (에러 0개)
- [ ] `npm run lint` 통과 (경고 0개)
- [ ] `npm run build` 성공
- [ ] 번들 크기 증가 <50KB (초기 번들 기준)

**Success Metrics**:
- 모든 빌드 단계 성공
- 번들 크기 최적화 유지

**Related**: spec.md (NFR-001)

---

## Dependencies and Execution Order

### Parallel Execution Opportunities

**Phase 1 병렬 실행 가능**:
- T002 (타입 정의) 완료 후:
  - T003 (export 추가) ‖ T009 (검증 함수)

**Phase 2 병렬 실행 가능**:
- T004 (상태 추가) 완료 후:
  - T005 (workSchedule 핸들러) ‖ T006 (roles 핸들러) ‖ T008 (섹션 export 준비)

**Phase 3 병렬 실행 가능**:
- T010 (컴포넌트 파일 생성) 완료 후:
  - T011 (주 출근일수) ‖ T012 (시작시간) ‖ T013 (종료시간)

**Phase 4 병렬 실행 가능**:
- T019 (RoleInputRow) 완료 후:
  - T020 (업데이트 핸들러) ‖ T021 (삭제 핸들러)

**Phase 5 병렬 실행 가능**:
- T025 (다크모드 클래스 검사) 완료 후:
  - T026 (수동 테스트) ‖ T027 (자동 테스트) ‖ T028 (접근성 테스트)

**Phase 6 병렬 실행 가능**:
- T029 (조건부 렌더링) 완료 후:
  - T030 (폼 검증) ‖ T031 (문서 업데이트)

### Critical Path

```
T001 → T002 → T003 → T004 → T005 → T007 → T010 → T011/T012/T013 → T014 → T015 → T017 → T018 → T019 → T022 → T023 → T025 → T029 → T032 → T033
```

**Estimated Total Time**: 11.5 hours (최적 병렬 실행 시)

### Task Priority Legend

- **P1**: 필수 기능, 즉시 구현 필요
- **P2**: 중요하지만 우선순위 낮음, P1 완료 후 진행

---

## Implementation Strategy

### Day 1 (4 hours)
- **Morning**: Phase 1 (Setup) - T001 ~ T003
- **Afternoon**: Phase 2 (Foundational) - T004 ~ T009

### Day 2 (4 hours)
- **Morning**: Phase 3 (US-001) - T010 ~ T014
- **Afternoon**: Phase 3 (US-001) - T015 ~ T017

### Day 3 (3.5 hours)
- **Morning**: Phase 4 (US-002) - T018 ~ T022
- **Afternoon**: Phase 4 (US-002) - T023 ~ T024

### Day 4 (2.5 hours)
- **Morning**: Phase 5 (US-003) - T025 ~ T028
- **Afternoon**: Phase 6 (Polish) - T029 ~ T033

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- T016: US-001 자동 테스트 (주 출근일수, 시간대)
- T024: US-002 자동 테스트 (역할 추가/삭제)
- T027: US-003 자동 테스트 (다크모드)
- T028: 접근성 테스트 (jest-axe)

**Coverage Target**: ≥80% (lines, branches, functions, statements)

### Manual Tests
- T015: US-001 수동 테스트
- T023: US-002 수동 테스트
- T026: US-003 수동 테스트 (다크모드)
- T032: 최종 통합 테스트

---

## Quality Gates

### Before Merge
- [ ] `npm run type-check` 통과 (에러 0개)
- [ ] `npm run lint` 통과 (경고 0개)
- [ ] `npm test` 통과 (모든 테스트 성공)
- [ ] 테스트 커버리지 ≥80%
- [ ] 다크모드 수동 테스트 통과
- [ ] 접근성 테스트 (jest-axe) 통과
- [ ] `npm run build` 성공
- [ ] 문서 업데이트 완료

---

## Risk Mitigation

| 위험 | 가능성 | 영향도 | 완화 전략 |
|------|--------|--------|-----------|
| TypeScript 타입 에러 | Low | Medium | strict mode 준수, 단계별 type-check |
| 다크모드 색상 대비 미달 | Medium | Medium | WCAG 검증 도구 사용, 수동 테스트 |
| 역할 목록 무한 증가 | Low | Low | 최대 10개 제한 (UI 안내) |
| 야간 근무 시간 계산 오류 | Low | Low | 명확한 주석, 단위 테스트 |
| Props drilling 깊이 증가 | Low | Low | Props Grouping 패턴으로 최소화 |

---

## Success Criteria (Final)

### Functional Success
- [ ] FR-001: 주 출근일수 1-7 입력 가능, 시간대 HH:mm 형식 입력 가능
- [ ] FR-002: 역할 동적 추가/삭제 가능, 역할별 인원수 입력 가능
- [ ] FR-003: 데이터 Firestore 저장 성공
- [ ] FR-004: postingType === 'fixed'일 때만 섹션 표시
- [ ] FR-005: 기존 공고 타입 기능 정상 동작
- [ ] FR-006: 폼 제출 전 검증 동작

### Non-Functional Success
- [ ] NFR-001: 빌드 성공, 번들 크기 증가 <50KB
- [ ] NFR-002: TypeScript strict mode 준수 (any 타입 없음)
- [ ] NFR-003: 다크모드 100% 지원
- [ ] NFR-004: WCAG 2.1 AA 준수 (색상 대비 4.5:1)
- [ ] NFR-005: 테스트 커버리지 ≥80%

### User Story Success
- [ ] US-001: 관리자가 주 출근일수, 시간대 입력 가능 (SC-001: <1분)
- [ ] US-002: 관리자가 역할/인원 동적 추가/삭제 가능 (SC-002: <2분)
- [ ] US-003: 다크모드에서 모든 요소 올바르게 표시 (SC-003: 색상 대비 4.5:1)

---

*마지막 업데이트: 2025-11-23*
*생성 도구: /speckit.tasks*
*관련 문서: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md)*
