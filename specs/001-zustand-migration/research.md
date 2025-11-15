# Research: Zustand Store Migration Best Practices

**Feature**: UnifiedDataContext를 Zustand Store로 전면 교체
**Branch**: `001-zustand-migration`
**Date**: 2025-11-14
**Researched By**: Claude Code

## Executive Summary

이 문서는 기존 Context API + useReducer 기반의 UnifiedDataContext (782줄)를 Zustand 5.0 Store로 마이그레이션하기 위한 기술 조사 결과를 담고 있습니다. 주요 조사 항목은 Zustand 5.0 베스트 프랙티스, immer/devtools 미들웨어, Firebase 실시간 구독 통합 패턴, Map 메모이제이션, shallow 비교 최적화, TypeScript strict mode 타입 정의입니다.

**핵심 결론**:
- Zustand 5.0의 curried syntax (`create<T>()(...)`)를 사용하여 TypeScript strict mode 완벽 지원
- immer와 devtools 미들웨어를 조합하여 개발자 경험 극대화
- Firebase onSnapshot을 Store actions 내부에서 관리하여 cleanup 보장
- Map 데이터 구조는 shallow 비교로 최적화 가능
- useShallow hook으로 불필요한 리렌더링 방지
- 메모리 누수 방지를 위해 unsubscribe 함수 필수 반환

---

## 1. Zustand 5.0 베스트 프랙티스

### 1.1 Decision: Curried Syntax 사용 (TypeScript strict mode)

**선택**: `create<T>()(...)` curried syntax 사용

**근거**:
- TypeScript strict mode에서 타입 추론이 완벽하게 작동
- 미들웨어와 함께 사용할 때 타입 안전성 보장
- Zustand 공식 문서에서 권장하는 최신 패턴
- 타입 명시적 선언으로 개발자 실수 방지

**대안 검토**:
1. **기본 create 사용**: 타입 추론이 불완전하여 any 타입 발생 가능성 높음 → ❌
2. **combine 미들웨어 사용**: 간단한 상태에는 유용하나 복잡한 actions 정의 시 제약 → ❌
3. **StateCreator 타입 수동 정의**: 보일러플레이트 코드 증가 → ❌

**코드 예시**:
```typescript
import { create } from 'zustand';

interface BearState {
  bears: number;
  increase: (by: number) => void;
}

// ✅ 권장: curried syntax
const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by }))
}));

// ❌ 비권장: 기본 create (타입 추론 불완전)
const useBearStore = create((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by }))
}));
```

### 1.2 Decision: Slices Pattern으로 Store 구조화

**선택**: 단일 Store에 모든 상태를 두지 않고, 논리적으로 분리된 slices 사용

**근거**:
- 각 slice가 특정 도메인(staff, workLogs 등)을 담당하여 관심사 분리
- 코드 가독성 향상 및 유지보수 용이
- 타입 안전성 향상 (각 slice별 독립적 타입 정의)
- 테스트 작성 용이 (slice별 단위 테스트)

**대안 검토**:
1. **단일 거대 Store**: 782줄 Context를 그대로 옮기면 가독성 저하 → ❌
2. **완전 분리된 여러 Store**: Context 간 의존성 관리 복잡 → ❌
3. **Slices Pattern**: 단일 Store 내부에서 논리적 분리 → ✅

**코드 예시**:
```typescript
import { StateCreator } from 'zustand';

// Staff Slice
interface StaffSlice {
  staff: Map<string, Staff>;
  getStaffById: (id: string) => Staff | undefined;
  setStaff: (staff: Map<string, Staff>) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
}

const createStaffSlice: StateCreator<UnifiedDataStore, [], [], StaffSlice> = (set, get) => ({
  staff: new Map(),
  getStaffById: (id) => get().staff.get(id),
  setStaff: (staff) => set({ staff }),
  updateStaff: (staff) => set((state) => {
    const newStaff = new Map(state.staff);
    newStaff.set(staff.id, staff);
    return { staff: newStaff };
  }),
  deleteStaff: (id) => set((state) => {
    const newStaff = new Map(state.staff);
    newStaff.delete(id);
    return { staff: newStaff };
  }),
});

// WorkLog Slice
interface WorkLogSlice {
  workLogs: Map<string, WorkLog>;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
  setWorkLogs: (logs: Map<string, WorkLog>) => void;
}

const createWorkLogSlice: StateCreator<UnifiedDataStore, [], [], WorkLogSlice> = (set, get) => ({
  workLogs: new Map(),
  getWorkLogsByStaffId: (staffId) => {
    const logs = Array.from(get().workLogs.values());
    return logs.filter(log => log.staffId === staffId);
  },
  setWorkLogs: (logs) => set({ workLogs: logs }),
});

// 통합 Store
type UnifiedDataStore = StaffSlice & WorkLogSlice;

export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((...args) => ({
      ...createStaffSlice(...args),
      ...createWorkLogSlice(...args),
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

### 1.3 Decision: any 타입 절대 사용 금지

**선택**: ESLint 규칙으로 any 타입 사용 강제 차단

**근거**:
- TypeScript strict mode의 이점을 완전히 활용
- 런타임 에러 사전 방지
- IDE 자동완성 및 타입 체크 정확도 향상
- 프로젝트 CLAUDE.md 개발 원칙 준수

**ESLint 설정**:
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error"
  }
}
```

---

## 2. immer 미들웨어 사용법

### 2.1 Decision: immer 미들웨어 필수 사용

**선택**: Zustand의 immer 미들웨어를 모든 mutating actions에 적용

**근거**:
- 불변성 관리가 자동화되어 개발자 실수 방지
- 복잡한 중첩 객체 업데이트 시 코드 간결성 향상
- Map 데이터 구조와 함께 사용 시에도 안전
- 성능 저하 거의 없음 (Immer의 최적화된 구조적 공유)

**대안 검토**:
1. **수동 불변성 관리**: `{...state, staff: new Map(state.staff)}` 패턴 반복 → 실수 가능성 ❌
2. **immer 미들웨어 없이 사용**: 코드 복잡도 증가 → ❌
3. **immer 미들웨어 사용**: 간결하고 안전한 코드 → ✅

**코드 예시**:
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface BeeState {
  bees: number;
  staff: Map<string, Staff>;
  addBees: (by: number) => void;
  updateStaff: (staff: Staff) => void;
}

const useBeeStore = create<BeeState>()(
  immer((set) => ({
    bees: 0,
    staff: new Map(),

    // ✅ immer 사용: 직접 수정 가능
    addBees: (by) => set((state) => {
      state.bees += by;
    }),

    // ✅ Map도 직접 수정 가능
    updateStaff: (staff) => set((state) => {
      state.staff.set(staff.id, staff);
    }),
  }))
);

// ❌ immer 없이 수동 관리 (비권장)
const useBeeStoreManual = create<BeeState>()((set) => ({
  bees: 0,
  staff: new Map(),

  addBees: (by) => set((state) => ({ bees: state.bees + by })),

  updateStaff: (staff) => set((state) => {
    const newStaff = new Map(state.staff);
    newStaff.set(staff.id, staff);
    return { staff: newStaff };
  }),
}));
```

### 2.2 Decision: immer와 Map 데이터 구조 조합

**선택**: Map을 immer 내부에서 안전하게 사용

**근거**:
- Immer는 Map, Set 등 ES6 컬렉션을 네이티브 지원
- `.set()`, `.delete()` 등 Map 메서드를 직접 호출 가능
- 불변성 자동 보장으로 버그 방지

**주의사항**:
- Immer는 draft 상태를 추적하므로, Map 내부에서도 안전하게 수정 가능
- 단, 반환 값이 있는 경우 명시적으로 return 필요

**코드 예시**:
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface StaffState {
  staff: Map<string, Staff>;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
  batchUpdateStaff: (staffList: Staff[]) => void;
}

const useStaffStore = create<StaffState>()(
  immer((set) => ({
    staff: new Map(),

    // ✅ Map.set() 직접 사용 가능
    updateStaff: (staff) => set((state) => {
      state.staff.set(staff.id, staff);
    }),

    // ✅ Map.delete() 직접 사용 가능
    deleteStaff: (id) => set((state) => {
      state.staff.delete(id);
    }),

    // ✅ 여러 Map 연산 조합 가능
    batchUpdateStaff: (staffList) => set((state) => {
      staffList.forEach(staff => {
        state.staff.set(staff.id, staff);
      });
    }),
  }))
);
```

---

## 3. devtools 미들웨어 설정

### 3.1 Decision: devtools 미들웨어 개발 환경에서 필수 활성화

**선택**: Redux DevTools와 연동하여 상태 디버깅 활성화

**근거**:
- Time-travel 디버깅으로 상태 변화 추적 용이
- Action 히스토리 확인으로 버그 원인 파악 빠름
- 개발 생산성 크게 향상
- 프로덕션에서는 자동 비활성화 가능

**대안 검토**:
1. **devtools 미사용**: 디버깅 어려움, 상태 추적 불가 → ❌
2. **console.log 디버깅**: 비효율적이고 logger 사용 원칙 위배 → ❌
3. **devtools 미들웨어 사용**: 최고의 디버깅 경험 → ✅

**설치 방법**:
```bash
npm install @redux-devtools/extension --save-dev
```

**코드 예시**:
```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {} from '@redux-devtools/extension'; // TypeScript 타입 지원

interface BearState {
  bears: number;
  increase: (by: number) => void;
}

const useBearStore = create<BearState>()(
  devtools(
    (set) => ({
      bears: 0,
      increase: (by) => set((state) => ({ bears: state.bears + by })),
    }),
    {
      name: 'BearStore', // DevTools에 표시될 이름
      enabled: process.env.NODE_ENV === 'development', // 프로덕션에서 비활성화
    }
  )
);
```

### 3.2 Decision: devtools + immer + persist 미들웨어 조합

**선택**: devtools를 가장 바깥쪽에, immer를 내부에 배치

**근거**:
- Zustand 공식 문서 권장 패턴
- devtools가 마지막에 있어야 setState 추적 정확
- 미들웨어 순서가 타입 추론에 영향

**미들웨어 순서**:
```
devtools(
  persist(
    immer(
      // store implementation
    )
  )
)
```

**코드 예시**:
```typescript
import { create, StateCreator } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {} from '@redux-devtools/extension';

interface State {
  count: number;
}

interface Actions {
  increment: (qty: number) => void;
  decrement: (qty: number) => void;
}

type Store = State & Actions;

const useStore = create<Store>()(
  devtools(
    persist(
      immer((set) => ({
        count: 0,

        increment: (qty: number) => set((state) => {
          state.count += qty;
        }),

        decrement: (qty: number) => set((state) => {
          state.count -= qty;
        }),
      })),
      { name: 'count-storage' }
    ),
    { name: 'CounterStore' }
  )
);
```

### 3.3 Decision: Action 이름 명시적으로 지정

**선택**: devtools에서 action 이름을 명확하게 표시

**근거**:
- Redux DevTools에서 action 추적 용이
- 복잡한 Store에서 어떤 action이 실행되었는지 명확히 확인
- 디버깅 시 시간 절약

**코드 예시**:
```typescript
const useStaffStore = create<StaffState>()(
  devtools(
    immer((set) => ({
      staff: new Map(),

      // ✅ Action 이름 명시
      updateStaff: (staff) => set((state) => {
        state.staff.set(staff.id, staff);
      }, false, 'updateStaff'), // 세 번째 인자: action 이름

      deleteStaff: (id) => set((state) => {
        state.staff.delete(id);
      }, false, 'deleteStaff'),
    })),
    { name: 'StaffStore' }
  )
);
```

---

## 4. Firebase 실시간 구독과 Zustand 통합 패턴

### 4.1 Decision: Store actions 내부에서 onSnapshot 구독 관리

**선택**: `subscribeAll()` 및 `unsubscribeAll()` actions를 Store에 정의하여 Firebase 구독 관리

**근거**:
- Store가 구독 생명주기를 완전히 제어
- cleanup 로직이 Store 내부에 캡슐화되어 메모리 누수 방지
- 컴포넌트는 단순히 useEffect에서 Store actions만 호출
- Context API에서 사용하던 패턴을 그대로 적용 가능

**대안 검토**:
1. **컴포넌트에서 직접 onSnapshot 호출**: 중복 코드, cleanup 누락 위험 → ❌
2. **Custom Hook으로 분리**: Store와 분리되어 상태 관리 복잡 → ❌
3. **Store actions로 통합**: 단일 책임 원칙, cleanup 보장 → ✅

**코드 예시**:
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { collection, onSnapshot, query, where, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UnifiedDataStore {
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  isLoading: boolean;
  error: string | null;

  // Firebase 구독 관리
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;
}

// 구독 함수들을 Store 외부에 저장
let staffUnsubscribe: Unsubscribe | null = null;
let workLogsUnsubscribe: Unsubscribe | null = null;

export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      staff: new Map(),
      workLogs: new Map(),
      isLoading: false,
      error: null,

      // ✅ 모든 Firebase 구독 시작
      subscribeAll: (userId, role) => {
        set({ isLoading: true, error: null });

        try {
          // Staff 구독
          const staffQuery = query(collection(db, 'staff'));
          staffUnsubscribe = onSnapshot(
            staffQuery,
            (snapshot) => {
              const staffMap = new Map<string, Staff>();
              snapshot.docs.forEach(doc => {
                staffMap.set(doc.id, { id: doc.id, ...doc.data() } as Staff);
              });

              set((state) => {
                state.staff = staffMap;
                state.isLoading = false;
              });
            },
            (error) => {
              console.error('Staff subscription error:', error);
              set({ error: error.message, isLoading: false });
            }
          );

          // WorkLogs 구독
          const workLogsQuery = query(collection(db, 'workLogs'));
          workLogsUnsubscribe = onSnapshot(
            workLogsQuery,
            (snapshot) => {
              const logsMap = new Map<string, WorkLog>();
              snapshot.docs.forEach(doc => {
                logsMap.set(doc.id, { id: doc.id, ...doc.data() } as WorkLog);
              });

              set((state) => {
                state.workLogs = logsMap;
              });
            },
            (error) => {
              console.error('WorkLogs subscription error:', error);
              set({ error: error.message });
            }
          );
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      // ✅ 모든 Firebase 구독 정리
      unsubscribeAll: () => {
        if (staffUnsubscribe) {
          staffUnsubscribe();
          staffUnsubscribe = null;
        }

        if (workLogsUnsubscribe) {
          workLogsUnsubscribe();
          workLogsUnsubscribe = null;
        }

        // Store 초기화
        set({
          staff: new Map(),
          workLogs: new Map(),
          isLoading: false,
          error: null,
        });
      },
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

### 4.2 Decision: 컴포넌트에서 useEffect로 구독 관리

**선택**: 최상위 컴포넌트(App.tsx)에서 useEffect로 subscribeAll/unsubscribeAll 호출

**근거**:
- 컴포넌트 생명주기와 Firebase 구독 생명주기 동기화
- cleanup 함수로 자동 구독 해제 보장
- 로그아웃 시 자동으로 unsubscribeAll 호출

**코드 예시**:
```typescript
// App.tsx
import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useUnifiedDataStore } from './stores/unifiedDataStore';

function App() {
  const { currentUser, role } = useAuth();
  const { subscribeAll, unsubscribeAll } = useUnifiedDataStore();

  useEffect(() => {
    if (currentUser && role) {
      // ✅ 로그인 시 구독 시작
      subscribeAll(currentUser.uid, role);

      // ✅ cleanup: 로그아웃 시 자동 구독 해제
      return () => {
        unsubscribeAll();
      };
    }
  }, [currentUser, role, subscribeAll, unsubscribeAll]);

  return (
    <div className="App">
      {/* 앱 컨텐츠 */}
    </div>
  );
}
```

### 4.3 Decision: 에러 처리 및 재시도 로직

**선택**: onSnapshot 에러 콜백에서 에러 상태 업데이트, 재시도는 별도 처리

**근거**:
- Firebase 연결 끊김 시 자동 재연결 지원
- 에러 상태를 Store에 저장하여 UI에서 표시 가능
- 재시도 로직은 복잡도를 높이므로 초기 버전에서는 제외

**코드 예시**:
```typescript
subscribeAll: (userId, role) => {
  set({ isLoading: true, error: null });

  const staffQuery = query(collection(db, 'staff'));
  staffUnsubscribe = onSnapshot(
    staffQuery,
    (snapshot) => {
      // 성공 처리
      set((state) => {
        state.staff = /* ... */;
        state.isLoading = false;
        state.error = null; // ✅ 에러 초기화
      });
    },
    (error) => {
      // ✅ 에러 처리
      console.error('Staff subscription error:', error);
      set({
        error: error.message,
        isLoading: false
      });

      // Firebase는 자동으로 재연결 시도
      // 수동 재시도는 필요 시 추가
    }
  );
},
```

---

## 5. Map 데이터 구조 메모이제이션 전략

### 5.1 Decision: Map을 State로 사용하되 shallow 비교 활용

**선택**: `Map<string, T>` 형태로 데이터 저장, useShallow로 비교

**근거**:
- 기존 Context에서 Map 사용 중이므로 일관성 유지
- Map은 O(1) 조회 성능 보장
- Zustand의 shallow 비교가 Map을 최적화 지원
- 불필요한 리렌더링 방지

**대안 검토**:
1. **Object 사용**: TypeScript 타입 안전성 낮음, 프로토타입 오염 위험 → ❌
2. **Array 사용**: 조회 시 O(n) 성능, 비효율 → ❌
3. **Map 사용 + shallow 비교**: O(1) 조회, 최적화 지원 → ✅

**shallow 비교 동작 방식**:
```typescript
const mapLeft = new Map([[1, 'one'], [2, 'two'], [3, 'three']]);
const mapRight = new Map([[1, 'one'], [2, 'two'], [3, 'three']]);

Object.is(mapLeft, mapRight); // → false (참조 비교)
shallow(mapLeft, mapRight);    // → true (내용 비교)
```

**코드 예시**:
```typescript
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

interface StaffState {
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
}

const useStaffStore = create<StaffState>()((set) => ({
  staff: new Map(),
  workLogs: new Map(),
}));

// 컴포넌트에서 사용
function MyComponent() {
  // ❌ 비효율적: 매번 리렌더링
  const { staff, workLogs } = useStaffStore();

  // ✅ 효율적: shallow 비교로 최적화
  const { staff, workLogs } = useStaffStore(
    useShallow((state) => ({
      staff: state.staff,
      workLogs: state.workLogs,
    }))
  );

  // ✅ 단일 값: shallow 불필요
  const staff = useStaffStore((state) => state.staff);

  return <div>{/* ... */}</div>;
}
```

### 5.2 Decision: Selector 함수 메모이제이션

**선택**: 복잡한 계산이 필요한 selector는 메모이제이션 적용

**근거**:
- 필터링, 정렬 등 연산 비용이 높은 경우 성능 향상
- Zustand는 selector가 동일한 결과를 반환하면 리렌더링 안 함
- 과도한 메모이제이션은 오히려 성능 저하 (측정 후 적용)

**코드 예시**:
```typescript
import { create } from 'zustand';

interface UnifiedDataStore {
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;

  // ✅ 간단한 selector: 메모이제이션 불필요 (Zustand가 자동 처리)
  getStaffById: (id: string) => Staff | undefined;

  // ✅ 복잡한 selector: Store 내부에서 메모이제이션
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
}

const useUnifiedDataStore = create<UnifiedDataStore>()((set, get) => {
  // 캐시 저장소
  const cache = new Map<string, WorkLog[]>();

  return {
    staff: new Map(),
    workLogs: new Map(),

    getStaffById: (id) => get().staff.get(id),

    // ✅ 메모이제이션 적용
    getWorkLogsByStaffId: (staffId) => {
      const workLogs = get().workLogs;
      const cacheKey = `${staffId}-${workLogs.size}`;

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
      }

      const result = Array.from(workLogs.values())
        .filter(log => log.staffId === staffId);

      cache.set(cacheKey, result);
      return result;
    },
  };
});
```

### 5.3 Decision: reselect 라이브러리는 필요 시에만 사용

**선택**: 초기 버전에서는 Zustand 내장 메모이제이션만 사용, 성능 문제 발생 시 reselect 도입

**근거**:
- Zustand의 기본 selector 메모이제이션으로 대부분 충분
- reselect 추가 시 복잡도 증가
- 측정 후 필요 시 점진적 도입 (YAGNI 원칙)

**코드 예시**:
```typescript
// ✅ 초기 버전: Zustand 내장 메모이제이션
const useStaffStore = create<StaffState>()((set, get) => ({
  staff: new Map(),

  getActiveStaff: () => {
    // Zustand가 자동으로 메모이제이션
    return Array.from(get().staff.values())
      .filter(s => s.status === 'active');
  },
}));

// 🔄 성능 문제 발생 시: reselect 도입
import { createSelector } from 'reselect';

const selectStaff = (state: StaffState) => state.staff;
const selectActiveStaff = createSelector(
  [selectStaff],
  (staff) => Array.from(staff.values()).filter(s => s.status === 'active')
);

const useStaffStoreWithReselect = create<StaffState>()((set, get) => ({
  staff: new Map(),
  getActiveStaff: () => selectActiveStaff(get()),
}));
```

---

## 6. shallow 비교 최적화 기법

### 6.1 Decision: useShallow hook 사용 (Zustand 4.5+)

**선택**: `useShallow` hook을 통해 shallow 비교 적용

**근거**:
- Zustand 4.5+ 공식 권장 방법
- 이전 버전의 `shallow` import보다 타입 안전
- React 18의 useSyncExternalStore와 호환
- 불필요한 리렌더링 방지 효과 확인됨

**대안 검토**:
1. **shallow 직접 import**: 레거시 방식, useShallow 권장 → ❌
2. **useShallow 사용**: 최신 권장 방식 → ✅

**마이그레이션 예시**:
```typescript
// ❌ 레거시 방식 (Zustand 3.x)
import { shallow } from 'zustand/shallow';

const { staff, workLogs } = useUnifiedDataStore(
  (state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
  }),
  shallow
);

// ✅ 최신 방식 (Zustand 4.5+)
import { useShallow } from 'zustand/react/shallow';

const { staff, workLogs } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
  }))
);
```

### 6.2 Decision: shallow 비교 사용 시나리오

**선택**: 여러 값을 동시에 선택할 때만 useShallow 사용

**근거**:
- 단일 값 선택 시에는 Zustand가 자동으로 참조 비교
- 객체 반환 시 매번 새 객체가 생성되므로 shallow 필요
- 성능 측정 후 필요한 곳에만 적용

**사용 가이드라인**:
```typescript
import { useShallow } from 'zustand/react/shallow';

// ✅ 단일 값: useShallow 불필요
const staff = useUnifiedDataStore((state) => state.staff);

// ✅ 단일 primitive: useShallow 불필요
const isLoading = useUnifiedDataStore((state) => state.isLoading);

// ✅ 여러 값: useShallow 필수
const { staff, workLogs, isLoading } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
    isLoading: state.isLoading,
  }))
);

// ✅ selector + action: useShallow 필수
const { getStaffById, updateStaff } = useUnifiedDataStore(
  useShallow((state) => ({
    getStaffById: state.getStaffById,
    updateStaff: state.updateStaff,
  }))
);
```

### 6.3 Decision: Map 데이터 shallow 비교 최적화

**선택**: Map 전체를 비교할 때는 useShallow 사용, 개별 값 조회는 selector 사용

**근거**:
- Zustand의 shallow는 Map을 내용 기반으로 비교
- 개별 값 조회(`.get()`)는 참조 비교로 충분
- 성능과 정확성의 균형

**코드 예시**:
```typescript
import { useShallow } from 'zustand/react/shallow';

interface StaffState {
  staff: Map<string, Staff>;
  getStaffById: (id: string) => Staff | undefined;
}

const useStaffStore = create<StaffState>()((set, get) => ({
  staff: new Map(),
  getStaffById: (id) => get().staff.get(id),
}));

// ✅ Map 전체 사용: useShallow
function AllStaffList() {
  const staff = useStaffStore(
    useShallow((state) => state.staff)
  );

  return (
    <ul>
      {Array.from(staff.values()).map(s => (
        <li key={s.id}>{s.name}</li>
      ))}
    </ul>
  );
}

// ✅ 개별 값 조회: selector (useShallow 불필요)
function StaffDetail({ staffId }: { staffId: string }) {
  const getStaffById = useStaffStore((state) => state.getStaffById);
  const staff = getStaffById(staffId);

  if (!staff) return <div>Not found</div>;

  return <div>{staff.name}</div>;
}

// ✅ 필터링된 배열: useMemo + useShallow
function ActiveStaffList() {
  const staff = useStaffStore(
    useShallow((state) => state.staff)
  );

  const activeStaff = useMemo(() => {
    return Array.from(staff.values())
      .filter(s => s.status === 'active');
  }, [staff]);

  return (
    <ul>
      {activeStaff.map(s => (
        <li key={s.id}>{s.name}</li>
      ))}
    </ul>
  );
}
```

### 6.4 Decision: 성능 측정 후 최적화 적용

**선택**: React DevTools Profiler로 측정 후 필요한 곳에만 최적화 적용

**근거**:
- 조기 최적화는 복잡도만 높임 (Premature Optimization)
- 실제 성능 병목을 측정 후 해결
- 유지보수성과 성능의 균형

**측정 방법**:
1. React DevTools Profiler에서 리렌더링 횟수 확인
2. 불필요한 리렌더링이 발생하는 컴포넌트 식별
3. useShallow, useMemo, useCallback 적용
4. 재측정하여 개선 확인

---

## 7. TypeScript strict mode에서의 Zustand 타입 정의

### 7.1 Decision: 엄격한 타입 정의로 any 완전 제거

**선택**: 모든 State, Actions, Selectors에 명시적 타입 정의

**근거**:
- TypeScript strict mode 에러 0개 달성
- IDE 자동완성 및 타입 체크 완벽 지원
- 런타임 에러 사전 방지
- 프로젝트 CLAUDE.md 개발 원칙 준수

**타입 정의 패턴**:
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

// ✅ 엔티티 타입 정의
interface Staff {
  id: string;
  name: string;
  role: string;
  contact: string;
}

interface WorkLog {
  id: string;
  staffId: string;
  eventId: string;
  date: string;
  hours: number;
}

// ✅ State 타입 정의
interface State {
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  isLoading: boolean;
  error: string | null;
}

// ✅ Selectors 타입 정의
interface Selectors {
  getStaffById: (id: string) => Staff | undefined;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
}

// ✅ Actions 타입 정의
interface Actions {
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;
  setStaff: (staff: Map<string, Staff>) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
}

// ✅ 통합 타입
type UnifiedDataStore = State & Selectors & Actions;

// ✅ Store 생성 (타입 안전성 100%)
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // State 초기화
      staff: new Map<string, Staff>(),
      workLogs: new Map<string, WorkLog>(),
      isLoading: false,
      error: null,

      // Selectors
      getStaffById: (id: string): Staff | undefined => {
        return get().staff.get(id);
      },

      getWorkLogsByStaffId: (staffId: string): WorkLog[] => {
        const logs = Array.from(get().workLogs.values());
        return logs.filter(log => log.staffId === staffId);
      },

      // Actions
      subscribeAll: (userId: string, role: string): void => {
        set({ isLoading: true, error: null });
        // Firebase 구독 로직
      },

      unsubscribeAll: (): void => {
        // cleanup 로직
        set({
          staff: new Map(),
          workLogs: new Map(),
          isLoading: false,
          error: null,
        });
      },

      setStaff: (staff: Map<string, Staff>): void => {
        set({ staff });
      },

      updateStaff: (staff: Staff): void => {
        set((state) => {
          state.staff.set(staff.id, staff);
        });
      },

      deleteStaff: (id: string): void => {
        set((state) => {
          state.staff.delete(id);
        });
      },
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

### 7.2 Decision: StateCreator 타입으로 Slices 정의

**선택**: 각 slice를 `StateCreator<T, [], [], S>` 타입으로 정의

**근거**:
- 미들웨어 타입 추론 완벽 지원
- 여러 slice를 조합할 때 타입 안전성 보장
- Zustand 공식 문서 권장 패턴

**코드 예시**:
```typescript
import { StateCreator } from 'zustand';

// ✅ Staff Slice 타입 정의
interface StaffSlice {
  staff: Map<string, Staff>;
  getStaffById: (id: string) => Staff | undefined;
  updateStaff: (staff: Staff) => void;
}

// ✅ WorkLog Slice 타입 정의
interface WorkLogSlice {
  workLogs: Map<string, WorkLog>;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
}

// ✅ 통합 Store 타입
type UnifiedDataStore = StaffSlice & WorkLogSlice;

// ✅ StateCreator로 Slice 정의 (타입 안전)
const createStaffSlice: StateCreator<
  UnifiedDataStore,  // 전체 Store 타입
  [],                // 미들웨어 (없음)
  [],                // 미들웨어 (없음)
  StaffSlice         // 이 Slice의 타입
> = (set, get) => ({
  staff: new Map(),

  getStaffById: (id) => get().staff.get(id),

  updateStaff: (staff) => set((state) => ({
    ...state,
    staff: new Map(state.staff).set(staff.id, staff),
  })),
});

const createWorkLogSlice: StateCreator<
  UnifiedDataStore,
  [],
  [],
  WorkLogSlice
> = (set, get) => ({
  workLogs: new Map(),

  getWorkLogsByStaffId: (staffId) => {
    return Array.from(get().workLogs.values())
      .filter(log => log.staffId === staffId);
  },
});

// ✅ Slices 조합
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((...args) => ({
      ...createStaffSlice(...args),
      ...createWorkLogSlice(...args),
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

### 7.3 Decision: 타입 가드 함수로 런타임 안전성 강화

**선택**: Firebase 데이터를 파싱할 때 타입 가드 함수 사용

**근거**:
- Firebase에서 온 데이터의 타입 보장 불가
- 런타임 에러 방지
- TypeScript strict mode와 완벽 호환

**코드 예시**:
```typescript
// ✅ 타입 가드 함수 정의
function isStaff(data: unknown): data is Staff {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.role === 'string' &&
    typeof obj.contact === 'string'
  );
}

// ✅ Firebase 데이터 파싱 시 사용
subscribeAll: (userId, role) => {
  const staffQuery = query(collection(db, 'staff'));

  staffUnsubscribe = onSnapshot(
    staffQuery,
    (snapshot) => {
      const staffMap = new Map<string, Staff>();

      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };

        // ✅ 타입 가드로 검증
        if (isStaff(data)) {
          staffMap.set(doc.id, data);
        } else {
          console.error('Invalid staff data:', data);
        }
      });

      set({ staff: staffMap });
    }
  );
},
```

---

## 8. 메모리 누수 방지 및 Cleanup 패턴

### 8.1 Decision: unsubscribe 함수 반드시 호출

**선택**: Firebase onSnapshot이 반환하는 unsubscribe 함수를 Store에 저장하고, unsubscribeAll에서 호출

**근거**:
- 메모리 누수 방지 (구독이 계속 유지되면 메모리 사용 증가)
- Zustand Store는 싱글톤이므로 구독 관리 중앙화
- 로그아웃 시 자동으로 cleanup 보장

**안티패턴**:
```typescript
// ❌ 나쁜 예: unsubscribe 호출 안 함
subscribeAll: (userId, role) => {
  onSnapshot(query(collection(db, 'staff')), (snapshot) => {
    // 데이터 처리
  });
  // unsubscribe 함수를 저장하지 않음 → 메모리 누수!
},
```

**권장 패턴**:
```typescript
// ✅ 좋은 예: unsubscribe 함수 저장 및 호출
let staffUnsubscribe: Unsubscribe | null = null;

const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set) => ({
      subscribeAll: (userId, role) => {
        // ✅ unsubscribe 함수 저장
        staffUnsubscribe = onSnapshot(
          query(collection(db, 'staff')),
          (snapshot) => {
            // 데이터 처리
          }
        );
      },

      unsubscribeAll: () => {
        // ✅ unsubscribe 호출
        if (staffUnsubscribe) {
          staffUnsubscribe();
          staffUnsubscribe = null;
        }
      },
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

### 8.2 Decision: useEffect cleanup 함수로 컴포넌트 언마운트 처리

**선택**: 최상위 컴포넌트(App.tsx)에서 useEffect의 cleanup 함수로 unsubscribeAll 호출

**근거**:
- 컴포넌트 언마운트 시 자동 cleanup
- 로그아웃 시 자동 cleanup
- React 생명주기와 Firebase 구독 생명주기 동기화

**코드 예시**:
```typescript
// App.tsx
import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useUnifiedDataStore } from './stores/unifiedDataStore';

function App() {
  const { currentUser, role } = useAuth();
  const subscribeAll = useUnifiedDataStore((state) => state.subscribeAll);
  const unsubscribeAll = useUnifiedDataStore((state) => state.unsubscribeAll);

  useEffect(() => {
    if (currentUser && role) {
      // ✅ 로그인 시 구독 시작
      subscribeAll(currentUser.uid, role);

      // ✅ cleanup: 로그아웃 또는 언마운트 시 자동 호출
      return () => {
        unsubscribeAll();
      };
    }
  }, [currentUser, role, subscribeAll, unsubscribeAll]);

  return <div className="App">{/* ... */}</div>;
}
```

### 8.3 Decision: Chrome DevTools Memory Profiler로 메모리 누수 검증

**선택**: 개발 중 정기적으로 메모리 사용량 모니터링

**근거**:
- 메모리 누수는 눈에 보이지 않으므로 도구로 확인 필요
- 10분간 안정적 작동 여부 확인
- 프로덕션 배포 전 검증

**측정 방법**:
1. Chrome DevTools → Performance → Memory 탭
2. "Take heap snapshot" 버튼 클릭
3. 로그인/로그아웃 반복 (10회)
4. 다시 "Take heap snapshot" 클릭
5. 메모리 사용량 비교 (증가 폭이 크면 누수 의심)

---

## 9. 성공 기준 및 검증 방법

### 9.1 타입 체크 검증

**방법**: `npm run type-check`
**기준**: 에러 0개

```bash
cd app2
npm run type-check
```

### 9.2 린트 검증

**방법**: `npm run lint`
**기준**: 에러 0개 (any 타입 사용 금지)

```bash
npm run lint
```

### 9.3 빌드 검증

**방법**: `npm run build`
**기준**: 빌드 성공, 번들 크기 299KB 이하 유지

```bash
npm run build
```

### 9.4 성능 검증

**방법**: React DevTools Profiler
**기준**: 리렌더링 횟수 기존 대비 동일 또는 감소

**측정 단계**:
1. React DevTools → Profiler 탭
2. "Start Profiling" 클릭
3. 페이지 로드 및 상호작용 (staff 추가/수정/삭제)
4. "Stop Profiling" 클릭
5. Flamegraph에서 리렌더링 횟수 확인

### 9.5 메모리 누수 검증

**방법**: Chrome DevTools Memory Profiler
**기준**: 10분간 메모리 사용량 안정적 유지

**측정 단계**:
1. Chrome DevTools → Memory 탭
2. Heap snapshot 촬영
3. 로그인/로그아웃 10회 반복
4. Heap snapshot 재촬영
5. 메모리 증가 폭 확인 (10MB 이하 정상)

### 9.6 실시간 구독 검증

**방법**: Firebase Console에서 수동 수정
**기준**: 3초 이내 UI 반영

**측정 단계**:
1. 브라우저에서 앱 로드
2. Firebase Console → Firestore → staff 컬렉션
3. 특정 문서 수정 (name 필드 변경)
4. 브라우저 UI 자동 업데이트 확인 (3초 이내)

---

## 10. 권장 사항 및 주의사항

### 10.1 권장 사항

1. **점진적 마이그레이션**: 한 번에 모든 컴포넌트를 마이그레이션하지 말고, 페이지별로 순차 진행
2. **테스트 우선**: 각 단계마다 타입 체크, 린트, 수동 테스트 수행
3. **Redux DevTools 활용**: 상태 변화를 실시간으로 추적하며 디버깅
4. **성능 측정**: React Profiler로 리렌더링 횟수를 주기적으로 확인
5. **문서화**: 마이그레이션 과정 및 의사결정 이유를 문서로 남김

### 10.2 주의사항

1. **Map 참조 수정 금지**: immer 없이 직접 `state.staff.set()`을 호출하면 불변성 위반
2. **unsubscribe 누락 방지**: 모든 onSnapshot은 반드시 unsubscribe 함수 저장 및 호출
3. **과도한 메모이제이션 지양**: 측정 후 필요한 곳에만 적용 (Premature Optimization 방지)
4. **타입 가드 사용**: Firebase 데이터 파싱 시 런타임 타입 검증 필수
5. **devtools 프로덕션 비활성화**: `enabled: process.env.NODE_ENV === 'development'`

---

## 11. 참고 자료

### 공식 문서
- [Zustand 공식 문서](https://zustand.docs.pmnd.rs/)
- [Zustand TypeScript 가이드](https://github.com/pmndrs/zustand/blob/main/docs/guides/typescript.md)
- [Immer 미들웨어](https://zustand.docs.pmnd.rs/integrations/immer-middleware)
- [DevTools 미들웨어](https://zustand.docs.pmnd.rs/middlewares/devtools)
- [Firebase Firestore onSnapshot](https://firebase.google.com/docs/firestore/query-data/listen)

### 블로그 및 튜토리얼
- [Zustand + TypeScript: State Management Guide (2024)](https://tillitsdone.com/blogs/zustand-typescript-guide-2024/)
- [Working with selectors in Zustand and Redux](https://greenonsoftware.com/articles/libraries/working-with-selectors-in-zustand-and-redux/)
- [Avoid performance issues when using Zustand](https://dev.to/devgrana/avoid-performance-issues-when-using-zustand-12ee)

### 프로젝트 문서
- [CLAUDE.md](../../CLAUDE.md) - UNIQN 프로젝트 개발 가이드
- [spec.md](./spec.md) - Feature Specification
- [plan.md](./plan.md) - Implementation Plan

---

**최종 업데이트**: 2025-11-14
**다음 단계**: Phase 1 - data-model.md, contracts/, quickstart.md 생성
