# Performance Tests Contract

**Feature**: UnifiedDataContext 테스트 작성
**Test Type**: 성능 테스트 (Performance Tests)
**Priority**: P3
**Date**: 2025-11-06

## Overview

UnifiedDataContext의 메모이제이션 효과, 데이터 처리 성능, 메모리 관리를 검증하는 성능 테스트 시나리오입니다.

---

## Test File

**Location**: `app2/src/contexts/__tests__/UnifiedDataContext.performance.test.tsx`

---

## Key Test Scenarios

### 1. 메모이제이션 효과 측정

```typescript
test('메모이제이션으로 80% 이상 성능 개선', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });
  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 첫 번째 조회 (캐시 미스)
  const start1 = performance.now();
  for (let i = 0; i < 1000; i++) {
    result.current.getStaffById('staff1');
  }
  const duration1 = performance.now() - start1;

  // 두 번째 조회 (캐시 히트)
  const start2 = performance.now();
  for (let i = 0; i < 1000; i++) {
    result.current.getStaffById('staff1');
  }
  const duration2 = performance.now() - start2;

  // 80% 이상 개선 검증
  const improvement = (duration1 - duration2) / duration1;
  expect(improvement).toBeGreaterThanOrEqual(0.8);
});
```

### 2. 대량 데이터 처리 성능

```typescript
test('1000개 데이터 처리 시간 100ms 이내', async () => {
  // 1000개 Mock 데이터 생성
  const largeDataSet = new Map();
  for (let i = 0; i < 1000; i++) {
    largeDataSet.set(`staff${i}`, { id: `staff${i}`, name: `Staff ${i}` });
  }

  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  const start = performance.now();
  act(() => {
    // 데이터 변환 로직 실행
    result.current.setStaff(largeDataSet);
  });
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100); // 100ms 이내
});
```

### 3. 메모리 누수 검증

```typescript
test('반복 mount/unmount 시 메모리 누수 없음', async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  // 100번 mount/unmount
  for (let i = 0; i < 100; i++) {
    const { unmount } = renderHook(() => useUnifiedData(), { wrapper });
    await waitFor(() => expect(result.current.loading.initial).toBe(false));
    unmount();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const increase = (finalMemory - initialMemory) / initialMemory;

  // 메모리 증가 5% 이내
  expect(increase).toBeLessThan(0.05);
});
```

### 4. 메모리 사용량 제한

```typescript
test('5개 컬렉션 구독 시 메모리 사용량 50MB 이내', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  expect(memoryUsage).toBeLessThan(50);
});
```

### 5. 리렌더링 최소화

```typescript
test('데이터 조회 시 불필요한 리렌더링 없음', async () => {
  let renderCount = 0;

  const TestComponent = () => {
    const { getStaffById } = useUnifiedData();
    renderCount++;

    // 동일한 데이터 조회 (메모이제이션 적용)
    getStaffById('staff1');
    getStaffById('staff1');

    return null;
  };

  render(
    <UnifiedDataProvider>
      <TestComponent />
    </UnifiedDataProvider>
  );

  await waitFor(() => expect(renderCount).toBe(1)); // 1번만 렌더링
});
```

---

## Performance Benchmarks

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 메모이제이션 효과 | 80% 이상 | performance.now() 비교 |
| 1000개 데이터 처리 | 100ms 이내 | performance.now() 측정 |
| 메모리 누수 | ±5% 이내 | process.memoryUsage() |
| 구독 메모리 사용량 | 50MB 이내 | process.memoryUsage() |
| 불필요한 리렌더링 | 0회 | React DevTools Profiler |

---

## Success Criteria

- ✅ 모든 성능 벤치마크 통과
- ✅ 메모리 누수 없음
- ✅ 실행 시간 2초 이내
- 실제 프로덕션 환경 성능과 ±10% 오차 범위

---

**Status**: ✅ Contract Defined | **Next**: Quickstart Guide 작성
