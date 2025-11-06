# Integration Tests Contract

**Feature**: UnifiedDataContext 테스트 작성
**Test Type**: 통합 테스트 (Integration Tests)
**Priority**: P2
**Date**: 2025-11-06

## Overview

UnifiedDataContext와 Firestore 간의 실시간 데이터 동기화 및 역할별 권한 필터링을 검증하는 통합 테스트 시나리오입니다.

---

## Test File

**Location**: `app2/src/contexts/__tests__/UnifiedDataContext.integration.test.tsx`

---

## Key Test Scenarios

### 1. Firestore 실시간 구독

```typescript
test('5개 컬렉션의 onSnapshot 구독이 활성화됨', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => {
    expect(mockOnSnapshot).toHaveBeenCalledTimes(5); // staff, workLogs, applications, scheduleEvents, jobPostings
  });
});
```

### 2. 역할별 쿼리 필터링

```typescript
// Admin: 모든 데이터 접근
test('admin 역할은 모든 스태프 데이터에 접근 가능', async () => {
  mockAuth.currentUser = { uid: 'admin1', role: 'admin' };

  const { result } = renderHook(() => useUnifiedData(), { wrapper });
  await waitFor(() => expect(result.current.staff.size).toBe(10)); // 전체 데이터
});

// Staff: 본인 데이터만 접근
test('staff 역할은 본인 데이터만 조회 가능', async () => {
  mockAuth.currentUser = { uid: 'user1', role: 'staff' };

  const { result } = renderHook(() => useUnifiedData(), { wrapper });
  await waitFor(() => {
    expect(result.current.staff.size).toBe(1);
    expect(result.current.staff.has('user1')).toBe(true);
  });
});
```

### 3. 실시간 데이터 업데이트

```typescript
test('Firestore 데이터 변경 시 실시간 업데이트', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // Firestore에 새 데이터 추가 시뮬레이션
  act(() => {
    mockFirestoreCallback({ docs: [{ id: 'staff3', data: () => ({ name: 'New Staff' }) }] });
  });

  await waitFor(() => {
    expect(result.current.staff.has('staff3')).toBe(true);
  });
});
```

### 4. Cleanup (Unsubscribe)

```typescript
test('unmount 시 모든 Firestore 구독이 정리됨', async () => {
  const unsubscribes = [];

  mockFirestore.onSnapshot = jest.fn((callback) => {
    const unsub = jest.fn();
    unsubscribes.push(unsub);
    return unsub;
  });

  const { unmount } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(unsubscribes.length).toBe(5));

  unmount();

  // 모든 unsubscribe 호출 확인
  unsubscribes.forEach(unsub => {
    expect(unsub).toHaveBeenCalled();
  });
});
```

---

## Success Criteria

- ✅ 5개 컬렉션 동시 구독 검증
- ✅ admin vs staff 역할별 필터링 정확성
- ✅ 실시간 데이터 동기화 (< 100ms)
- ✅ cleanup 100% 검증
- 실행 시간 3초 이내

---

**Status**: ✅ Contract Defined | **Next**: Performance Tests Contract
