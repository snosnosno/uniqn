# Zustand Store 빠른 시작 가이드

**Feature**: 001-zustand-migration - UnifiedDataContext를 Zustand Store로 전면 교체
**작성일**: 2025-11-14
**대상**: UNIQN 프로젝트 개발자

---

## 📚 목차

1. [Zustand란?](#zustand란)
2. [기본 사용법](#기본-사용법)
3. [마이그레이션 가이드](#마이그레이션-가이드)
4. [테스트 작성 방법](#테스트-작성-방법)
5. [Redux DevTools 사용법](#redux-devtools-사용법)
6. [트러블슈팅](#트러블슈팅)

---

## Zustand란?

**Zustand**는 React를 위한 경량 상태 관리 라이브러리입니다.

### 주요 특징

- ✅ **간결함**: 보일러플레이트 코드 최소화
- ✅ **성능**: 불필요한 리렌더링 방지 (selector 기반)
- ✅ **타입 안전성**: TypeScript와 완벽한 호환
- ✅ **디버깅**: Redux DevTools 연동 지원
- ✅ **유연성**: 미들웨어 시스템 (immer, devtools 등)

### Context API vs Zustand

| 항목 | Context API | Zustand |
|------|-------------|---------|
| **코드 라인 수** | 782줄 | ~400줄 (50% 감소) |
| **리렌더링 최적화** | 어려움 | 쉬움 (selector) |
| **디버깅** | 어려움 | 쉬움 (DevTools) |
| **타입 안전성** | 보통 | 우수 |
| **메모이제이션** | 수동 | 자동 |

---

## 기본 사용법

### 1. Store 생성

**경로**: `app2/src/stores/unifiedDataStore.ts`

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

interface UnifiedDataStore {
  // State
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  isLoading: boolean;
  error: string | null;

  // Selectors
  getStaffById: (id: string) => Staff | undefined;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];

  // Actions
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;
  setStaff: (staff: Map<string, Staff>) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
}

export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // 초기 상태
      staff: new Map(),
      workLogs: new Map(),
      isLoading: false,
      error: null,

      // Selectors
      getStaffById: (id) => get().staff.get(id),
      getWorkLogsByStaffId: (staffId) => {
        const logs = Array.from(get().workLogs.values());
        return logs.filter(log => log.staffId === staffId);
      },

      // Actions
      subscribeAll: (userId, role) => {
        set({ isLoading: true, error: null });
        // Firebase onSnapshot 구독 로직
      },
      unsubscribeAll: () => {
        // cleanup 로직
      },
      setStaff: (staff) => set({ staff }),
      updateStaff: (staff) => set((state) => {
        state.staff.set(staff.id, staff); // immer 덕분에 불변성 자동 처리
      }),
      deleteStaff: (id) => set((state) => {
        state.staff.delete(id);
      }),
    })),
    { name: 'UnifiedDataStore' } // Redux DevTools에 표시될 이름
  )
);
```

### 2. 컴포넌트에서 사용

#### 단일 값 조회

```typescript
import { useUnifiedDataStore } from '../stores/unifiedDataStore';

function StaffList() {
  // staff Map만 구독 (staff 변경 시에만 리렌더링)
  const staff = useUnifiedDataStore((state) => state.staff);

  return (
    <ul>
      {Array.from(staff.values()).map((s) => (
        <li key={s.id}>{s.name}</li>
      ))}
    </ul>
  );
}
```

#### 여러 값 조회 (shallow 비교)

```typescript
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { shallow } from 'zustand/shallow';

function MySchedulePage() {
  // staff, workLogs, getStaffById를 한 번에 구독
  const { staff, workLogs, getStaffById } = useUnifiedDataStore(
    (state) => ({
      staff: state.staff,
      workLogs: state.workLogs,
      getStaffById: state.getStaffById,
    }),
    shallow // shallow 비교로 리렌더링 최적화
  );

  const staffData = getStaffById('staff123');

  return (
    <div>
      <p>총 스태프: {staff.size}</p>
      <p>총 근무 기록: {workLogs.size}</p>
      <p>선택된 스태프: {staffData?.name}</p>
    </div>
  );
}
```

#### Action 호출

```typescript
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { useEffect } from 'react';

function App() {
  const subscribeAll = useUnifiedDataStore((state) => state.subscribeAll);
  const unsubscribeAll = useUnifiedDataStore((state) => state.unsubscribeAll);

  useEffect(() => {
    // 컴포넌트 마운트 시 구독 시작
    subscribeAll('user123', 'admin');

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubscribeAll();
    };
  }, [subscribeAll, unsubscribeAll]);

  return <div>App</div>;
}
```

---

## 마이그레이션 가이드

### Context API → Zustand Store 변경 사항

#### Before (Context API)

```typescript
// 1. Import
import { useUnifiedData } from '../contexts/UnifiedDataContext';

function MyComponent() {
  // 2. Hook 사용
  const { staff, workLogs, getStaffById } = useUnifiedData();

  // 3. 데이터 사용
  const staffData = getStaffById('staff123');

  return <div>{staffData?.name}</div>;
}
```

#### After (Zustand Store)

```typescript
// 1. Import 변경
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { shallow } from 'zustand/shallow';

function MyComponent() {
  // 2. Hook 사용 변경 (selector + shallow)
  const { staff, workLogs, getStaffById } = useUnifiedDataStore(
    (state) => ({
      staff: state.staff,
      workLogs: state.workLogs,
      getStaffById: state.getStaffById,
    }),
    shallow
  );

  // 3. 데이터 사용 (동일)
  const staffData = getStaffById('staff123');

  return <div>{staffData?.name}</div>;
}
```

### 마이그레이션 체크리스트

**모든 컴포넌트에서 다음을 확인하세요:**

- [ ] `import` 문 변경: `UnifiedDataContext` → `unifiedDataStore`
- [ ] Hook 호출 변경: `useUnifiedData()` → `useUnifiedDataStore(selector, shallow)`
- [ ] Selector 함수 작성 (필요한 값만 조회)
- [ ] `shallow` 비교 추가 (여러 값 조회 시)
- [ ] TypeScript 타입 에러 확인
- [ ] 기능 동작 확인 (조회, 생성, 수정, 삭제)

### 주요 마이그레이션 대상 컴포넌트

**경로**: `app2/src/`

1. `pages/MySchedulePage/index.tsx`
2. `pages/JobPostingPage/index.tsx`
3. `pages/ApplicantListPage/index.tsx`
4. `pages/StaffManagementPage/index.tsx`
5. `pages/AttendancePage/index.tsx`
6. `components/ScheduleDetailModal/index.tsx`
7. `components/StaffSelector.tsx`
8. `components/WorkLogList.tsx`
9. `components/ApplicationList.tsx`
10. `components/AttendanceRecordList.tsx`
11. (그 외 10개+)

### 마이그레이션 순서

1. **Step 1**: Zustand Store 완전 구현 (3일)
   - Store 파일 생성
   - 인터페이스 정의
   - Firebase 구독 로직 이전
   - Selectors/Actions 구현

2. **Step 2**: 모든 사용처 일괄 변경 (3일)
   - grep으로 사용처 검색
   - 각 컴포넌트 마이그레이션
   - 개별 테스트

3. **Step 3**: Context 완전 제거 (0.5일)
   - `UnifiedDataContext.tsx` 삭제
   - `App.tsx`에서 Provider 제거

4. **Step 4**: 테스트 및 검증 (2일)
   - 단위 테스트 작성
   - 통합 테스트
   - 성능 벤치마크

---

## 테스트 작성 방법

### 단위 테스트

**경로**: `app2/src/stores/__tests__/unifiedDataStore.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useUnifiedDataStore } from '../unifiedDataStore';

describe('UnifiedDataStore', () => {
  beforeEach(() => {
    // 각 테스트 전에 Store 초기화
    const { result } = renderHook(() => useUnifiedDataStore());
    act(() => {
      result.current.setStaff(new Map());
      result.current.setWorkLogs(new Map());
      result.current.setError(null);
    });
  });

  describe('Selectors', () => {
    it('getStaffById - 존재하는 ID로 조회 시 Staff 반환', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const staff = {
        id: 'staff123',
        name: '홍길동',
        role: 'dealer',
      };

      act(() => {
        result.current.updateStaff(staff);
      });

      const retrieved = result.current.getStaffById('staff123');
      expect(retrieved).toEqual(staff);
    });

    it('getStaffById - 존재하지 않는 ID로 조회 시 undefined 반환', () => {
      const { result } = renderHook(() => useUnifiedDataStore());
      const retrieved = result.current.getStaffById('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('getWorkLogsByStaffId - 올바른 필터링', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const workLogs = new Map([
        ['log1', { id: 'log1', staffId: 'staff123', eventId: 'event1', date: '2024-01-01' }],
        ['log2', { id: 'log2', staffId: 'staff456', eventId: 'event2', date: '2024-01-02' }],
        ['log3', { id: 'log3', staffId: 'staff123', eventId: 'event3', date: '2024-01-03' }],
      ]);

      act(() => {
        result.current.setWorkLogs(workLogs);
      });

      const filtered = result.current.getWorkLogsByStaffId('staff123');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('log1');
      expect(filtered[1].id).toBe('log3');
    });
  });

  describe('Actions', () => {
    it('updateStaff - 새 Staff 추가', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const staff = {
        id: 'staff123',
        name: '홍길동',
        role: 'dealer',
      };

      act(() => {
        result.current.updateStaff(staff);
      });

      expect(result.current.staff.size).toBe(1);
      expect(result.current.staff.get('staff123')).toEqual(staff);
    });

    it('deleteStaff - Staff 삭제', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      const staff = {
        id: 'staff123',
        name: '홍길동',
        role: 'dealer',
      };

      act(() => {
        result.current.updateStaff(staff);
        result.current.deleteStaff('staff123');
      });

      expect(result.current.staff.size).toBe(0);
      expect(result.current.staff.get('staff123')).toBeUndefined();
    });

    it('setLoading - 로딩 상태 변경', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('setError - 에러 상태 변경', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      act(() => {
        result.current.setError('Firebase 연결 실패');
      });

      expect(result.current.error).toBe('Firebase 연결 실패');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Performance', () => {
    it('shallow 비교로 불필요한 리렌더링 방지', () => {
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useUnifiedDataStore(
          (state) => ({
            staff: state.staff,
            workLogs: state.workLogs,
          }),
          (a, b) => a.staff === b.staff && a.workLogs === b.workLogs
        );
      });

      const initialRenderCount = renderCount;

      // staff 변경 시 리렌더링
      act(() => {
        result.current.staff.set('staff123', { id: 'staff123', name: '홍길동', role: 'dealer' });
      });

      expect(renderCount).toBe(initialRenderCount + 1);

      // 다른 상태 변경 시 리렌더링 없음
      act(() => {
        const store = useUnifiedDataStore.getState();
        store.setError('Some error');
      });

      expect(renderCount).toBe(initialRenderCount + 1); // 리렌더링 없음
    });
  });
});
```

### 통합 테스트

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useUnifiedDataStore } from '../unifiedDataStore';
import { collection, onSnapshot } from 'firebase/firestore';

// Firebase mock
jest.mock('firebase/firestore');

describe('UnifiedDataStore - Firebase Integration', () => {
  it('subscribeAll - Firebase 실시간 구독 시작', async () => {
    const { result } = renderHook(() => useUnifiedDataStore());

    const mockUnsubscribe = jest.fn();
    (onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

    act(() => {
      result.current.subscribeAll('user123', 'admin');
    });

    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('unsubscribeAll - 모든 구독 정리', () => {
    const { result } = renderHook(() => useUnifiedDataStore());

    const mockUnsubscribe = jest.fn();
    (onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

    act(() => {
      result.current.subscribeAll('user123', 'admin');
      result.current.unsubscribeAll();
    });

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
```

### 테스트 실행

```bash
cd app2

# 전체 테스트 실행
npm run test

# 단일 파일 테스트
npm run test unifiedDataStore.test.ts

# Watch 모드
npm run test -- --watch

# 커버리지 확인
npm run test:coverage
```

---

## Redux DevTools 사용법

### 1. 브라우저 확장 설치

**Chrome/Edge**: [Redux DevTools Extension](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)

### 2. DevTools 열기

1. 브라우저에서 개발자 도구 열기 (`F12`)
2. **Redux** 탭 선택
3. **UnifiedDataStore** 인스턴스 확인

### 3. 주요 기능

#### State 추적

- **현재 상태**: 오른쪽 패널에서 전체 Store 상태 확인
- **상태 변화**: 타임라인에서 action별 상태 변화 추적

#### Time-Travel Debugging

- **과거 상태 복원**: 타임라인에서 특정 시점 클릭
- **Diff 확인**: 상태 변화 전후 비교
- **Jump**: 특정 action으로 이동

#### Action 추적

```typescript
// Store에서 발생한 모든 action 확인
- "updateStaff" (staff123)
- "setLoading" (true)
- "setError" (null)
- "deleteStaff" (staff456)
```

#### Export/Import State

- **Export**: 현재 상태를 JSON 파일로 저장
- **Import**: 저장된 상태를 불러와서 테스트

### 4. DevTools 사용 예시

```typescript
// Store 생성 시 devtools 미들웨어 추가
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // ...
    })),
    {
      name: 'UnifiedDataStore', // DevTools에 표시될 이름
      enabled: process.env.NODE_ENV === 'development', // 개발 환경에서만 활성화
    }
  )
);
```

---

## 트러블슈팅

### 문제 1: 리렌더링이 너무 자주 발생

**원인**: Selector 없이 전체 Store를 구독함

```typescript
// ❌ 나쁜 예
const store = useUnifiedDataStore();
```

**해결책**: Selector로 필요한 값만 조회

```typescript
// ✅ 좋은 예
const staff = useUnifiedDataStore((state) => state.staff);
```

### 문제 2: Map이 업데이트되는데 UI가 반영 안 됨

**원인**: Map을 직접 수정하면 참조가 변경되지 않아 리렌더링이 발생하지 않음

```typescript
// ❌ 나쁜 예 (immer 없이)
set((state) => {
  state.staff.set('staff123', newStaff); // 참조 변경 없음
  return state;
});
```

**해결책**: immer 미들웨어 사용

```typescript
// ✅ 좋은 예 (immer 사용)
set((state) => {
  state.staff.set('staff123', newStaff); // immer가 자동으로 불변성 처리
});
```

### 문제 3: TypeScript 타입 에러

**원인**: Selector 타입이 자동 추론되지 않음

```typescript
// ❌ 타입 에러 발생
const data = useUnifiedDataStore((state) => ({
  staff: state.staff,
  getStaffById: state.getStaffById,
}));
```

**해결책**: 명시적 타입 지정 또는 shallow 사용

```typescript
// ✅ shallow 사용
import { shallow } from 'zustand/shallow';

const data = useUnifiedDataStore(
  (state) => ({
    staff: state.staff,
    getStaffById: state.getStaffById,
  }),
  shallow
);
```

### 문제 4: Firebase 구독이 정리되지 않음

**원인**: unsubscribeAll()을 호출하지 않음

```typescript
// ❌ 메모리 누수 발생
useEffect(() => {
  subscribeAll('user123', 'admin');
  // cleanup 없음
}, []);
```

**해결책**: useEffect cleanup에서 unsubscribeAll 호출

```typescript
// ✅ 메모리 누수 방지
useEffect(() => {
  subscribeAll('user123', 'admin');
  return () => {
    unsubscribeAll(); // cleanup
  };
}, [subscribeAll, unsubscribeAll]);
```

### 문제 5: Redux DevTools에 연결 안 됨

**원인**: devtools 미들웨어가 올바르게 설정되지 않음

```typescript
// ❌ devtools 없음
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  immer((set, get) => ({
    // ...
  }))
);
```

**해결책**: devtools 미들웨어 추가

```typescript
// ✅ devtools 추가
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // ...
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

---

## 추가 리소스

### 공식 문서

- [Zustand 공식 문서](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [immer 미들웨어](https://docs.pmnd.rs/zustand/integrations/immer-middleware)
- [devtools 미들웨어](https://docs.pmnd.rs/zustand/integrations/redux-devtools)

### 프로젝트 문서

- [CLAUDE.md](../../CLAUDE.md) - UNIQN 프로젝트 개발 가이드
- [spec.md](./spec.md) - Feature Specification

### 유용한 패키지

```bash
# Zustand 관련
npm install zustand
npm install immer

# TypeScript 타입
npm install -D @types/node

# 테스트
npm install -D @testing-library/react
npm install -D @testing-library/react-hooks
npm install -D jest
```

---

## FAQ

### Q1. Context API를 완전히 제거해야 하나요?

**A**: 네, UnifiedDataContext는 완전히 제거하지만, AuthContext, TournamentContext 등 다른 Context는 그대로 유지합니다.

### Q2. 성능이 정말 향상되나요?

**A**: Selector 기반 구독 덕분에 불필요한 리렌더링이 감소합니다. React DevTools Profiler로 측정 시 동일하거나 향상된 성능을 보입니다.

### Q3. 기존 기능이 모두 동일하게 작동하나요?

**A**: 네, 마이그레이션은 순수 리팩토링이므로 사용자가 보는 화면과 기능은 변경되지 않습니다.

### Q4. 얼마나 걸리나요?

**A**: 전체 마이그레이션은 약 8.5일 예상됩니다:
- Step 1: Store 구현 (3일)
- Step 2: 컴포넌트 변경 (3일)
- Step 3: Context 제거 (0.5일)
- Step 4: 테스트 (2일)

### Q5. 롤백이 가능한가요?

**A**: 네, Git 브랜치를 사용하므로 문제 발생 시 이전 버전으로 롤백 가능합니다.

---

**작성자**: Claude Code
**버전**: 1.0.0
**최종 업데이트**: 2025-11-14
