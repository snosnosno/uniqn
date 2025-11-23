# Research: 고정공고 근무일정 입력 섹션

**Date**: 2025-11-23
**Feature**: 고정공고 근무일정 입력 섹션
**Branch**: 001-fixed-schedule-section

## 목적

고정공고 작성 폼에 근무일정 입력 섹션을 추가하기 위한 기술적 결정사항과 모범 사례를 조사합니다.

## 기술 결정사항

### 1. Props Grouping 패턴

**Decision**: data, handlers, validation 3개 그룹으로 props 구조화

**Rationale**:
- 기존 JobPostingForm의 BasicInfoSection, SalarySection 등에서 이미 사용 중인 패턴
- Props 전달이 명확하고 React.memo 최적화에 유리
- TypeScript 타입 정의가 모듈화되어 유지보수 용이

**Alternatives Considered**:
- Flat props 구조: 기존 패턴과 불일치, props 수 증가 시 관리 어려움
- Context API: 단일 섹션 컴포넌트에 과도한 복잡도

**Example**:
```typescript
interface FixedWorkScheduleSectionProps {
  data: {
    workSchedule: WorkSchedule;
    requiredRolesWithCount: RoleWithCount[];
  };
  handlers: {
    onWorkScheduleChange: (schedule: WorkSchedule) => void;
    onRolesChange: (roles: RoleWithCount[]) => void;
  };
  validation?: {
    errors: Record<string, string>;
    touched: Record<string, boolean>;
  };
}
```

### 2. 동적 역할 추가/삭제 UI 패턴

**Decision**: 배열 state 관리 + 인덱스 기반 수정/삭제

**Rationale**:
- React의 표준 배열 state 관리 패턴
- key prop으로 리스트 렌더링 최적화 가능
- 단순하고 예측 가능한 동작

**Alternatives Considered**:
- Immer.js 사용: 추가 의존성 불필요, 배열 조작이 복잡하지 않음
- Formik/React Hook Form: 전체 폼이 아닌 섹션만 구현하므로 과도

**Best Practices**:
- 고유 key 사용 (index 대신 UUID 또는 timestamp)
- 삭제 시 애니메이션 효과 고려 (사용자 피드백)
- 최대 개수 제한 (예: 10개) 설정 권장

**Implementation Example**:
```typescript
const handleAddRole = useCallback(() => {
  onRolesChange([
    ...requiredRolesWithCount,
    { id: Date.now().toString(), role: '딜러', count: 1 }
  ]);
}, [requiredRolesWithCount, onRolesChange]);

const handleRemoveRole = useCallback((index: number) => {
  onRolesChange(requiredRolesWithCount.filter((_, i) => i !== index));
}, [requiredRolesWithCount, onRolesChange]);
```

### 3. HTML5 입력 유효성 검증

**Decision**: HTML5 min/max 속성 + 클라이언트 검증

**Rationale**:
- 브라우저 네이티브 기능 활용으로 일관된 UX
- 접근성 도구(스크린 리더)에서 자동 인식
- 추가 라이브러리 불필요

**HTML5 Attributes**:
```typescript
// 주 출근일수
<input
  type="number"
  min="1"
  max="7"
  required
/>

// 인원수
<input
  type="number"
  min="1"
  required
/>

// 시간
<input
  type="time"
  required
/>
```

**Alternatives Considered**:
- Zod 스키마 검증: 이미 프로젝트에 있으나, 섹션 레벨에서는 HTML5만으로 충분
- 커스텀 검증 함수: HTML5가 이미 제공하는 기능을 재구현하는 것은 비효율적

### 4. 다크모드 지원

**Decision**: Tailwind CSS dark: variant 사용

**Rationale**:
- 프로젝트 전체에서 사용 중인 표준 방식
- WCAG 2.1 AA 색상 대비 자동 준수 (프로젝트 설정됨)
- 조건부 클래스 없이 선언적으로 관리

**Best Practices**:
```typescript
// ✅ 올바른 사용
<input className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" />
<label className="text-gray-700 dark:text-gray-200" />
<button className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800" />
```

**Color Contrast Validation**:
- 라이트모드: gray-900 on white (21:1 - AAA 수준)
- 다크모드: gray-100 on gray-900 (15.8:1 - AAA 수준)

### 5. 역할 선택 드롭다운

**Decision**: 기존 Select 컴포넌트 재사용

**Rationale**:
- app2/src/components/common/Select.tsx 이미 존재
- 다크모드, 접근성 이미 구현됨
- 일관된 UI/UX

**역할 목록 정의**:
```typescript
// app2/src/types/jobPosting/workSchedule.ts
export type StaffRole = '딜러' | '플로어' | '칩러너' | '서빙' | '기타';

export const STAFF_ROLES: StaffRole[] = [
  '딜러',
  '플로어',
  '칩러너',
  '서빙',
  '기타'
];
```

### 6. 시간 입력 처리

**Decision**: HTML5 time input (HH:mm 형식)

**Rationale**:
- 브라우저 네이티브 time picker 제공
- 자동 포맷 검증
- 모바일에서 최적화된 입력 UI

**야간 근무 처리**:
- 종료시간 < 시작시간은 정상 (예: 18:00 - 02:00)
- 유효성 검증에서 허용
- 실제 근무 시간 계산 시 날짜 차이 고려

```typescript
// 시간 차이 계산 예시 (필요 시)
const calculateWorkHours = (start: string, end: string): number => {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  let hours = endH - startH;
  if (hours < 0) hours += 24; // 야간 근무

  return hours + (endM - startM) / 60;
};
```

## 테스트 전략

### 1. 단위 테스트 (Jest + React Testing Library)

**Coverage Targets**:
- 컴포넌트 렌더링: 100%
- 사용자 상호작용: 100%
- 유효성 검증: 100%

**Test Cases**:
```typescript
describe('FixedWorkScheduleSection', () => {
  it('주 출근일수 1-7 범위 입력 가능', () => {});
  it('주 출근일수 범위 외 입력 차단 (HTML5 min/max)', () => {});
  it('시작/종료 시간 HH:mm 형식 입력', () => {});
  it('역할 추가 버튼 클릭 시 새 입력 필드 추가', () => {});
  it('역할 삭제 버튼 클릭 시 해당 항목 제거', () => {});
  it('인원수 0 또는 음수 입력 차단 (HTML5 min)', () => {});
  it('다크모드 클래스 정상 적용', () => {});
  it('접근성: 모든 input에 label 연결 (getByLabelText)', () => {});
});
```

### 2. 접근성 테스트 (jest-axe)

**Validation**:
```typescript
import { axe } from 'jest-axe';

it('접근성 위반 없음 (axe-core)', async () => {
  const { container } = render(<FixedWorkScheduleSection {...props} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 성능 최적화

### 1. React.memo

**Target Components**:
- FixedWorkScheduleSection (최상위)
- RoleInputRow (역할 입력 행 - 반복 렌더링)

### 2. useCallback

**Memoized Handlers**:
```typescript
const handleWorkScheduleChange = useCallback((schedule: WorkSchedule) => {
  setFormData(prev => ({ ...prev, workSchedule: schedule }));
}, []);

const handleRolesChange = useCallback((roles: RoleWithCount[]) => {
  setFormData(prev => ({ ...prev, requiredRolesWithCount: roles }));
}, []);
```

### 3. useMemo

**역할 목록 최적화** (필요 시):
```typescript
const sortedRoles = useMemo(() =>
  requiredRolesWithCount.sort((a, b) => a.role.localeCompare(b.role)),
  [requiredRolesWithCount]
);
```

## 참고 문서

### 프로젝트 내부 문서
- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 개발 가이드
- [BasicInfoSection.tsx](../../app2/src/components/jobPosting/JobPostingForm/sections/BasicInfoSection.tsx) - Props Grouping 패턴 참조
- [SalarySection/](../../app2/src/components/jobPosting/JobPostingForm/sections/SalarySection/) - 동적 입력 UI 참조

### 외부 문서
- [React.memo 공식 문서](https://react.dev/reference/react/memo)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [HTML5 Input Types](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input)

## 위험 요소 및 완화 전략

| 위험 요소 | 영향도 | 완화 전략 |
|-----------|--------|-----------|
| Props drilling 깊이 증가 | Low | Props Grouping 패턴으로 최소화 |
| 다크모드 색상 대비 미달 | Medium | WCAG AA 자동 검증 도구 사용 |
| 역할 목록 무한 증가 | Low | 최대 10개 제한 (UI에 안내) |
| 야간 근무 시간 계산 오류 | Low | 명확한 주석 + 단위 테스트 |
| 브라우저 호환성 (time input) | Low | Capacitor 7.4에서 기본 지원 |

## 다음 단계

✅ Phase 0 완료: 기술 조사 및 결정사항 문서화
➡️ Phase 1 진행: data-model.md, quickstart.md 작성
