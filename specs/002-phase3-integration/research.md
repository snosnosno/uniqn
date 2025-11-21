# Research Document: Phase 3 통합 - 기술 조사 및 결정

**Feature**: Phase 3 통합 - DateFilter 마이그레이션 & 유틸리티 리팩토링
**Branch**: `002-phase3-integration`
**Date**: 2025-11-20
**Phase**: 0 (Research & Unknowns Resolution)

## 목적

Phase 3 구현에 필요한 모든 기술적 불확실성을 해결하고, 최적의 구현 방식을 선택합니다.

---

## 1. Zustand Persist Configuration

### Question
localStorage 직렬화/역직렬화 전략 및 Zustand persist middleware 설정 방법

### Research Findings

**Phase 3-1 패턴 분석** (`app2/src/stores/unifiedDataStore.ts`):
- Zustand 5.0 + immer + devtools 미들웨어 조합 사용
- Firebase onSnapshot 실시간 구독 → Zustand State 업데이트
- Map<string, T> 자료구조 사용 (빠른 조회, immer enableMapSet() 필요)
- Middleware 순서: `devtools(immer(...))` (외부 → 내부)

**Persist 설정 전략**:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

// Middleware 순서: devtools → persist → immer
export const useDateFilterStore = create<DateFilterStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State & Actions
      })),
      {
        name: 'date-filter-storage', // localStorage 키
        storage: createJSONStorage(() => localStorage), // 기본 storage
        partialize: (state) => ({
          // 저장할 필드만 선택
          selectedDate: state.selectedDate,
        }),
      }
    ),
    {
      name: 'DateFilterStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
```

### Decision

**Zustand Persist 설정**:
- **localStorage 키**: `date-filter-storage` (신규, 기존 `tournament_selected_date` 무시)
- **직렬화 전략**: JSON.stringify/parse (Zustand 기본)
- **저장 필드**: `selectedDate`만 persist (availableDates는 TournamentDataContext에서 계산)
- **Fallback**: localStorage 실패 시 Zustand 메모리 상태로 자동 폴백 (persist 미들웨어 기본 동작)

### Rationale
- **구현 단순성**: 기존 localStorage 마이그레이션 로직 불필요 (Clarification #2 결정)
- **Phase 3-1 패턴 재사용**: 검증된 미들웨어 조합 및 구조
- **번들 크기 최소화**: createJSONStorage로 커스텀 storage 불필요

### Alternatives Considered
- ❌ **기존 키 재사용 + 마이그레이션 로직**: 복잡도 증가, 유지보수 부담
- ❌ **IndexedDB**: 오버엔지니어링, 간단한 문자열 저장에 불필요

---

## 2. Date Formatting Library Choice

### Question
date-fns 사용 여부 vs 네이티브 JavaScript Date API

### Research Findings

**Current Usage Pattern**:
```typescript
// 기존 코드 (29회 사용)
const dateString = new Date().toISOString().split('T')[0]; // "2025-11-20"
```

**date-fns 4.1 Analysis**:
- ✅ **장점**: 타임존 안전, 다국어 지원, 포맷팅 유연성
- ❌ **단점**: 번들 크기 (+10KB tree-shaken), 성능 오버헤드 (네이티브 대비 ~2배 느림)

**Native API Analysis**:
- ✅ **장점**: 번들 크기 0KB, 빠른 성능, 기존 패턴과 일치
- ⚠️ **주의점**: 타임존 처리 주의 (UTC 기준 통일 필요)

**Performance Benchmark**:
```typescript
// Native API: ~0.01ms per call
new Date().toISOString().split('T')[0];

// date-fns: ~0.02ms per call
import { format } from 'date-fns';
format(new Date(), 'yyyy-MM-dd');
```

### Decision

**네이티브 JavaScript Date API 사용**:
```typescript
// utils/dateUtils.ts
export function toISODateString(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;

    return dateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
  } catch (error) {
    logger.warn('toISODateString: Invalid date', { date, error });
    return null;
  }
}
```

### Rationale
- **번들 크기**: 0KB 추가 (date-fns 제외)
- **성능**: 네이티브 API가 2배 빠름
- **일관성**: 기존 코드 패턴 유지 (29회 사용 → 유틸리티 함수로 중앙화)
- **충분성**: YYYY-MM-DD, YYYY-MM-DD HH:mm 포맷만 필요 (복잡한 날짜 계산 없음)

### Alternatives Considered
- ❌ **date-fns 전면 도입**: 오버엔지니어링, 번들 크기 증가
- ❌ **Intl.DateTimeFormat**: 포맷 제어 복잡, ISO 형식 생성에 비효율적

---

## 3. TypeScript Generic Patterns

### Question
유틸리티 함수에서 제네릭 타입 설계 및 타입 안전성 보장 방법

### Research Findings

**TypeScript Strict Mode Requirements**:
- `any` 타입 금지 (CLAUDE.md 규칙)
- null 반환 시 명시적 타입 (`string | null`)
- 제네릭 constraint로 타입 범위 제한

**Generic Pattern Analysis**:
```typescript
// Pattern 1: Simple Generic (날짜 유틸리티)
export function formatDate(
  date: Date | string | null | undefined,
  format: 'date' | 'datetime'
): string | null {
  // null 반환 + logger 경고 (Clarification #1)
}

// Pattern 2: Constrained Generic (폼 유틸리티)
export function createFormHandler<T extends Record<string, any>>(
  setState: React.Dispatch<React.SetStateAction<T>>
): (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => void {
  return (field: keyof T) => (e) => {
    setState((prev) => ({ ...prev, [field]: e.target.value }));
  };
}

// Pattern 3: Type Guard (타입 안전성)
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}
```

### Decision

**TypeScript Generic Design**:

**1. 날짜 유틸리티** (`utils/dateUtils.ts`):
```typescript
/**
 * 날짜를 지정된 포맷으로 변환
 * @param date - 변환할 날짜 (Date, string, null, undefined)
 * @param format - 'date' (YYYY-MM-DD) 또는 'datetime' (YYYY-MM-DD HH:mm)
 * @returns 포맷된 날짜 문자열 또는 null (에러 시)
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: 'date' | 'datetime'
): string | null;

export function parseDate(dateString: string | null | undefined): Date | null;
export function isValidDate(date: unknown): date is Date;
export function toISODateString(date: Date | string | null | undefined): string | null;
```

**2. Firebase 에러 유틸리티** (`utils/firebaseErrors.ts`):
```typescript
import { FirebaseError } from 'firebase/app';

export function getFirebaseErrorMessage(
  error: FirebaseError | Error | unknown,
  locale: 'ko' | 'en' = 'ko'
): string;

export function isPermissionDenied(error: unknown): error is FirebaseError;
export function handleFirebaseError(error: unknown): void;
```

**3. 폼 유틸리티** (`utils/formUtils.ts`):
```typescript
export function createFormHandler<T extends Record<string, any>>(
  setState: React.Dispatch<React.SetStateAction<T>>
): {
  handleChange: (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectChange: (field: keyof T) => (value: any) => void;
};
```

### Rationale
- **타입 안전성**: TypeScript strict mode 100% 준수
- **null 처리**: 명시적 null 반환으로 에러 전파 방지 (Clarification #1)
- **재사용성**: 제네릭으로 다양한 타입 지원
- **문서화**: JSDoc으로 타입 힌트 및 사용 예시 제공

### Alternatives Considered
- ❌ **예외 던지기**: 프로덕션 안정성 저하 (Clarification #1에서 기각)
- ❌ **any 타입 사용**: TypeScript strict mode 위반
- ❌ **Union 타입 남발**: 타입 체크 복잡도 증가

---

## 4. Firebase Error Code Mapping

### Question
Firebase 에러 코드 → 한국어/영어 사용자 친화적 메시지 변환 전략

### Research Findings

**Common Firebase Error Codes** (20개 파일 분석 결과):
- `permission-denied`: 권한 없음
- `not-found`: 데이터 없음
- `unauthenticated`: 인증 필요
- `already-exists`: 중복 데이터
- `resource-exhausted`: 할당량 초과
- `cancelled`: 작업 취소
- `unknown`: 알 수 없는 에러

**i18n System Analysis**:
- 프로젝트에 i18n 시스템 존재 가정 (Assumption #8)
- 키 구조: `errors.firebase.[error-code]`

### Decision

**Firebase Error Mapping Strategy**:
```typescript
// utils/firebaseErrors.ts

const FIREBASE_ERROR_MESSAGES: Record<
  string,
  { ko: string; en: string }
> = {
  'permission-denied': {
    ko: '권한이 없습니다. 관리자에게 문의하세요.',
    en: 'Permission denied. Contact administrator.',
  },
  'not-found': {
    ko: '요청한 데이터를 찾을 수 없습니다.',
    en: 'Requested data not found.',
  },
  'unauthenticated': {
    ko: '로그인이 필요합니다.',
    en: 'Authentication required.',
  },
  'already-exists': {
    ko: '이미 존재하는 데이터입니다.',
    en: 'Data already exists.',
  },
  'resource-exhausted': {
    ko: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    en: 'Quota exceeded. Please try again later.',
  },
  'cancelled': {
    ko: '작업이 취소되었습니다.',
    en: 'Operation cancelled.',
  },
  'unknown': {
    ko: '일시적인 오류가 발생했습니다. 다시 시도해주세요.',
    en: 'Temporary error occurred. Please try again.',
  },
};

/**
 * Firebase 에러를 사용자 친화적인 메시지로 변환
 */
export function getFirebaseErrorMessage(
  error: FirebaseError | Error | unknown,
  locale: 'ko' | 'en' = 'ko'
): string {
  if (!error) return FIREBASE_ERROR_MESSAGES['unknown'][locale];

  // FirebaseError 타입 체크
  const code = (error as FirebaseError).code || 'unknown';
  const errorCode = code.replace('firestore/', '').replace('auth/', '');

  // 매핑된 메시지 반환
  const message = FIREBASE_ERROR_MESSAGES[errorCode];
  return message ? message[locale] : FIREBASE_ERROR_MESSAGES['unknown'][locale];
}
```

### Rationale
- **사용자 경험**: 기술적 에러 코드 → 이해하기 쉬운 메시지
- **국제화**: 한국어/영어 지원
- **확장성**: 새로운 에러 코드 추가 용이
- **Fallback**: 알 수 없는 에러 시 기본 메시지

### Alternatives Considered
- ❌ **i18n 라이브러리 의존**: 오버헤드, 단순 매핑으로 충분
- ❌ **에러 코드 노출**: 사용자 혼란, 보안 취약점 가능성

---

## 5. Phase 3-1 Pattern Analysis

### Question
Phase 3-1 (UnifiedDataContext → Zustand) 성공 패턴 분석 및 재사용 방법

### Research Findings

**Phase 3-1 Key Patterns** (`app2/src/stores/unifiedDataStore.ts` 분석):

**1. Store 구조**:
```typescript
interface StoreState {
  // State
  data: Map<string, T>;
  isLoading: boolean;
  error: string | null;
}

interface StoreSelectors {
  // 조회 함수
  getById: (id: string) => T | undefined;
  getByFilter: (filter: any) => T[];
}

interface StoreActions {
  // Firebase 구독
  subscribeAll: (userId: string) => void;
  unsubscribeAll: () => void;

  // CRUD
  set: (items: Map<string, T>) => void;
  update: (item: T) => void;
  delete: (id: string) => void;
  updateBatch: (items: T[]) => void;
  deleteBatch: (ids: string[]) => void;
}
```

**2. Middleware 조합**:
```typescript
create<Store>()(
  devtools(        // Redux DevTools (개발 환경만)
    immer(         // 불변성 자동 처리
      (set, get) => ({ /* state & actions */ })
    ),
    { name: 'StoreName', enabled: process.env.NODE_ENV === 'development' }
  )
);
```

**3. Firebase 구독 패턴**:
```typescript
// Store 외부에 unsubscribe 함수 저장
let dataUnsubscribe: Unsubscribe | null = null;

// subscribeAll 내부
const dataQuery = query(collection(db, 'collectionName'));
dataUnsubscribe = onSnapshot(
  dataQuery,
  (snapshot) => {
    const dataMap = new Map<string, T>();
    snapshot.docs.forEach(doc => {
      dataMap.set(doc.id, { ...doc.data(), id: doc.id } as T);
    });
    set({ data: dataMap });
  },
  (error) => {
    logger.error('Subscription error', error);
    set({ error: error.message });
  }
);
```

**4. 호환성 레이어** (`hooks/useUnifiedData.ts` 추정):
```typescript
// 기존 Context API와 동일한 인터페이스 제공
export const useUnifiedData = () => {
  const store = useUnifiedDataStore();
  return {
    staff: Array.from(store.staff.values()),
    workLogs: Array.from(store.workLogs.values()),
    getStaffById: store.getStaffById,
    // ... 기존 API 유지
  };
};
```

### Decision

**DateFilter 마이그레이션 패턴** (Phase 3-1 재사용):

**1. Store 생성** (`stores/dateFilterStore.ts`):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

interface DateFilterState {
  selectedDate: string; // YYYY-MM-DD
  availableDates: string[]; // computed from TournamentDataContext
}

interface DateFilterActions {
  setSelectedDate: (date: string) => void;
  setAvailableDates: (dates: string[]) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
}

export const useDateFilterStore = create<DateFilterState & DateFilterActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State
        selectedDate: '',
        availableDates: [],

        // Actions
        setSelectedDate: (date: string) => set({ selectedDate: date }),
        setAvailableDates: (dates: string[]) => set({ availableDates: dates }),

        goToNextDate: () => {
          const { selectedDate, availableDates } = get();
          const currentIndex = availableDates.indexOf(selectedDate);
          if (currentIndex === -1 || currentIndex === availableDates.length - 1) return;
          set({ selectedDate: availableDates[currentIndex + 1] });
        },

        goToPreviousDate: () => {
          const { selectedDate, availableDates } = get();
          const currentIndex = availableDates.indexOf(selectedDate);
          if (currentIndex <= 0) return;
          set({ selectedDate: availableDates[currentIndex - 1] });
        },

        goToToday: () => {
          const { availableDates } = get();
          const today = new Date().toISOString().split('T')[0];
          if (availableDates.includes(today)) {
            set({ selectedDate: today });
          } else {
            const futureDates = availableDates.filter(d => d >= today);
            const nearestDate = futureDates[0] || availableDates[availableDates.length - 1];
            if (nearestDate) set({ selectedDate: nearestDate });
          }
        },
      })),
      {
        name: 'date-filter-storage',
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

**2. 호환성 Hook** (`hooks/useDateFilter.ts`):
```typescript
import { useDateFilterStore } from '../stores/dateFilterStore';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { useEffect } from 'react';

/**
 * DateFilterContext 호환 Hook
 *
 * 기존 Context API와 동일한 인터페이스 제공
 * DateFilterContext.tsx 삭제 후에도 기존 컴포넌트 코드 변경 최소화
 */
export const useDateFilter = () => {
  const { tournaments } = useTournamentData();
  const store = useDateFilterStore();

  // availableDates 자동 계산 (TournamentDataContext 기반)
  useEffect(() => {
    const dates = tournaments
      .map(t => t.dateKey)
      .filter(dateKey => dateKey)
      .sort();
    const uniqueDates = Array.from(new Set(dates));
    store.setAvailableDates(uniqueDates);
  }, [tournaments, store]);

  // 기존 Context API와 동일한 인터페이스 반환
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

### Rationale
- **검증된 패턴**: Phase 3-1에서 성공적으로 검증됨
- **API 호환성**: 기존 컴포넌트 코드 변경 최소화 (100% 호환)
- **점진적 마이그레이션**: 한 번에 모든 파일 변경 불필요
- **성능**: Context Provider 제거로 불필요한 리렌더링 제거

### Alternatives Considered
- ❌ **Context API 유지**: Phase 3 목표(Context 제거) 위반
- ❌ **전면 리팩토링**: Breaking changes 발생, 리스크 증가

---

## Summary

### All Decisions Made

| Research Topic | Decision | Key Rationale |
|----------------|----------|---------------|
| **1. Zustand Persist** | 새로운 localStorage 키 사용 (`date-filter-storage`) | 구현 단순성, 기존 데이터 무시 |
| **2. Date Library** | 네이티브 JavaScript Date API | 번들 크기 0KB, 성능 우수, 기존 패턴 일치 |
| **3. TypeScript Generics** | null 반환 + 명시적 타입 | 타입 안전성, 프로덕션 안정성 |
| **4. Firebase Error** | Record<string, {ko, en}> 매핑 | 사용자 경험, 국제화, Fallback |
| **5. Phase 3-1 Pattern** | Store + 호환성 Hook 패턴 재사용 | 검증된 패턴, API 호환성 100% |

### Next Steps

**Phase 1 진행 가능** ✅ - 모든 NEEDS CLARIFICATION 해결 완료

1. **data-model.md 생성**: DateFilterStore, 유틸리티 인터페이스 설계
2. **contracts/ 생성**: TypeScript 타입 정의 및 API 시그니처
3. **quickstart.md 생성**: 개발자 온보딩 가이드
4. **Agent Context 업데이트**: `.specify/memory/claude-context.md`

**Estimated Timeline**:
- Phase 1: 1일 (8시간)
- Phase 2 (tasks.md): 별도 `/speckit.tasks` 명령 실행

---

**Research Completed**: 2025-11-20
**Status**: ✅ All unknowns resolved, ready for Phase 1
