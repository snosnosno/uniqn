# Data Model: UnifiedDataContext

**Feature**: UnifiedDataContext 테스트 작성
**Date**: 2025-11-06
**Status**: ✅ Completed

## Overview

UnifiedDataContext가 관리하는 5개 Firebase 컬렉션의 데이터 구조와 상태 관리 모델을 정의합니다. 이 문서는 테스트에서 사용할 Mock 데이터와 타입 정의의 기준이 됩니다.

---

## 1. State Structure

### 1.1 UnifiedDataState

```typescript
interface UnifiedDataState {
  // Map 기반 데이터 저장 (O(1) 조회 성능)
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  attendanceRecords: Map<string, AttendanceRecord>;
  applications: Map<string, Application>;
  scheduleEvents: ScheduleEvent[]; // 배열 (정렬 필요)

  // 로딩 상태 (각 컬렉션별 독립 관리)
  loading: {
    initial: boolean;        // 초기 로딩
    staff: boolean;
    workLogs: boolean;
    applications: boolean;
    scheduleEvents: boolean;
    jobPostings: boolean;
  };

  // 에러 상태 (각 컬렉션별 독립 관리)
  error: {
    staff: Error | null;
    workLogs: Error | null;
    applications: Error | null;
    scheduleEvents: Error | null;
    jobPostings: Error | null;
  };

  // 성능 메트릭
  performanceMetrics: PerformanceMetrics;
}
```

### 1.2 초기 상태

```typescript
export const initialUnifiedDataState: UnifiedDataState = {
  staff: new Map(),
  workLogs: new Map(),
  attendanceRecords: new Map(),
  applications: new Map(),
  scheduleEvents: [],

  loading: {
    initial: true,
    staff: true,
    workLogs: true,
    applications: true,
    scheduleEvents: true,
    jobPostings: true,
  },

  error: {
    staff: null,
    workLogs: null,
    applications: null,
    scheduleEvents: null,
    jobPostings: null,
  },

  performanceMetrics: {
    lastUpdateTime: Date.now(),
    subscriptionCount: 0,
    cacheHitRate: 0,
  },
};
```

---

## 2. Entity Models

### 2.1 Staff

**Description**: 스태프 정보 (확정된 인력)

**Key Fields**:
```typescript
interface Staff {
  id: string;              // Firestore 문서 ID
  staffId: string;         // 비즈니스 ID
  name: string;            // 필수
  role: string;            // 필수 (예: "dealer", "manager")
  phone?: string;
  email?: string;

  // 지원자 확정 정보
  assignedRole?: string;   // 확정된 역할
  assignedTime?: string;   // 확정된 시간 (예: "09:00~18:00")
  assignedDate?: string;   // 확정된 날짜 (예: "2025-01-06")

  // 연결 정보
  userId?: string;         // users 컬렉션 연결
  postingId?: string;      // 원래 지원한 공고 ID

  // 개인정보 (users에서 캐시)
  gender?: string;
  age?: number;
  experience?: string;
  nationality?: string;
  region?: string;

  // 은행 정보
  bankName?: string;
  bankAccount?: string;
  residentId?: string;

  // 메타데이터
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

**Validation Rules**:
- `id`, `staffId`, `name`, `role`: 필수
- `phone` 또는 `email` 중 최소 1개 필요
- `assignedDate`: ISO 8601 형식 (YYYY-MM-DD)

**Test Mock**:
```typescript
export const mockStaff: Map<string, Staff> = new Map([
  ['staff1', {
    id: 'staff1',
    staffId: 'staff1',
    name: 'John Doe',
    role: 'dealer',
    phone: '010-1234-5678',
    email: 'john@example.com',
    assignedRole: 'dealer',
    assignedTime: '09:00~18:00',
    assignedDate: '2025-11-06',
    userId: 'user1',
  }],
  ['staff2', {
    id: 'staff2',
    staffId: 'staff2',
    name: 'Jane Smith',
    role: 'manager',
    phone: '010-8765-4321',
    assignedRole: 'manager',
    assignedTime: '08:00~17:00',
    assignedDate: '2025-11-06',
    userId: 'user2',
  }],
]);
```

### 2.2 WorkLog

**Description**: 근무 로그 (출근/퇴근 기록)

**Key Fields**:
```typescript
interface WorkLog {
  id: string;
  staffId: string;         // 필수
  staffName: string;       // 호환성 유지
  eventId: string;         // 필수

  // 스태프 정보 (persons 컬렉션 통합)
  staffInfo: {
    userId: string;
    name: string;
    email?: string;
    phone?: string;
    userRole?: string;
    jobRole?: string[];
    isActive?: boolean;
    bankName?: string;
    accountNumber?: string;
    gender?: string;
    age?: number;
    experience?: string;
    nationality?: string;
    region?: string;
  };

  // 할당 정보
  assignmentInfo: {
    role: string;
    assignedRole?: string;
    assignedTime?: string;
    assignedDate?: string;
    postingId: string;
    managerId?: string;
    type?: 'staff' | 'applicant' | 'both';
  };

  // 근무 시간
  date: string;            // 필수 (YYYY-MM-DD)
  scheduledStartTime?: Timestamp;
  scheduledEndTime?: Timestamp;
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;

  // 근무 통계
  hoursWorked?: number;
  overtimeHours?: number;
  earlyLeaveHours?: number;

  // 상태 및 메타
  status?: 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'absent';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;

  // 스냅샷 데이터 (공고 삭제 대비)
  snapshotData?: {
    title?: string;
    salary: {
      type: 'hourly' | 'daily' | 'monthly' | 'other';
      amount: number;
    };
    location: string;
    contactPhone?: string;
    createdBy: string;
    snapshotAt: Timestamp;
  };
}
```

**Validation Rules**:
- `id`, `staffId`, `eventId`, `date`: 필수
- `date`: ISO 8601 형식
- `status`: 정의된 enum 값만 허용

**Test Mock**:
```typescript
export const mockWorkLogs: Map<string, WorkLog> = new Map([
  ['log1', {
    id: 'log1',
    staffId: 'staff1',
    staffName: 'John Doe',
    eventId: 'event1',
    date: '2025-11-06',
    staffInfo: {
      userId: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
    },
    assignmentInfo: {
      role: 'dealer',
      postingId: 'posting1',
    },
    status: 'checked_in',
    hoursWorked: 8,
  }],
]);
```

### 2.3 AttendanceRecord

**Description**: 출석 기록 (체크인/체크아웃)

**Key Fields**:
```typescript
interface AttendanceRecord {
  id: string;
  staffId: string;         // 필수
  workLogId?: string;
  eventId: string;         // 필수
  status: 'not_started' | 'checked_in' | 'checked_out';
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

**Test Mock**:
```typescript
export const mockAttendanceRecords: Map<string, AttendanceRecord> = new Map([
  ['att1', {
    id: 'att1',
    staffId: 'staff1',
    workLogId: 'log1',
    eventId: 'event1',
    status: 'checked_in',
    checkInTime: Timestamp.now(),
  }],
]);
```

### 2.4 Application

**Description**: 지원서 (아직 확정되지 않은 지원자)

**Key Fields**:
```typescript
interface Application {
  id: string;
  eventId: string;         // 필수
  applicantId: string;     // 필수
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  role?: string;
  appliedDate?: Timestamp;
  reviewedDate?: Timestamp;
  reviewedBy?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

**Test Mock**:
```typescript
export const mockApplications: Map<string, Application> = new Map([
  ['app1', {
    id: 'app1',
    eventId: 'event1',
    applicantId: 'user3',
    status: 'pending',
    role: 'dealer',
    appliedDate: Timestamp.now(),
  }],
  ['app2', {
    id: 'app2',
    eventId: 'event1',
    applicantId: 'user4',
    status: 'approved',
    role: 'manager',
  }],
]);
```

### 2.5 ScheduleEvent

**Description**: 일정 이벤트 (토너먼트, 행사 등)

**Key Fields**:
```typescript
interface ScheduleEvent {
  id: string;
  title: string;           // 필수
  date: string;            // 필수 (YYYY-MM-DD)
  startTime?: string;      // HH:mm
  endTime?: string;        // HH:mm
  location?: string;
  description?: string;
  type?: 'tournament' | 'training' | 'meeting' | 'other';
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

**Test Mock**:
```typescript
export const mockScheduleEvents: ScheduleEvent[] = [
  {
    id: 'event1',
    title: '월례 토너먼트',
    date: '2025-11-06',
    startTime: '09:00',
    endTime: '18:00',
    location: '강남 홀덤펍',
    type: 'tournament',
    status: 'scheduled',
  },
  {
    id: 'event2',
    title: '딜러 트레이닝',
    date: '2025-11-07',
    startTime: '10:00',
    endTime: '12:00',
    location: '교육장',
    type: 'training',
    status: 'scheduled',
  },
];
```

---

## 3. Reducer Actions

### 3.1 Action Types

```typescript
type UnifiedDataAction =
  | { type: 'SET_LOADING'; collection: string; loading: boolean }
  | { type: 'SET_ERROR'; collection: string; error: Error | null }
  | { type: 'SET_STAFF'; staff: Map<string, Staff> }
  | { type: 'SET_WORK_LOGS'; workLogs: Map<string, WorkLog> }
  | { type: 'SET_ATTENDANCE_RECORDS'; records: Map<string, AttendanceRecord> }
  | { type: 'SET_APPLICATIONS'; applications: Map<string, Application> }
  | { type: 'SET_SCHEDULE_EVENTS'; events: ScheduleEvent[] }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; metrics: Partial<PerformanceMetrics> };
```

### 3.2 State Transitions

**초기 상태 → 로딩 중**:
- `SET_LOADING` action 발생
- `loading.initial = true`, `loading.[collection] = true`

**로딩 중 → 데이터 로드 완료**:
- `SET_[COLLECTION]` action 발생
- Map 또는 배열에 데이터 저장
- `SET_LOADING` action으로 `loading.[collection] = false`
- 핵심 컬렉션(staff, workLogs, applications, jobPostings) 모두 로드 완료 시 `loading.initial = false`

**데이터 로드 완료 → 에러 발생**:
- `SET_ERROR` action 발생
- `error.[collection] = Error 객체`
- `SET_LOADING` action으로 `loading.[collection] = false`

**에러 발생 → 재시도**:
- `SET_LOADING` action으로 `loading.[collection] = true`
- `SET_ERROR` action으로 `error.[collection] = null`

---

## 4. Performance Metrics

### 4.1 PerformanceMetrics

```typescript
interface PerformanceMetrics {
  lastUpdateTime: number;       // 마지막 업데이트 시간 (ms)
  subscriptionCount: number;    // 활성 구독 수
  cacheHitRate: number;         // 캐시 히트율 (0-1)
  averageQueryTime?: number;    // 평균 쿼리 시간 (ms)
}
```

### 4.2 Test Scenarios

```typescript
// 초기 메트릭
const initialMetrics: PerformanceMetrics = {
  lastUpdateTime: Date.now(),
  subscriptionCount: 0,
  cacheHitRate: 0,
};

// 구독 활성화 후
const activeMetrics: PerformanceMetrics = {
  lastUpdateTime: Date.now(),
  subscriptionCount: 5, // 5개 컬렉션 구독
  cacheHitRate: 0,
};

// 캐시 활용 후
const cachedMetrics: PerformanceMetrics = {
  lastUpdateTime: Date.now(),
  subscriptionCount: 5,
  cacheHitRate: 0.85, // 85% 캐시 히트율
  averageQueryTime: 2.5, // 평균 2.5ms
};
```

---

## 5. Query Functions (조회 API)

### 5.1 Staff Queries

```typescript
// ID로 스태프 조회
getStaffById(staffId: string): Staff | undefined

// 역할로 스태프 목록 조회
getStaffByRole(role: string): Staff[]

// 모든 스태프 목록 조회
getAllStaff(): Staff[]
```

### 5.2 WorkLog Queries

```typescript
// 스태프 ID로 근무 로그 조회
getWorkLogsByStaffId(staffId: string): WorkLog[]

// 이벤트 ID로 근무 로그 조회
getWorkLogsByEventId(eventId: string): WorkLog[]

// 날짜로 근무 로그 조회
getWorkLogsByDate(date: string): WorkLog[]
```

### 5.3 Application Queries

```typescript
// 이벤트 ID로 지원서 조회
getApplicationsByEventId(eventId: string): Application[]

// 지원자 ID로 지원서 조회
getApplicationsByApplicantId(applicantId: string): Application[]

// 상태로 지원서 조회
getApplicationsByStatus(status: Application['status']): Application[]
```

### 5.4 ScheduleEvent Queries

```typescript
// 오늘 일정 조회
getTodayScheduleEvents(): ScheduleEvent[]

// 날짜로 일정 조회
getScheduleEventsByDate(date: string): ScheduleEvent[]

// 날짜 범위로 일정 조회
getScheduleEventsByDateRange(startDate: string, endDate: string): ScheduleEvent[]
```

---

## 6. Test Data Relationships

### 6.1 관계 다이어그램

```
┌──────────────┐
│ ScheduleEvent│
│  (event1)    │
└───────┬──────┘
        │
        ├─────────┬─────────┬─────────┐
        │         │         │         │
    ┌───▼───┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────┐
    │ Staff │ │WorkLog│ │ Attend│ │ Applic│
    │(staff1)│ │ (log1)│ │ (att1)│ │ (app1)│
    └────┬──┘ └───────┘ └───────┘ └───┬───┘
         │                             │
         └─────────┬───────────────────┘
                   │
              ┌────▼────┐
              │  User   │
              │ (user1) │
              └─────────┘
```

### 6.2 Test Data Set (Full)

```typescript
// 완전한 테스트 데이터 세트
export const fullTestDataSet = {
  staff: new Map([
    ['staff1', { id: 'staff1', name: 'John Doe', role: 'dealer', userId: 'user1' }],
    ['staff2', { id: 'staff2', name: 'Jane Smith', role: 'manager', userId: 'user2' }],
  ]),

  workLogs: new Map([
    ['log1', {
      id: 'log1',
      staffId: 'staff1',
      eventId: 'event1',
      date: '2025-11-06',
      status: 'checked_in',
    }],
  ]),

  attendanceRecords: new Map([
    ['att1', {
      id: 'att1',
      staffId: 'staff1',
      workLogId: 'log1',
      eventId: 'event1',
      status: 'checked_in',
    }],
  ]),

  applications: new Map([
    ['app1', {
      id: 'app1',
      eventId: 'event1',
      applicantId: 'user3',
      status: 'pending',
    }],
  ]),

  scheduleEvents: [
    {
      id: 'event1',
      title: '월례 토너먼트',
      date: '2025-11-06',
      type: 'tournament',
    },
  ],
};
```

---

## 7. Validation & Constraints

### 7.1 데이터 무결성 규칙

1. **참조 무결성**:
   - `WorkLog.staffId`는 `Staff.id`를 참조해야 함
   - `AttendanceRecord.workLogId`는 `WorkLog.id`를 참조해야 함
   - `Application.eventId`는 `ScheduleEvent.id`를 참조해야 함

2. **상태 전이 규칙**:
   - `AttendanceRecord.status`: `not_started` → `checked_in` → `checked_out`
   - `Application.status`: `pending` → `approved` | `rejected` | `withdrawn`

3. **타임스탬프 규칙**:
   - `checkOutTime` >= `checkInTime`
   - `actualEndTime` >= `actualStartTime`

### 7.2 테스트 검증 포인트

- **데이터 타입 검증**: TypeScript strict mode 준수
- **필수 필드 검증**: 필수 필드 누락 시 에러
- **날짜 형식 검증**: ISO 8601 형식 (YYYY-MM-DD)
- **상태 값 검증**: 정의된 enum 값만 허용
- **참조 무결성 검증**: 외래 키 관계 확인

---

## 8. Next Steps

1. ✅ `contracts/`: 테스트 계약 정의
2. ✅ `quickstart.md`: 테스트 실행 가이드
3. ⏳ `tasks.md`: 작업 분해 및 우선순위 설정

---

**Status**: ✅ Phase 1 Data Model 완료 | **Next**: Test Contracts 작성
