# Quickstart Guide: Phase 3 Integration

**Feature**: DateFilter 마이그레이션 & 유틸리티 리팩토링
**Branch**: `002-phase3-integration`
**Date**: 2025-11-20

## 목적

Phase 3 작업에 참여하는 개발자를 위한 온보딩 가이드입니다. 5분 안에 구현 시작할 수 있도록 핵심 정보를 제공합니다.

---

## 1. 빠른 시작 (Quick Start)

### Step 1: 브랜치 체크아웃

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git checkout 002-phase3-integration
cd app2
npm install
```

### Step 2: 프로젝트 구조 이해 (30초)

```
app2/src/
├── stores/              # NEW: Zustand stores
│   └── dateFilterStore.ts      # 구현 필요
├── hooks/               # React hooks
│   └── useDateFilter.ts        # 구현 필요
├── utils/               # NEW: Utility modules
│   ├── dateUtils.ts            # 구현 필요
│   ├── firebaseErrors.ts       # 구현 필요
│   └── formUtils.ts            # 구현 필요
└── contexts/
    └── DateFilterContext.tsx   # 삭제 예정
```

### Step 3: 첫 번째 구현 시작

```bash
# 1. DateFilterStore 생성
touch app2/src/stores/dateFilterStore.ts

# 2. 테스트 파일 생성
mkdir -p app2/src/stores/__tests__
touch app2/src/stores/__tests__/dateFilterStore.test.ts

# 3. 구현 시작!
# 참고: specs/002-phase3-integration/contracts/dateFilterStore.ts
```

---

## 2. 핵심 개념 (3분 읽기)

### 2.1. Phase 3 목표

**WHAT**: DateFilterContext → Zustand Store 마이그레이션 + 유틸리티 중앙화

**WHY**:
- Context API 제거 (Phase 3 목표)
- 날짜 처리 중복 코드 29회 → 0회
- Firebase 에러 처리 표준화 (20개 파일)

**HOW**:
1. DateFilterStore (Zustand) 생성
2. useDateFilter Hook (호환성 레이어) 생성
3. 유틸리티 함수 생성 (dateUtils, firebaseErrors, formUtils)
4. 6개 파일 마이그레이션 (DateFilter 사용)
5. 20개 파일 마이그레이션 (날짜 유틸리티 사용)

### 2.2. Phase 3-1 패턴 재사용

✅ **이미 검증된 패턴** (Phase 3-1: UnifiedDataContext → Zustand):
- Zustand 5.0 + immer + devtools 조합
- 호환성 Hook으로 API 100% 유지
- 단계적 마이그레이션 (한 번에 모든 파일 변경 X)

**참고 파일**: `app2/src/stores/unifiedDataStore.ts` (514 lines)

### 2.3. Clarification 결정 사항 (5개)

| # | 질문 | 결정 |
|---|------|------|
| 1 | 에러 처리 전략 | null 반환 + logger 경고 (앱 크래시 방지) |
| 2 | localStorage 전략 | 새로운 키 사용 (`date-filter-storage`) |
| 3 | 마이그레이션 범위 | 20개 파일 전체 (100% 중복 제거) |
| 4 | 날짜 포맷 설계 | 포맷 옵션 지원 ('date' \| 'datetime') |
| 5 | FormUtils 우선순위 | Phase 3 포함 (완전한 유틸리티 세트) |

---

## 3. 구현 우선순위 (작업 순서)

### Week 1: Part 1 - DateFilter 마이그레이션 (2일)

**Day 1**: DateFilterStore 생성 및 테스트
- [ ] `stores/dateFilterStore.ts` 구현
- [ ] `hooks/useDateFilter.ts` 구현
- [ ] 단위 테스트 작성 (80%+ coverage)

**Day 2**: 6개 파일 마이그레이션 및 Context 제거
- [ ] TablesPage, ParticipantsPage, DateNavigator 등 마이그레이션
- [ ] `contexts/DateFilterContext.tsx` 삭제
- [ ] 회귀 테스트 통과 확인

### Week 2: Part 2 - 유틸리티 생성 (4일)

**Day 3**: 날짜 유틸리티
- [ ] `utils/dateUtils.ts` 구현
- [ ] 테스트 작성
- [ ] 5개 파일 마이그레이션 (검증)

**Day 4-5**: Firebase 에러 유틸리티 + 전체 마이그레이션
- [ ] `utils/firebaseErrors.ts` 구현
- [ ] 20개 파일 전체 마이그레이션 (날짜 + Firebase)

**Day 6**: FormUtils
- [ ] `utils/formUtils.ts` 구현
- [ ] 테스트 작성

**Day 7**: 통합 테스트 및 최종 검증
- [ ] `npm run type-check` ✅
- [ ] `npm run lint` ✅
- [ ] `npm run build` ✅

---

## 4. 코드 예시 (Copy & Paste Ready)

### 4.1. DateFilterStore 뼈대

```typescript
// app2/src/stores/dateFilterStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

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

type DateFilterStore = DateFilterState & DateFilterActions;

export const useDateFilterStore = create<DateFilterStore>()(
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

        // TODO: Implement goToPreviousDate, goToToday
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

### 4.2. useDateFilter Hook 뼈대

```typescript
// app2/src/hooks/useDateFilter.ts
import { useDateFilterStore } from '../stores/dateFilterStore';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { useEffect } from 'react';

export const useDateFilter = () => {
  const { tournaments } = useTournamentData();
  const store = useDateFilterStore();

  // availableDates 자동 계산
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

### 4.3. DateUtils 뼈대

```typescript
// app2/src/utils/dateUtils.ts
import { logger } from './logger';

export type DateFormat = 'date' | 'datetime';
export type DateInput = Date | string | null | undefined;

export function toISODateString(date: DateInput): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      logger.warn('toISODateString: Invalid date', { date });
      return null;
    }
    return dateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
  } catch (error) {
    logger.warn('toISODateString: Error', { date, error });
    return null;
  }
}

export function formatDate(date: DateInput, format: DateFormat): string | null {
  const isoDate = toISODateString(date);
  if (!isoDate) return null;

  if (format === 'date') {
    return isoDate; // "YYYY-MM-DD"
  }

  // format === 'datetime'
  try {
    const dateObj = new Date(isoDate);
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${isoDate} ${hours}:${minutes}`; // "YYYY-MM-DD HH:mm"
  } catch (error) {
    logger.warn('formatDate: Error formatting datetime', { date, error });
    return isoDate; // Fallback to date only
  }
}

// TODO: Implement parseDate, isValidDate
```

---

## 5. 테스트 전략

### 5.1. 단위 테스트 (Jest)

```typescript
// app2/src/stores/__tests__/dateFilterStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useDateFilterStore } from '../dateFilterStore';

describe('DateFilterStore', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  it('should set selected date', () => {
    const { result } = renderHook(() => useDateFilterStore());

    act(() => {
      result.current.setSelectedDate('2025-11-20');
    });

    expect(result.current.selectedDate).toBe('2025-11-20');
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useDateFilterStore());

    act(() => {
      result.current.setSelectedDate('2025-11-20');
    });

    const stored = JSON.parse(localStorage.getItem('date-filter-storage') || '{}');
    expect(stored.state.selectedDate).toBe('2025-11-20');
  });

  // TODO: Add more tests (goToNextDate, goToPreviousDate, goToToday)
});
```

### 5.2. 통합 테스트

```typescript
// app2/src/tests/integration/dateFilterMigration.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { useDateFilter } from '../../hooks/useDateFilter';

// TODO: Test migration from Context to Zustand
// - Verify API compatibility
// - Test localStorage persistence
// - Test availableDates computation
```

---

## 6. 체크리스트

### 구현 전 확인사항
- [ ] Branch `002-phase3-integration` 체크아웃
- [ ] `specs/002-phase3-integration/` 문서 읽기 (spec.md, plan.md, research.md, data-model.md)
- [ ] Phase 3-1 패턴 참고 (`app2/src/stores/unifiedDataStore.ts`)
- [ ] Clarification 결정 사항 숙지 (5개)

### 구현 중 확인사항
- [ ] TypeScript strict mode 준수 (any 타입 금지)
- [ ] logger 사용 (console.log 금지)
- [ ] 다크모드 적용 (UI 컴포넌트)
- [ ] 에러 처리: null 반환 + logger 경고
- [ ] 메모이제이션 (useMemo, useCallback)

### 구현 후 확인사항
- [ ] `npm run type-check` 통과 (에러 0개)
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 테스트 커버리지 80% 이상
- [ ] 기존 기능 회귀 테스트 통과

---

## 7. 참고 문서

### 필수 문서
1. **[spec.md](./spec.md)**: 기능 명세 (User Stories, Requirements, Success Criteria)
2. **[plan.md](./plan.md)**: 구현 계획 (Technical Context, Constitution Check, Project Structure)
3. **[research.md](./research.md)**: 기술 조사 (5개 Research Topics, Decisions)
4. **[data-model.md](./data-model.md)**: 데이터 모델 (Interfaces, Types, Relationships)
5. **[contracts/](./contracts/)**: TypeScript 타입 정의 (4개 모듈)

### 추가 문서
- **[CLAUDE.md](../../CLAUDE.md)**: 프로젝트 개발 가이드
- **[Phase 3-1 완료 보고서](../../docs/)**: 참고 패턴
- **[Zustand 공식 문서](https://docs.pmnd.rs/zustand/)**: Zustand API

---

## 8. 도움 요청

### 질문이 있을 때
1. **Spec 문서 확인**: `specs/002-phase3-integration/spec.md`
2. **Research 문서 확인**: `specs/002-phase3-integration/research.md`
3. **Phase 3-1 코드 참고**: `app2/src/stores/unifiedDataStore.ts`
4. **팀 문의**: [담당자 연락처]

### 이슈 발견 시
- **Clarification 필요**: Spec에 명시되지 않은 사항
- **버그 발견**: 기존 코드 문제
- **설계 변경 제안**: 더 나은 구현 방법

---

**Ready to Start** ✅
**Estimated Time to First Commit**: 1 hour (DateFilterStore skeleton + tests)
**Total Implementation Time**: 7 days (56 hours)

Good luck! 🚀
