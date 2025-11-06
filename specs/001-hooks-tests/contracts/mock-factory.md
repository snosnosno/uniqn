# Mock Factory Specification

**Feature**: 001-hooks-tests
**Date**: 2025-11-06
**Status**: Complete

## Overview

이 문서는 재사용 가능한 Mock 데이터 Factory의 구현 사양을 정의합니다. 모든 Factory는 타입 안전성을 보장하며 TypeScript strict mode를 준수합니다.

---

## 1. Factory 설계 원칙

### Core Principles

1. **Type Safety**: 모든 Factory 함수는 명시적 타입을 반환
2. **Flexibility**: `Partial<T>` 오버라이드로 유연한 데이터 생성
3. **Reusability**: 공통 Mock 로직을 중앙화
4. **Consistency**: 프로덕션 데이터 구조와 완벽히 일치
5. **Testability**: Factory 자체도 테스트 가능

### Standard Factory Signature

```typescript
export function createMock<T>(overrides?: Partial<T>): T {
  return {
    ...defaultValues,
    ...overrides,
  };
}
```

---

## 2. Entity Mock Factories

### 2.1 Notification Factory

**파일**: `app2/src/__tests__/mocks/testData.ts`

```typescript
import { Notification, NotificationType } from '@/types';

/**
 * 알림 Mock 데이터 생성
 * @param overrides - 덮어쓸 필드 (선택)
 * @returns Notification 객체
 */
export const createMockNotification = (
  overrides?: Partial<Notification>
): Notification => ({
  id: `notif-${Date.now()}-${Math.random()}`,
  userId: 'test-user-1',
  type: 'work',
  title: '근무 배정 알림',
  message: '새로운 근무가 배정되었습니다.',
  isRead: false,
  createdAt: new Date('2025-11-06T10:00:00Z'),
  data: {},
  ...overrides,
});

/**
 * 여러 알림 일괄 생성
 * @param count - 생성할 알림 개수
 * @param baseOverrides - 모든 알림에 공통 적용할 필드
 * @returns Notification 배열
 */
export const createMockNotifications = (
  count: number,
  baseOverrides?: Partial<Notification>
): Notification[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockNotification({
      id: `notif-${index}`,
      message: `알림 ${index + 1}`,
      ...baseOverrides,
    })
  );
};

/**
 * 타입별 알림 생성 헬퍼
 */
export const notificationFactories = {
  work: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'work',
      title: '근무 관련 알림',
      ...overrides,
    }),

  schedule: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'schedule',
      title: '일정 변경 알림',
      ...overrides,
    }),

  system: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'system',
      title: '시스템 공지',
      ...overrides,
    }),

  finance: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'finance',
      title: '급여 관련 알림',
      ...overrides,
    }),

  application: (overrides?: Partial<Notification>) =>
    createMockNotification({
      type: 'application',
      title: '지원서 관련 알림',
      ...overrides,
    }),
};
```

### 2.2 WorkLog Factory

```typescript
import { WorkLog } from '@/types';

/**
 * 근무 기록 Mock 데이터 생성
 * @param overrides - 덮어쓸 필드 (선택)
 * @returns WorkLog 객체
 */
export const createMockWorkLog = (
  overrides?: Partial<WorkLog>
): WorkLog => ({
  id: `worklog-${Date.now()}-${Math.random()}`,
  staffId: 'staff-1',
  eventId: 'event-1',
  date: '2025-11-06',
  startTime: '10:00',
  endTime: '18:00',
  hourlyRate: 15000,
  isNightShift: false,
  isHoliday: false,
  isOvertime: false,
  createdAt: new Date('2025-11-06T09:00:00Z'),
  updatedAt: new Date('2025-11-06T09:00:00Z'),
  ...overrides,
});

/**
 * 특수 근무 유형별 Factory
 */
export const workLogFactories = {
  /** 일반 주간 근무 (10:00-18:00) */
  regular: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      startTime: '10:00',
      endTime: '18:00',
      isNightShift: false,
      isHoliday: false,
      isOvertime: false,
      ...overrides,
    }),

  /** 야간 근무 (22:00-06:00) */
  nightShift: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      startTime: '22:00',
      endTime: '06:00',
      isNightShift: true,
      ...overrides,
    }),

  /** 휴일 근무 */
  holiday: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      date: '2025-01-01', // 신정
      isHoliday: true,
      ...overrides,
    }),

  /** 연장 근무 */
  overtime: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      startTime: '10:00',
      endTime: '22:00', // 12시간
      isOvertime: true,
      ...overrides,
    }),

  /** 야간 + 휴일 (최고 수당) */
  nightHoliday: (overrides?: Partial<WorkLog>) =>
    createMockWorkLog({
      date: '2025-01-01',
      startTime: '22:00',
      endTime: '06:00',
      isNightShift: true,
      isHoliday: true,
      ...overrides,
    }),
};

/**
 * 주간 근무 기록 생성 (월-금)
 */
export const createWeeklyWorkLogs = (
  staffId: string,
  weekStart: string // YYYY-MM-DD (월요일)
): WorkLog[] => {
  const addDays = (date: string, days: number): string => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  return [0, 1, 2, 3, 4].map((dayOffset) =>
    createMockWorkLog({
      staffId,
      date: addDays(weekStart, dayOffset),
      startTime: '10:00',
      endTime: '18:00',
    })
  );
};
```

### 2.3 Applicant Factory

```typescript
import { Applicant, ApplicationStatus } from '@/types';

/**
 * 지원자 Mock 데이터 생성
 * @param overrides - 덮어쓸 필드 (선택)
 * @returns Applicant 객체
 */
export const createMockApplicant = (
  overrides?: Partial<Applicant>
): Applicant => ({
  id: `app-${Date.now()}-${Math.random()}`,
  eventId: 'event-1',
  name: '테스트 사용자',
  phoneNumber: '010-1234-5678',
  email: 'test@example.com',
  status: 'pending',
  appliedAt: new Date('2025-11-05T14:00:00Z'),
  ...overrides,
});

/**
 * 상태별 지원자 Factory
 */
export const applicantFactories = {
  /** 대기 중 지원자 */
  pending: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'pending',
      ...overrides,
    }),

  /** 승인된 지원자 */
  approved: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'approved',
      processedAt: new Date('2025-11-06T10:00:00Z'),
      processedBy: 'admin-1',
      ...overrides,
    }),

  /** 거부된 지원자 */
  rejected: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'rejected',
      processedAt: new Date('2025-11-06T11:00:00Z'),
      processedBy: 'admin-1',
      notes: '경력 부족',
      ...overrides,
    }),

  /** 취소된 지원자 */
  cancelled: (overrides?: Partial<Applicant>) =>
    createMockApplicant({
      status: 'cancelled',
      processedAt: new Date('2025-11-06T12:00:00Z'),
      ...overrides,
    }),
};

/**
 * 대량 지원자 생성 (테스트용)
 */
export const createBulkApplicants = (
  count: number,
  eventId: string
): Applicant[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockApplicant({
      id: `app-${index}`,
      eventId,
      name: `지원자 ${index + 1}`,
      phoneNumber: `010-${String(index).padStart(4, '0')}-${String(
        index
      ).padStart(4, '0')}`,
      email: `applicant${index}@example.com`,
    })
  );
};
```

---

## 3. Firebase Mock Factories

### 3.1 Firestore Snapshot Factory

**파일**: `app2/src/__tests__/setup/mockFactories.ts`

```typescript
import {
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  DocumentReference,
} from 'firebase/firestore';

/**
 * Firestore QuerySnapshot Mock 생성
 * @param data - 문서 데이터 배열
 * @returns Mock QuerySnapshot
 */
export const createMockSnapshot = <T extends DocumentData>(
  data: T[]
): QuerySnapshot<T> => {
  const docs = data.map((item, index) => ({
    id: (item as any).id || `doc-${index}`,
    exists: () => true,
    data: () => item,
    ref: {
      id: (item as any).id || `doc-${index}`,
      path: `collection/${(item as any).id || index}`,
      collection: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as DocumentReference<T>,
  }));

  return {
    docs: docs as unknown as DocumentSnapshot<T>[],
    size: data.length,
    empty: data.length === 0,
    forEach: (callback: (doc: DocumentSnapshot<T>) => void) => {
      docs.forEach(callback as any);
    },
    query: {} as any,
    metadata: { fromCache: false, hasPendingWrites: false },
  } as unknown as QuerySnapshot<T>;
};

/**
 * 빈 Snapshot 생성
 */
export const createEmptySnapshot = <T extends DocumentData>(): QuerySnapshot<T> => {
  return createMockSnapshot<T>([]);
};

/**
 * 단일 문서 Snapshot 생성
 */
export const createSingleDocSnapshot = <T extends DocumentData>(
  data: T
): DocumentSnapshot<T> => {
  return {
    id: (data as any).id || 'doc-1',
    exists: () => true,
    data: () => data,
    ref: {
      id: (data as any).id || 'doc-1',
      path: `collection/${(data as any).id || 1}`,
    } as unknown as DocumentReference<T>,
  } as unknown as DocumentSnapshot<T>;
};
```

### 3.2 Firebase Functions Mock Factory

```typescript
/**
 * Firebase onSnapshot Mock 생성
 * @returns Mock onSnapshot 함수와 제어 객체
 */
export const createMockOnSnapshot = () => {
  let callback: Function | null = null;
  const unsubscribe = jest.fn();

  const mockOnSnapshot = jest.fn((query, cb) => {
    callback = cb;
    return unsubscribe;
  });

  return {
    mockOnSnapshot,
    unsubscribe,
    /**
     * 실시간 업데이트 트리거
     * @param data - 새로운 데이터
     */
    triggerUpdate: <T extends DocumentData>(data: T[]) => {
      if (callback) {
        const snapshot = createMockSnapshot(data);
        callback(snapshot);
      }
    },
    /**
     * 초기 데이터 즉시 전달
     * @param data - 초기 데이터
     */
    emitInitialData: <T extends DocumentData>(data: T[]) => {
      if (callback) {
        const snapshot = createMockSnapshot(data);
        callback(snapshot);
      }
    },
  };
};

/**
 * updateDoc Mock 생성
 */
export const createMockUpdateDoc = () => {
  const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

  return {
    mockUpdateDoc,
    /**
     * 성공 응답 설정
     */
    mockSuccess: () => {
      mockUpdateDoc.mockResolvedValue(undefined);
    },
    /**
     * 실패 응답 설정
     * @param error - 에러 메시지
     */
    mockFailure: (error: string) => {
      mockUpdateDoc.mockRejectedValue(new Error(error));
    },
    /**
     * 한 번만 실패 설정
     * @param error - 에러 메시지
     */
    mockFailureOnce: (error: string) => {
      mockUpdateDoc.mockRejectedValueOnce(new Error(error));
    },
  };
};
```

---

## 4. Common Test Data Sets

**파일**: `app2/src/__tests__/mocks/testData.ts`

```typescript
/**
 * 최소 테스트 데이터셋 (빠른 테스트용)
 */
export const minimalTestData = {
  notifications: [createMockNotification()],
  workLogs: [createMockWorkLog()],
  applicants: [createMockApplicant()],
};

/**
 * 현실적 테스트 데이터셋 (통합 테스트용)
 */
export const realisticTestData = {
  notifications: [
    notificationFactories.work(),
    notificationFactories.schedule(),
    notificationFactories.system({ isRead: true }),
    notificationFactories.finance({ isRead: true }),
    notificationFactories.application(),
  ],
  workLogs: [
    workLogFactories.regular(),
    workLogFactories.nightShift(),
    workLogFactories.holiday(),
    workLogFactories.overtime(),
  ],
  applicants: [
    applicantFactories.pending(),
    applicantFactories.approved(),
    applicantFactories.rejected(),
  ],
};

/**
 * 엣지 케이스 데이터셋
 */
export const edgeCaseTestData = {
  emptyNotifications: [],
  emptyWorkLogs: [],
  emptyApplicants: [],

  invalidWorkLog: createMockWorkLog({
    startTime: '18:00',
    endTime: '10:00', // 잘못된 시간
  }),

  bulkApplicants: createBulkApplicants(100, 'event-1'),

  veryLongWorkLog: createMockWorkLog({
    startTime: '00:00',
    endTime: '23:59', // 거의 24시간
  }),
};
```

---

## 5. Factory Usage Examples

### Example 1: 기본 사용

```typescript
// 기본값으로 생성
const notification = createMockNotification();

// 일부 필드 오버라이드
const customNotification = createMockNotification({
  userId: 'custom-user',
  isRead: true,
});
```

### Example 2: 타입별 Factory 사용

```typescript
// 타입별 Factory로 의미있는 데이터 생성
const workNotification = notificationFactories.work();
const systemNotification = notificationFactories.system({ isRead: true });

const nightShift = workLogFactories.nightShift();
const holidayShift = workLogFactories.holiday();

const pendingApplicant = applicantFactories.pending();
const approvedApplicant = applicantFactories.approved();
```

### Example 3: 대량 데이터 생성

```typescript
// 여러 알림 일괄 생성
const notifications = createMockNotifications(5, { userId: 'user-1' });

// 100명의 지원자 생성
const applicants = createBulkApplicants(100, 'event-1');

// 주간 근무 기록 생성
const weeklyLogs = createWeeklyWorkLogs('staff-1', '2025-11-04');
```

### Example 4: Firebase Mock 사용

```typescript
// onSnapshot Mock 설정
const { mockOnSnapshot, triggerUpdate, emitInitialData } = createMockOnSnapshot();

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  onSnapshot: mockOnSnapshot,
}));

// 초기 데이터 전달
emitInitialData([createMockNotification()]);

// 테스트 중 업데이트 트리거
triggerUpdate([
  createMockNotification({ id: 'notif-1' }),
  createMockNotification({ id: 'notif-2' }),
]);
```

---

## 6. Factory Testing

Factory 자체도 테스트 가능합니다:

```typescript
// app2/src/__tests__/setup/mockFactories.test.ts
describe('Mock Factories', () => {
  describe('createMockNotification', () => {
    test('기본값으로 유효한 Notification 생성', () => {
      const notification = createMockNotification();

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe('test-user-1');
      expect(notification.type).toBe('work');
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    test('오버라이드가 올바르게 적용됨', () => {
      const notification = createMockNotification({
        userId: 'custom-user',
        isRead: true,
      });

      expect(notification.userId).toBe('custom-user');
      expect(notification.isRead).toBe(true);
      // 다른 필드는 기본값 유지
      expect(notification.type).toBe('work');
    });
  });

  describe('createMockSnapshot', () => {
    test('데이터 배열로 유효한 Snapshot 생성', () => {
      const data = [createMockNotification(), createMockNotification()];
      const snapshot = createMockSnapshot(data);

      expect(snapshot.size).toBe(2);
      expect(snapshot.empty).toBe(false);
      expect(snapshot.docs).toHaveLength(2);
    });

    test('빈 배열로 빈 Snapshot 생성', () => {
      const snapshot = createMockSnapshot([]);

      expect(snapshot.size).toBe(0);
      expect(snapshot.empty).toBe(true);
    });
  });
});
```

---

## Factory Contract Summary

| Factory | Purpose | Key Features |
|---------|---------|--------------|
| `createMockNotification` | 알림 데이터 생성 | 타입별 Factory 제공 |
| `createMockWorkLog` | 근무 기록 생성 | 특수 근무 유형별 Factory |
| `createMockApplicant` | 지원자 데이터 생성 | 상태별 Factory 제공 |
| `createMockSnapshot` | Firestore Snapshot Mock | 실시간 구독 테스트 지원 |
| `createMockOnSnapshot` | onSnapshot Mock | 업데이트 트리거 제어 |

**All mock factories specified. Ready for implementation.**
