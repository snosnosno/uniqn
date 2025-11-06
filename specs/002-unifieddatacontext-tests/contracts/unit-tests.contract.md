# Unit Tests Contract

**Feature**: UnifiedDataContext 테스트 작성
**Test Type**: 단위 테스트 (Unit Tests)
**Priority**: P1 (가장 높음)
**Date**: 2025-11-06

## Overview

UnifiedDataContext의 핵심 기능을 검증하는 단위 테스트 시나리오를 정의합니다. 각 함수와 상태 관리 로직의 정확성을 독립적으로 검증합니다.

---

## Test File

**Location**: `app2/src/contexts/__tests__/UnifiedDataContext.test.tsx`

**Dependencies**:
- React Testing Library
- renderHook
- Mock 데이터 (`__mocks__/test-data.ts`)
- Mock Firestore (`__mocks__/test-firestore.ts`)

---

## Test Scenarios

### 1. Context 초기화 (Initialization)

#### 1.1 useUnifiedData Hook 반환값 검증

**Given**: UnifiedDataProvider가 렌더링됨
**When**: useUnifiedData Hook을 호출
**Then**: 모든 Context 값이 반환되어야 함

```typescript
test('useUnifiedData Hook returns all context values', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper: UnifiedDataProvider });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 상태 검증
  expect(result.current).toHaveProperty('staff');
  expect(result.current).toHaveProperty('workLogs');
  expect(result.current).toHaveProperty('applications');
  expect(result.current).toHaveProperty('scheduleEvents');
  expect(result.current).toHaveProperty('loading');
  expect(result.current).toHaveProperty('error');

  // 조회 함수 검증
  expect(result.current).toHaveProperty('getStaffById');
  expect(result.current).toHaveProperty('getWorkLogsByStaffId');
  expect(result.current).toHaveProperty('getApplicationsByEventId');
  expect(result.current).toHaveProperty('getTodayScheduleEvents');
});
```

**Expected Result**:
- 모든 상태 필드 존재
- 모든 조회 함수 존재
- 타입 안전성 보장

#### 1.2 초기 상태 검증

**Given**: UnifiedDataProvider가 렌더링됨
**When**: 초기 상태를 확인
**Then**: 초기값이 올바르게 설정되어야 함

```typescript
test('초기 상태가 올바르게 설정됨', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper: UnifiedDataProvider });

  // Map 초기화 검증
  expect(result.current.staff).toBeInstanceOf(Map);
  expect(result.current.staff.size).toBe(0);
  expect(result.current.workLogs).toBeInstanceOf(Map);
  expect(result.current.workLogs.size).toBe(0);

  // 배열 초기화 검증
  expect(Array.isArray(result.current.scheduleEvents)).toBe(true);
  expect(result.current.scheduleEvents.length).toBe(0);

  // 로딩 상태 검증
  expect(result.current.loading.initial).toBe(true);
  expect(result.current.loading.staff).toBe(true);

  // 에러 상태 검증
  expect(result.current.error.staff).toBeNull();
  expect(result.current.error.workLogs).toBeNull();
});
```

---

### 2. 조회 함수 테스트 (Query Functions)

#### 2.1 getStaffById

**Given**: staff Map에 데이터가 로드됨
**When**: 유효한 staffId로 getStaffById를 호출
**Then**: 해당 스태프 정보를 반환해야 함

```typescript
test('getStaffById는 유효한 ID로 스태프를 반환함', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper: UnifiedDataProvider });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  const staff = result.current.getStaffById('staff1');

  expect(staff).toBeDefined();
  expect(staff?.id).toBe('staff1');
  expect(staff?.name).toBe('John Doe');
  expect(staff?.role).toBe('dealer');
});
```

**Edge Cases**:
```typescript
test('getStaffById는 존재하지 않는 ID에 대해 undefined 반환', () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });
  const staff = result.current.getStaffById('invalid-id');
  expect(staff).toBeUndefined();
});

test('getStaffById는 빈 문자열에 대해 undefined 반환', () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });
  const staff = result.current.getStaffById('');
  expect(staff).toBeUndefined();
});
```

#### 2.2 getWorkLogsByStaffId

**Given**: workLogs Map에 데이터가 로드됨
**When**: 유효한 staffId로 getWorkLogsByStaffId를 호출
**Then**: 해당 스태프의 근무 로그 배열을 반환해야 함

```typescript
test('getWorkLogsByStaffId는 해당 스태프의 근무 로그를 반환함', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  const workLogs = result.current.getWorkLogsByStaffId('staff1');

  expect(Array.isArray(workLogs)).toBe(true);
  expect(workLogs.length).toBeGreaterThan(0);
  expect(workLogs[0].staffId).toBe('staff1');
});
```

**Edge Cases**:
```typescript
test('getWorkLogsByStaffId는 데이터 없을 때 빈 배열 반환', () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });
  const workLogs = result.current.getWorkLogsByStaffId('invalid-staff');
  expect(workLogs).toEqual([]);
});
```

#### 2.3 getApplicationsByEventId

**Given**: applications Map에 데이터가 로드됨
**When**: 유효한 eventId로 getApplicationsByEventId를 호출
**Then**: 해당 이벤트의 지원서 배열을 반환해야 함

```typescript
test('getApplicationsByEventId는 해당 이벤트의 지원서를 반환함', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  const applications = result.current.getApplicationsByEventId('event1');

  expect(Array.isArray(applications)).toBe(true);
  expect(applications.length).toBeGreaterThan(0);
  expect(applications[0].eventId).toBe('event1');
});
```

#### 2.4 getTodayScheduleEvents

**Given**: scheduleEvents 배열에 데이터가 로드됨
**When**: getTodayScheduleEvents를 호출
**Then**: 오늘 날짜의 일정 배열을 반환해야 함

```typescript
test('getTodayScheduleEvents는 오늘 일정을 반환함', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const events = result.current.getTodayScheduleEvents();

  expect(Array.isArray(events)).toBe(true);
  events.forEach(event => {
    expect(event.date).toBe(today);
  });
});
```

---

### 3. 메모이제이션 테스트 (Memoization)

#### 3.1 캐시 히트 검증

**Given**: 동일한 데이터 조회가 반복됨
**When**: 두 번째 조회가 실행됨
**Then**: 캐시된 결과를 반환해야 함 (참조 동일성)

```typescript
test('메모이제이션이 동일한 조회에 대해 캐시된 결과를 반환함', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 첫 번째 호출
  const data1 = result.current.getStaffById('staff1');

  // 두 번째 호출
  const data2 = result.current.getStaffById('staff1');

  // 참조 동일성 검증 (캐시 히트)
  expect(data1).toBe(data2); // 동일한 객체 참조
});
```

#### 3.2 캐시 크기 제한 검증

**Given**: 1000개 이상의 서로 다른 키로 조회가 발생함
**When**: 캐시 크기가 1000개를 초과함
**Then**: 가장 오래된 항목이 삭제되어야 함

```typescript
test('캐시 크기 제한 (1000개)', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 1001개 조회 (캐시 채우기)
  for (let i = 0; i < 1001; i++) {
    result.current.getStaffById(`staff${i}`);
  }

  // 첫 번째 항목 재조회 (캐시 미스 예상)
  const start1 = performance.now();
  result.current.getStaffById('staff0');
  const duration1 = performance.now() - start1;

  // 마지막 항목 재조회 (캐시 히트 예상)
  const start2 = performance.now();
  result.current.getStaffById('staff1000');
  const duration2 = performance.now() - start2;

  // 마지막 항목이 더 빨라야 함 (캐시 히트)
  expect(duration2).toBeLessThan(duration1);
});
```

---

### 4. 상태 업데이트 테스트 (State Updates)

#### 4.1 데이터 로드 시 상태 업데이트

**Given**: Firestore에서 데이터가 로드됨
**When**: onSnapshot 콜백이 호출됨
**Then**: 상태가 업데이트되어야 함

```typescript
test('데이터 로드 시 staff Map이 업데이트됨', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // staff 데이터 검증
  expect(result.current.staff.size).toBeGreaterThan(0);
  expect(result.current.staff.has('staff1')).toBe(true);
});
```

#### 4.2 로딩 상태 전이

**Given**: 초기 로딩 상태임
**When**: 데이터 로드가 완료됨
**Then**: 로딩 상태가 false로 변경되어야 함

```typescript
test('로딩 상태가 올바르게 전이됨', async () => {
  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  // 초기 로딩 상태
  expect(result.current.loading.initial).toBe(true);

  // 데이터 로드 대기
  await waitFor(() => expect(result.current.loading.initial).toBe(false));

  // 개별 컬렉션 로딩 상태
  expect(result.current.loading.staff).toBe(false);
  expect(result.current.loading.workLogs).toBe(false);
});
```

---

### 5. 에러 핸들링 테스트 (Error Handling)

#### 5.1 Firestore 에러 처리

**Given**: Firestore 구독 중 에러 발생
**When**: onSnapshot 에러 콜백이 호출됨
**Then**: 에러 상태가 설정되고 로딩이 중지되어야 함

```typescript
test('Firestore 에러 발생 시 에러 상태가 설정됨', async () => {
  // Mock Firestore 에러
  mockFirestore.collection.mockImplementationOnce(() => ({
    onSnapshot: (success: any, error: any) => {
      error(new Error('Firestore connection failed'));
      return jest.fn();
    },
  }));

  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => {
    expect(result.current.error.staff).toBeDefined();
    expect(result.current.error.staff?.message).toBe('Firestore connection failed');
  });

  // 로딩 상태 종료
  expect(result.current.loading.staff).toBe(false);
});
```

#### 5.2 권한 에러 처리

**Given**: 권한이 없는 컬렉션에 접근
**When**: Firestore가 permission-denied 에러 반환
**Then**: 적절한 에러 메시지가 설정되어야 함

```typescript
test('권한 에러 발생 시 적절한 에러 메시지 표시', async () => {
  mockFirestore.collection.mockImplementationOnce(() => ({
    onSnapshot: (success: any, error: any) => {
      error({ code: 'permission-denied', message: 'Insufficient permissions' });
      return jest.fn();
    },
  }));

  const { result } = renderHook(() => useUnifiedData(), { wrapper });

  await waitFor(() => {
    expect(result.current.error.staff).toBeDefined();
    expect(result.current.error.staff?.message).toContain('Insufficient permissions');
  });
});
```

---

## Success Criteria

### Coverage Goals
- **Line Coverage**: 70% 이상
- **Branch Coverage**: 60% 이상
- **Function Coverage**: 80% 이상

### Test Execution
- 모든 테스트 통과 (0 failures)
- 실행 시간 5초 이내
- act() warning 없음

### Quality Gates
- ✅ 모든 조회 함수 테스트 (100%)
- ✅ 메모이제이션 동작 검증
- ✅ 상태 전이 시나리오 커버
- ✅ 에러 핸들링 검증
- ✅ 타입 안전성 보장

---

## Test Execution

```bash
# 단위 테스트만 실행
npm test -- UnifiedDataContext.test.tsx

# watch 모드
npm test -- UnifiedDataContext.test.tsx --watch

# 커버리지 포함
npm test -- UnifiedDataContext.test.tsx --coverage
```

---

**Status**: ✅ Contract Defined | **Next**: Integration Tests Contract
