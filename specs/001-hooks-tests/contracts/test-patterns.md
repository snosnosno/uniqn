# Test Patterns: 핵심 Hooks 테스트 패턴

**Feature**: 001-hooks-tests
**Date**: 2025-11-06
**Status**: Complete

## Overview

이 문서는 `useNotifications`, `useScheduleData`, `useApplicantActions` 테스트 작성 시 사용할 표준 패턴과 베스트 프랙티스를 정의합니다.

---

## 1. 기본 Hook 테스트 구조

### Standard Template

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';

describe('useHookName', () => {
  // Setup: 각 테스트 전 실행
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Cleanup: 각 테스트 후 실행
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('초기화', () => {
    test('초기 상태가 올바르게 설정된다', () => {
      const { result } = renderHook(() => useHookName());

      expect(result.current.data).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('핵심 기능', () => {
    // 기능별 테스트 케이스
  });

  describe('에러 처리', () => {
    // 에러 시나리오 테스트
  });

  describe('엣지 케이스', () => {
    // 경계값 및 특수 상황 테스트
  });
});
```

---

## 2. 비동기 상태 업데이트 패턴

### Pattern 1: waitFor를 사용한 상태 대기

```typescript
test('비동기 데이터 로드', async () => {
  const { result } = renderHook(() => useNotifications('user-1'));

  // 초기 로딩 상태 확인
  expect(result.current.loading).toBe(true);

  // 데이터 로드 완료 대기
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  }, { timeout: 2000 });

  // 최종 상태 검증
  expect(result.current.notifications).toHaveLength(1);
  expect(result.current.error).toBeNull();
});
```

### Pattern 2: act를 사용한 상태 변경

```typescript
test('알림 읽음 처리', async () => {
  const { result } = renderHook(() => useNotifications('user-1'));

  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(1);
  });

  // 상태 변경 액션은 act로 감싸기
  await act(async () => {
    await result.current.markAsRead('notif-1');
  });

  // 업데이트된 상태 검증
  await waitFor(() => {
    expect(result.current.notifications[0].isRead).toBe(true);
  });
});
```

### Pattern 3: 여러 비동기 작업 순차 처리

```typescript
test('여러 작업 순차 실행', async () => {
  const { result } = renderHook(() => useApplicantActions());

  await waitFor(() => {
    expect(result.current.applicants).toHaveLength(3);
  });

  // 첫 번째 작업
  await act(async () => {
    await result.current.approveApplicant('app-1');
  });

  await waitFor(() => {
    expect(result.current.applicants[0].status).toBe('approved');
  });

  // 두 번째 작업
  await act(async () => {
    await result.current.rejectApplicant('app-2');
  });

  await waitFor(() => {
    expect(result.current.applicants[1].status).toBe('rejected');
  });
});
```

---

## 3. Firebase Mock 패턴

### Pattern 1: onSnapshot 실시간 구독

```typescript
// 테스트 파일 상단에 Mock 설정
let onSnapshotCallback: Function | null = null;
const mockUnsubscribe = jest.fn();

mockOnSnapshot.mockImplementation((query, callback) => {
  onSnapshotCallback = callback;

  // 초기 데이터 즉시 전달
  const initialSnapshot = createMockSnapshot([
    createMockNotification(),
  ]);
  callback(initialSnapshot);

  return mockUnsubscribe;
});

// 테스트에서 실시간 업데이트 시뮬레이션
test('실시간 알림 업데이트', async () => {
  const { result } = renderHook(() => useNotifications('user-1'));

  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(1);
  });

  // 새 알림 추가 시뮬레이션
  act(() => {
    const newSnapshot = createMockSnapshot([
      createMockNotification({ id: 'notif-1' }),
      createMockNotification({ id: 'notif-2' }),
    ]);
    onSnapshotCallback?.(newSnapshot);
  });

  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(2);
  });
});

// Cleanup 검증
test('언마운트 시 구독 해제', () => {
  const { unmount } = renderHook(() => useNotifications('user-1'));

  unmount();

  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
```

### Pattern 2: updateDoc/deleteDoc 작업

```typescript
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
}));

test('문서 업데이트', async () => {
  const { result } = renderHook(() => useApplicantActions());

  await act(async () => {
    await result.current.approveApplicant('app-1');
  });

  // Firebase 함수 호출 검증
  expect(mockUpdateDoc).toHaveBeenCalledWith(
    expect.any(Object), // DocumentReference
    expect.objectContaining({
      status: 'approved',
      processedAt: expect.any(Object),
    })
  );
});
```

### Pattern 3: 에러 시뮬레이션

```typescript
test('Firebase 업데이트 실패 처리', async () => {
  // 이번 호출만 실패하도록 설정
  mockUpdateDoc.mockRejectedValueOnce(new Error('Permission denied'));

  const { result } = renderHook(() => useApplicantActions());

  await act(async () => {
    await result.current.approveApplicant('app-1');
  });

  // 에러 상태 확인
  await waitFor(() => {
    expect(result.current.error).toContain('Permission denied');
  });

  // UI 상태 롤백 확인
  expect(result.current.applicants[0].status).toBe('pending');
});
```

---

## 4. 계산 로직 테스트 패턴

### Pattern 1: 급여 계산 검증

```typescript
describe('급여 계산', () => {
  test('기본 급여 계산', async () => {
    const workLog = createMockWorkLog({
      startTime: '10:00',
      endTime: '18:00',
      hourlyRate: 15000,
    });

    const { result } = renderHook(() => useScheduleData([workLog]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 8시간 × 15,000원 = 120,000원
    expect(result.current.totalPay).toBe(120000);
  });

  test('야간수당 계산 (22:00-06:00)', async () => {
    const nightLog = createMockWorkLog({
      startTime: '22:00',
      endTime: '06:00', // 다음날
      hourlyRate: 15000,
      isNightShift: true,
    });

    const { result } = renderHook(() => useScheduleData([nightLog]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 8시간 기본급 + 야간수당 (50%)
    // 120,000 + (120,000 × 0.5) = 180,000원
    expect(result.current.totalPay).toBe(180000);
  });

  test('휴일수당 계산 (1.5배)', async () => {
    const holidayLog = createMockWorkLog({
      date: '2025-01-01', // 신정
      startTime: '10:00',
      endTime: '18:00',
      hourlyRate: 15000,
      isHoliday: true,
    });

    const { result } = renderHook(() => useScheduleData([holidayLog]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 120,000 × 1.5 = 180,000원
    expect(result.current.totalPay).toBe(180000);
  });
});
```

### Pattern 2: 캐싱 동작 검증

```typescript
test('동일 입력에 대해 캐시된 값 반환', async () => {
  const workLogs = [createMockWorkLog()];

  const { result, rerender } = renderHook(
    ({ logs }) => useScheduleData(logs),
    { initialProps: { logs: workLogs } }
  );

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  const firstResult = result.current.totalPay;

  // 동일한 데이터로 리렌더
  rerender({ logs: workLogs });

  // 재계산 없이 동일한 값 반환
  expect(result.current.totalPay).toBe(firstResult);
  expect(result.current.totalPay).toBe(120000);
});
```

---

## 5. 일괄 작업 테스트 패턴

### Pattern 1: Promise.all 병렬 처리

```typescript
test('여러 지원자 일괄 승인', async () => {
  const { result } = renderHook(() => useApplicantActions());

  await waitFor(() => {
    expect(result.current.applicants).toHaveLength(3);
  });

  const applicantIds = ['app-1', 'app-2', 'app-3'];

  await act(async () => {
    await result.current.approveMultiple(applicantIds);
  });

  await waitFor(() => {
    const allApproved = result.current.applicants.every(
      (app) => app.status === 'approved'
    );
    expect(allApproved).toBe(true);
  });

  // Firebase 호출 횟수 검증
  expect(mockUpdateDoc).toHaveBeenCalledTimes(3);
});
```

### Pattern 2: 부분 실패 처리

```typescript
test('일부 업데이트 실패 시 성공한 것만 반영', async () => {
  // 두 번째 호출만 실패하도록 설정
  mockUpdateDoc
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce(undefined);

  const { result } = renderHook(() => useApplicantActions());

  const applicantIds = ['app-1', 'app-2', 'app-3'];

  await act(async () => {
    await result.current.approveMultiple(applicantIds);
  });

  await waitFor(() => {
    // app-1, app-3는 승인, app-2는 pending 유지
    expect(result.current.applicants[0].status).toBe('approved');
    expect(result.current.applicants[1].status).toBe('pending');
    expect(result.current.applicants[2].status).toBe('approved');
  });

  // 에러 메시지 확인
  expect(result.current.error).toContain('1개 항목 처리 실패');
});
```

---

## 6. 에러 처리 테스트 패턴

### Pattern 1: 네트워크 에러

```typescript
test('네트워크 에러 처리', async () => {
  mockOnSnapshot.mockImplementation(() => {
    throw new Error('Network error');
  });

  const { result } = renderHook(() => useNotifications('user-1'));

  await waitFor(() => {
    expect(result.current.error).toContain('Network error');
  });

  // 데이터는 빈 배열
  expect(result.current.notifications).toEqual([]);
  expect(result.current.loading).toBe(false);
});
```

### Pattern 2: 권한 에러

```typescript
test('권한 부족 에러 처리', async () => {
  mockUpdateDoc.mockRejectedValue(
    new Error('PERMISSION_DENIED: Missing or insufficient permissions')
  );

  const { result } = renderHook(() => useApplicantActions());

  await act(async () => {
    await result.current.approveApplicant('app-1');
  });

  await waitFor(() => {
    expect(result.current.error).toContain('권한이 없습니다');
  });
});
```

### Pattern 3: 유효성 검증 에러

```typescript
test('잘못된 입력 데이터 에러', async () => {
  const invalidLog = createMockWorkLog({
    startTime: '18:00',
    endTime: '10:00', // 시작보다 이전
  });

  const { result } = renderHook(() => useScheduleData([invalidLog]));

  await waitFor(() => {
    expect(result.current.error).toContain('종료 시간이 시작 시간보다 빠릅니다');
  });

  expect(result.current.totalPay).toBe(0);
});
```

---

## 7. 메모리 누수 방지 패턴

### Pattern 1: Cleanup 검증

```typescript
test('언마운트 시 리스너 정리', () => {
  const { unmount } = renderHook(() => useNotifications('user-1'));

  // 구독 시작 확인
  expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

  unmount();

  // 구독 해제 함수 호출 확인
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
```

### Pattern 2: 여러 번 마운트/언마운트

```typescript
test('여러 번 마운트/언마운트해도 메모리 누수 없음', () => {
  for (let i = 0; i < 5; i++) {
    const { unmount } = renderHook(() => useNotifications('user-1'));
    unmount();
  }

  // 구독/해제 횟수 일치
  expect(mockOnSnapshot).toHaveBeenCalledTimes(5);
  expect(mockUnsubscribe).toHaveBeenCalledTimes(5);
});
```

---

## 8. 성능 테스트 패턴

### Pattern 1: 실행 시간 측정

```typescript
test('대량 데이터 처리 성능', async () => {
  const manyApplicants = Array.from({ length: 100 }, (_, i) =>
    createMockApplicant({ id: `app-${i}` })
  );

  const startTime = performance.now();

  const { result } = renderHook(() =>
    useApplicantActions(manyApplicants)
  );

  await waitFor(() => {
    expect(result.current.applicants).toHaveLength(100);
  });

  const endTime = performance.now();
  const duration = endTime - startTime;

  // 100개 처리에 1초 이내
  expect(duration).toBeLessThan(1000);
}, 5000); // 테스트 타임아웃 5초
```

### Pattern 2: 재렌더링 최소화 검증

```typescript
test('불필요한 재렌더링 방지', async () => {
  let renderCount = 0;

  const { rerender } = renderHook(() => {
    renderCount++;
    return useScheduleData([createMockWorkLog()]);
  });

  await waitFor(() => {
    expect(renderCount).toBeGreaterThan(0);
  });

  const initialRenderCount = renderCount;

  // 동일한 Props로 리렌더
  rerender();

  // 재렌더링 횟수가 증가하지 않음
  expect(renderCount).toBe(initialRenderCount);
});
```

---

## Test Pattern Summary

| 패턴 | 사용 시기 | 핵심 도구 |
|------|----------|-----------|
| 비동기 상태 대기 | 데이터 로드, 상태 업데이트 | waitFor, act |
| Firebase Mock | 실시간 구독, CRUD 작업 | jest.mock, mockImplementation |
| 계산 로직 검증 | 급여, 수당 계산 | 정확한 결과 값 비교 |
| 일괄 작업 | 여러 항목 동시 처리 | Promise.all, forEach |
| 에러 처리 | 네트워크, 권한, 검증 에러 | mockRejectedValue, try-catch |
| 메모리 누수 방지 | Hook 언마운트 | unmount, unsubscribe 검증 |
| 성능 측정 | 대량 데이터, 느린 작업 | performance.now() |

**All test patterns defined. Ready for implementation.**
