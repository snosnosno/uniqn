# Data Model: Phase 3 통합 - DateFilter & 유틸리티

**Feature**: Phase 3 통합 - DateFilter 마이그레이션 & 유틸리티 리팩토링
**Branch**: `002-phase3-integration`
**Date**: 2025-11-20
**Phase**: 1 (Data Model & Contracts)

## 목적

Phase 3 구현에 필요한 모든 데이터 구조, 인터페이스, 타입 정의를 명확히 합니다.

---

## 1. DateFilterStore (Zustand Store)

### Store Interface

```typescript
/**
 * DateFilterStore State
 *
 * 날짜 필터 상태를 관리하는 Zustand Store
 * localStorage에 selectedDate를 persist
 */
interface DateFilterState {
  /**
   * 현재 선택된 날짜 (YYYY-MM-DD 형식)
   * @example "2025-11-20"
   */
  selectedDate: string;

  /**
   * 토너먼트가 있는 날짜 목록 (정렬된 배열)
   * TournamentDataContext에서 계산됨
   * @example ["2025-11-18", "2025-11-19", "2025-11-20"]
   */
  availableDates: string[];
}

/**
 * DateFilterStore Actions
 */
interface DateFilterActions {
  /**
   * 날짜 선택
   * localStorage에 자동 저장됨
   */
  setSelectedDate: (date: string) => void;

  /**
   * 사용 가능한 날짜 목록 설정
   * TournamentDataContext 업데이트 시 호출
   */
  setAvailableDates: (dates: string[]) => void;

  /**
   * 다음 토너먼트 날짜로 이동
   * 마지막 날짜면 변경 없음
   */
  goToNextDate: () => void;

  /**
   * 이전 토너먼트 날짜로 이동
   * 첫 번째 날짜면 변경 없음
   */
  goToPreviousDate: () => void;

  /**
   * 오늘 날짜로 이동
   * 오늘에 토너먼트가 없으면 가장 가까운 미래 날짜
   */
  goToToday: () => void;
}

/**
 * DateFilterStore 전체 타입
 */
type DateFilterStore = DateFilterState & DateFilterActions;
```

### Store Implementation Pattern

```typescript
// stores/dateFilterStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

export const useDateFilterStore = create<DateFilterStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State
        selectedDate: '',
        availableDates: [],

        // Actions (implementation)
        // ... (research.md 참고)
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

### Persist Configuration

| 속성 | 값 | 설명 |
|------|-----|------|
| **name** | `date-filter-storage` | localStorage 키 (신규) |
| **storage** | `localStorage` | 저장소 타입 (기본) |
| **partialize** | `{ selectedDate }` | selectedDate만 저장 |
| **version** | `1` | 스키마 버전 (기본) |

---

## 2. DateUtils (날짜 유틸리티)

### Module Interface

```typescript
/**
 * 날짜 유틸리티 모듈
 *
 * 프로젝트 전반의 날짜 처리 중복 코드를 중앙화
 * 20개 파일, 29회 사용 패턴 → 유틸리티 함수로 대체
 */

/**
 * 날짜 포맷 타입
 */
type DateFormat = 'date' | 'datetime';

/**
 * 날짜를 지정된 포맷으로 변환
 *
 * @param date - 변환할 날짜 (Date, string, null, undefined)
 * @param format - 'date' (YYYY-MM-DD) 또는 'datetime' (YYYY-MM-DD HH:mm)
 * @returns 포맷된 날짜 문자열 또는 null (에러 시)
 *
 * @example
 * formatDate(new Date(), 'date'); // "2025-11-20"
 * formatDate(new Date(), 'datetime'); // "2025-11-20 14:30"
 * formatDate(null, 'date'); // null
 * formatDate('invalid', 'date'); // null (logger 경고)
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: DateFormat
): string | null;

/**
 * ISO 날짜 문자열로 변환 (YYYY-MM-DD)
 *
 * 기존 toISOString().split('T')[0] 패턴 대체
 *
 * @param date - 변환할 날짜
 * @returns YYYY-MM-DD 형식 문자열 또는 null
 *
 * @example
 * toISODateString(new Date()); // "2025-11-20"
 * toISODateString("2025-11-20T15:30:00Z"); // "2025-11-20"
 */
export function toISODateString(
  date: Date | string | null | undefined
): string | null;

/**
 * 날짜 문자열을 Date 객체로 변환
 *
 * @param dateString - 변환할 날짜 문자열
 * @returns Date 객체 또는 null
 *
 * @example
 * parseDate("2025-11-20"); // Date(2025-11-20T00:00:00Z)
 * parseDate("invalid"); // null (logger 경고)
 */
export function parseDate(
  dateString: string | null | undefined
): Date | null;

/**
 * 날짜 유효성 검증 (Type Guard)
 *
 * @param date - 검증할 값
 * @returns Date 객체이고 유효하면 true
 *
 * @example
 * isValidDate(new Date()); // true
 * isValidDate(new Date('invalid')); // false
 * isValidDate(null); // false
 */
export function isValidDate(date: unknown): date is Date;
```

### Usage Example

```typescript
// Before: 중복 코드 (29회 사용)
const dateKey = new Date().toISOString().split('T')[0]; // ❌

// After: 유틸리티 함수
import { toISODateString, formatDate } from '@/utils/dateUtils';

const dateKey = toISODateString(new Date()); // ✅ "2025-11-20"
const displayDate = formatDate(new Date(), 'datetime'); // ✅ "2025-11-20 14:30"
```

---

## 3. FirebaseErrorUtils (Firebase 에러 처리)

### Module Interface

```typescript
/**
 * Firebase 에러 처리 유틸리티
 *
 * Firebase 에러 코드를 사용자 친화적인 메시지로 변환
 * 20개 파일에서 표준화된 에러 처리
 */

import { FirebaseError } from 'firebase/app';

/**
 * 지원 언어
 */
type Locale = 'ko' | 'en';

/**
 * Firebase 에러 메시지 매핑
 */
interface ErrorMessage {
  ko: string;
  en: string;
}

/**
 * Firebase 에러 코드별 메시지 매핑
 */
const FIREBASE_ERROR_MESSAGES: Record<string, ErrorMessage>;

/**
 * Firebase 에러를 사용자 친화적인 메시지로 변환
 *
 * @param error - Firebase 에러 (FirebaseError, Error, unknown)
 * @param locale - 언어 ('ko' | 'en', 기본값: 'ko')
 * @returns 사용자 친화적인 에러 메시지
 *
 * @example
 * getFirebaseErrorMessage(error, 'ko'); // "권한이 없습니다. 관리자에게 문의하세요."
 * getFirebaseErrorMessage(error, 'en'); // "Permission denied. Contact administrator."
 */
export function getFirebaseErrorMessage(
  error: FirebaseError | Error | unknown,
  locale?: Locale
): string;

/**
 * Firebase 권한 거부 에러 감지 (Type Guard)
 *
 * @param error - 검증할 에러
 * @returns 권한 거부 에러이면 true
 *
 * @example
 * if (isPermissionDenied(error)) {
 *   // 권한 거부 특별 처리
 * }
 */
export function isPermissionDenied(error: unknown): error is FirebaseError;

/**
 * Firebase 에러 로깅 및 사용자 메시지 반환
 *
 * logger.error()로 로깅 + 사용자 메시지 반환
 *
 * @param error - Firebase 에러
 * @param context - 에러 발생 컨텍스트 (선택)
 * @returns 사용자 친화적인 에러 메시지
 *
 * @example
 * handleFirebaseError(error, { component: 'JobPostingForm', action: 'submit' });
 * // logger: "[FirebaseError] permission-denied at JobPostingForm.submit"
 * // return: "권한이 없습니다. 관리자에게 문의하세요."
 */
export function handleFirebaseError(
  error: unknown,
  context?: Record<string, any>
): string;
```

### Error Code Mapping

| Firebase Error Code | 한국어 메시지 | 영어 메시지 |
|---------------------|--------------|-------------|
| `permission-denied` | 권한이 없습니다. 관리자에게 문의하세요. | Permission denied. Contact administrator. |
| `not-found` | 요청한 데이터를 찾을 수 없습니다. | Requested data not found. |
| `unauthenticated` | 로그인이 필요합니다. | Authentication required. |
| `already-exists` | 이미 존재하는 데이터입니다. | Data already exists. |
| `resource-exhausted` | 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요. | Quota exceeded. Please try again later. |
| `cancelled` | 작업이 취소되었습니다. | Operation cancelled. |
| `unknown` | 일시적인 오류가 발생했습니다. 다시 시도해주세요. | Temporary error occurred. Please try again. |

### Usage Example

```typescript
// Before: 중복 에러 처리 (20개 파일)
try {
  await saveData();
} catch (error) {
  console.error('Error:', error); // ❌
  alert('오류가 발생했습니다.'); // ❌
}

// After: 표준화된 에러 처리
import { handleFirebaseError, isPermissionDenied } from '@/utils/firebaseErrors';

try {
  await saveData();
} catch (error) {
  const message = handleFirebaseError(error, {
    component: 'JobPostingForm',
    action: 'save',
  }); // ✅ logger + 사용자 메시지

  if (isPermissionDenied(error)) {
    // 권한 거부 특별 처리
    navigate('/login');
  } else {
    toast.error(message);
  }
}
```

---

## 4. FormUtils (폼 유틸리티)

### Module Interface

```typescript
/**
 * 폼 유틸리티 모듈
 *
 * React 폼 상태 관리 중복 코드 제거
 * 제네릭 핸들러 생성
 */

/**
 * 폼 핸들러 타입
 */
interface FormHandlers<T extends Record<string, any>> {
  /**
   * Input onChange 핸들러 생성
   *
   * @param field - 상태 필드명
   * @returns onChange 핸들러 함수
   *
   * @example
   * const { handleChange } = createFormHandler(setState);
   * <input onChange={handleChange('name')} />
   */
  handleChange: (
    field: keyof T
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;

  /**
   * Select onChange 핸들러 생성
   *
   * @param field - 상태 필드명
   * @returns onChange 핸들러 함수
   *
   * @example
   * const { handleSelectChange } = createFormHandler(setState);
   * <select onChange={handleSelectChange('role')} />
   */
  handleSelectChange: (field: keyof T) => (value: any) => void;
}

/**
 * 제네릭 폼 핸들러 생성
 *
 * React useState의 setState 함수로 폼 핸들러 생성
 *
 * @param setState - React setState 함수
 * @returns 폼 핸들러 객체
 *
 * @example
 * const [formData, setFormData] = useState({ name: '', email: '' });
 * const { handleChange } = createFormHandler(setFormData);
 *
 * <input name="name" onChange={handleChange('name')} />
 * <input name="email" onChange={handleChange('email')} />
 */
export function createFormHandler<T extends Record<string, any>>(
  setState: React.Dispatch<React.SetStateAction<T>>
): FormHandlers<T>;
```

### Usage Example

```typescript
// Before: 중복 핸들러 코드
const [formData, setFormData] = useState({ name: '', email: '' });

const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData(prev => ({ ...prev, name: e.target.value }));
}; // ❌ 중복

const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData(prev => ({ ...prev, email: e.target.value }));
}; // ❌ 중복

// After: 제네릭 핸들러
import { createFormHandler } from '@/utils/formUtils';

const [formData, setFormData] = useState({ name: '', email: '' });
const { handleChange } = createFormHandler(setFormData); // ✅ 한 줄

<input name="name" onChange={handleChange('name')} /> // ✅
<input name="email" onChange={handleChange('email')} /> // ✅
```

---

## 5. 호환성 Hook (useDateFilter)

### Hook Interface

```typescript
/**
 * DateFilterContext 호환 Hook
 *
 * 기존 Context API와 동일한 인터페이스 제공
 * DateFilterContext.tsx 삭제 후에도 기존 컴포넌트 코드 변경 최소화
 */

/**
 * useDateFilter 반환 타입
 *
 * 기존 DateFilterContext와 100% 호환
 */
interface DateFilterContextType {
  /**
   * 현재 선택된 날짜
   */
  selectedDate: string;

  /**
   * 날짜 설정
   */
  setSelectedDate: (date: string) => void;

  /**
   * 다음 날짜로 이동
   */
  goToNextDate: () => void;

  /**
   * 이전 날짜로 이동
   */
  goToPreviousDate: () => void;

  /**
   * 오늘 날짜로 이동
   */
  goToToday: () => void;

  /**
   * 토너먼트가 있는 날짜 목록
   */
  availableDates: string[];
}

/**
 * DateFilter Hook
 *
 * @returns DateFilterContext와 동일한 API
 *
 * @example
 * // Before (Context API)
 * const { selectedDate, setSelectedDate } = useDateFilter(); // ✅
 *
 * // After (Zustand Store)
 * const { selectedDate, setSelectedDate } = useDateFilter(); // ✅ 동일
 */
export function useDateFilter(): DateFilterContextType;
```

### Implementation Pattern

```typescript
// hooks/useDateFilter.ts
import { useDateFilterStore } from '../stores/dateFilterStore';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { useEffect } from 'react';

export const useDateFilter = (): DateFilterContextType => {
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

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                           │
│  (TablesPage, ParticipantsPage, DateNavigator, etc.)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ useDateFilter() Hook
                     │ (Compatibility Layer)
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Zustand DateFilterStore                         │
│  - selectedDate: string                                      │
│  - availableDates: string[]                                  │
│  - Actions: set, goToNext, goToPrev, goToToday              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Middleware: devtools → persist → immer
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  localStorage                                │
│  Key: 'date-filter-storage'                                  │
│  Value: { state: { selectedDate: "2025-11-20" } }          │
└──────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│                 TournamentDataContext                        │
│  (tournaments: Tournament[])                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ useEffect dependency
                     │
┌────────────────────▼────────────────────────────────────────┐
│             useDateFilter Hook                               │
│  Computes availableDates from tournaments.map(t => t.dateKey)│
│  → store.setAvailableDates(uniqueDates)                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Entity Relationships

### Core Entities

```
DateFilterStore (Zustand Store)
├── selectedDate: string (persisted)
├── availableDates: string[] (computed from TournamentDataContext)
└── Actions: CRUD operations

DateUtils Module
├── formatDate(date, format): string | null
├── toISODateString(date): string | null
├── parseDate(dateString): Date | null
└── isValidDate(date): date is Date

FirebaseErrorUtils Module
├── getFirebaseErrorMessage(error, locale): string
├── isPermissionDenied(error): error is FirebaseError
└── handleFirebaseError(error, context): string

FormUtils Module
└── createFormHandler<T>(setState): FormHandlers<T>

useDateFilter Hook (Compatibility Layer)
├── Wraps DateFilterStore
├── Auto-computes availableDates from TournamentDataContext
└── Returns Context API-compatible interface
```

---

## 8. Type Safety & Validation

### TypeScript Strict Mode Compliance

모든 타입은 TypeScript strict mode 100% 준수:
- ❌ `any` 타입 사용 금지
- ✅ 명시적 null/undefined 처리
- ✅ Type Guard 함수 활용
- ✅ 제네릭 constraint로 타입 범위 제한

### Validation Strategy

| Layer | Validation Method | Error Handling |
|-------|-------------------|----------------|
| **DateUtils** | isValidDate() Type Guard | null 반환 + logger 경고 |
| **FirebaseErrorUtils** | instanceof FirebaseError | Fallback 메시지 반환 |
| **FormUtils** | TypeScript Generic Constraint | 컴파일 타임 타입 체크 |
| **DateFilterStore** | Zustand immer middleware | 불변성 자동 보장 |

---

## Summary

### 생성된 데이터 모델

1. ✅ **DateFilterStore**: Zustand Store (selectedDate, availableDates, Actions)
2. ✅ **DateUtils**: 4개 함수 (formatDate, toISODateString, parseDate, isValidDate)
3. ✅ **FirebaseErrorUtils**: 3개 함수 (getFirebaseErrorMessage, isPermissionDenied, handleFirebaseError)
4. ✅ **FormUtils**: 1개 함수 (createFormHandler<T>)
5. ✅ **useDateFilter Hook**: 호환성 레이어 (Context API → Zustand)

### Key Design Decisions

- **API 호환성**: 기존 DateFilterContext API 100% 유지
- **타입 안전성**: TypeScript strict mode 준수, null 명시적 처리
- **에러 처리**: null 반환 + logger 경고 (프로덕션 안정성)
- **성능**: Zustand + immer로 불변성 자동 처리, 리렌더링 최소화

---

**Data Model Completed**: 2025-11-20
**Status**: ✅ Ready for contracts/ generation
