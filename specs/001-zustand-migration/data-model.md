# Data Model: Zustand Store Migration

**Project**: UNIQN (T-HOLDEM)
**Feature**: UnifiedDataContext → Zustand Store 전면 교체
**Version**: 1.0.0
**Created**: 2025-11-14

## 개요

이 문서는 Zustand Store로 마이그레이션되는 모든 엔티티의 데이터 모델을 정의합니다. 기존 UnifiedDataContext에서 관리하던 5개 핵심 컬렉션(Staff, WorkLog, Application, AttendanceRecord, JobPosting)과 Zustand Store 자체의 구조를 포함합니다.

## 엔티티 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                      UnifiedDataStore (Zustand)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  State:                                                          │
│  ├─ staff: Map<string, Staff>                                   │
│  ├─ workLogs: Map<string, WorkLog>                              │
│  ├─ applications: Map<string, Application>                      │
│  ├─ attendanceRecords: Map<string, AttendanceRecord>            │
│  ├─ jobPostings: Map<string, JobPosting>                        │
│  ├─ isLoading: boolean                                          │
│  └─ error: string | null                                        │
│                                                                  │
│  Actions:                                                        │
│  ├─ subscribeAll(userId, role)                                  │
│  ├─ unsubscribeAll()                                            │
│  ├─ setStaff(staff: Map<string, Staff>)                        │
│  ├─ updateStaff(staff: Staff)                                   │
│  ├─ deleteStaff(id: string)                                     │
│  └─ ... (각 컬렉션별 CRUD actions)                              │
│                                                                  │
│  Selectors:                                                      │
│  ├─ getStaffById(id: string)                                    │
│  ├─ getWorkLogsByStaffId(staffId: string)                       │
│  ├─ getApplicationsByPostId(postId: string)                     │
│  └─ ... (각 컬렉션별 selectors)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐
    │ Staff  │   │ WorkLog  │   │ Application  │   │JobPosting│
    └────────┘   └──────────┘   └──────────────┘   └──────────┘
         │              │              │              │
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌─────────────────────────────────────────────────────┐
    │           AttendanceRecord                           │
    └─────────────────────────────────────────────────────┘
```

## 관계 다이어그램

```
Staff (staffId)
  │
  ├─1:N─> WorkLog (staffId)
  │         │
  │         └─1:1─> AttendanceRecord (staffId, workLogId)
  │
  └─1:N─> Application (applicantId)

JobPosting (id)
  │
  ├─1:N─> Application (eventId, postId)
  │
  └─1:N─> WorkLog (eventId)
```

---

## 1. UnifiedDataStore (Zustand Store)

Zustand를 사용한 전역 상태 저장소. 5개 컬렉션과 로딩/에러 상태를 관리합니다.

### TypeScript 인터페이스

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

interface UnifiedDataStore {
  // ========== State ==========
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  applications: Map<string, Application>;
  attendanceRecords: Map<string, AttendanceRecord>;
  jobPostings: Map<string, JobPosting>;
  isLoading: boolean;
  error: string | null;

  // ========== Selectors ==========
  getStaffById: (id: string) => Staff | undefined;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
  getWorkLogsByEventId: (eventId: string) => WorkLog[];
  getApplicationsByPostId: (postId: string) => Application[];
  getAttendanceByStaffId: (staffId: string) => AttendanceRecord[];

  // ========== Actions ==========
  // Firebase 구독 관리
  subscribeAll: (userId: string, role: string) => void;
  unsubscribeAll: () => void;

  // Staff CRUD
  setStaff: (staff: Map<string, Staff>) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;

  // WorkLog CRUD
  setWorkLogs: (workLogs: Map<string, WorkLog>) => void;
  updateWorkLog: (workLog: WorkLog) => void;
  deleteWorkLog: (id: string) => void;

  // Application CRUD
  setApplications: (applications: Map<string, Application>) => void;
  updateApplication: (application: Application) => void;
  deleteApplication: (id: string) => void;

  // AttendanceRecord CRUD
  setAttendanceRecords: (records: Map<string, AttendanceRecord>) => void;
  updateAttendanceRecord: (record: AttendanceRecord) => void;
  deleteAttendanceRecord: (id: string) => void;

  // JobPosting CRUD
  setJobPostings: (postings: Map<string, JobPosting>) => void;
  updateJobPosting: (posting: JobPosting) => void;
  deleteJobPosting: (id: string) => void;

  // 로딩/에러 상태 관리
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `staff` | `Map<string, Staff>` | ✅ | 스태프 컬렉션, staffId가 키 |
| `workLogs` | `Map<string, WorkLog>` | ✅ | 근무 기록 컬렉션, workLogId가 키 |
| `applications` | `Map<string, Application>` | ✅ | 지원서 컬렉션, applicationId가 키 |
| `attendanceRecords` | `Map<string, AttendanceRecord>` | ✅ | 출석 기록 컬렉션, recordId가 키 |
| `jobPostings` | `Map<string, JobPosting>` | ✅ | 구인공고 컬렉션, postingId가 키 |
| `isLoading` | `boolean` | ✅ | 전역 로딩 상태 |
| `error` | `string \| null` | ✅ | 전역 에러 메시지 |

### 상태 전이 (State Transitions)

```
초기 상태 (초기화)
  │
  ├─> subscribeAll(userId, role)
  │     │
  │     ├─> isLoading = true
  │     ├─> Firebase onSnapshot 구독 시작
  │     └─> 데이터 수신 시:
  │           ├─> staff.set(staffId, staffData)
  │           ├─> workLogs.set(workLogId, workLogData)
  │           ├─> applications.set(applicationId, applicationData)
  │           ├─> attendanceRecords.set(recordId, recordData)
  │           ├─> jobPostings.set(postingId, postingData)
  │           └─> isLoading = false
  │
  ├─> updateStaff(staff)
  │     └─> staff.set(staff.id, staff)  (immer로 불변성 보장)
  │
  ├─> deleteStaff(id)
  │     └─> staff.delete(id)
  │
  └─> unsubscribeAll()
        └─> 모든 Firebase 구독 해제 (cleanup)
```

### Validation Rules

1. **Map 키 규칙**: 각 컬렉션의 키는 문서의 `id` 필드와 일치해야 함
2. **불변성**: immer 미들웨어를 통해 자동 불변성 보장
3. **구독 관리**: subscribeAll 호출 시 기존 구독은 자동으로 해제됨
4. **에러 처리**: Firebase 에러 발생 시 `error` 상태에 메시지 저장

### 사용 예시

```typescript
// 컴포넌트에서 사용
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { shallow } from 'zustand/shallow';

// 단일 값 조회
const staff = useUnifiedDataStore((state) => state.staff);

// 여러 값 조회 (shallow 비교로 리렌더링 최적화)
const { staff, workLogs, getStaffById } = useUnifiedDataStore(
  (state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
    getStaffById: state.getStaffById,
  }),
  shallow
);

// Actions 호출
const updateStaff = useUnifiedDataStore((state) => state.updateStaff);
updateStaff({ id: 'staff-123', name: '김딜러', ... });
```

---

## 2. Staff

스태프(직원) 정보를 담는 엔티티. `users` 컬렉션과 연결되어 사용자 인증 정보와 함께 관리됩니다.

### TypeScript 인터페이스

```typescript
export interface Staff {
  // 기본 식별자
  id: string;              // Firestore 문서 ID
  staffId: string;         // 스태프 고유 ID (id와 동일, 표준 필드)

  // 기본 정보
  name: string;            // 이름
  role: string;            // 역할 (dealer, manager, chiprunner 등)
  phone?: string;          // 전화번호
  email?: string;          // 이메일

  // 지원자 확정 시 배정 정보
  assignedRole?: string;   // 지원자에서 확정된 역할
  assignedTime?: string;   // 지원자에서 확정된 시간 (예: "09:00~18:00")
  assignedDate?: string;   // 지원자에서 확정된 날짜 (예: "2025-01-06")

  // users 컬렉션 연결
  userId?: string;         // users 컬렉션과 연결하는 사용자 ID (Firebase Auth UID)

  // 원래 지원 정보
  postingId?: string;      // 원래 지원한 공고 ID (사전질문 조회용)

  // 추가 개인정보 (users에서 조회한 캐시)
  gender?: string;         // 성별 (male/female/other)
  age?: number;            // 나이
  experience?: string;     // 경력 (예: "2년")
  nationality?: string;    // 국적 (KR/US/JP 등)
  region?: string;         // 지역 (seoul/gyeonggi 등)
  history?: string;        // 이력
  notes?: string;          // 기타 메모

  // 은행 정보 (users에서 조회한 캐시)
  bankName?: string;       // 은행명
  bankAccount?: string;    // 계좌번호
  residentId?: string;     // 주민등록번호 뒷자리

  // 메타데이터
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `id` | `string` | ✅ | Firestore 문서 ID | `"staff-abc123"` |
| `staffId` | `string` | ✅ | 스태프 고유 ID (표준 필드) | `"staff-abc123"` |
| `name` | `string` | ✅ | 스태프 이름 | `"김딜러"` |
| `role` | `string` | ✅ | 역할 | `"dealer"` |
| `phone` | `string` | ❌ | 전화번호 | `"010-1234-5678"` |
| `email` | `string` | ❌ | 이메일 | `"dealer@example.com"` |
| `userId` | `string` | ❌ | Firebase Auth UID | `"user-xyz789"` |
| `assignedRole` | `string` | ❌ | 확정된 역할 | `"dealer"` |
| `assignedTime` | `string` | ❌ | 확정된 시간 | `"09:00~18:00"` |
| `assignedDate` | `string` | ❌ | 확정된 날짜 | `"2025-01-06"` |
| `postingId` | `string` | ❌ | 지원한 공고 ID | `"posting-123"` |
| `gender` | `string` | ❌ | 성별 | `"male"` |
| `age` | `number` | ❌ | 나이 | `28` |
| `bankName` | `string` | ❌ | 은행명 | `"신한은행"` |
| `bankAccount` | `string` | ❌ | 계좌번호 | `"110-123-456789"` |

### 관계

- **1:N → WorkLog**: 한 스태프는 여러 근무 기록을 가질 수 있음 (`staffId` 외래키)
- **1:N → Application**: 한 스태프는 여러 지원서를 제출할 수 있음 (`applicantId` 외래키)
- **1:1 → User**: `userId`를 통해 `users` 컬렉션과 연결 (인증 정보)

### Validation Rules

```typescript
// 필수 필드 검증
const validateStaff = (staff: Staff): boolean => {
  if (!staff.id || !staff.staffId || !staff.name || !staff.role) {
    return false;
  }

  // staffId와 id는 동일해야 함
  if (staff.staffId !== staff.id) {
    return false;
  }

  // role은 허용된 값만 가능
  const allowedRoles = ['dealer', 'manager', 'chiprunner', 'admin'];
  if (!allowedRoles.includes(staff.role)) {
    return false;
  }

  return true;
};
```

---

## 3. WorkLog

근무 기록을 담는 엔티티. 스태프의 실제 근무 시간, 예정 시간, 급여 정보 등을 포함합니다.

### TypeScript 인터페이스

```typescript
export interface WorkLog {
  // 기본 식별자
  id: string;                  // Firestore 문서 ID
  staffId: string;             // 스태프 ID (표준 필드)
  staffName: string;           // 스태프 이름 (호환성)
  eventId: string;             // 이벤트/공고 ID (표준 필드)
  date: string;                // 근무 날짜 (YYYY-MM-DD)

  // persons 컬렉션 통합 - 스태프 정보
  staffInfo: {
    userId: string;            // 실제 사용자 ID (Firebase Auth UID)
    name: string;              // 사용자 이름
    email?: string;            // 이메일
    phone?: string;            // 전화번호
    userRole?: string;         // 사용자 권한 (staff, manager, admin)
    jobRole?: string[];        // 직무 역할들 (['dealer', 'manager'])
    isActive?: boolean;        // 활성 상태
    // 은행 정보
    bankName?: string;
    accountNumber?: string;
    // 추가 개인정보
    gender?: string;
    age?: number;
    experience?: string;
    nationality?: string;
    region?: string;
  };

  // 할당 정보 (persons 컬렉션의 할당 관련 정보)
  assignmentInfo: {
    role: string;              // 할당된 역할
    assignedRole?: string;     // 지원자에서 확정된 역할
    assignedTime?: string;     // 지원자에서 확정된 시간
    assignedDate?: string;     // 지원자에서 확정된 날짜
    postingId: string;         // 구인공고 ID
    managerId?: string;        // 관리자 ID
    type?: 'staff' | 'applicant' | 'both';
  };

  // 근무 시간 정보
  scheduledStartTime?: Timestamp;   // 예정 시작 시간
  scheduledEndTime?: Timestamp;     // 예정 종료 시간
  actualStartTime?: Timestamp;      // 실제 시작 시간
  actualEndTime?: Timestamp;        // 실제 종료 시간

  // 호환성 필드
  role?: string;               // assignmentInfo.role과 동일
  assignedTime?: string;       // UI에서 사용하는 시간 표시 필드

  // 근무 통계
  hoursWorked?: number;        // 실제 근무 시간
  overtimeHours?: number;      // 초과 근무 시간
  earlyLeaveHours?: number;    // 조퇴 시간

  // 상태 및 메타데이터
  status?: 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'absent';
  notes?: string;              // 비고
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;          // 생성자 ID

  // 스냅샷 데이터 (공고 삭제 대비)
  snapshotData?: {
    title?: string;
    salary: {
      type: 'hourly' | 'daily' | 'monthly' | 'other';
      amount: number;
      useRoleSalary?: boolean;
      roleSalaries?: Record<string, { type: string; amount: number }>;
    };
    allowances?: {
      meal?: number;
      transportation?: number;
      accommodation?: number;
    };
    taxSettings?: {
      enabled: boolean;
      taxRate?: number;
      taxAmount?: number;
    };
    location: string;
    detailedAddress?: string;
    district?: string;
    contactPhone?: string;
    createdBy: string;
    snapshotAt: Timestamp;
    snapshotReason?: 'confirmed' | 'worklog_created' | 'posting_deleted';
  };
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | ✅ | Firestore 문서 ID |
| `staffId` | `string` | ✅ | 스태프 ID (외래키) |
| `eventId` | `string` | ✅ | 이벤트/공고 ID (외래키) |
| `date` | `string` | ✅ | 근무 날짜 (YYYY-MM-DD) |
| `staffInfo` | `object` | ✅ | 스태프 상세 정보 |
| `assignmentInfo` | `object` | ✅ | 할당 정보 |
| `scheduledStartTime` | `Timestamp` | ❌ | 예정 시작 시간 |
| `scheduledEndTime` | `Timestamp` | ❌ | 예정 종료 시간 |
| `actualStartTime` | `Timestamp` | ❌ | 실제 시작 시간 |
| `actualEndTime` | `Timestamp` | ❌ | 실제 종료 시간 |
| `status` | `string` | ❌ | 근무 상태 |
| `snapshotData` | `object` | ❌ | 급여/공고 스냅샷 |

### 관계

- **N:1 → Staff**: 여러 근무 기록은 하나의 스태프에 속함 (`staffId` 외래키)
- **N:1 → JobPosting**: 여러 근무 기록은 하나의 공고에 속함 (`eventId` 외래키)
- **1:1 → AttendanceRecord**: 하나의 근무 기록은 하나의 출석 기록을 가짐 (`workLogId` 외래키)

### Validation Rules

```typescript
const validateWorkLog = (workLog: WorkLog): boolean => {
  // 필수 필드 검증
  if (!workLog.id || !workLog.staffId || !workLog.eventId || !workLog.date) {
    return false;
  }

  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(workLog.date)) {
    return false;
  }

  // staffInfo와 assignmentInfo는 필수
  if (!workLog.staffInfo || !workLog.assignmentInfo) {
    return false;
  }

  // 상태 값 검증
  const validStatuses = ['not_started', 'checked_in', 'checked_out', 'completed', 'absent'];
  if (workLog.status && !validStatuses.includes(workLog.status)) {
    return false;
  }

  return true;
};
```

### 상태 전이 (State Transitions)

```
not_started → checked_in → checked_out → completed
     │                          │
     └──────────────────────────┴─> absent (출근하지 않은 경우)
```

---

## 4. Application

지원서를 담는 엔티티. 사용자가 구인공고에 지원한 정보를 포함합니다.

### TypeScript 인터페이스

```typescript
export interface Application {
  // 기본 정보
  id: string;                    // Firestore 문서 ID
  applicantId: string;           // 지원자 ID (users 컬렉션의 userId)
  applicantName: string;         // 지원자 이름
  applicantEmail?: string;       // 지원자 이메일
  applicantPhone?: string;       // 지원자 전화번호

  // 구인공고 정보
  eventId: string;               // 표준 필드 (CLAUDE.md 준수)
  postId: string;                // 하위 호환성 (eventId와 동일)
  postTitle: string;             // 공고 제목

  // 상태 관리
  status: 'applied' | 'confirmed' | 'cancelled';

  // 핵심 배정 정보 (Single Source of Truth)
  assignments: Assignment[];

  // 히스토리 관리
  originalApplication?: {
    assignments: Assignment[];
    appliedAt: Timestamp;
  };
  confirmationHistory?: ApplicationHistoryEntry[];

  // 추가 정보
  preQuestionAnswers?: PreQuestionAnswer[];
  notes?: string;

  // 구인공고 정보 (MyApplicationsTab에서 사용)
  jobPosting?: {
    id: string;
    title: string;
    location: string;
    district?: string;
    detailedAddress?: string;
    eventDate?: string;
    [key: string]: any;
  };

  // 메타데이터
  appliedAt: Timestamp;
  confirmedAt?: Timestamp;
  cancelledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastModified?: Timestamp;
}

// Assignment 하위 구조
export interface Assignment {
  role?: string;                 // 개별 선택 시 사용
  roles?: string[];              // 그룹 선택 시 다중 역할
  timeSlot: string;
  dates: string[];               // 항상 배열 형태
  isGrouped: boolean;            // 연속된 날짜 그룹 여부
  groupId?: string;              // 그룹 식별자
  checkMethod?: 'group' | 'individual';
  requirementId?: string;        // 날짜 중복 모집 구분용
  duration?: {
    type: 'single' | 'consecutive' | 'multi';
    startDate: string;
    endDate?: string;
  };
}

// 사전 질문 답변
export interface PreQuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
  required: boolean;
}

// 히스토리 엔트리
export interface ApplicationHistoryEntry {
  confirmedAt: Timestamp;
  cancelledAt?: Timestamp;
  assignments: Assignment[];
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | ✅ | Firestore 문서 ID |
| `applicantId` | `string` | ✅ | 지원자 ID (외래키) |
| `eventId` | `string` | ✅ | 구인공고 ID (외래키, 표준 필드) |
| `postId` | `string` | ✅ | 구인공고 ID (하위 호환성) |
| `status` | `string` | ✅ | 지원 상태 |
| `assignments` | `Assignment[]` | ✅ | 배정 정보 배열 |
| `originalApplication` | `object` | ❌ | 최초 지원 정보 |
| `confirmationHistory` | `ApplicationHistoryEntry[]` | ❌ | 확정/취소 이력 |
| `preQuestionAnswers` | `PreQuestionAnswer[]` | ❌ | 사전질문 답변 |

### 관계

- **N:1 → User**: 여러 지원서는 하나의 사용자에 속함 (`applicantId` 외래키)
- **N:1 → JobPosting**: 여러 지원서는 하나의 공고에 속함 (`eventId` 외래키)

### Validation Rules

```typescript
const validateApplication = (application: Application): boolean => {
  // 필수 필드 검증
  if (!application.id || !application.applicantId || !application.eventId || !application.status) {
    return false;
  }

  // status 값 검증
  const validStatuses = ['applied', 'confirmed', 'cancelled'];
  if (!validStatuses.includes(application.status)) {
    return false;
  }

  // assignments는 필수이며 최소 1개 이상
  if (!Array.isArray(application.assignments) || application.assignments.length === 0) {
    return false;
  }

  // 각 assignment 검증
  for (const assignment of application.assignments) {
    if (!assignment.timeSlot || !Array.isArray(assignment.dates) || assignment.dates.length === 0) {
      return false;
    }

    // role 또는 roles 중 하나는 있어야 함
    if (!assignment.role && (!assignment.roles || assignment.roles.length === 0)) {
      return false;
    }
  }

  return true;
};
```

### 상태 전이 (State Transitions)

```
applied → confirmed
   │         │
   │         └─> cancelled (확정 후 취소)
   │
   └─> cancelled (지원 직후 취소)
```

---

## 5. AttendanceRecord

출석 기록을 담는 엔티티. 스태프의 실제 출퇴근 시간을 기록합니다.

### TypeScript 인터페이스

```typescript
export interface AttendanceRecord {
  // 기본 식별자
  id: string;                  // Firestore 문서 ID
  staffId: string;             // 스태프 ID (표준 필드, 외래키)
  workLogId?: string;          // WorkLog ID (외래키)
  eventId: string;             // 이벤트/공고 ID (외래키)

  // 출석 상태
  status: 'not_started' | 'checked_in' | 'checked_out';

  // 출퇴근 시간
  checkInTime?: Timestamp;     // 출근 시간
  checkOutTime?: Timestamp;    // 퇴근 시간

  // 메타데이터
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | ✅ | Firestore 문서 ID |
| `staffId` | `string` | ✅ | 스태프 ID (외래키) |
| `eventId` | `string` | ✅ | 이벤트/공고 ID (외래키) |
| `status` | `string` | ✅ | 출석 상태 |
| `workLogId` | `string` | ❌ | WorkLog ID (외래키) |
| `checkInTime` | `Timestamp` | ❌ | 출근 시간 |
| `checkOutTime` | `Timestamp` | ❌ | 퇴근 시간 |

### 관계

- **N:1 → Staff**: 여러 출석 기록은 하나의 스태프에 속함 (`staffId` 외래키)
- **1:1 → WorkLog**: 하나의 출석 기록은 하나의 근무 기록에 속함 (`workLogId` 외래키)

### Validation Rules

```typescript
const validateAttendanceRecord = (record: AttendanceRecord): boolean => {
  // 필수 필드 검증
  if (!record.id || !record.staffId || !record.eventId || !record.status) {
    return false;
  }

  // status 값 검증
  const validStatuses = ['not_started', 'checked_in', 'checked_out'];
  if (!validStatuses.includes(record.status)) {
    return false;
  }

  // checkInTime이 있으면 status는 checked_in 이상이어야 함
  if (record.checkInTime && record.status === 'not_started') {
    return false;
  }

  // checkOutTime이 있으면 checkInTime도 있어야 함
  if (record.checkOutTime && !record.checkInTime) {
    return false;
  }

  // checkOutTime이 있으면 status는 checked_out이어야 함
  if (record.checkOutTime && record.status !== 'checked_out') {
    return false;
  }

  return true;
};
```

### 상태 전이 (State Transitions)

```
not_started → checked_in → checked_out
     │             │
     └─────────────┴─> (이전 상태로 돌아갈 수 없음, 단방향)
```

---

## 6. JobPosting

구인공고를 담는 엔티티. 토너먼트, 이벤트 등의 인력 모집 정보를 포함합니다.

### TypeScript 인터페이스

```typescript
export interface JobPosting {
  // 기본 정보
  id: string;                    // Firestore 문서 ID
  title: string;                 // 공고 제목
  type?: 'application' | 'fixed';
  description: string;           // 공고 설명

  // 장소 정보
  location: string;              // 위치
  district?: string;             // 시/군/구
  detailedAddress?: string;      // 상세 주소
  contactPhone?: string;         // 문의 연락처

  // 모집 요구사항 (날짜별)
  dateSpecificRequirements: DateSpecificRequirement[];

  // 역할 정보
  requiredRoles?: string[];      // 필요한 역할 목록

  // 상태 관리
  status: 'open' | 'closed';
  statusChangeReason?: string;   // 상태 변경 사유
  statusChangedAt?: Timestamp;   // 상태 변경 시간
  statusChangedBy?: string;      // 상태 변경자

  // 지원자 정보
  applicants?: string[];         // 지원자 ID 목록
  confirmedStaff?: ConfirmedStaff[];  // 확정된 스태프 목록

  // 공고 타입
  recruitmentType?: 'application' | 'fixed';
  postingType: 'regular' | 'fixed' | 'tournament' | 'urgent';

  // 사전질문
  preQuestions?: PreQuestion[];

  // 급여 정보
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;
  useRoleSalary?: boolean;       // 역할별 급여 사용 여부
  roleSalaries?: {
    [role: string]: {
      salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
      salaryAmount: string;
      customRoleName?: string;
    }
  };

  // 복리후생
  benefits?: {
    mealAllowance?: number;
    transportation?: number;
    accommodation?: number;
  };

  // 세금 설정
  taxSettings?: {
    enabled: boolean;
    taxRate?: number;
    taxAmount?: number;
  };

  // 자동 관리
  autoManageStatus?: boolean;    // 자동 상태 관리 활성화

  // 타입별 설정
  fixedConfig?: FixedConfig;
  tournamentConfig?: TournamentConfig;
  urgentConfig?: UrgentConfig;

  // 칩 관리
  chipCost?: number;             // 칩 비용
  isChipDeducted: boolean;       // 칩 차감 여부

  // 메타데이터
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;             // 생성자 ID
}

// 하위 구조
export interface DateSpecificRequirement {
  date: string;                  // YYYY-MM-DD
  roles: string[];
  timeSlots: string[];
}

export interface PreQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect';
  required: boolean;
  options?: string[];
}

export interface ConfirmedStaff {
  staffId: string;
  role: string;
  date: string;
  timeSlot: string;
}

export interface FixedConfig {
  durationDays: 7 | 30 | 90;
  chipCost: 3 | 5 | 10;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface TournamentConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  resubmittedAt?: Timestamp;
  submittedAt: Timestamp;
}

export interface UrgentConfig {
  chipCost: 5;
  createdAt: Timestamp;
  priority: 'high';
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | ✅ | Firestore 문서 ID |
| `title` | `string` | ✅ | 공고 제목 |
| `description` | `string` | ✅ | 공고 설명 |
| `location` | `string` | ✅ | 위치 |
| `status` | `string` | ✅ | 공고 상태 |
| `postingType` | `string` | ✅ | 공고 타입 |
| `isChipDeducted` | `boolean` | ✅ | 칩 차감 여부 |
| `dateSpecificRequirements` | `DateSpecificRequirement[]` | ✅ | 날짜별 요구사항 |
| `createdBy` | `string` | ✅ | 생성자 ID |
| `createdAt` | `Timestamp` | ✅ | 생성 시간 |

### 관계

- **1:N → Application**: 하나의 공고는 여러 지원서를 가질 수 있음 (`eventId` 외래키)
- **1:N → WorkLog**: 하나의 공고는 여러 근무 기록을 가질 수 있음 (`eventId` 외래키)

### Validation Rules

```typescript
const validateJobPosting = (posting: JobPosting): boolean => {
  // 필수 필드 검증
  if (!posting.id || !posting.title || !posting.location || !posting.status || !posting.postingType) {
    return false;
  }

  // status 값 검증
  if (!['open', 'closed'].includes(posting.status)) {
    return false;
  }

  // postingType 값 검증
  const validPostingTypes = ['regular', 'fixed', 'tournament', 'urgent'];
  if (!validPostingTypes.includes(posting.postingType)) {
    return false;
  }

  // dateSpecificRequirements는 최소 1개 이상
  if (!Array.isArray(posting.dateSpecificRequirements) || posting.dateSpecificRequirements.length === 0) {
    return false;
  }

  // 타입별 설정 검증
  if (posting.postingType === 'fixed' && !posting.fixedConfig) {
    return false;
  }

  if (posting.postingType === 'tournament' && !posting.tournamentConfig) {
    return false;
  }

  if (posting.postingType === 'urgent' && !posting.urgentConfig) {
    return false;
  }

  return true;
};
```

### 상태 전이 (State Transitions)

```
open → closed (수동 또는 자동)
  │       │
  └───────┴─> (양방향 전환 가능)
```

---

## 데이터 플로우

### 1. Firebase 실시간 구독 플로우

```
사용자 로그인
  │
  └─> UnifiedDataStore.subscribeAll(userId, role)
        │
        ├─> Firebase onSnapshot('staff')
        │     └─> state.staff.set(staffId, staffData)
        │
        ├─> Firebase onSnapshot('workLogs')
        │     └─> state.workLogs.set(workLogId, workLogData)
        │
        ├─> Firebase onSnapshot('applications')
        │     └─> state.applications.set(applicationId, applicationData)
        │
        ├─> Firebase onSnapshot('attendanceRecords')
        │     └─> state.attendanceRecords.set(recordId, recordData)
        │
        └─> Firebase onSnapshot('jobPostings')
              └─> state.jobPostings.set(postingId, postingData)

사용자 로그아웃
  │
  └─> UnifiedDataStore.unsubscribeAll()
        └─> 모든 Firebase 구독 해제 (cleanup)
```

### 2. 데이터 업데이트 플로우

```
컴포넌트에서 데이터 수정
  │
  ├─> Optimistic Update (즉시 UI 반영)
  │     └─> UnifiedDataStore.updateStaff(staff)
  │           └─> state.staff.set(staff.id, staff)
  │
  └─> Firebase Update (Firestore에 저장)
        │
        └─> onSnapshot 콜백 트리거
              └─> 최종 데이터로 state 업데이트 (실시간 동기화)
```

### 3. Selector를 통한 데이터 조회 플로우

```
컴포넌트 렌더링
  │
  └─> useUnifiedDataStore(selector, shallow)
        │
        ├─> selector 실행 (예: getStaffById)
        │     └─> state.staff.get(staffId)
        │
        └─> shallow 비교
              └─> 값이 변경되지 않았으면 리렌더링 방지
```

---

## 마이그레이션 고려사항

### 1. Context API → Zustand 필드 매핑

| Context API | Zustand Store | 비고 |
|-------------|---------------|------|
| `state.staff` | `staff: Map<string, Staff>` | 동일 |
| `state.workLogs` | `workLogs: Map<string, WorkLog>` | 동일 |
| `state.applications` | `applications: Map<string, Application>` | 동일 |
| `state.attendanceRecords` | `attendanceRecords: Map<string, AttendanceRecord>` | 동일 |
| `state.jobPostings` | `jobPostings: Map<string, JobPosting>` | 동일 |
| `state.loading.staff` | `isLoading` | 전역 로딩 상태로 통합 |
| `state.error.staff` | `error` | 전역 에러 상태로 통합 |
| `dispatch({ type: 'SET_STAFF', data })` | `setStaff(data)` | Action 단순화 |
| `getStaffById(id)` | `getStaffById(id)` | 동일 (selector) |

### 2. 타입 안전성 보장

모든 타입은 TypeScript strict mode에서 에러 없이 컴파일되어야 하며, `any` 타입 사용을 금지합니다.

```typescript
// ✅ 올바른 사용
const staff = useUnifiedDataStore((state) => state.staff);
const staffById = useUnifiedDataStore((state) => state.getStaffById('staff-123'));

// ❌ 금지된 사용
const data: any = useUnifiedDataStore((state) => state.staff);  // any 타입 금지
```

### 3. 성능 최적화

- **shallow 비교**: 불필요한 리렌더링 방지
- **immer 미들웨어**: 불변성 자동 보장
- **devtools 미들웨어**: Redux DevTools 연동
- **메모이제이션**: selector 결과 캐싱

---

## 참고 문서

- [Zustand 공식 문서](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [immer 미들웨어](https://docs.pmnd.rs/zustand/integrations/immer-middleware)
- [devtools 미들웨어](https://docs.pmnd.rs/zustand/integrations/redux-devtools)
- [프로젝트 CLAUDE.md](../../CLAUDE.md)
- [spec.md](./spec.md)

---

**버전**: 1.0.0
**최종 수정일**: 2025-11-14
**작성자**: T-HOLDEM Development Team
