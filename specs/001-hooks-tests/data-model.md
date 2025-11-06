# Data Model: 테스트 데이터 구조

**Feature**: 001-hooks-tests
**Date**: 2025-11-06
**Status**: Complete

## Overview

이 문서는 핵심 Hooks 테스트에서 사용되는 Mock 데이터 구조와 테스트 데이터 모델을 정의합니다. 모든 Mock 데이터는 프로덕션 Firebase 스키마와 일치하며 TypeScript strict mode를 준수합니다.

---

## 1. Notification (알림)

### Entity Definition

```typescript
interface Notification {
  id: string;                    // Unique identifier
  userId: string;                // 알림 수신자 ID
  type: NotificationType;        // 알림 타입
  title: string;                 // 알림 제목
  message: string;               // 알림 내용
  isRead: boolean;               // 읽음 여부
  createdAt: Date;               // 생성 시간
  data?: Record<string, any>;    // 추가 메타데이터 (선택)
}

type NotificationType = 'system' | 'work' | 'schedule' | 'finance' | 'application';
```

### Validation Rules

- `id`: 필수, 비어있지 않아야 함
- `userId`: 필수, 비어있지 않아야 함
- `type`: 5가지 타입 중 하나여야 함
- `message`: 필수, 최소 1자 이상
- `isRead`: 필수, boolean
- `createdAt`: 필수, 유효한 Date 객체

### State Transitions

```
생성 (isRead: false) → 읽음 처리 (isRead: true) → 삭제
```

### Test Data Factory

```typescript
// app2/src/__tests__/mocks/testData.ts
export const createMockNotification = (overrides?: Partial<Notification>): Notification => ({
  id: `notif-${Date.now()}`,
  userId: 'test-user-1',
  type: 'work',
  title: '근무 배정 알림',
  message: '새로운 근무가 배정되었습니다.',
  isRead: false,
  createdAt: new Date('2025-11-06T10:00:00Z'),
  ...overrides,
});

// 사용 예시
const unreadNotification = createMockNotification();
const readNotification = createMockNotification({ isRead: true });
const systemNotification = createMockNotification({ type: 'system', title: '시스템 점검' });
```

---

## 2. WorkLog (근무 기록)

### Entity Definition

```typescript
interface WorkLog {
  id: string;                    // Unique identifier
  staffId: string;               // 스태프 ID
  eventId: string;               // 이벤트 ID
  date: string;                  // 근무 날짜 (YYYY-MM-DD)
  startTime: string;             // 시작 시간 (HH:MM)
  endTime: string;               // 종료 시간 (HH:MM)
  hourlyRate: number;            // 시급 (원)
  isNightShift?: boolean;        // 야간 근무 여부
  isHoliday?: boolean;           // 휴일 근무 여부
  isOvertime?: boolean;          // 연장 근무 여부
  totalPay?: number;             // 총 급여 (계산값)
  createdAt: Date;
  updatedAt: Date;
}
```

### Validation Rules

- `staffId`, `eventId`: 필수, 비어있지 않아야 함
- `date`: 필수, YYYY-MM-DD 형식
- `startTime`, `endTime`: 필수, HH:MM 형식 (24시간제)
- `endTime`은 `startTime`보다 나중이어야 함 (다음날 새벽 고려)
- `hourlyRate`: 필수, 양수 (최저시급 이상)
- `totalPay`: 자동 계산 (수정 불가)

### Calculation Logic

```typescript
// 기본 급여 계산
totalPay = workHours × hourlyRate

// 야간수당 (22:00-06:00)
if (isNightShift) {
  totalPay += nightHours × hourlyRate × 0.5
}

// 휴일수당
if (isHoliday) {
  totalPay × 1.5
}

// 연장수당 (주 40시간 초과)
if (isOvertime) {
  totalPay += overtimeHours × hourlyRate × 0.5
}
```

### Test Data Factory

```typescript
export const createMockWorkLog = (overrides?: Partial<WorkLog>): WorkLog => ({
  id: `worklog-${Date.now()}`,
  staffId: 'staff-1',
  eventId: 'event-1',
  date: '2025-11-06',
  startTime: '10:00',
  endTime: '18:00',
  hourlyRate: 15000,
  isNightShift: false,
  isHoliday: false,
  isOvertime: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 특수 케이스
const nightShiftLog = createMockWorkLog({
  startTime: '22:00',
  endTime: '06:00',
  isNightShift: true,
});

const holidayLog = createMockWorkLog({
  date: '2025-01-01', // 신정
  isHoliday: true,
});
```

---

## 3. Applicant (지원자)

### Entity Definition

```typescript
interface Applicant {
  id: string;                    // Unique identifier
  eventId: string;               // 이벤트 ID
  userId?: string;               // 사용자 ID (가입자만)
  name: string;                  // 이름
  phoneNumber: string;           // 연락처
  email?: string;                // 이메일 (선택)
  status: ApplicationStatus;     // 지원 상태
  appliedAt: Date;               // 지원 시간
  processedAt?: Date;            // 처리 시간 (승인/거부)
  processedBy?: string;          // 처리자 ID
  notes?: string;                // 관리자 메모
}

type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
```

### Validation Rules

- `eventId`, `name`, `phoneNumber`: 필수
- `status`: 4가지 상태 중 하나
- `phoneNumber`: 한국 전화번호 형식 (010-XXXX-XXXX 또는 01X-XXX-XXXX)
- `email`: 유효한 이메일 형식 (선택)
- `processedAt`, `processedBy`: status가 'approved' 또는 'rejected'일 때 필수

### State Transitions

```
pending (대기) → approved (승인) or rejected (거부)
               ↘ cancelled (취소)
```

**상태 변경 규칙**:
- `pending` → `approved` 또는 `rejected`: 관리자만 가능
- `pending` → `cancelled`: 지원자 본인만 가능
- `approved`, `rejected`, `cancelled`: 최종 상태 (변경 불가)

### Test Data Factory

```typescript
export const createMockApplicant = (overrides?: Partial<Applicant>): Applicant => ({
  id: `app-${Date.now()}`,
  eventId: 'event-1',
  name: '테스트 사용자',
  phoneNumber: '010-1234-5678',
  email: 'test@example.com',
  status: 'pending',
  appliedAt: new Date('2025-11-05T14:00:00Z'),
  ...overrides,
});

// 상태별 지원자
const pendingApplicant = createMockApplicant();
const approvedApplicant = createMockApplicant({
  status: 'approved',
  processedAt: new Date('2025-11-06T10:00:00Z'),
  processedBy: 'admin-1',
});
const rejectedApplicant = createMockApplicant({
  status: 'rejected',
  processedAt: new Date('2025-11-06T11:00:00Z'),
  processedBy: 'admin-1',
  notes: '경력 부족',
});
```

---

## 4. Firebase Mock Structures

### Firestore Snapshot Structure

```typescript
interface MockQuerySnapshot<T> {
  docs: MockDocumentSnapshot<T>[];
  size: number;
  empty: boolean;
}

interface MockDocumentSnapshot<T> {
  id: string;
  exists: () => boolean;
  data: () => T | undefined;
  ref: MockDocumentReference;
}

interface MockDocumentReference {
  id: string;
  path: string;
  collection: (name: string) => MockCollectionReference;
  update: (data: any) => Promise<void>;
  delete: () => Promise<void>;
}
```

### Factory Implementation

```typescript
// app2/src/__tests__/setup/mockFactories.ts
export const createMockSnapshot = <T>(data: T[]): MockQuerySnapshot<T> => ({
  docs: data.map((item, index) => ({
    id: (item as any).id || `doc-${index}`,
    exists: () => true,
    data: () => item,
    ref: {
      id: (item as any).id || `doc-${index}`,
      path: `collection/${(item as any).id || index}`,
      collection: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  })),
  size: data.length,
  empty: data.length === 0,
});

// 사용 예시
const notifications = [
  createMockNotification(),
  createMockNotification({ isRead: true }),
];
const snapshot = createMockSnapshot(notifications);
mockOnSnapshot.mockImplementation((callback) => {
  callback(snapshot);
  return jest.fn(); // unsubscribe
});
```

---

## 5. Test Data Sets

### Minimal Data Set (빠른 테스트용)

```typescript
export const minimalTestData = {
  notifications: [createMockNotification()],
  workLogs: [createMockWorkLog()],
  applicants: [createMockApplicant()],
};
```

### Realistic Data Set (통합 테스트용)

```typescript
export const realisticTestData = {
  notifications: [
    createMockNotification({ type: 'work', isRead: false }),
    createMockNotification({ type: 'schedule', isRead: false }),
    createMockNotification({ type: 'system', isRead: true }),
    createMockNotification({ type: 'finance', isRead: true }),
    createMockNotification({ type: 'application', isRead: false }),
  ],
  workLogs: [
    createMockWorkLog(), // 일반 근무
    createMockWorkLog({ isNightShift: true, startTime: '22:00', endTime: '06:00' }), // 야간
    createMockWorkLog({ isHoliday: true, date: '2025-01-01' }), // 휴일
    createMockWorkLog({ isOvertime: true }), // 연장
  ],
  applicants: [
    createMockApplicant({ status: 'pending' }),
    createMockApplicant({ status: 'approved', processedBy: 'admin-1' }),
    createMockApplicant({ status: 'rejected', processedBy: 'admin-1' }),
  ],
};
```

### Edge Case Data Set (경계 테스트용)

```typescript
export const edgeCaseTestData = {
  emptyNotifications: [],

  invalidWorkLog: createMockWorkLog({
    startTime: '18:00',
    endTime: '10:00', // 시작보다 이전 종료 시간
  }),

  veryLongWorkLog: createMockWorkLog({
    startTime: '00:00',
    endTime: '23:59', // 거의 24시간
  }),

  invalidApplicant: createMockApplicant({
    phoneNumber: 'invalid', // 잘못된 전화번호 형식
  }),

  bulkApplicants: Array.from({ length: 100 }, (_, i) =>
    createMockApplicant({ id: `app-${i}`, name: `지원자 ${i}` })
  ),
};
```

---

## 6. Type Safety Guidelines

### Strict Type Checking

```typescript
// ✅ 타입 안전한 Factory
export function createTypedMock<T>(defaults: T, overrides?: Partial<T>): T {
  return { ...defaults, ...overrides };
}

// ❌ any 타입 사용 금지
const badMock: any = { id: '123' }; // 금지!

// ✅ 올바른 사용
const goodMock: Notification = createMockNotification();
```

### Validation Helpers

```typescript
// app2/src/__tests__/setup/validators.ts
export const validateNotification = (notif: Notification): boolean => {
  return (
    !!notif.id &&
    !!notif.userId &&
    ['system', 'work', 'schedule', 'finance', 'application'].includes(notif.type) &&
    !!notif.message &&
    typeof notif.isRead === 'boolean' &&
    notif.createdAt instanceof Date
  );
};

export const validateWorkLog = (log: WorkLog): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  return (
    !!log.staffId &&
    !!log.eventId &&
    dateRegex.test(log.date) &&
    timeRegex.test(log.startTime) &&
    timeRegex.test(log.endTime) &&
    log.hourlyRate > 0
  );
};
```

---

## Data Model Summary

| Entity | Key Fields | Validation Rules | State Transitions |
|--------|-----------|------------------|-------------------|
| Notification | id, userId, type, message, isRead | 5가지 타입, 필수 필드 | 생성 → 읽음 → 삭제 |
| WorkLog | staffId, eventId, date, times, hourlyRate | 시간 검증, 양수 시급 | 생성 → 수정 → 삭제 |
| Applicant | id, eventId, name, phoneNumber, status | 4가지 상태, 전화번호 형식 | pending → approved/rejected/cancelled |

**All data models defined. Ready for contract generation.**
