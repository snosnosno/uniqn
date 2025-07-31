# 📚 대용량 라이브러리 대체 가이드

## 1. FullCalendar → 경량 대체안

### 현재 상황
- **크기**: ~500KB (gzipped: ~150KB)
- **사용처**: MySchedulePage의 ScheduleCalendar 컴포넌트
- **사용 기능**: 월별 달력 뷰, 이벤트 표시, 클릭 이벤트

### 대체 옵션 비교

#### Option A: react-big-calendar
```bash
npm install react-big-calendar moment
```

**장점**:
- 크기: ~100KB (80% 절감)
- 유사한 API
- 한국어 지원

**단점**:
- moment.js 의존성
- 커스터마이징 제한

**구현 예시**:
```typescript
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const MyCalendar = ({ events }) => (
  <Calendar
    localizer={localizer}
    events={events}
    startAccessor="start"
    endAccessor="end"
    style={{ height: 500 }}
  />
);
```

#### Option B: 자체 구현 (권장) ✅
**장점**:
- 크기: ~20KB (96% 절감)
- 완전한 커스터마이징
- 필요한 기능만 구현

**구현 계획**:
```typescript
// components/LightweightCalendar.tsx
import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'shift' | 'attendance' | 'payroll';
}

interface LightweightCalendarProps {
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const LightweightCalendar: React.FC<LightweightCalendarProps> = ({
  events,
  onDateClick,
  onEventClick
}) => {
  const currentMonth = new Date();
  
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
      const dateKey = format(new Date(event.date), 'yyyy-MM-dd');
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
  }, [events]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* 요일 헤더 */}
      {['일', '월', '화', '수', '목', '금', '토'].map(day => (
        <div key={day} className="text-center font-bold p-2">
          {day}
        </div>
      ))}
      
      {/* 날짜 셀 */}
      {days.map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDate[dateKey] || [];
        
        return (
          <div
            key={dateKey}
            onClick={() => onDateClick(day)}
            className="border p-2 min-h-[100px] cursor-pointer hover:bg-gray-50"
          >
            <div className="font-semibold">{format(day, 'd')}</div>
            {dayEvents.map(event => (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className="text-xs p-1 mt-1 bg-blue-100 rounded cursor-pointer"
              >
                {event.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default LightweightCalendar;
```

---

## 2. react-data-grid → @tanstack/react-table

### 현재 상황
- **크기**: ~200KB (gzipped: ~60KB)
- **사용처**: ShiftGridComponent
- **사용 기능**: 그리드 표시, 셀 편집, 행 선택

### 대체 구현

```bash
npm install @tanstack/react-table
```

**구현 예시**:
```typescript
// components/LightweightDataGrid.tsx
import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';

interface LightweightDataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onCellEdit?: (rowIndex: number, columnId: string, value: any) => void;
}

function LightweightDataGrid<T>({ data, columns, onCellEdit }: LightweightDataGridProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LightweightDataGrid;
```

---

## 3. react-icons 최적화

### 현재 상황
- 여러 아이콘 패키지에서 import
- Tree-shaking이 제대로 작동하지 않음

### 최적화 방법

#### Option A: 개별 import
```typescript
// 이전
import { FaUser, FaClock, FaEdit } from 'react-icons/fa';

// 이후
import FaUser from 'react-icons/fa/FaUser';
import FaClock from 'react-icons/fa/FaClock';
import FaEdit from 'react-icons/fa/FaEdit';
```

#### Option B: SVG 직접 사용 (권장)
```typescript
// components/Icons.tsx
export const UserIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

export const ClockIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
  </svg>
);
```

---

## 4. Firebase SDK 최적화

### Dynamic Import 구현
```typescript
// utils/firebase-dynamic.ts
let storageModule: any = null;
let functionsModule: any = null;

export const getStorageLazy = async () => {
  if (!storageModule) {
    storageModule = await import('firebase/storage');
  }
  return storageModule.getStorage();
};

export const getFunctionsLazy = async () => {
  if (!functionsModule) {
    functionsModule = await import('firebase/functions');
  }
  return functionsModule.getFunctions();
};

// 사용 예시
const uploadFile = async (file: File) => {
  const storage = await getStorageLazy();
  const storageRef = ref(storage, `uploads/${file.name}`);
  return uploadBytes(storageRef, file);
};
```

---

## 📋 구현 체크리스트

### Phase 1: 즉시 적용 가능 (1주)
- [ ] react-icons 개별 import 적용
- [ ] Firebase Storage/Functions 동적 import
- [ ] 사용하지 않는 의존성 제거

### Phase 2: POC 개발 (2주)
- [ ] LightweightCalendar 컴포넌트 개발
- [ ] @tanstack/react-table 통합 테스트
- [ ] 성능 벤치마크

### Phase 3: 마이그레이션 (3주)
- [ ] FullCalendar → LightweightCalendar 교체
- [ ] react-data-grid → @tanstack/react-table 교체
- [ ] 통합 테스트 및 버그 수정

## 🎯 예상 결과

### 번들 크기 감소
- FullCalendar 제거: -400KB
- react-data-grid 교체: -150KB
- react-icons 최적화: -30KB
- Firebase 최적화: -50KB
- **총 절감**: ~630KB (40% 감소)

### 성능 개선
- 초기 로딩: 3.5초 → 2.0초
- Time to Interactive: 4.5초 → 2.5초
- Lighthouse 점수: 75 → 90+

### 유지보수성
- 외부 의존성 감소
- 커스터마이징 용이
- 번들 크기 예측 가능

이 가이드를 따라 단계적으로 진행하면 안정적으로 번들 크기를 줄이고 성능을 개선할 수 있습니다.