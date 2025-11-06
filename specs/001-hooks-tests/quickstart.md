# Quickstart: 핵심 Hooks 테스트 작성

**Feature**: 001-hooks-tests
**Date**: 2025-11-06
**Status**: Ready to implement

## Overview

이 가이드는 `useNotifications`, `useScheduleData`, `useApplicantActions` 세 가지 핵심 Hook의 단위 테스트를 빠르게 시작할 수 있도록 안내합니다.

---

## Prerequisites

### 1. 환경 확인

```bash
cd app2

# Node.js 버전 확인 (18+ 필요)
node --version

# 의존성 설치 확인
npm list @testing-library/react
npm list jest

# TypeScript 설정 확인
npm run type-check
```

### 2. 필요한 패키지 (이미 설치됨)

```json
{
  "@testing-library/react": "^14.x",
  "@testing-library/jest-dom": "^6.x",
  "jest": "^29.x",
  "ts-jest": "^29.x"
}
```

---

## Step 1: 첫 번째 테스트 작성 (5분)

### 1.1 useNotifications 테스트 파일 생성

```bash
# 디렉토리 생성
mkdir -p app2/src/hooks/__tests__

# 테스트 파일 생성
touch app2/src/hooks/__tests__/useNotifications.test.ts
```

### 1.2 기본 테스트 작성

```typescript
// app2/src/hooks/__tests__/useNotifications.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import useNotifications from '../useNotifications';

describe('useNotifications', () => {
  test('초기 상태가 올바르게 설정된다', () => {
    const { result } = renderHook(() => useNotifications('user-1'));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
```

### 1.3 테스트 실행

```bash
# 단일 테스트 파일 실행
npm test -- useNotifications.test.ts

# Watch 모드로 실행 (개발 중)
npm test -- --watch useNotifications.test.ts
```

**예상 결과**:
```
PASS  src/hooks/__tests__/useNotifications.test.ts
  useNotifications
    ✓ 초기 상태가 올바르게 설정된다 (45ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

---

## Step 2: Firebase Mock 설정 (10분)

### 2.1 공통 Mock 파일 생성

```bash
mkdir -p app2/src/__tests__/mocks
touch app2/src/__tests__/mocks/firebase.ts
```

```typescript
// app2/src/__tests__/mocks/firebase.ts
import { DocumentData, QuerySnapshot } from 'firebase/firestore';

// onSnapshot Mock
export const mockOnSnapshot = jest.fn((query, callback) => {
  // 즉시 빈 데이터 반환
  const emptySnapshot = {
    docs: [],
    size: 0,
    empty: true,
  } as unknown as QuerySnapshot<DocumentData>;

  callback(emptySnapshot);

  // Unsubscribe 함수 반환
  return jest.fn();
});

// Firebase Firestore Mock
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  onSnapshot: mockOnSnapshot,
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));
```

### 2.2 setupTests.ts에 Mock 추가

```typescript
// app2/src/__tests__/setup/setupTests.ts (기존 파일)
import '@testing-library/jest-dom';
import '../mocks/firebase'; // 🆕 Firebase Mock 추가
```

---

## Step 3: Mock Factory 생성 (10분)

### 3.1 Test Data Factory 생성

```bash
touch app2/src/__tests__/mocks/testData.ts
```

```typescript
// app2/src/__tests__/mocks/testData.ts
import { Notification } from '@/types';

export const createMockNotification = (
  overrides?: Partial<Notification>
): Notification => ({
  id: `notif-${Date.now()}`,
  userId: 'test-user-1',
  type: 'work',
  title: '테스트 알림',
  message: '테스트 메시지',
  isRead: false,
  createdAt: new Date('2025-11-06T10:00:00Z'),
  ...overrides,
});
```

### 3.2 Factory 사용 예시

```typescript
// 테스트에서 사용
import { createMockNotification } from '@/__tests__/mocks/testData';

const notification = createMockNotification();
const readNotification = createMockNotification({ isRead: true });
```

---

## Step 4: 실시간 구독 테스트 (15분)

### 4.1 onSnapshot Mock 개선

```typescript
// app2/src/__tests__/mocks/firebase.ts 업데이트
let onSnapshotCallback: Function | null = null;

export const mockOnSnapshot = jest.fn((query, callback) => {
  onSnapshotCallback = callback;

  // 초기 데이터 즉시 전달
  const initialSnapshot = {
    docs: [],
    size: 0,
    empty: true,
  } as unknown as QuerySnapshot<DocumentData>;

  callback(initialSnapshot);

  return mockUnsubscribe;
});

// 테스트에서 실시간 업데이트 트리거
export const triggerFirestoreUpdate = (data: any[]) => {
  if (onSnapshotCallback) {
    const snapshot = {
      docs: data.map((item) => ({
        id: item.id,
        data: () => item,
      })),
      size: data.length,
      empty: data.length === 0,
    } as unknown as QuerySnapshot<DocumentData>;

    onSnapshotCallback(snapshot);
  }
};
```

### 4.2 실시간 업데이트 테스트

```typescript
import { act } from 'react';
import { triggerFirestoreUpdate } from '@/__tests__/mocks/firebase';

test('실시간 알림 업데이트', async () => {
  const { result } = renderHook(() => useNotifications('user-1'));

  // 새 알림 추가 시뮬레이션
  act(() => {
    triggerFirestoreUpdate([
      createMockNotification({ id: 'notif-1' }),
    ]);
  });

  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(1);
  });
});
```

---

## Step 5: 테스트 커버리지 확인 (5분)

### 5.1 커버리지 실행

```bash
# 전체 테스트 커버리지
npm run test:coverage

# 특정 파일만 커버리지
npm run test:coverage -- useNotifications.test.ts
```

### 5.2 커버리지 리포트 확인

```bash
# HTML 리포트 열기 (브라우저)
open coverage/lcov-report/index.html
```

**커버리지 목표**:
- 각 Hook: ≥ 70% (Lines, Branches, Functions, Statements)

---

## Step 6: 전체 워크플로우 (30분)

### 6.1 완전한 테스트 예시

```typescript
// app2/src/hooks/__tests__/useNotifications.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import useNotifications from '../useNotifications';
import { createMockNotification } from '@/__tests__/mocks/testData';
import { triggerFirestoreUpdate, mockOnSnapshot } from '@/__tests__/mocks/firebase';

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('초기화', () => {
    test('초기 상태가 올바르게 설정된다', () => {
      const { result } = renderHook(() => useNotifications('user-1'));

      expect(result.current.notifications).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('실시간 구독', () => {
    test('Firestore에서 알림을 받아온다', async () => {
      const { result } = renderHook(() => useNotifications('user-1'));

      act(() => {
        triggerFirestoreUpdate([
          createMockNotification({ id: 'notif-1' }),
          createMockNotification({ id: 'notif-2' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(2);
      });

      expect(result.current.loading).toBe(false);
    });

    test('언마운트 시 구독 해제', () => {
      const { unmount } = renderHook(() => useNotifications('user-1'));

      unmount();

      // mockOnSnapshot이 반환한 unsubscribe 함수 호출 확인
      // (구현에 따라 검증 방법 다름)
    });
  });

  describe('알림 필터링', () => {
    test('읽지 않은 알림만 필터링', async () => {
      const { result } = renderHook(() => useNotifications('user-1', { unreadOnly: true }));

      act(() => {
        triggerFirestoreUpdate([
          createMockNotification({ id: 'notif-1', isRead: false }),
          createMockNotification({ id: 'notif-2', isRead: true }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].id).toBe('notif-1');
      });
    });
  });

  describe('에러 처리', () => {
    test('Firestore 에러 시 에러 상태 설정', async () => {
      mockOnSnapshot.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { result } = renderHook(() => useNotifications('user-1'));

      await waitFor(() => {
        expect(result.current.error).toContain('Permission denied');
      });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });
});
```

---

## Common Commands

### 개발 중

```bash
# Watch 모드로 테스트 실행
npm test -- --watch

# 특정 파일만 Watch
npm test -- --watch useNotifications.test.ts

# 실패한 테스트만 재실행
npm test -- --onlyFailures
```

### 검증

```bash
# 모든 테스트 실행
npm run test

# 커버리지 포함
npm run test:coverage

# 타입 체크
npm run type-check

# Lint 체크
npm run lint
```

### 배포 전

```bash
# 전체 품질 게이트 실행
npm run type-check && npm run lint && npm run test && npm run build
```

---

## Troubleshooting

### 문제 1: "Cannot find module '@/__tests__/mocks/testData'"

**해결**:
```typescript
// tsconfig.json에서 paths 확인
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 문제 2: "act(...) warnings"

**해결**:
```typescript
// 상태 업데이트를 act로 감싸기
await act(async () => {
  await result.current.someAction();
});
```

### 문제 3: "waitFor timeout"

**해결**:
```typescript
// 타임아웃 늘리기
await waitFor(() => {
  expect(result.current.data).toBeDefined();
}, { timeout: 3000 }); // 기본 1초 → 3초
```

### 문제 4: "Firebase is not mocked"

**해결**:
```typescript
// setupTests.ts에 Mock import 확인
import '../mocks/firebase';

// jest.config.js에 setupFilesAfterEnv 확인
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/setupTests.ts'],
};
```

---

## Next Steps

1. **useScheduleData 테스트**: 복잡한 계산 로직 테스트
   - [data-model.md](data-model.md#2-worklog-근무-기록) 참조
   - [test-patterns.md](contracts/test-patterns.md#4-계산-로직-테스트-패턴) 참조

2. **useApplicantActions 테스트**: 상태 변경 및 일괄 작업 테스트
   - [data-model.md](data-model.md#3-applicant-지원자) 참조
   - [test-patterns.md](contracts/test-patterns.md#5-일괄-작업-테스트-패턴) 참조

3. **공통 유틸리티 확장**: Mock Factory 및 Helper 함수 추가
   - [mock-factory.md](contracts/mock-factory.md) 참조

4. **테스트 리팩토링**: 중복 제거 및 재사용성 향상

5. **CI/CD 통합**: GitHub Actions에서 자동 테스트 실행

---

## Resources

- **설계 문서**: [plan.md](plan.md)
- **Research**: [research.md](research.md)
- **Data Model**: [data-model.md](data-model.md)
- **Test Patterns**: [contracts/test-patterns.md](contracts/test-patterns.md)
- **Mock Factory**: [contracts/mock-factory.md](contracts/mock-factory.md)

**Ready to start coding!** 🚀
