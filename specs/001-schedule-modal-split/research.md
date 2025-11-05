# Research: ScheduleDetailModal 컴포넌트 분리 패턴

**Created**: 2025-11-05
**Branch**: 001-schedule-modal-split
**Purpose**: 1,123줄 단일 파일을 5개 파일로 분리하기 위한 기술적 결정사항 연구

## 현재 구조 분석

### 파일 구성 (1,123줄)

1. **Import 및 타입 정의** (~30줄)
   - React, Firebase, Utils import
   - ScheduleDetailModalProps 인터페이스

2. **State 관리** (~10줄)
   - activeTab: 'basic' | 'work' | 'calculation'
   - jobPosting, realTimeWorkLogs
   - Modal 상태 (ReportModal, ConfirmModal)

3. **Data Fetching & Effect Hooks** (~150줄)
   - JobPosting 데이터 조회 (useEffect)
   - WorkLogs 실시간 구독 (useEffect with onSnapshot)
   - 급여 정보 계산 (useMemo, useCallback)

4. **Helper Functions** (~100줄)
   - getTargetWorkLog(): 공통 WorkLog 찾기 로직
   - getSalaryInfo(): 급여 계산 useMemo
   - workHistory: 근무 내역 생성 useMemo

5. **Render Logic** (~833줄)
   - Modal 레이아웃 및 헤더 (~50줄)
   - 탭 네비게이션 (~30줄)
   - **Basic Tab** (~250줄): 기본 정보 표시
   - **Work Tab** (~300줄): 근무 정보 및 출석 관리
   - **Calculation Tab** (~250줄): 급여 계산 상세
   - 액션 버튼 (~50줄)
   - 하위 Modal (ReportModal, ConfirmModal)

### 메모이제이션 현황

- **useMemo**: getSalaryInfo, workHistory
- **useCallback**: 핸들러 함수들 (확인 필요)
- **React.memo**: 사용하지 않음 (컴포넌트 분리 후 적용 필요)

### 상태 공유 방식

- **Props**: schedule, onClose, onCheckOut, onCancel, onDelete
- **내부 State**: jobPosting, realTimeWorkLogs, activeTab
- **Derived State**: getSalaryInfo, workHistory (useMemo)

## Decision 1: 컴포넌트 간 상태 공유 패턴

### 선택: Props Drilling (Presentational/Container Pattern)

**근거**:
1. **간단한 계층 구조**: 컨테이너 → 탭 (1단계 깊이)
   - Props가 2단계 이상 전달되지 않으므로 Props Drilling 문제 없음
   - Context 오버헤드가 불필요하게 큼

2. **명확한 데이터 흐름**: 단방향 데이터 흐름 유지
   - 각 탭은 순수 Presentational Component
   - 모든 로직은 컨테이너(index.tsx)에서 관리
   - 디버깅 및 테스트 용이

3. **성능 최적화 가능**: React.memo + useCallback 조합
   - 각 탭을 React.memo로 래핑하여 불필요한 리렌더링 방지
   - 컨테이너에서 useCallback으로 핸들러 함수 메모이제이션

4. **프로젝트 일관성**: 기존 코드베이스 패턴 준수
   - 다른 Modal 컴포넌트들도 Props Drilling 사용
   - Context는 Theme, Auth 등 전역 상태에만 사용

### 대안 검토

#### Context API
- **장점**: Props Drilling 제거, 중간 컴포넌트 투명성
- **단점**:
  - 추가 복잡도 (Provider, Consumer)
  - 디버깅 어려움 (데이터 흐름 추적 어려움)
  - 성능 최적화 복잡 (Context 변경 시 모든 Consumer 리렌더링)
  - 테스트 복잡도 증가 (Provider 래핑 필요)
- **거부 이유**: 3개 탭만 있는 단순 구조에서 불필요한 오버엔지니어링

#### Compound Component Pattern
- **장점**: 유연한 컴포넌트 조합, 암시적 Props 전달
- **단점**:
  - 학습 곡선 높음
  - 코드 가독성 저하 (암시적 Props가 명시적 Props보다 이해하기 어려움)
  - 프로젝트의 다른 부분과 일관성 부족
- **거부 이유**: 탭 네비게이션은 고정된 구조이므로 유연성 불필요

### 구현 전략

```typescript
// index.tsx (Container Component)
const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = (props) => {
  // 모든 상태 관리 및 로직
  const [activeTab, setActiveTab] = useState('basic');
  const [jobPosting, setJobPosting] = useState(null);
  const [realTimeWorkLogs, setRealTimeWorkLogs] = useState([]);

  // 메모이제이션된 데이터
  const salaryInfo = useMemo(() => getSalaryInfo(), [deps]);
  const workHistory = useMemo(() => getWorkHistory(), [deps]);

  // 메모이제이션된 핸들러
  const handleUpdate = useCallback((field, value) => { /* ... */ }, [deps]);
  const handleCheckOut = useCallback(() => { /* ... */ }, [deps]);

  return (
    <Modal>
      {activeTab === 'basic' && (
        <BasicInfoTab
          schedule={schedule}
          jobPosting={jobPosting}
          onUpdate={handleUpdate}
        />
      )}
      {activeTab === 'work' && (
        <WorkInfoTab
          schedule={schedule}
          workLogs={realTimeWorkLogs}
          onCheckOut={handleCheckOut}
        />
      )}
      {activeTab === 'calculation' && (
        <CalculationTab
          salaryInfo={salaryInfo}
          workHistory={workHistory}
        />
      )}
    </Modal>
  );
};

// BasicInfoTab.tsx (Presentational Component)
export const BasicInfoTab = React.memo<BasicInfoTabProps>(({ schedule, jobPosting, onUpdate }) => {
  // 순수 렌더링 로직만
  return <div>...</div>;
});
```

## Decision 2: 메모이제이션 전략

### 선택: React.memo + useCallback + useMemo 조합

**근거**:
1. **불필요한 리렌더링 방지**:
   - 각 탭 컴포넌트를 React.memo로 래핑
   - Props가 변경되지 않으면 리렌더링 생략
   - 탭 전환 시 다른 탭이 리렌더링되지 않음

2. **핸들러 함수 안정성**:
   - 컨테이너에서 useCallback으로 핸들러 메모이제이션
   - 자식 컴포넌트에 전달되는 함수가 매번 새로 생성되지 않음
   - React.memo shallow comparison 통과

3. **비용이 큰 계산 최적화**:
   - getSalaryInfo, workHistory는 useMemo 유지
   - Firebase 데이터 기반 계산은 의존성이 변경될 때만 재계산

4. **성능 저하 방지**:
   - 기존 성능 유지 (번들 크기 < 305KB)
   - 탭 전환 응답 시간 < 100ms

### 대안 검토

#### React.memo 없이 Props만 사용
- **장점**: 코드 간결
- **단점**: 부모 리렌더링 시 모든 탭 리렌더링 (성능 저하)
- **거부 이유**: 성능 저하 허용 불가

#### useMemo 모든 곳에 사용
- **장점**: 이론적으로 최대 성능
- **단점**: 코드 복잡도 증가, 메모리 오버헤드, 과도한 최적화
- **거부 이유**: 비용이 큰 계산에만 useMemo 사용하는 것이 React 권장사항

### 구현 전략

```typescript
// index.tsx
const ScheduleDetailModal: React.FC<Props> = ({ schedule, onClose }) => {
  // useMemo: 비용이 큰 계산
  const salaryInfo = useMemo(() => calculateSalary(schedule, workLogs), [schedule, workLogs]);

  // useCallback: 자식에 전달되는 핸들러
  const handleUpdate = useCallback((field: keyof Schedule, value: any) => {
    // update logic
  }, [/* deps */]);

  return (
    <BasicInfoTab
      schedule={schedule}
      salaryInfo={salaryInfo}
      onUpdate={handleUpdate}
    />
  );
};

// BasicInfoTab.tsx
export const BasicInfoTab = React.memo<BasicInfoTabProps>((props) => {
  // 순수 렌더링 로직
  return <div>...</div>;
});
```

## Decision 3: 타입 정의 위치

### 선택: types.ts 별도 파일 (중앙 집중)

**근거**:
1. **타입 재사용성**:
   - 여러 탭에서 공통으로 사용하는 타입 (Schedule, WorkLog, Calculation)
   - 한 곳에서 정의하고 import하여 일관성 유지

2. **순환 참조 방지**:
   - 각 파일에서 타입을 정의하면 순환 참조 위험
   - types.ts에서 모든 타입 정의 → 순환 참조 없음

3. **타입 검색 용이성**:
   - 개발자가 타입을 찾을 때 types.ts만 확인
   - IDE 자동완성 및 타입 추론 개선

4. **프로젝트 일관성**:
   - 프로젝트의 다른 부분도 types/ 디렉토리 사용
   - ScheduleDetailModal/types.ts로 일관된 패턴 유지

### 대안 검토

#### 각 파일에 inline 타입 정의
- **장점**: 파일 간 의존성 최소화, 타입과 구현이 함께 위치
- **단점**:
  - 공통 타입 중복 정의 (DRY 위반)
  - 타입 변경 시 여러 파일 수정 필요
  - 순환 참조 위험
- **거부 이유**: 유지보수성 저하

#### 프로젝트 전역 types/ 디렉토리 사용
- **장점**: 전체 프로젝트에서 타입 공유
- **단점**:
  - ScheduleDetailModal 전용 타입이 전역에 노출
  - 타입 파일이 비대해짐
  - 도메인 경계가 불명확
- **거부 이유**: 도메인 경계 유지 필요

### 구현 전략

```typescript
// ScheduleDetailModal/types.ts
export interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleEvent | null;
  onCheckOut?: (scheduleId: string) => void;
  onCancel?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
}

export interface BasicInfoTabProps {
  schedule: ScheduleEvent;
  jobPosting: JobPosting | null;
  onUpdate: (field: keyof ScheduleEvent, value: any) => void;
  isReadOnly: boolean;
}

export interface WorkInfoTabProps {
  schedule: ScheduleEvent;
  workLogs: UnifiedWorkLog[];
  onCheckOut: (scheduleId: string) => void;
  isReadOnly: boolean;
}

export interface CalculationTabProps {
  salaryInfo: SalaryInfo;
  workHistory: WorkHistoryItem[];
}

// 공통 타입
export interface SalaryInfo {
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  baseSalary: number;
  totalHours: number;
  totalDays: number;
  basePay: number;
  allowances: PayrollCalculationResult['allowances'];
  tax?: number;
  taxRate?: number;
  afterTaxAmount?: number;
}

export interface WorkHistoryItem {
  label: string;
  value: string | number;
  type?: 'info' | 'warning' | 'success' | 'error';
}
```

## Decision 4: 파일 이동 전략

### 선택: 단계적 이동 (Git Rename 추적)

**근거**:
1. **Git 히스토리 보존**:
   - 파일을 삭제하고 새로 만들면 히스토리 손실
   - 단계적 이동으로 Git이 rename 추적 가능
   - `git log --follow` 명령어로 전체 히스토리 확인 가능

2. **리뷰 용이성**:
   - 각 단계가 명확한 커밋으로 분리
   - 리뷰어가 변경사항을 단계별로 확인 가능
   - 문제 발생 시 롤백 쉬움

3. **테스트 안정성**:
   - 각 단계마다 빌드 및 테스트 실행
   - 문제 조기 발견 및 수정 가능

### 구현 전략

**Step 1**: 디렉토리 생성 및 타입 분리
```bash
mkdir -p app2/src/pages/MySchedulePage/components/ScheduleDetailModal/tabs
# types.ts 먼저 생성 (기존 파일에서 타입만 추출)
git add ScheduleDetailModal/types.ts
git commit -m "refactor: Extract types from ScheduleDetailModal"
```

**Step 2**: 탭 컴포넌트 분리
```bash
# BasicInfoTab.tsx 생성 (기존 파일에서 Basic Tab 로직 추출)
git add ScheduleDetailModal/tabs/BasicInfoTab.tsx
git commit -m "refactor: Extract BasicInfoTab component"

# WorkInfoTab.tsx, CalculationTab.tsx 동일 방식
```

**Step 3**: 메인 컨테이너 정리
```bash
# 기존 ScheduleDetailModal.tsx → ScheduleDetailModal/index.tsx
git mv ScheduleDetailModal.tsx ScheduleDetailModal/index.tsx
git commit -m "refactor: Move ScheduleDetailModal to directory structure"

# index.tsx에서 탭 컴포넌트 import로 교체
git add ScheduleDetailModal/index.tsx
git commit -m "refactor: Integrate tab components in ScheduleDetailModal"
```

**Step 4**: Import 경로 업데이트
```bash
# MySchedulePage/index.tsx 수정
git add MySchedulePage/index.tsx
git commit -m "refactor: Update import path for ScheduleDetailModal"
```

## Decision 5: 다크모드 스타일 유지 전략

### 선택: 기존 Tailwind `dark:` 클래스 모두 복사

**근거**:
1. **픽셀 단위 동일성**: 사용자 경험 변경 없음
2. **Constitution 준수**: 다크모드 필수 원칙
3. **검증 용이성**: 라이트/다크 모드 전환으로 즉시 확인

### 구현 전략

```typescript
// 기존 (ScheduleDetailModal.tsx)
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-300">텍스트</p>
</div>

// 분리 후 (BasicInfoTab.tsx) - 동일하게 유지
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-300">텍스트</p>
</div>
```

**검증 체크리스트**:
- [ ] 모든 `bg-*` 클래스에 `dark:bg-*` 있음
- [ ] 모든 `text-*` 클래스에 `dark:text-*` 있음
- [ ] 모든 `border-*` 클래스에 `dark:border-*` 있음
- [ ] 수동 테스트: 라이트/다크 모드 전환 후 각 탭 확인

## 요약 및 Next Steps

### 확정된 결정사항

| 항목 | 결정 | 근거 |
|------|------|------|
| **상태 공유** | Props Drilling (Presentational/Container) | 간단한 계층, 명확한 데이터 흐름, 프로젝트 일관성 |
| **메모이제이션** | React.memo + useCallback + useMemo | 성능 유지, 불필요한 리렌더링 방지 |
| **타입 정의** | types.ts 별도 파일 (중앙 집중) | 재사용성, 순환 참조 방지, 프로젝트 일관성 |
| **파일 이동** | 단계적 이동 (Git Rename 추적) | 히스토리 보존, 리뷰 용이, 테스트 안정성 |
| **다크모드** | 기존 Tailwind 클래스 모두 복사 | 픽셀 단위 동일, Constitution 준수 |

### Phase 1로 진행

이제 다음 아티팩트를 생성합니다:
1. **data-model.md**: Props 인터페이스 및 공통 타입
2. **contracts/**: TypeScript 인터페이스 파일
3. **quickstart.md**: 컴포넌트 사용법 및 예제
4. **Agent Context Update**: Claude agent-context.md 업데이트

### 위험 요소 및 완화 전략

| 위험 | 완화 전략 |
|------|----------|
| 메모이제이션 누락으로 성능 저하 | React DevTools Profiler로 리렌더링 측정, useCallback/React.memo 철저히 적용 |
| Import 경로 변경 누락 | TypeScript 컴파일 에러로 즉시 발견, IDE의 "Find All References" 사용 |
| 다크모드 스타일 누락 | 각 탭마다 라이트/다크 모드 수동 테스트, 체크리스트 활용 |
| Git 히스토리 손실 | 단계적 이동으로 rename 추적, `git log --follow` 확인 |
