# 📚 T-HOLDEM 마이그레이션 가이드

이 문서는 T-HOLDEM 프로젝트의 주요 라이브러리 마이그레이션 가이드를 통합하여 제공합니다.

## 📋 목차

1. [TypeScript Strict Mode 마이그레이션](#typescript-strict-mode-마이그레이션)
2. [FullCalendar → LightweightCalendar](#fullcalendar--lightweightcalendar)
3. [react-data-grid → @tanstack/react-table](#react-data-grid--tanstackreact-table)
4. [Context API → Zustand](#context-api--zustand)
5. [라이브러리 교체 일반 가이드](#라이브러리-교체-일반-가이드)

---

## TypeScript Strict Mode 마이그레이션

### 개요
2025년 1월 30일 TypeScript Strict Mode를 성공적으로 적용했습니다.

### 설정 변경
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 주요 패턴 변경

#### 1. 배열/객체 접근 안전성
```typescript
// Before
const value = array[index];

// After
const value = array[index] || defaultValue;
// 또는
const value = array[index];
if (value !== undefined) {
  // 사용
}
```

#### 2. Optional Property 처리
```typescript
// Before
const props = {
  ...baseProps,
  optionalProp: optionalValue || undefined
};

// After
const props = {
  ...baseProps,
  ...(optionalValue && { optionalProp: optionalValue })
};
```

#### 3. 타입 가드 활용
```typescript
// 타입 가드 함수
function isValidData(data: unknown): data is ValidDataType {
  return (
    typeof data === 'object' &&
    data !== null &&
    'requiredField' in data
  );
}

// 사용
if (isValidData(response)) {
  // response는 ValidDataType으로 추론됨
}
```

### 마이그레이션 체크리스트
- [x] tsconfig.json strict 옵션 활성화
- [x] 모든 any 타입 제거
- [x] 배열/객체 접근 undefined 체크
- [x] Optional property 조건부 spread 패턴 적용
- [x] 타입 가드 함수 구현
- [x] 빌드 오류 해결

---

## FullCalendar → LightweightCalendar

### 개요
- **절감**: ~480KB (96%)
- **마이그레이션 난이도**: 중간
- **영향 범위**: TournamentSchedulePage, 일정 관리 기능

### 설치 및 제거
```bash
# FullCalendar 제거
npm uninstall @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction

# date-fns 설치 (이미 설치되어 있을 수 있음)
npm install date-fns
```

### API 변경사항

#### Props 매핑
```typescript
// FullCalendar
<FullCalendar
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView="dayGridMonth"
  events={events}
  eventClick={handleEventClick}
  dateClick={handleDateClick}
  headerToolbar={{
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  }}
/>

// LightweightCalendar
<LightweightCalendar
  events={events}
  view={view} // 'month' | 'week' | 'day'
  onEventClick={handleEventClick}
  onDateClick={handleDateClick}
  onViewChange={setView}
  locale="ko"
/>
```

#### 이벤트 객체 변환
```typescript
// FullCalendar 이벤트
const fcEvent = {
  id: '1',
  title: 'Tournament',
  start: '2024-01-20T10:00:00',
  end: '2024-01-20T18:00:00',
  backgroundColor: '#3788d8'
};

// LightweightCalendar 이벤트
const lwEvent: CalendarEvent = {
  id: '1',
  title: 'Tournament',
  start: new Date('2024-01-20T10:00:00'),
  end: new Date('2024-01-20T18:00:00'),
  color: '#3788d8',
  allDay: false
};
```

### 마이그레이션 단계

1. **컴포넌트 교체**
   ```typescript
   // 1. Import 변경
   import LightweightCalendar from '../components/LightweightCalendar';
   
   // 2. State 추가 (view 관리)
   const [view, setView] = useState<'month' | 'week' | 'day'>('month');
   
   // 3. 이벤트 데이터 변환
   const calendarEvents = tournaments.map(t => ({
     id: t.id,
     title: t.title,
     start: t.startDate.toDate(),
     end: t.endDate.toDate(),
     color: getEventColor(t.status)
   }));
   ```

2. **기능 보완**
   - 주/일 뷰가 필요한 경우 컴포넌트 확장
   - 커스텀 이벤트 렌더링이 필요한 경우 renderEvent prop 활용

---

## react-data-grid → @tanstack/react-table

### 개요
- **절감**: ~145KB (85%)
- **마이그레이션 난이도**: 높음
- **영향 범위**: ShiftSchedulePage, 딜러 배치 관리

### 설치 및 제거
```bash
# react-data-grid 제거
npm uninstall react-data-grid

# @tanstack/react-table 설치
npm install @tanstack/react-table
```

### 주요 변경사항

#### 1. 데이터 구조
```typescript
// react-data-grid
interface Row {
  id: string;
  [key: string]: any;
}

// @tanstack/react-table
interface GridRow {
  id: string;
  dealerName: string;
  startTime: string;
  [timeSlot: string]: string;
}
```

#### 2. 컬럼 정의
```typescript
// react-data-grid
const columns = [
  { key: 'dealerName', name: '딜러명', width: 120 },
  { key: 'startTime', name: '출근시간', width: 100 },
  ...timeSlots.map(slot => ({
    key: slot,
    name: slot,
    editor: CustomEditor,
    formatter: CustomFormatter
  }))
];

// @tanstack/react-table
const columns: ColumnDef<GridRow>[] = [
  {
    id: 'dealerName',
    accessorKey: 'dealerName',
    header: '딜러명',
    size: 120,
    cell: ({ row }) => (
      <div className="dealer-cell">{row.original.dealerName}</div>
    )
  },
  ...timeSlots.map(slot => ({
    id: slot,
    accessorKey: slot,
    header: slot,
    size: 100,
    cell: ({ row, getValue }) => (
      <EditableCell
        value={getValue()}
        onSave={(value) => handleCellChange(row.id, slot, value)}
      />
    )
  }))
];
```

#### 3. 셀 편집
```typescript
// LightweightDataGrid에서 제공하는 편집 기능
const EditableCell = ({ value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  if (isEditing) {
    return (
      <CellEditor
        value={value}
        onSave={(newValue) => {
          onSave(newValue);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }
  
  return (
    <div onClick={() => setIsEditing(true)}>
      {value || '대기'}
    </div>
  );
};
```

### 마이그레이션 체크리스트
- [ ] react-data-grid 제거
- [ ] @tanstack/react-table 설치
- [ ] 데이터 구조 변환
- [ ] 컬럼 정의 마이그레이션
- [ ] 셀 편집 기능 구현
- [ ] 스타일 조정
- [ ] 성능 테스트

---

## Context API → Zustand

### 개요
- **개선사항**: 보일러플레이트 감소, 선택적 구독, DevTools 지원
- **마이그레이션 난이도**: 낮음 (호환성 레이어 제공)
- **영향 범위**: TournamentContext 사용 컴포넌트

### 설치
```bash
npm install zustand
```

### Store 생성
```typescript
// src/stores/tournamentStore.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface TournamentState {
  // State
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  
  // Actions
  setTournaments: (tournaments: Tournament[]) => void;
  addTournament: (tournament: Tournament) => void;
  updateTournament: (id: string, updates: Partial<Tournament>) => void;
  
  // Selectors
  getActiveTournaments: () => Tournament[];
}

export const useTournamentStore = create<TournamentState>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        tournaments: [],
        currentTournament: null,
        
        // Actions
        setTournaments: (tournaments) => set({ tournaments }),
        addTournament: (tournament) => 
          set((state) => ({ 
            tournaments: [...state.tournaments, tournament] 
          })),
        updateTournament: (id, updates) =>
          set((state) => ({
            tournaments: state.tournaments.map(t =>
              t.id === id ? { ...t, ...updates } : t
            )
          })),
          
        // Selectors
        getActiveTournaments: () => {
          const state = get();
          return state.tournaments.filter(t => t.status === 'active');
        }
      }),
      {
        name: 'tournament-storage'
      }
    )
  )
);
```

### 점진적 마이그레이션

#### 1단계: 호환성 레이어
```typescript
// src/contexts/TournamentContextAdapter.tsx
export const TournamentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const store = useTournamentStore();
  
  const contextValue = {
    tournaments: store.tournaments,
    currentTournament: store.currentTournament,
    addTournament: store.addTournament,
    updateTournament: store.updateTournament,
    dispatch: (action: any) => {
      // 기존 dispatch 호출을 Zustand action으로 변환
      switch (action.type) {
        case 'SET_TOURNAMENTS':
          store.setTournaments(action.payload);
          break;
        // ... 다른 액션들
      }
    }
  };
  
  return (
    <TournamentContext.Provider value={contextValue}>
      {children}
    </TournamentContext.Provider>
  );
};
```

#### 2단계: 컴포넌트 마이그레이션
```typescript
// Before (Context API)
const { tournaments, dispatch } = useTournamentContext();

// After (Zustand - 직접 사용)
const { tournaments, addTournament } = useTournamentStore();

// 또는 선택적 구독
const tournaments = useTournamentStore(state => state.tournaments);
const addTournament = useTournamentStore(state => state.addTournament);
```

### 장점
1. **선택적 구독**: 필요한 state만 구독하여 불필요한 리렌더링 방지
2. **DevTools**: Redux DevTools로 상태 변화 추적
3. **영속성**: localStorage에 자동 저장/복원
4. **타입 안전성**: TypeScript 완벽 지원

---

## 라이브러리 교체 일반 가이드

### 교체 전 체크리스트
1. **영향 분석**
   - [ ] 사용 중인 컴포넌트 목록 작성
   - [ ] 주요 기능 의존성 파악
   - [ ] 대체 라이브러리 기능 비교

2. **위험 평가**
   - [ ] 기능 누락 확인
   - [ ] 성능 영향 예측
   - [ ] 마이그레이션 비용 산정

### 교체 프로세스

#### 1단계: 준비
```bash
# 브랜치 생성
git checkout -b feature/replace-library-name

# 현재 번들 크기 측정
npm run analyze:bundle
```

#### 2단계: 구현
1. 새 라이브러리 설치
2. 어댑터/래퍼 컴포넌트 생성
3. 한 컴포넌트씩 점진적 교체
4. 테스트 실행

#### 3단계: 검증
```bash
# 번들 크기 비교
npm run analyze:bundle

# 성능 테스트
npm run lighthouse

# 기능 테스트
npm test
```

#### 4단계: 정리
1. 이전 라이브러리 제거
2. 불필요한 코드 정리
3. 문서 업데이트
4. PR 생성

### 롤백 계획
- 각 단계별 커밋으로 롤백 포인트 생성
- feature 브랜치에서 충분한 테스트 후 merge
- 문제 발생 시 이전 커밋으로 즉시 롤백

---

## 문제 해결 가이드

### TypeScript 오류
```typescript
// Object is possibly 'undefined'
if (value !== undefined) {
  // 사용
}

// Property does not exist
interface ExtendedType extends BaseType {
  newProperty: string;
}
```

### 빌드 오류
```bash
# 캐시 삭제
rm -rf node_modules/.cache
npm run build

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### 성능 문제
1. React DevTools Profiler로 리렌더링 확인
2. 메모이제이션 적용 (useMemo, useCallback)
3. 동적 import로 코드 분할

---

이 가이드는 실제 마이그레이션 경험을 바탕으로 작성되었으며, 지속적으로 업데이트됩니다.