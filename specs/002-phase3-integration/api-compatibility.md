# API Compatibility Requirements: DateFilter Migration

**Source**: [app2/src/stores/dateFilterStore.ts](../../app2/src/stores/dateFilterStore.ts) (migrated from DateFilterContext)
**Target**: Zustand Store + Compatibility Hook
**Created**: 2025-11-20

## 📋 API Interface (100% Compatibility Required)

### DateFilterContextType

```typescript
interface DateFilterContextType {
  selectedDate: string;          // YYYY-MM-DD 형식
  setSelectedDate: (date: string) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
  availableDates: string[];      // 토너먼트가 있는 날짜 목록 (정렬됨)
}
```

## 🔑 핵심 동작 요구사항

### 1. localStorage Persistence
- **Key**: `'tournament_selected_date'` → **NEW**: `'date-filter-storage'`
- **기존 데이터 마이그레이션**: ❌ 없음 (Clarification #2 결정)
- **Save Trigger**: `setSelectedDate()` 호출 시 자동 저장
- **Restore Logic**:
  1. localStorage에서 복원 시도
  2. 복원된 날짜가 `availableDates`에 있으면 사용
  3. 없으면 기본 날짜 로직 적용

### 2. availableDates 자동 계산
- **Source**: `useTournamentData().tournaments` (TournamentDataContext)
- **Logic**:
  ```typescript
  const availableDates = tournaments
    .map(t => t.dateKey)
    .filter(dateKey => dateKey)  // 빈 값 제외
    .sort();                     // 오름차순 정렬

  // 중복 제거
  return Array.from(new Set(dates));
  ```
- **Dependencies**: `useTournamentData` Hook (기존 유지)

### 3. 기본 날짜 선택 로직
**Trigger**: `availableDates` 변경 시 (useEffect)

**우선순위**:
1. localStorage에 저장된 날짜가 `availableDates`에 있으면 복원
2. 오늘 날짜 (`new Date().toISOString().split('T')[0]`)가 `availableDates`에 있으면 선택
3. 오늘 이후 가장 가까운 미래 날짜 선택
4. 미래 날짜 없으면 배열의 마지막 날짜 선택

**Code Pattern** (from DateFilterContext:65-74):
```typescript
const today = new Date().toISOString().split('T')[0] || '';
if (availableDates.includes(today)) {
  setSelectedDate(today);
} else {
  const futureDates = availableDates.filter(date => date >= today);
  const defaultDate = futureDates[0] || availableDates[availableDates.length - 1] || '';
  setSelectedDate(defaultDate);
}
```

### 4. Navigation Functions

#### goToNextDate()
**Logic** (from DateFilterContext:88-98):
- 현재 선택된 날짜의 인덱스 찾기
- 마지막 날짜면 무시 (`currentIndex === availableDates.length - 1`)
- 다음 날짜로 이동 (`availableDates[currentIndex + 1]`)

#### goToPreviousDate()
**Logic** (from DateFilterContext:101-111):
- 현재 선택된 날짜의 인덱스 찾기
- 첫 번째 날짜면 무시 (`currentIndex <= 0`)
- 이전 날짜로 이동 (`availableDates[currentIndex - 1]`)

#### goToToday()
**Logic** (from DateFilterContext:114-126):
- 오늘 날짜 계산 (`new Date().toISOString().split('T')[0]`)
- 오늘 날짜가 `availableDates`에 있으면 선택
- 없으면 가장 가까운 미래 날짜 선택
- 미래 날짜 없으면 배열의 마지막 날짜 선택

### 5. Logging
**Pattern** (from DateFilterContext:57-60, 81-84):
```typescript
logger.info('날짜 선택 복원됨', {
  component: 'DateFilterContext',
  data: { savedDate }
});

logger.info('날짜 선택 변경됨', {
  component: 'DateFilterContext',
  data: { selectedDate: date }
});
```

**Zustand Store Logging**:
- Component명: `'DateFilterStore'` (devtools name)
- Log location: `setSelectedDate`, localStorage 복원 시

## 🎯 Migration Strategy

### Phase 1: Zustand Store 생성
**File**: `app2/src/stores/dateFilterStore.ts`

**Store Structure**:
```typescript
interface DateFilterState {
  selectedDate: string;
  availableDates: string[];
}

interface DateFilterActions {
  setSelectedDate: (date: string) => void;
  setAvailableDates: (dates: string[]) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
}

// Middleware: devtools → persist → immer
export const useDateFilterStore = create<DateFilterStore>()(
  devtools(
    persist(
      immer((set, get) => ({ /* ... */ })),
      {
        name: 'date-filter-storage',  // NEW KEY
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ selectedDate: state.selectedDate }),
      }
    ),
    {
      name: 'DateFilterStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
```

### Phase 2: Compatibility Hook 생성
**File**: `app2/src/hooks/useDateFilter.ts`

**Hook Structure**:
```typescript
export const useDateFilter = (): DateFilterContextType => {
  const { tournaments } = useTournamentData();
  const store = useDateFilterStore();

  // availableDates 자동 계산 (useEffect)
  useEffect(() => {
    const dates = tournaments
      .map(t => t.dateKey)
      .filter(dateKey => dateKey)
      .sort();
    const uniqueDates = Array.from(new Set(dates));
    store.setAvailableDates(uniqueDates);
  }, [tournaments, store]);

  // 기본 날짜 선택 로직 (useEffect)
  useEffect(() => {
    if (store.availableDates.length === 0) return;
    if (store.selectedDate) return; // 이미 선택됨

    // localStorage 복원은 Zustand persist가 자동 처리
    // 기본 날짜 로직만 구현
    const today = new Date().toISOString().split('T')[0] || '';
    // ... 기본 날짜 선택 로직
  }, [store.availableDates, store.selectedDate]);

  // Context API와 동일한 인터페이스 반환
  return {
    selectedDate: store.selectedDate,
    setSelectedDate: store.setSelectedDate,
    goToNextDate: store.goToNextDate,
    goToPreviousDate: store.goToPreviousDate,
    goToToday: store.goToToday,
    availableDates: store.availableDates,
  };
};
```

### Phase 3: 마이그레이션 순서
1. ✅ DateFilterStore 생성 및 테스트
2. ✅ useDateFilter Hook 생성 (API 100% 호환)
3. ✅ 6개 파일 마이그레이션:
   - TablesPage (import 변경만)
   - ParticipantsPage (import 변경만)
   - DateNavigator (import 변경만)
   - 나머지 3개 파일
4. ✅ DateFilterContext.tsx 삭제
5. ✅ 통합 테스트

## 🧪 테스트 검증 항목

### API Compatibility Tests
- [ ] `useDateFilter()` Hook이 동일한 인터페이스 반환
- [ ] `selectedDate` 타입: `string` (YYYY-MM-DD)
- [ ] `availableDates` 타입: `string[]` (정렬됨, 중복 없음)
- [ ] All 5 functions callable: `setSelectedDate`, `goToNextDate`, `goToPreviousDate`, `goToToday`

### Functional Tests
- [ ] localStorage 저장/복원 (Key: `'date-filter-storage'`)
- [ ] availableDates 자동 계산 (tournaments 변경 시)
- [ ] 기본 날짜 선택 로직 (오늘 → 미래 가장 가까운 날짜 → 마지막 날짜)
- [ ] Navigation 함수 동작 (next, previous, today)
- [ ] Logging 정상 동작

### Integration Tests
- [ ] TablesPage에서 날짜 선택 → ParticipantsPage에서 유지
- [ ] 브라우저 새로고침 시 선택한 날짜 복원
- [ ] DateNavigator 버튼 클릭 시 정상 동작

## 📝 Breaking Changes

**NONE** - 100% API 호환성 유지

**Import 변경** (마이그레이션 시):
```typescript
// Before
import { useDateFilter } from '@/contexts/DateFilterContext';

// After
import { useDateFilter } from '@/hooks/useDateFilter';
```

**사용법**: 변경 없음
```typescript
const { selectedDate, setSelectedDate, goToNextDate, /* ... */ } = useDateFilter();
```

## 🎓 Pattern Reference

**Phase 3-1**: [app2/src/stores/unifiedDataStore.ts](../../app2/src/stores/unifiedDataStore.ts)

**Key Patterns**:
1. Middleware 순서: `devtools( persist( immer(...) ) )`
2. devtools 설정: `{ name: 'StoreName', enabled: process.env.NODE_ENV === 'development' }`
3. 외부 변수로 Firebase unsubscribe 관리 (DateFilter는 불필요)
4. Selector 패턴: `get()` 사용
5. immer draft 상태 수정 패턴

---

**Status**: ✅ API 분석 완료 - 구현 준비 완료
**Next**: T016 (DateFilterStore 생성)
