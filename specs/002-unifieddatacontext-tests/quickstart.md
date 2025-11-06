# Quickstart Guide: UnifiedDataContext 테스트

**Feature**: UnifiedDataContext 테스트 작성
**Date**: 2025-11-06

## Overview

UnifiedDataContext 테스트를 실행하고 작성하는 방법을 안내합니다. 개발자가 빠르게 테스트 환경을 구축하고 새로운 테스트를 추가할 수 있도록 돕습니다.

---

## Quick Start

### 1. 환경 설정

테스트에 필요한 패키지는 이미 설치되어 있습니다:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "firebase": "^11.9.1",
    "fake-indexeddb": "^6.2.2"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^5.17.0",
    "@types/jest": "^29.5.3"
  }
}
```

### 2. 테스트 실행

```bash
# 현재 디렉토리로 이동
cd app2

# 모든 UnifiedDataContext 테스트 실행
npm test -- UnifiedDataContext

# 특정 테스트 파일만 실행
npm test -- UnifiedDataContext.test.tsx           # 단위 테스트
npm test -- UnifiedDataContext.integration.test.tsx  # 통합 테스트
npm test -- UnifiedDataContext.performance.test.tsx  # 성능 테스트

# Watch 모드 (자동 재실행)
npm test -- UnifiedDataContext --watch

# 커버리지 확인
npm test -- UnifiedDataContext --coverage
```

### 3. 테스트 구조 확인

```text
app2/src/contexts/
├── UnifiedDataContext.tsx              # 테스트 대상
└── __tests__/
    ├── UnifiedDataContext.test.tsx           # 단위 테스트 (P1)
    ├── UnifiedDataContext.integration.test.tsx  # 통합 테스트 (P2)
    ├── UnifiedDataContext.performance.test.tsx  # 성능 테스트 (P3)
    └── __mocks__/
        ├── test-data.ts                      # Mock 데이터
        ├── test-firestore.ts                 # Firestore Mock
        └── test-helpers.ts                   # 테스트 헬퍼
```

---

## 테스트 작성 가이드

### 패턴 1: 기본 Hook 테스트

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useUnifiedData, UnifiedDataProvider } from '../UnifiedDataContext';

test('useUnifiedData Hook이 올바른 값을 반환함', async () => {
  const { result } = renderHook(() => useUnifiedData(), {
    wrapper: UnifiedDataProvider
  });

  // 로딩 완료 대기
  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 상태 검증
  expect(result.current.staff).toBeInstanceOf(Map);
  expect(result.current.getStaffById).toBeDefined();
});
```

### 패턴 2: Mock 데이터 사용

```typescript
import { mockStaff, mockWorkLogs } from './__mocks__/test-data';

beforeEach(() => {
  // Mock Firestore 데이터 설정
  mockFirestore.collection('staff').docs = Array.from(mockStaff.values());
});

test('Mock 데이터로 조회 함수 테스트', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  const staff = result.current.getStaffById('staff1');
  expect(staff?.name).toBe('John Doe');
});
```

### 패턴 3: 성능 측정

```typescript
test('메모이제이션 효과 측정', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 첫 번째 호출
  const start1 = performance.now();
  result.current.getStaffById('staff1');
  const duration1 = performance.now() - start1;

  // 두 번째 호출 (캐시 히트)
  const start2 = performance.now();
  result.current.getStaffById('staff1');
  const duration2 = performance.now() - start2;

  // 성능 개선 검증
  expect(duration2).toBeLessThan(duration1 * 0.2); // 80% 개선
});
```

### 패턴 4: 에러 핸들링 테스트

```typescript
import { mockFirestoreError } from './__mocks__/test-firestore';

test('Firestore 에러 처리', async () => {
  // Mock Firestore 에러 설정
  mockFirestore.collection.mockImplementationOnce(() => {
    throw new Error('Firestore connection failed');
  });

  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => {
    expect(result.current.error.staff).toBeDefined();
    expect(result.current.error.staff?.message).toContain('connection failed');
  });
});
```

---

## Mock 데이터 구조

### test-data.ts

```typescript
import { Staff, WorkLog, Application } from '../../../types/unifiedData';

export const mockStaff: Map<string, Staff> = new Map([
  ['staff1', {
    id: 'staff1',
    staffId: 'staff1',
    name: 'John Doe',
    role: 'dealer',
    phone: '010-1234-5678',
    email: 'john@example.com',
  }],
  ['staff2', {
    id: 'staff2',
    staffId: 'staff2',
    name: 'Jane Smith',
    role: 'manager',
    phone: '010-8765-4321',
  }],
]);

export const mockWorkLogs: Map<string, WorkLog> = new Map([
  ['log1', {
    id: 'log1',
    staffId: 'staff1',
    staffName: 'John Doe',
    eventId: 'event1',
    date: '2025-11-06',
    status: 'checked_in',
  }],
]);

export const mockApplications: Map<string, Application> = new Map([
  ['app1', {
    id: 'app1',
    eventId: 'event1',
    applicantId: 'user3',
    status: 'pending',
    role: 'dealer',
  }],
]);
```

### test-firestore.ts

```typescript
export const mockFirestore = {
  collection: jest.fn((collectionName: string) => ({
    onSnapshot: jest.fn((callback) => {
      // Mock 데이터 반환
      const mockData = {
        staff: Array.from(mockStaff.values()),
        workLogs: Array.from(mockWorkLogs.values()),
        applications: Array.from(mockApplications.values()),
      };

      callback({
        docs: mockData[collectionName] || [],
      });

      // unsubscribe 함수 반환
      return jest.fn();
    }),
  })),
};
```

---

## 커버리지 확인

### 커버리지 실행

```bash
npm test -- UnifiedDataContext --coverage
```

### 커버리지 목표

| 메트릭 | 목표 | 현재 상태 |
|--------|------|-----------|
| Line Coverage | 70% 이상 | ⏳ 구현 후 측정 |
| Branch Coverage | 60% 이상 | ⏳ 구현 후 측정 |
| Function Coverage | 80% 이상 | ⏳ 구현 후 측정 |

### 커버리지 리포트 보기

```bash
# HTML 리포트 생성
npm run test:coverage

# 브라우저에서 확인
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html # Windows
```

---

## 트러블슈팅

### 문제 1: act() warning

**증상**: `Warning: An update to X inside a test was not wrapped in act(...)`

**해결**:
```typescript
import { act } from '@testing-library/react';

await act(async () => {
  // 상태 업데이트 코드
  await result.current.refreshData();
});
```

### 문제 2: 테스트 격리 실패

**증상**: 이전 테스트가 다음 테스트에 영향을 미침

**해결**:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockStorage = {};
  // 모든 Mock 초기화
});

afterEach(() => {
  // cleanup은 자동으로 호출됨 (React Testing Library 13+)
});
```

### 문제 3: Firestore Mock 에러

**증상**: `Cannot read property 'collection' of undefined`

**해결**:
```typescript
// 파일 최상단에 배치
jest.mock('../../firebase', () => ({
  firestore: mockFirestore,
}));
```

---

## 베스트 프랙티스

### ✅ 권장 사항

1. **테스트 독립성**: 각 테스트는 독립적으로 실행 가능해야 함
2. **명확한 네이밍**: `test('기능 - 조건 - 예상 결과')` 형식 사용
3. **Mock 데이터**: `__mocks__/test-data.ts`를 활용하여 재사용
4. **waitFor 사용**: 비동기 상태 변경은 항상 waitFor로 대기
5. **cleanup 검증**: unmount 시 Firestore 구독 정리 확인

### ❌ 피해야 할 패턴

1. **불필요한 act()**: 읽기 전용 작업에는 act() 불필요
2. **Hard-coded 타임아웃**: setTimeout 대신 waitFor 사용
3. **전역 상태 공유**: 테스트 간 상태 공유 금지
4. **console.log 사용**: logger 사용 권장

---

## 다음 단계

1. ✅ **Phase 1 완료**: plan.md, research.md, data-model.md, contracts/, quickstart.md
2. ⏳ **Phase 2 진행**: `/speckit.tasks` 명령으로 tasks.md 생성
3. ⏳ **Phase 3 구현**: 실제 테스트 코드 작성

---

**Status**: ✅ Quickstart Guide 완료 | **Next**: Agent Context 업데이트
