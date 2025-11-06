# Phase 0: Research & Best Practices

**Feature**: UnifiedDataContext 테스트 작성
**Date**: 2025-11-06
**Status**: ✅ Completed

## Overview

이 문서는 UnifiedDataContext의 테스트 작성을 위한 연구 결과를 정리합니다. AuthContext 테스트 패턴, Firestore Emulator 설정, 메모이제이션 테스트, React Testing Library 베스트 프랙티스를 다룹니다.

---

## 1. 테스트 패턴 연구

### 1.1 AuthContext 테스트 패턴 분석

**출처**: `app2/src/contexts/__tests__/AuthContext.test.tsx`

#### Mock 전략

```typescript
// ✅ 패턴 1: Firebase Mock (파일 최상단에 배치)
jest.mock('../../firebase', () => ({
  auth: {
    currentUser: null,
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

// ✅ 패턴 2: Utility Mock
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/sentry', () => ({
  setSentryUser: jest.fn(),
}));

// ✅ 패턴 3: Storage Mock (상태를 유지하는 객체)
const mockStorage: Record<string, string> = {};
jest.mock('../../utils/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn((key: string) => mockStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
    clear: jest.fn(() => Object.keys(mockStorage).forEach(k => delete mockStorage[k])),
  },
}));
```

**UnifiedDataContext 적용 방안**:
- `firebase` mock: Firestore 구독 함수 mock
- `logger` mock: 동일 패턴 적용
- `OptimizedUnifiedDataService` mock: 서비스 레이어 mock

#### renderHook 사용법

```typescript
import { renderHook, waitFor, act } from '@testing-library/react';

test('useAuth Hook returns all context values', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

  // 비동기 상태 대기
  await waitFor(() => expect(result.current.loading).toBe(false));

  // 상태 검증
  expect(result.current).toHaveProperty('currentUser');
  expect(result.current.currentUser).toBeNull();
});
```

**UnifiedDataContext 적용 방안**:
```typescript
const { result } = renderHook(() => useUnifiedData(), {
  wrapper: ({ children }) => (
    <AuthProvider>
      <UnifiedDataProvider>{children}</UnifiedDataProvider>
    </AuthProvider>
  )
});
```

#### 테스트 격리 (Isolation)

```typescript
describe('AuthContext - User Story 1', () => {
  beforeEach(() => {
    // localStorage 초기화
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      },
      writable: true,
      configurable: true,
    });

    // Mock 초기화
    jest.clearAllMocks();
  });
});
```

**UnifiedDataContext 적용 방안**:
- `beforeEach`에서 mockStorage, Firestore mock 초기화
- `afterEach`에서 Firestore 구독 cleanup 검증

#### 에러 핸들링 테스트

```typescript
// Mock 에러 객체 (test-errors.ts)
export const wrongPasswordError = {
  code: 'auth/wrong-password',
  message: 'The password is invalid',
};

export const networkError = {
  code: 'auth/network-request-failed',
  message: 'A network error occurred',
};

// 테스트
test('signIn handles network errors', async () => {
  mockSignInWithEmailAndPassword.mockRejectedValueOnce(networkError);

  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

  await act(async () => {
    await expect(result.current.signIn('test@test.com', 'password'))
      .rejects.toThrow('A network error occurred');
  });
});
```

**UnifiedDataContext 적용 방안**:
- Firestore 에러 객체 생성 (`permission-denied`, `unavailable` 등)
- 네트워크 에러, 권한 에러, 데이터 형식 오류 시나리오

---

## 2. Firestore Emulator 연구

### 2.1 Emulator 설정

**Decision**: **Emulator 대신 Mock 사용**

**Rationale**:
- AuthContext 테스트에서 Firebase 전체를 mock으로 처리하는 패턴이 확립됨
- Firestore Emulator는 추가 설정과 프로세스 관리 필요
- Mock 방식이 더 빠르고 격리된 테스트 환경 제공

**Mock Firestore 구조**:
```typescript
// test-firestore.ts
export const mockFirestore = {
  collection: jest.fn((collectionName: string) => ({
    doc: jest.fn((docId: string) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockData[collectionName]?.[docId],
      }),
    })),
    where: jest.fn(() => ({
      onSnapshot: jest.fn((callback) => {
        callback({ docs: [] });
        return jest.fn(); // unsubscribe
      }),
    })),
    onSnapshot: jest.fn((callback) => {
      callback({ docs: [] });
      return jest.fn(); // unsubscribe
    }),
  })),
};
```

### 2.2 fake-indexeddb 통합

**Decision**: **fake-indexeddb 사용 (이미 프로젝트에 설치됨)**

**Setup**:
```typescript
// jest.setup.ts (또는 테스트 파일 상단)
import 'fake-indexeddb/auto';
```

**Alternatives Considered**:
- 실제 IndexedDB: 브라우저 환경 필요, 테스트 속도 느림
- LocalStorage Mock: IndexedDB 기능 제한적

---

## 3. 메모이제이션 테스트 연구

### 3.1 Performance.now() 측정

**Pattern**:
```typescript
test('메모이제이션 효과 80% 이상', () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  // 첫 번째 호출 (캐시 미스)
  const start1 = performance.now();
  const data1 = result.current.getStaffById('staff1');
  const duration1 = performance.now() - start1;

  // 두 번째 호출 (캐시 히트)
  const start2 = performance.now();
  const data2 = result.current.getStaffById('staff1');
  const duration2 = performance.now() - start2;

  // 검증: 두 번째 호출이 80% 이상 빠름
  const improvement = (duration1 - duration2) / duration1;
  expect(improvement).toBeGreaterThanOrEqual(0.8);
});
```

### 3.2 캐시 동작 검증

**Test Scenarios**:
1. **캐시 히트**: 동일한 키로 조회 시 캐시된 값 반환
2. **캐시 크기 제한**: 1000개 초과 시 오래된 항목 삭제
3. **캐시 무효화**: 데이터 업데이트 시 캐시 클리어

```typescript
test('캐시 크기 제한 (1000개)', () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  // 1001개 조회
  for (let i = 0; i < 1001; i++) {
    result.current.getStaffById(`staff${i}`);
  }

  // 첫 번째 항목은 삭제됨
  const firstItem = result.current.getStaffById('staff0');
  // 캐시에 없으므로 다시 조회 (느림)
});
```

### 3.3 메모리 사용량 측정

**Pattern**:
```typescript
test('메모리 누수 없음 (반복 mount/unmount)', () => {
  const initialMemory = process.memoryUsage().heapUsed;

  // 100번 mount/unmount
  for (let i = 0; i < 100; i++) {
    const { unmount } = renderHook(() => useUnifiedData(), { wrapper });
    unmount();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const increase = (finalMemory - initialMemory) / initialMemory;

  // 메모리 증가가 5% 이내
  expect(increase).toBeLessThan(0.05);
});
```

---

## 4. React Testing Library 베스트 프랙티스

### 4.1 act() 사용법

**Rule**: `act()`는 상태 업데이트가 있을 때 사용

```typescript
// ✅ Good: renderHook 내부에서 자동 처리
const { result } = renderHook(() => useUnifiedData(), { wrapper });
await waitFor(() => expect(result.current.loading).toBe(false));

// ✅ Good: 명시적으로 act() 사용 (상태 업데이트 함수 호출)
await act(async () => {
  await result.current.refreshData();
});

// ❌ Bad: 불필요한 act() (읽기 전용)
await act(async () => {
  const data = result.current.getStaffById('staff1'); // ❌ 상태 변경 없음
});
```

### 4.2 waitFor 최적화

**Pattern**:
```typescript
// ✅ Good: timeout 명시
await waitFor(
  () => expect(result.current.loading).toBe(false),
  { timeout: 3000, interval: 50 }
);

// ✅ Good: 여러 조건 체크
await waitFor(() => {
  expect(result.current.loading).toBe(false);
  expect(result.current.staff.size).toBeGreaterThan(0);
});

// ❌ Bad: 불필요한 waitFor (동기 데이터)
await waitFor(() => {
  expect(result.current.staff.has('staff1')).toBe(true); // ❌ 이미 로드됨
});
```

### 4.3 cleanup

**Pattern**:
```typescript
describe('UnifiedDataContext', () => {
  let unsubscribes: jest.Mock[] = [];

  beforeEach(() => {
    unsubscribes = [];
  });

  afterEach(() => {
    // Firestore 구독 cleanup 검증
    unsubscribes.forEach(unsub => {
      expect(unsub).toHaveBeenCalled();
    });
  });

  test('cleanup on unmount', () => {
    const { unmount } = renderHook(() => useUnifiedData(), { wrapper });
    unmount();

    // cleanup 검증
    expect(unsubscribes.length).toBeGreaterThan(0);
  });
});
```

---

## 5. 최종 결정 및 권장 사항

### 5.1 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| **테스트 프레임워크** | Jest 29.5.3 | 이미 설치됨, React 프로젝트 표준 |
| **React 테스트** | React Testing Library 14.0.0 | 이미 설치됨, renderHook 내장 |
| **Firestore 테스트** | Mock (Jest) | AuthContext 패턴과 일관성, 빠른 실행 |
| **IndexedDB** | fake-indexeddb 6.2.2 | 이미 설치됨, 추가 설정 불필요 |
| **성능 측정** | Performance.now() | 브라우저 표준 API, 정확한 측정 |

### 5.2 테스트 구조

```text
app2/src/contexts/__tests__/
├── UnifiedDataContext.test.tsx           # 단위 테스트 (P1)
├── UnifiedDataContext.integration.test.tsx  # 통합 테스트 (P2)
├── UnifiedDataContext.performance.test.tsx  # 성능 테스트 (P3)
└── __mocks__/
    ├── test-data.ts                      # Mock 데이터
    ├── test-firestore.ts                 # Firestore Mock
    └── test-helpers.ts                   # 테스트 헬퍼
```

### 5.3 Mock 데이터 설계

```typescript
// test-data.ts
export const mockStaff = new Map([
  ['staff1', { id: 'staff1', name: 'John Doe', role: 'manager' }],
  ['staff2', { id: 'staff2', name: 'Jane Smith', role: 'staff' }],
]);

export const mockWorkLogs = new Map([
  ['log1', { id: 'log1', staffId: 'staff1', date: '2025-11-06', hours: 8 }],
]);

export const mockApplications = new Map([
  ['app1', { id: 'app1', eventId: 'event1', applicantId: 'staff1', status: 'pending' }],
]);
```

### 5.4 테스트 커버리지 목표

| 컴포넌트 | 목표 커버리지 | 우선순위 |
|---------|---------------|----------|
| **UnifiedDataContext** | 70%+ | P1 |
| **조회 함수** (getStaffById 등) | 100% | P1 |
| **메모이제이션** | 90%+ | P2 |
| **Firestore 구독** | 80%+ | P2 |
| **에러 핸들링** | 90%+ | P2 |
| **성능 최적화** | 80%+ | P3 |

---

## 6. 다음 단계

### Phase 1: Design & Contracts

1. ✅ `data-model.md`: 5개 컬렉션의 데이터 구조 정의
2. ✅ `contracts/`: 단위/통합/성능 테스트 계약 정의
3. ✅ `quickstart.md`: 테스트 실행 및 작성 가이드
4. ✅ Agent Context 업데이트

### Phase 2: Task Generation

- `/speckit.tasks` 명령으로 `tasks.md` 생성
- 우선순위와 의존성을 고려한 작업 분해

### Phase 3: Implementation

- `/speckit.implement` 명령으로 실제 테스트 코드 작성

---

**Status**: ✅ Phase 0 완료 | **Next**: Phase 1 Design Artifacts 생성
