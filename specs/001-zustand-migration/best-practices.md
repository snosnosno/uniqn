# Zustand Store 베스트 프랙티스 가이드

**Feature**: 001-zustand-migration - 효율적인 Zustand 사용을 위한 가이드
**버전**: 1.0.0
**최종 업데이트**: 2025-11-19
**대상**: UNIQN 프로젝트 개발자

---

## 📚 목차

1. [성능 최적화](#성능-최적화)
2. [State 설계 원칙](#state-설계-원칙)
3. [컴포넌트 패턴](#컴포넌트-패턴)
4. [에러 처리](#에러-처리)
5. [테스트 작성](#테스트-작성)
6. [안티 패턴](#안티-패턴)

---

## 성능 최적화

### 1. Selector를 항상 사용하세요

**원칙**: 전체 Store를 구독하지 마세요. 필요한 state만 선택적으로 구독합니다.

```typescript
// ✅ 좋음 - 필요한 state만 구독
function StaffCount() {
  const staff = useUnifiedDataStore((state) => state.staff)
  return <div>스태프 수: {staff.size}</div>
}

// ❌ 나쁨 - 전체 store 구독 (모든 state 변경 시 리렌더링)
function StaffCount() {
  const store = useUnifiedDataStore()
  return <div>스태프 수: {store.staff.size}</div>
}
```

**이유**: Selector를 사용하면 해당 state가 변경될 때만 리렌더링됩니다.

### 2. useShallow로 객체 구독 최적화

**원칙**: 여러 state를 객체로 구독할 때는 `useShallow`를 사용합니다.

```typescript
import { useShallow } from 'zustand/react/shallow'

// ✅ 좋음 - useShallow 사용
const { staff, workLogs, isLoading } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
    isLoading: state.isLoading,
  }))
)

// ❌ 나쁨 - 매번 새 객체 생성으로 불필요한 리렌더링
const { staff, workLogs, isLoading } = useUnifiedDataStore((state) => ({
  staff: state.staff,
  workLogs: state.workLogs,
  isLoading: state.isLoading,
}))
```

**이유**: useShallow는 얕은 비교로 실제 값이 변경되지 않으면 리렌더링하지 않습니다.

### 3. Batch Actions를 적극 활용하세요

**원칙**: 여러 항목을 동시에 처리할 때는 Batch Actions를 사용합니다.

```typescript
// ✅ 좋음 - Batch로 한 번에 처리 (1번의 리렌더링)
const updateStaffBatch = useUnifiedDataStore((state) => state.updateStaffBatch)
updateStaffBatch(staffList)

// ❌ 나쁨 - 개별 업데이트 (10번의 리렌더링)
const updateStaff = useUnifiedDataStore((state) => state.updateStaff)
staffList.forEach(staff => updateStaff(staff))
```

**성능 차이**:
- 개별 업데이트 10회: 10번의 `set()` 호출 → 10번의 리렌더링
- Batch 업데이트 1회: 1번의 `set()` 호출 → 1번의 리렌더링
- **성능 향상: 약 90% 리렌더링 감소**

### 4. Actions를 컴포넌트 외부에서 가져오세요

**원칙**: Actions는 useEffect 의존성 배열에 포함되어도 안전합니다.

```typescript
// ✅ 좋음 - Actions를 useEffect 외부에서 가져옴
function StaffManager() {
  const subscribeAll = useUnifiedDataStore((state) => state.subscribeAll)
  const unsubscribeAll = useUnifiedDataStore((state) => state.unsubscribeAll)

  useEffect(() => {
    subscribeAll(userId, role)
    return () => unsubscribeAll()
  }, [userId, role, subscribeAll, unsubscribeAll])
}

// ⚠️ 주의 - useCallback 불필요 (Zustand Actions는 이미 안정적)
```

**이유**: Zustand의 Actions는 참조가 변하지 않아 useCallback이 불필요합니다.

---

## State 설계 원칙

### 1. Map 자료구조 활용

**원칙**: ID 기반 조회가 필요한 데이터는 Map을 사용합니다.

```typescript
// ✅ 좋음 - Map 사용 (O(1) 조회)
const staff = useUnifiedDataStore((state) => state.staff)
const targetStaff = staff.get('staff123') // O(1)

// ❌ 나쁨 - Array 사용 (O(n) 조회)
const staffArray = Array.from(staff.values())
const targetStaff = staffArray.find(s => s.id === 'staff123') // O(n)
```

**성능 차이**:
- Map.get(): O(1) - 10,000개 데이터에서도 즉시 조회
- Array.find(): O(n) - 10,000개 데이터에서 평균 5,000번 비교

### 2. 정규화된 State 유지

**원칙**: 중복 데이터를 저장하지 말고, ID 참조를 사용합니다.

```typescript
// ✅ 좋음 - ID 참조 사용
interface WorkLog {
  id: string
  staffId: string  // ✅ Staff ID만 저장
  eventId: string  // ✅ Event ID만 저장
}

// ❌ 나쁨 - 중복 데이터 저장
interface WorkLog {
  id: string
  staff: Staff      // ❌ 전체 Staff 객체 저장
  event: Event      // ❌ 전체 Event 객체 저장
}
```

**이유**: 데이터 일관성 유지와 메모리 효율성을 위해.

### 3. 최소한의 State만 저장

**원칙**: 계산 가능한 값은 State에 저장하지 않습니다.

```typescript
// ✅ 좋음 - 계산된 값은 컴포넌트에서 생성
function StaffList() {
  const staff = useUnifiedDataStore((state) => state.staff)
  const staffCount = staff.size  // ✅ 즉시 계산
  const staffArray = useMemo(() => Array.from(staff.values()), [staff])
}

// ❌ 나쁨 - 계산된 값을 State에 저장
interface UnifiedDataState {
  staff: Map<string, Staff>
  staffCount: number        // ❌ 불필요 (staff.size로 계산 가능)
  staffArray: Staff[]       // ❌ 불필요 (Array.from()으로 변환 가능)
}
```

---

## 컴포넌트 패턴

### 1. 단일 책임 원칙

**원칙**: 각 컴포넌트는 하나의 책임만 가집니다.

```typescript
// ✅ 좋음 - 역할 분리
function StaffListContainer() {
  const staff = useUnifiedDataStore((state) => state.staff)
  const isLoading = useUnifiedDataStore((state) => state.isLoading)

  if (isLoading) return <LoadingSpinner />

  return <StaffList staff={Array.from(staff.values())} />
}

function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <div>
      {staff.map(s => <StaffItem key={s.id} staff={s} />)}
    </div>
  )
}

function StaffItem({ staff }: { staff: Staff }) {
  const updateStaff = useUnifiedDataStore((state) => state.updateStaff)

  return (
    <div onClick={() => updateStaff({ ...staff, name: '수정됨' })}>
      {staff.name}
    </div>
  )
}

// ❌ 나쁨 - 모든 로직이 한 컴포넌트에
function StaffListAll() {
  // 모든 로직이 여기에...
}
```

### 2. Props Drilling 회피

**원칙**: Zustand Store를 통해 전역 상태를 직접 접근합니다.

```typescript
// ✅ 좋음 - Store에서 직접 가져옴
function DeepChildComponent() {
  const staff = useUnifiedDataStore((state) => state.staff)
  return <div>{staff.size}</div>
}

// ❌ 나쁨 - Props로 여러 단계 전달
function Parent() {
  const staff = useUnifiedDataStore((state) => state.staff)
  return <Child staff={staff} />
}

function Child({ staff }) {
  return <GrandChild staff={staff} />
}

function GrandChild({ staff }) {
  return <div>{staff.size}</div>
}
```

### 3. Custom Hook 패턴

**원칙**: 복잡한 로직은 Custom Hook으로 분리합니다.

```typescript
// ✅ 좋음 - Custom Hook으로 로직 분리
function useStaffManagement() {
  const staff = useUnifiedDataStore((state) => state.staff)
  const updateStaff = useUnifiedDataStore((state) => state.updateStaff)
  const deleteStaff = useUnifiedDataStore((state) => state.deleteStaff)

  const staffArray = useMemo(() => Array.from(staff.values()), [staff])

  const handleUpdate = useCallback((id: string, updates: Partial<Staff>) => {
    const target = staff.get(id)
    if (target) {
      updateStaff({ ...target, ...updates, updatedAt: Timestamp.now() })
    }
  }, [staff, updateStaff])

  const handleDelete = useCallback((id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteStaff(id)
    }
  }, [deleteStaff])

  return { staffArray, handleUpdate, handleDelete }
}

// 사용
function StaffList() {
  const { staffArray, handleUpdate, handleDelete } = useStaffManagement()
  // ...
}
```

---

## 에러 처리

### 1. 에러 상태 활용

**원칙**: Store의 error 상태를 활용하여 에러를 처리합니다.

```typescript
// ✅ 좋음 - error 상태 확인
function StaffList() {
  const error = useUnifiedDataStore((state) => state.error)
  const staff = useUnifiedDataStore((state) => state.staff)

  if (error) {
    return (
      <div className="error">
        <p>에러 발생: {error}</p>
        <button onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    )
  }

  return <div>{/* 정상 UI */}</div>
}

// ❌ 나쁨 - try-catch로만 처리
function StaffList() {
  try {
    const staff = useUnifiedDataStore((state) => state.staff)
    return <div>{/* UI */}</div>
  } catch (error) {
    return <div>에러</div>
  }
}
```

### 2. Firebase 구독 에러 처리

**원칙**: Firebase 구독 중 발생한 에러는 Store의 setError로 저장합니다.

```typescript
// ✅ 좋음 - Store 내부에서 에러 처리
subscribeAll: (userId: string, role: string) => {
  try {
    onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        // 데이터 처리
      },
      (error) => {
        logger.error('Firebase 구독 에러', error)
        set({ error: error.message })  // ✅ Store에 에러 저장
      }
    )
  } catch (error) {
    logger.error('구독 초기화 에러', error)
    set({ error: '데이터 구독에 실패했습니다' })
  }
}
```

---

## 테스트 작성

### 1. Store 단위 테스트

```typescript
import { renderHook, act } from '@testing-library/react'
import { useUnifiedDataStore } from '../unifiedDataStore'

describe('UnifiedDataStore', () => {
  beforeEach(() => {
    // Store 초기화
    const { result } = renderHook(() => useUnifiedDataStore())
    act(() => {
      result.current.setStaff(new Map())
    })
  })

  it('should update staff correctly', () => {
    const { result } = renderHook(() => useUnifiedDataStore())

    const testStaff: Staff = {
      id: 'staff1',
      name: '홍길동',
      // ...
    }

    act(() => {
      result.current.updateStaff(testStaff)
    })

    expect(result.current.staff.get('staff1')).toEqual(testStaff)
    expect(result.current.staff.size).toBe(1)
  })
})
```

### 2. 컴포넌트 통합 테스트

```typescript
import { render, screen } from '@testing-library/react'
import { useUnifiedDataStore } from '../stores/unifiedDataStore'

// Mock Store
jest.mock('../stores/unifiedDataStore')

describe('StaffList', () => {
  it('should render staff list', () => {
    // Store Mock 설정
    (useUnifiedDataStore as jest.Mock).mockImplementation((selector) =>
      selector({
        staff: new Map([
          ['staff1', { id: 'staff1', name: '홍길동' }],
        ]),
        isLoading: false,
        error: null,
      })
    )

    render(<StaffList />)
    expect(screen.getByText('홍길동')).toBeInTheDocument()
  })
})
```

---

## 안티 패턴

### ❌ 1. 전체 Store 구독

```typescript
// ❌ 나쁨
const store = useUnifiedDataStore()

// ✅ 좋음
const staff = useUnifiedDataStore((state) => state.staff)
```

### ❌ 2. Actions를 useCallback으로 감싸기

```typescript
// ❌ 나쁨 - 불필요한 useCallback
const updateStaff = useCallback(
  useUnifiedDataStore((state) => state.updateStaff),
  []
)

// ✅ 좋음 - Actions는 이미 안정적
const updateStaff = useUnifiedDataStore((state) => state.updateStaff)
```

### ❌ 3. State를 직접 수정

```typescript
// ❌ 나쁨 - 직접 수정 (Immer를 사용해도 권장하지 않음)
const staff = useUnifiedDataStore((state) => state.staff)
staff.set('newId', newStaff)  // ❌ 직접 수정

// ✅ 좋음 - Actions 사용
const updateStaff = useUnifiedDataStore((state) => state.updateStaff)
updateStaff(newStaff)  // ✅ Actions 사용
```

### ❌ 4. 개별 업데이트 반복

```typescript
// ❌ 나쁨 - 여러 번 리렌더링
staffList.forEach(staff => updateStaff(staff))

// ✅ 좋음 - Batch 사용
updateStaffBatch(staffList)
```

### ❌ 5. 계산된 값을 State에 저장

```typescript
// ❌ 나쁨
interface UnifiedDataState {
  staff: Map<string, Staff>
  staffCount: number  // ❌ staff.size로 계산 가능
}

// ✅ 좋음
const staffCount = staff.size  // ✅ 즉시 계산
```

---

## 체크리스트

### 새 컴포넌트 작성 시

- [ ] Selector를 사용하여 필요한 state만 구독했나요?
- [ ] 여러 state를 구독할 때 useShallow를 사용했나요?
- [ ] 대량 작업 시 Batch Actions를 사용했나요?
- [ ] Loading과 Error 상태를 처리했나요?
- [ ] Props Drilling을 피하고 Store를 직접 사용했나요?
- [ ] 복잡한 로직은 Custom Hook으로 분리했나요?

### 성능 최적화 시

- [ ] React DevTools Profiler로 리렌더링 확인했나요?
- [ ] 불필요한 state 구독이 없나요?
- [ ] useMemo/useCallback을 적절히 사용했나요?
- [ ] Batch Actions를 활용하고 있나요?

### 테스트 작성 시

- [ ] Store 단위 테스트를 작성했나요?
- [ ] 컴포넌트 통합 테스트를 작성했나요?
- [ ] 에러 케이스를 테스트했나요?
- [ ] Loading 상태를 테스트했나요?

---

**작성자**: Claude Code
**버전**: 1.0.0
**최종 업데이트**: 2025-11-19
