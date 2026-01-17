# 모바일앱 데이터 플로우 & 연결 관계

> UNIQN Mobile App의 핵심 워크플로우와 데이터 연결 관계 문서

---

## 1. 핵심 워크플로우 (5단계)

```
┌─────────────────────────────────────────────────────────────┐
│  1️⃣ 인증 플로우                                              │
│  로그인/회원가입 → 본인인증(PASS/카카오) → 프로필 완성        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2️⃣ 구인구직 플로우 (스태프)                                  │
│  공고 검색/필터 → 상세 조회 → 지원(Assignment v3.0) → 확정대기 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3️⃣ 스케줄 & QR 플로우                                       │
│  내 스케줄 확인 → 당일 QR 출근 → 근무 → QR 퇴근 → 정산 대기   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  4️⃣ 구인자 관리 플로우                                        │
│  공고 생성 → 지원자 확인 → 확정/거절/대기 → 출퇴근 확인 → 정산 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  5️⃣ 알림 플로우                                               │
│  지원 알림 → 확정/거절 알림 → 근무 전날 리마인더 → 정산 완료   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 전체 데이터 연결 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1️⃣ 인증 플로우                                     │
│                                                                             │
│   [users]                                                                   │
│   ├─ uid ─────────────────┬──────────────────┬─────────────────────────────┤
│   ├─ name                 │                  │                             │
│   ├─ role ────────────────┼──────────────────┼─────────────────────────────┤
│   ├─ identity.ci          │                  │                             │
│   └─ fcmToken ────────────┼──────────────────┼──────────────────┐          │
│                           │                  │                  │          │
└───────────────────────────┼──────────────────┼──────────────────┼──────────┘
                            │                  │                  │
        ┌───────────────────┘                  │                  │
        │                                      │                  │
        ▼                                      │                  │
┌───────────────────────────────────────────────────────────────────────────┐
│                       2️⃣ 구인구직 플로우                                    │
│                                                                           │
│   [jobPostings]                      [applications]                       │
│   ├─ id ◄────────────────────────────┤─ jobPostingId                      │
│   ├─ ownerId ◄───┐                   ├─ applicantId ◄──── users.uid       │
│   ├─ postingType                     ├─ status                            │
│   ├─ dateSpecificRequirements[]      ├─ assignments[] (v3.0)              │
│   ├─ roles[]                         ├─ originalApplication               │
│   ├─ fixedConfig / tournamentConfig  ├─ confirmationHistory[]             │
│   └─ status                          ├─ cancellationRequest               │
│         │                            └─ waitlistOrder                     │
│         │                                    │                            │
└─────────┼────────────────────────────────────┼────────────────────────────┘
          │                                    │
          │         ┌──────────────────────────┘
          │         │
          ▼         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       3️⃣ 스케줄 & QR 플로우                                 │
│                                                                           │
│   [workLogs]                              [eventQRCodes]                  │
│   ├─ applicationId ◄── applications.id    ├─ eventId (jobPostingId)       │
│   ├─ jobPostingId ◄─── jobPostings.id     ├─ generatedBy ◄── users.uid   │
│   ├─ staffId ◄──────── users.uid          ├─ action (checkIn/checkOut)    │
│   ├─ date                                 ├─ securityCode (UUID)          │
│   ├─ actualStartTime / actualEndTime      ├─ expiresAt (3분 유효)         │
│   ├─ settlementBreakdown (캐싱)           └─ isActive                     │
│   └─ payrollStatus                                                        │
│         │                                                                 │
└─────────┼─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       4️⃣ 구인자 관리 플로우                                  │
│                                                                           │
│   구인자가 관리하는 데이터:                                                  │
│   ├─ jobPostings (ownerId = 자신)                                         │
│   ├─ applications (확정/거절/대기자/취소요청)                               │
│   ├─ workLogs (정산 처리, settlementBreakdown 사용)                        │
│   └─ eventQRCodes (QR 발급, 3분 유효, 2분마다 자동 갱신)                    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       5️⃣ 알림 플로우                                        │
│                                                                           │
│   [notifications]                                                         │
│   ├─ userId ◄──────────── users.uid                                       │
│   ├─ type (application_received, confirmed, rejected, reminder,           │
│   │        settlement, cancellation_requested, waitlist_promoted)         │
│   └─ data: {                                                              │
│        jobPostingId ◄──── jobPostings.id                                  │
│        applicationId ◄─── applications.id                                 │
│        workLogId ◄─────── workLogs.id                                     │
│      }                                                                    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 연결 키 (Foreign Keys)

| 연결 | From | To | 용도 |
|------|------|-----|------|
| **users.uid** | applications.applicantId | users | 지원자 정보 조회 |
| **users.uid** | workLogs.staffId | users | 근무자 정보 조회 |
| **users.uid** | jobPostings.ownerId | users | 공고 소유자 확인 |
| **users.uid** | notifications.userId | users | 알림 대상 |
| **users.uid** | eventQRCodes.generatedBy | users | QR 발급자 |
| **jobPostings.id** | applications.jobPostingId | jobPostings | 지원한 공고 |
| **jobPostings.id** | workLogs.jobPostingId | jobPostings | 근무한 공고 |
| **jobPostings.id** | eventQRCodes.eventId | jobPostings | QR 대상 공고 |
| **applications.id** | workLogs.applicationId | applications | 확정된 지원서 |

---

## 4. 플로우별 데이터 의존성

### 4.1 인증 → 구인구직

```
users.uid ──────────→ applications.applicantId
users.role ─────────→ 권한 체크 (employer만 공고 생성 가능)
users.name ─────────→ applications.applicantName (복사)
users.phone ────────→ applications.applicantPhone (복사)
```

### 4.2 구인구직 → 스케줄

```
applications.id ────────→ workLogs.applicationId (확정 시 생성)
applications.assignments[] → workLogs 다중 생성 (날짜별, 역할별)
jobPostings.id ─────────→ workLogs.jobPostingId
jobPostings.salaryInfo ─→ workLogs.settlementBreakdown (계산 기반)
```

### 4.3 스케줄 → 구인자

```
workLogs.actualStartTime ───→ settlementBreakdown 계산 (캐싱)
workLogs.actualEndTime ─────→ settlementBreakdown 계산 (캐싱)
eventQRCodes.qrData ────────→ workLogs 출퇴근 업데이트
eventQRCodes.securityCode ──→ QR 검증
```

### 4.4 전체 → 알림

```
applications.status 변경 ─────→ notifications 생성
applications.cancellationRequest → notifications 생성 (취소 요청)
workLogs.payrollStatus ───────→ notifications 생성 (정산완료)
users.fcmToken ───────────────→ 푸시 알림 전송
```

---

## 5. Assignment v3.0 구조

### 5.1 Assignment 타입 정의

```typescript
interface Assignment {
  // v3.0: role/roles → roleIds 통합
  roleIds: string[];              // 단일 및 다중 역할 배열로 통일

  // 날짜/시간
  dates: string[];                // 항상 배열 (연속 날짜 지원)
  timeSlot: string;               // "18:00-02:00" 또는 마커

  // 그룹핑 (연속 날짜)
  isGrouped: boolean;
  groupId?: string;               // 연속 날짜 그룹 식별
  checkMethod?: 'group' | 'individual';  // 출퇴근 확인 방식

  // 기타
  requirementId?: string;         // dateSpecificRequirement 참조
  duration?: DurationType;
  isTimeToBeAnnounced?: boolean;  // 시간 미정
  tentativeDescription?: string;
}

// 마커 상수
const FIXED_DATE_MARKER = 'FIXED_SCHEDULE';   // 고정공고용
const FIXED_TIME_MARKER = 'NEGOTIABLE';        // 협의 가능
const TBA_TIME_MARKER = '미정';                // 시간 미정
```

### 5.2 Assignment 헬퍼 함수

```typescript
// 역할 조회
getAssignmentRole(assignment)  → string      // 단일 역할
getAssignmentRoles(assignment) → string[]    // 모든 역할

// 생성 헬퍼
createSimpleAssignment(roleId, date, timeSlot)
createGroupedAssignment(roleIds, dates, timeSlot, groupId)
createMultiRoleAssignment(roleIds, date, timeSlot)

// 검증
isValidAssignment(assignment) → boolean      // 타입 가드
```

---

## 6. PostingType 시스템

### 6.1 4가지 공고 타입

| 타입 | 설명 | 추가 설정 |
|------|------|----------|
| `regular` | 일반 공고 | `dateSpecificRequirements[]` |
| `fixed` | 고정/기간제 공고 | `fixedConfig`, `workSchedule` |
| `tournament` | 대회 공고 | `tournamentConfig` (관리자 승인 필요) |
| `urgent` | 긴급 공고 | 우선 노출, `isUrgent: true` |

### 6.2 Fixed 공고 설정

```typescript
interface FixedConfig {
  startDate: string;              // 계약 시작일
  endDate: string;                // 계약 종료일
}

interface WorkSchedule {
  days: string[];                 // ['월', '화', '수', '목', '금']
  startTime: string;              // "09:00"
  endTime: string;                // "18:00"
}

// 추가 필드
daysPerWeek?: number;             // 0 = 협의, 1-7 = 고정 일수
isStartTimeNegotiable?: boolean;  // 시작시간 협의 가능
```

### 6.3 Tournament 공고 설정

```typescript
interface TournamentConfig {
  requiresApproval: boolean;      // 관리자 승인 필요
  approvedBy?: string;            // 승인자 ID
  approvedAt?: Timestamp;
}
```

---

## 7. 취소 요청 시스템 (Cancellation Request)

### 7.1 취소 요청 구조

```typescript
interface CancellationRequest {
  requestedAt: string;            // 요청 시간
  reason: string;                 // 취소 사유
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;            // 검토 시간
  reviewedBy?: string;            // 검토자 ID
  rejectionReason?: string;       // 거절 사유
}

// ApplicationStatus에 추가된 상태
type ApplicationStatus =
  | 'applied'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'waitlisted'
  | 'completed'
  | 'cancellation_pending';       // 취소 요청 대기중
```

### 7.2 취소 요청 플로우

```
[스태프]                           [구인자]
    │                                 │
    │  확정된 상태에서                 │
    │  취소 요청 생성                  │
    ├────────────────────────────────→│
    │                                 │
    │  status: 'cancellation_pending' │
    │  cancellationRequest.status:    │
    │    'pending'                    │
    │                                 │
    │                      검토 후    │
    │                   승인 또는 거절 │
    │←────────────────────────────────┤
    │                                 │
    │  승인 시:                        │
    │    status: 'cancelled'          │
    │    filledPositions -= 1         │
    │    workLogs 삭제                │
    │                                 │
    │  거절 시:                        │
    │    status: 'confirmed' (유지)   │
    │    cancellationRequest.status:  │
    │      'rejected'                 │
```

### 7.3 관련 함수

```typescript
// applicationService.ts
requestCancellation(input: RequestCancellationInput, applicantId: string)

// applicantManagementService.ts
reviewCancellationRequest(input: ReviewCancellationInput, reviewerId: string)
getCancellationRequests(jobPostingId: string, ownerId: string)
```

---

## 8. 대기자 관리 시스템 (Waitlist)

### 8.1 대기자 필드

```typescript
interface Application {
  // 기존 필드...

  // 대기자 관련
  waitlistOrder?: number;         // 대기 순번 (1부터 시작)
  waitlistPromotedAt?: Timestamp; // 승격 시간
}
```

### 8.2 대기자 플로우

```
[지원자 과다 상황]
    │
    ▼
┌─────────────────────────────────────┐
│  정원 초과 시                        │
│  → addToWaitlist() 호출             │
│  → status: 'waitlisted'             │
│  → waitlistOrder 자동 계산          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  정원 확보 시 (취소/거절 발생)       │
│  → promoteFromWaitlist() 호출       │
│  → 대기 순번 1번 자동 승격           │
│  → status: 'confirmed'              │
│  → workLogs 자동 생성               │
└─────────────────────────────────────┘
```

### 8.3 관련 함수

```typescript
// applicantManagementService.ts
addToWaitlist(applicationId: string, ownerId: string): Promise<void>
promoteFromWaitlist(applicationId: string, ownerId: string): Promise<ConfirmResult>
```

---

## 9. 확정/취소 이력 추적 (Audit Trail)

### 9.1 이력 구조

```typescript
interface Application {
  // 기존 필드...

  // 최초 지원 데이터 보존 (확정 시점에 저장)
  originalApplication?: {
    assignments: Assignment[];
    appliedAt: Timestamp;
  };

  // 확정/취소 이력 (감사 추적)
  confirmationHistory?: ConfirmationHistoryEntry[];
}

interface ConfirmationHistoryEntry {
  confirmedAt: Timestamp;
  cancelledAt?: Timestamp;
  cancelReason?: string;
  assignments: Assignment[];      // 해당 시점의 확정된 과제
  confirmedBy?: string;           // 확정자 ID
  cancelledBy?: string;           // 취소자 ID
}
```

### 9.2 이력 관리 목적

| 용도 | 설명 |
|------|------|
| **원본 복구** | 최초 지원 상태로 복구 가능 |
| **변경 추적** | 누가, 언제, 무엇을 변경했는지 기록 |
| **분쟁 해결** | 분쟁 발생 시 증거 자료 |
| **감사 로그** | 규정 준수용 감사 추적 |

### 9.3 관련 함수

```typescript
// applicationHistoryService.ts
confirmApplicationWithHistory(applicationId, selectedAssignments, confirmerId)
createHistoryEntry(assignments, confirmerId)
addCancellationToEntry(entry, cancelReason, cancellerId)
findActiveConfirmation(confirmationHistory)
updateDateSpecificRequirementsFilled(jobPosting, assignments, delta)
```

---

## 10. 정산 캐싱 시스템 (Settlement Breakdown)

### 10.1 정산 구조

```typescript
interface SettlementBreakdown {
  // 근무 시간
  hoursWorked: number;

  // 기본 급여
  salaryInfo: SalaryInfo;
  basePay: number;

  // 수당
  allowances?: {
    guaranteedHours?: number;     // 보장시간
    meal?: number;                // 식대
    transportation?: number;      // 교통비
    accommodation?: number;       // 숙박비
  };
  allowancePay: number;

  // 세금
  taxAmount: number;

  // 합계
  totalPay: number;               // 세전
  afterTaxPay: number;            // 세후

  // 메타
  isEstimate: boolean;            // 추정치 여부
  calculatedAt: string;           // 계산 시점
}
```

### 10.2 캐싱 전략

```
[스케줄 탭 진입]
    │
    ▼
┌─────────────────────────────────────┐
│  workLogToScheduleEvent() 호출      │
│                                     │
│  1. workLog 조회                    │
│  2. jobPosting 급여 정보 조회       │
│  3. calculateSettlementBreakdown()  │
│  4. ScheduleEvent에 캐싱 저장       │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  정산 탭에서                         │
│                                     │
│  → settlementBreakdown 사용 (캐싱)  │
│  → 중복 계산 방지                   │
│  → 성능 최적화                      │
└─────────────────────────────────────┘
```

### 10.3 개별 오버라이드

```typescript
interface ScheduleEvent {
  // 기본 정산 (캐싱)
  settlementBreakdown?: SettlementBreakdown;

  // 개별 오버라이드 (특수 케이스)
  customSalaryInfo?: SalaryInfo;
  customAllowances?: Allowances;
  customTaxSettings?: TaxSettings;
}
```

---

## 11. QR 코드 시스템 상세

### 11.1 QR 코드 구조

```typescript
interface EventQRCode {
  eventId: string;                // jobPostingId
  date: string;                   // YYYY-MM-DD
  action: 'checkIn' | 'checkOut';
  securityCode: string;           // UUID (보안용)

  createdBy: string;              // 발급자 ID
  createdAt: Timestamp;
  expiresAt: Timestamp;           // 3분 후 만료
  isActive: boolean;

  scanCount: number;              // 스캔 횟수
}

interface EventQRDisplayData {
  type: 'event';
  eventId: string;
  date: string;
  action: 'checkIn' | 'checkOut';
  securityCode: string;
  createdAt: number;              // ms
  expiresAt: number;              // ms
}
```

### 11.2 QR 유효 시간

```typescript
const QR_VALIDITY_DURATION_MS = 3 * 60 * 1000;  // 3분 유효
const QR_REFRESH_INTERVAL_MS = 2 * 60 * 1000;   // 2분마다 자동 갱신
```

### 11.3 QR 발급/검증 플로우

```
[구인자]                              [스태프]
    │                                    │
    │  QR 발급 요청                       │
    │  → deactivateExistingQRCodes()     │
    │  → 새 QR 생성 (3분 유효)            │
    │                                    │
    │  화면에 QR 표시                     │
    │  (2분마다 자동 갱신)                 │
    │                                    │
    │                        QR 스캔     │
    │←───────────────────────────────────┤
    │                                    │
    │  검증:                              │
    │  1. securityCode 일치              │
    │  2. expiresAt > now                │
    │  3. isActive = true                │
    │  4. date 일치                      │
    │                                    │
    │  성공 시:                           │
    │  → workLogs 업데이트                │
    │  → scanCount += 1                  │
```

### 11.4 단일 활성 QR 정책

```typescript
// 같은 eventId/date/action에 대해 한 번에 하나의 활성 QR만 유지
async function deactivateExistingQRCodes(
  eventId: string,
  date: string,
  action: 'checkIn' | 'checkOut'
) {
  // 기존 활성 QR 모두 비활성화
  // isActive = false
}
```

---

## 12. 트랜잭션 필수 연결 지점

### 12.1 지원 확정 시 (4개 컬렉션 동시 수정)

```typescript
runTransaction(async (tx) => {
  // 1. applications 업데이트
  tx.update(applicationRef, {
    status: 'confirmed',
    confirmedAt: serverTimestamp(),
    originalApplication: { ... },      // 최초 확정 시만
    confirmationHistory: arrayUnion(historyEntry)
  });

  // 2. jobPostings.filledPositions += 1
  tx.update(jobPostingRef, {
    filledPositions: increment(1)
  });

  // 3. dateSpecificRequirements.filled 업데이트
  // updateDateSpecificRequirementsFilled()

  // 4. workLogs 생성 (assignments[] 기반)
  assignments.forEach(assignment => {
    tx.set(workLogRef, {
      applicationId,
      jobPostingId,
      staffId,
      date: assignment.date,
      status: 'scheduled'
    });
  });
});
```

### 12.2 지원 거절 시 (정원 복구)

```typescript
runTransaction(async (tx) => {
  // 1. applications.status = 'rejected'
  tx.update(applicationRef, {
    status: 'rejected',
    rejectionReason,
    processedAt: serverTimestamp()
  });

  // 2. 확정된 상태였다면 filledPositions -= 1
  if (wasConfirmed) {
    tx.update(jobPostingRef, {
      filledPositions: increment(-1)
    });
  }
});
```

### 12.3 취소 요청 승인 시 (3개 컬렉션 동시 수정)

```typescript
runTransaction(async (tx) => {
  // 1. applications 업데이트
  tx.update(applicationRef, {
    status: 'cancelled',
    'cancellationRequest.status': 'approved',
    'cancellationRequest.reviewedAt': serverTimestamp(),
    'cancellationRequest.reviewedBy': reviewerId
  });

  // 2. jobPostings.filledPositions -= 1
  tx.update(jobPostingRef, {
    filledPositions: increment(-1)
  });

  // 3. workLogs 삭제
  workLogIds.forEach(id => {
    tx.delete(doc(db, 'workLogs', id));
  });
});
```

### 12.4 대기자 승격 시 (4개 컬렉션 동시 수정)

```typescript
runTransaction(async (tx) => {
  // 1. applications 업데이트
  tx.update(applicationRef, {
    status: 'confirmed',
    waitlistPromotedAt: serverTimestamp(),
    confirmationHistory: arrayUnion(historyEntry)
  });

  // 2. jobPostings.filledPositions += 1
  tx.update(jobPostingRef, {
    filledPositions: increment(1)
  });

  // 3. dateSpecificRequirements.filled 업데이트
  // updateDateSpecificRequirementsFilled()

  // 4. workLogs 생성
  assignments.forEach(assignment => {
    tx.set(workLogRef, { ... });
  });
});
```

### 12.5 QR 체크인/아웃 시

```typescript
runTransaction(async (tx) => {
  // 1. QR 검증
  const qrDoc = await tx.get(qrCodeRef);
  if (!isValidQR(qrDoc)) throw new Error('Invalid QR');

  // 2. workLogs 업데이트
  tx.update(workLogRef, {
    actualStartTime: serverTimestamp(),  // 또는 actualEndTime
    status: 'checked_in'                  // 또는 'checked_out'
  });

  // 3. eventQRCodes.scanCount += 1
  tx.update(qrCodeRef, {
    scanCount: increment(1)
  });
});
```

### 12.6 정산 처리 시

```typescript
runTransaction(async (tx) => {
  // 1. workLogs.payrollStatus = 'completed'
  tx.update(workLogRef, {
    payrollStatus: 'completed',
    payrollAmount: settlementBreakdown.afterTaxPay,
    payrollDate: serverTimestamp()
  });

  // 2. notifications 생성 (정산완료 알림)
  tx.set(notificationRef, {
    userId: staffId,
    type: 'settlement_completed',
    data: { workLogId, amount: settlementBreakdown.afterTaxPay }
  });
});
```

---

## 13. 데이터 생성 시점

| 시점 | 생성되는 데이터 | 트리거 | 관련 플로우 |
|------|---------------|--------|------------|
| 회원가입 | `users` | 인증 완료 | 1️⃣ 인증 |
| 공고 등록 | `jobPostings` | 구인자 생성 | 4️⃣ 구인자 |
| 지원 | `applications` | 스태프 지원 | 2️⃣ 구인구직 |
| 지원 확정 | `workLogs`, `originalApplication`, `confirmationHistory` | 구인자 확정 | 4️⃣ 구인자 |
| 대기자 등록 | `applications.waitlistOrder` | 정원 초과 시 | 4️⃣ 구인자 |
| 대기자 승격 | `workLogs`, `waitlistPromotedAt` | 정원 확보 시 | 4️⃣ 구인자 |
| 취소 요청 | `applications.cancellationRequest` | 스태프 요청 | 2️⃣ 구인구직 |
| 취소 승인 | `workLogs` 삭제 | 구인자 승인 | 4️⃣ 구인자 |
| QR 발급 | `eventQRCodes` | 구인자 발급 | 3️⃣ 스케줄 |
| QR 스캔 | `workLogs` 업데이트 | 스태프 체크인/아웃 | 3️⃣ 스케줄 |
| 상태 변경 | `notifications` | 자동 생성 | 5️⃣ 알림 |
| 정산 완료 | `workLogs.payrollStatus`, `notifications` | 구인자 처리 | 4️⃣ 구인자 |

---

## 14. 핵심 데이터 vs 미사용 데이터

### 14.1 핵심 데이터 (🔴 필수)

| 컬렉션 | 핵심 필드 | 용도 |
|--------|----------|------|
| **users** | `uid`, `name`, `role`, `identity.ci`, `fcmToken` | 사용자 식별, 권한, 중복가입방지, 푸시알림 |
| **jobPostings** | `id`, `status`, `postingType`, `dateSpecificRequirements[]`, `roles[]`, `ownerId`, `fixedConfig`, `tournamentConfig` | 공고 조회/필터/관리 |
| **applications** | `id`, `applicantId`, `jobPostingId`, `status`, `assignments[]`, `originalApplication`, `confirmationHistory[]`, `cancellationRequest`, `waitlistOrder` | 지원 상태 관리, 이력 추적 |
| **workLogs** | `id`, `applicationId`, `staffId`, `jobPostingId`, `date`, `actualStartTime/EndTime`, `settlementBreakdown`, `payrollStatus` | 출퇴근 기록, 정산 |
| **eventQRCodes** | `id`, `eventId`, `action`, `securityCode`, `expiresAt`, `isActive`, `generatedBy` | QR 출퇴근 |
| **notifications** | `id`, `userId`, `type`, `isRead`, `data` | 알림 |

### 14.2 미사용/레거시 데이터 (⚫)

| 필드/컬렉션 | 위치 | 이유 | 제거 예정 |
|------------|------|------|----------|
| `eventId` | applications | 레거시 (→ `jobPostingId` 사용) | 2025 Q3 |
| `postId` | applications | 레거시 (→ `jobPostingId` 사용) | 2025 Q3 |
| `workDate` (단일) | jobPostings | 레거시 (→ `dateSpecificRequirements[]` 배열) | 2025 Q3 |
| `timeSlot` (단일) | jobPostings | 레거시 (→ 시간대 배열) | 2025 Q3 |
| `appliedRole` (단일) | applications | v1 호환성 (→ `assignments[].roleIds`) | 2025 Q3 |
| `appliedDate` (단일) | applications | v1 호환성 (→ `assignments[].dates`) | 2025 Q3 |
| `role` / `roles` | assignments | v2 호환성 (→ `roleIds` 통합) | 2025 Q2 |
| `staff` 컬렉션 | Firestore | **완전 미사용** (모바일앱은 users만 사용) | - |
| `events` 컬렉션 | Firestore | **완전 미사용** (→ jobPostings로 통합) | - |
| `tournaments` | 모바일앱 | Phase 2 이후 (현재 미구현) | - |

---

## 15. 서비스 레이어 매핑

### 15.1 핵심 서비스

| 서비스 파일 | 담당 데이터 | 주요 기능 |
|------------|-----------|----------|
| `authService.ts` | users | 로그인, 회원가입, 소셜 로그인 |
| `jobService.ts` | jobPostings | 공고 목록, 검색, 필터, 상세 |
| `applicationService.ts` | applications | 지원, 취소 요청 |
| `applicantManagementService.ts` | applications | 확정, 거절, 대기자, 취소요청 검토 |
| `applicationHistoryService.ts` | applications | 이력 추적, 감사 로그 |
| `scheduleService.ts` | workLogs, applications | 스케줄 조회, 정산 계산 |
| `eventQRService.ts` | eventQRCodes, workLogs | QR 생성, 검증, 체크인/아웃 |
| `settlementService.ts` | workLogs | 정산 처리, 일괄 정산 |
| `notificationService.ts` | notifications | 알림 조회, 읽음 처리 |

### 15.2 보조 서비스

| 서비스 파일 | 담당 데이터 | 주요 기능 |
|------------|-----------|----------|
| `jobManagementService.ts` | jobPostings | 공고 CRUD (구인자용) |
| `confirmedStaffService.ts` | applications, workLogs | 확정 스태프 관리, 시간 수정 |
| `templateService.ts` | jobPostingTemplates | 공고 템플릿 저장/로드 |
| `applicantConversionService.ts` | applications, users | 지원자 → 스태프 변환 |
| `storageService.ts` | Firebase Storage | 프로필 이미지 업로드 |
| `pushNotificationService.ts` | FCM | 푸시 알림 등록/수신 |

---

## 16. 핵심 연결 체인 요약

```
users.uid (중심축)
    │
    ├──→ jobPostings.ownerId (구인자로서)
    │         │
    │         ├──→ applications.jobPostingId (공고에 대한 지원)
    │         │         │
    │         │         ├──→ applications.cancellationRequest (취소 요청)
    │         │         ├──→ applications.waitlistOrder (대기자 관리)
    │         │         ├──→ applications.confirmationHistory[] (이력 추적)
    │         │         │
    │         │         └──→ workLogs.applicationId (확정된 지원의 근무기록)
    │         │                   │
    │         │                   └──→ settlementBreakdown (정산 캐싱)
    │         │
    │         └──→ eventQRCodes.eventId (QR 발급)
    │
    ├──→ applications.applicantId (지원자로서)
    │
    ├──→ workLogs.staffId (근무자로서)
    │
    ├──→ eventQRCodes.generatedBy (QR 발급자로서)
    │
    └──→ notifications.userId (알림 수신자로서)
```

**핵심 포인트**:
- `users.uid`가 모든 데이터의 **중심축**
- `jobPostings.id`가 비즈니스 로직의 **연결 고리**
- `applications.id`가 지원-근무 간 **브릿지**
- `assignments[]`가 다중 역할/날짜/시간 **통합 관리**

---

## 17. 스태프 vs 구인자 데이터 접근 범위

### 스태프 (staff)

```yaml
읽기 가능:
  - jobPostings: 전체 (status = 'active')
  - applications: 본인 것만 (applicantId = uid)
  - workLogs: 본인 것만 (staffId = uid)
  - notifications: 본인 것만 (userId = uid)

쓰기 가능:
  - applications: 생성 (지원), 취소 요청
  - workLogs: QR 체크인/아웃만
```

### 구인자 (employer)

```yaml
읽기 가능:
  - jobPostings: 본인 것 (ownerId = uid)
  - applications: 본인 공고에 대한 것 (jobPostingId in myPostings)
  - workLogs: 본인 공고에 대한 것 (jobPostingId in myPostings)
  - notifications: 본인 것만 (userId = uid)

쓰기 가능:
  - jobPostings: CRUD
  - applications: 확정/거절/대기자 관리/취소 요청 검토
  - workLogs: 정산 처리, 시간 수정
  - eventQRCodes: 생성
```

### 관리자 (admin)

```yaml
읽기 가능:
  - 모든 컬렉션

쓰기 가능:
  - 모든 컬렉션
  - tournamentConfig 승인
  - 사용자 패널티 부여
```

---

## 18. Timestamp 형식 호환성

### 18.1 다양한 형식 처리

```typescript
// Firestore에서 반환되는 다양한 날짜 형식
type DateInput =
  | string                          // "2025-01-17"
  | Date                            // JavaScript Date
  | Timestamp                       // Firestore Timestamp
  | { seconds: number }             // 직렬화된 Timestamp
  | { toDate: () => Date };         // Timestamp 인터페이스

// 변환 함수
function parseDateInput(input: DateInput): string {
  if (typeof input === 'string') {
    return input;
  } else if (input instanceof Date) {
    return input.toISOString().split('T')[0];
  } else if ('toDate' in input && typeof input.toDate === 'function') {
    return input.toDate().toISOString().split('T')[0];
  } else if ('seconds' in input) {
    return new Date(input.seconds * 1000).toISOString().split('T')[0];
  }
  throw new Error('Invalid date input');
}
```

### 18.2 사용 위치

| 필드 | 형식 | 이유 |
|------|------|------|
| `createdAt`, `updatedAt` | Timestamp | Firestore 서버 시간 |
| `assignment.dates[]` | string (YYYY-MM-DD) | 배열 비교 용이 |
| `workLog.date` | string (YYYY-MM-DD) | 인덱싱 및 필터링 |
| `dateSpecificRequirements[].date` | string 또는 Timestamp | 호환성 유지 |

---

## 19. Hooks 레이어 데이터 관리

### 19.1 Hooks 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (Screens)                        │
│                         ↕                                    │
├─────────────────────────────────────────────────────────────┤
│                    Hooks Layer (42개 훅)                     │
│  ├─ UI 상태: useToast, useSettings, useMediaQuery           │
│  ├─ 서버 데이터: useJobPostings, useScheduleData            │
│  ├─ Firebase 구독: useUnifiedData, useFirestoreQuery        │
│  └─ 비즈니스 로직: useJobPostingForm, useTemplateManager    │
│                         ↕                                    │
├─────────────────────────────────────────────────────────────┤
│                    State Layer                               │
│  ├─ Zustand Store (전역 상태) ← 읽기/쓰기                    │
│  ├─ TanStack Query (캐싱) ← 읽기                            │
│  └─ React State (로컬 상태) ← 읽기/쓰기                      │
│                         ↕                                    │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                             │
│                         ↕                                    │
├─────────────────────────────────────────────────────────────┤
│                    Firebase Layer                            │
└─────────────────────────────────────────────────────────────┘
```

### 19.2 주요 훅 목록

| 훅 | 담당 데이터 | 용도 |
|----|-----------|------|
| `useAuth` | users, authStore | 인증 상태 관리 |
| `useJobPostings` | jobPostings | 공고 목록/검색 |
| `useJobPostingForm` | jobPostings, templates | 공고 생성/수정 폼 |
| `useScheduleData` | workLogs, applications | 스케줄 조회 |
| `useUnifiedData` | staff, workLogs, applications | 실시간 통합 데이터 |
| `useTemplateManager` | jobPostingTemplates | 템플릿 CRUD |
| `useAccountDeletion` | deletionRequests | 계정 삭제 관리 |
| `useEventQR` | eventQRCodes | QR 생성/검증 |
| `useToast` | toastStore | 토스트 알림 |

---

## 20. 상태 관리 (Zustand + TanStack Query)

### 20.1 Zustand Store 구조

```typescript
// unifiedDataStore.ts
interface UnifiedDataStore {
  // 컬렉션 데이터
  staff: Staff[];
  workLogs: WorkLog[];
  applications: Application[];
  attendanceRecords: AttendanceRecord[];
  jobPostings: JobPosting[];

  // 인덱스 맵 (O(1) 조회)
  workLogsByEventId: Map<string, WorkLog[]>;
  applicationsByApplicantId: Map<string, Application[]>;

  // 구독 관리
  subscriptions: Map<string, () => void>;

  // 액션
  setStaff: (staff: Staff[]) => void;
  subscribeToCollection: (collection: string) => void;
  unsubscribeAll: () => void;
}
```

### 20.2 TanStack Query Keys 중앙 관리

```typescript
// queryKeys.ts
export const queryKeys = {
  jobPostings: {
    all: ['jobPostings'] as const,
    list: (filters: object) => ['jobPostings', 'list', filters] as const,
    detail: (id: string) => ['jobPostings', 'detail', id] as const,
    mine: () => ['jobPostings', 'mine'] as const,
  },
  applications: {
    all: ['applications'] as const,
    mine: () => ['applications', 'mine'] as const,
    byJob: (jobId: string) => ['applications', 'job', jobId] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    byDate: (date: string) => ['schedules', 'date', date] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unread: () => ['notifications', 'unread'] as const,
  },
};
```

### 20.3 캐싱 정책 (5단계)

| 정책 | staleTime | gcTime | 용도 | 예시 |
|------|-----------|--------|------|------|
| `realtime` | 0 | 5분 | 실시간 데이터 | notifications |
| `frequent` | 2분 | 10분 | 자주 변경 | jobPostings.list |
| `standard` | 5분 | 30분 | 보통 빈도 | jobPostings.detail |
| `stable` | 30분 | 1시간 | 드물게 변경 | settings, regions |
| `offlineFirst` | Infinity | Infinity | 오프라인 우선 | mySchedule |

---

## 21. 에러 처리 패턴

### 21.1 에러 코드 체계

```typescript
// 에러 코드 분류
E1xxx: 네트워크 에러
  E1001: 네트워크 연결 실패
  E1002: 요청 타임아웃
  E1003: 서버 응답 없음

E2xxx: 인증 에러
  E2001: 로그인 필요
  E2002: 토큰 만료
  E2003: 권한 없음
  E2004: 계정 비활성화

E3xxx: 검증 에러
  E3001: 필수 필드 누락
  E3002: 형식 오류
  E3003: 값 범위 초과

E4xxx: Firebase 에러
  E4001: Firestore 읽기 실패
  E4002: Firestore 쓰기 실패
  E4003: Storage 업로드 실패

E5xxx: 보안 에러
  E5001: XSS 탐지
  E5002: 비정상 접근

E6xxx: 비즈니스 에러
  E6001: 정원 마감
  E6002: 중복 지원
  E6003: 취소 불가 상태
  E6004: 잔액 부족

E7xxx: 알 수 없는 에러
  E7001: 예상치 못한 오류
```

### 21.2 에러 전파 플로우

```
Service Layer
    │ throw ServiceError / ValidationError / AuthError
    ▼
Hooks Layer
    │ try/catch → 에러 로깅 + 상태 업데이트
    ▼
UI Layer
    │ error 상태 확인 → Toast 표시 또는 ErrorBoundary
    ▼
사용자
```

### 21.3 재시도 정책

```typescript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,          // 1초
  maxDelay: 30000,          // 30초
  backoffMultiplier: 2,     // 지수 백오프
  retryableErrors: ['E1001', 'E1002', 'E4001', 'E4002'],
};
```

---

## 22. 커스텀 역할 (customRole) 처리

### 22.1 역할 타입 구조

```typescript
// 기존 역할 목록
const PREDEFINED_ROLES = [
  'dealer', 'floor', 'serving', 'chip_runner',
  'cashier', 'supervisor', 'security', 'other'
];

// 역할별 급여 설정
interface RoleSalary {
  salaryType: SalaryType;
  salaryAmount: string;
  customRoleName?: string;  // 'other' 선택 시에만 사용
}
```

### 22.2 커스텀 역할 플로우

```
[공고 생성]
    │
    ├─ 역할 드롭다운에서 'other' 선택
    │
    ├─ customRoleName 입력 필드 활성화
    │
    ├─ handleCustomRoleNameChange(role, customName)
    │  └─ formData.roleSalaries.other.customRoleName = customName
    │
    └─ Firebase 저장:
       jobPostings/{id}.roleSalaries: {
         other: {
           salaryType: 'hourly',
           salaryAmount: '15000',
           customRoleName: '리셉션'
         }
       }

[지원 시]
    │
    ├─ 역할 목록에 customRoleName 표시
    │  └─ "기타 (리셉션)"
    │
    └─ applications/{id}.appliedRole = 'other'
       applications/{id}.customRole = '리셉션'
```

---

## 23. 사전질문 (preQuestions) 시스템

### 23.1 사전질문 타입

```typescript
interface PreQuestion {
  id: string;
  question: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select';
  options?: string[];  // select 타입일 때만
}

interface PreQuestionAnswer {
  questionId: string;
  question?: string;
  answer: string;
  required?: boolean;
}
```

### 23.2 사전질문 데이터 플로우

```
[공고 생성 시]
    │
    ├─ handlePreQuestionsToggle(enabled)
    │  └─ formData.usePreQuestions = true
    │
    ├─ addPreQuestion()
    │  └─ 새 질문 추가 (기본: text 타입, 선택사항)
    │
    ├─ handlePreQuestionChange(index, field, value)
    │  └─ 질문 내용, 필수 여부, 타입 수정
    │
    ├─ handlePreQuestionOptionChange(qIndex, oIndex, value)
    │  └─ select 타입 옵션 수정
    │
    └─ Firebase 저장:
       jobPostings/{id}.preQuestions: [
         { id: 'q1', question: '경력은?', type: 'text', required: true },
         { id: 'q2', question: '선호 시간?', type: 'select', options: ['오전', '오후'] }
       ]

[지원 시]
    │
    ├─ 공고 상세에서 preQuestions 로드
    │
    ├─ 각 질문별 답변 UI 렌더링
    │  ├─ text/textarea: 텍스트 입력
    │  └─ select: 옵션 드롭다운
    │
    └─ Firebase 저장:
       applications/{id}.preQuestionAnswers: [
         { questionId: 'q1', answer: '3년', required: true },
         { questionId: 'q2', answer: '오후' }
       ]

[지원자 관리 시]
    │
    └─ 구인자 페이지에서 preQuestionAnswers 표시
       └─ PreQuestionDisplay 컴포넌트
```

---

## 24. 공고 템플릿 (templates) 시스템

### 24.1 템플릿 구조

```typescript
interface JobPostingTemplate {
  id: string;
  name: string;
  description: string;
  templateData: {
    title: string;
    type: PostingType;
    description: string;
    location: string;
    district: string;
    salaryType: SalaryType;
    salaryAmount: string;
    benefits: string[];
    preQuestions: PreQuestion[];
    roleSalaries: Record<string, RoleSalary>;
    // 제외: dateSpecificRequirements (날짜별 변경 필요)
  };
  createdBy: string;
  createdAt: Timestamp;
  usageCount: number;
  lastUsedAt?: Timestamp;
}
```

### 24.2 템플릿 데이터 플로우

```
[템플릿 저장]
    │
    ├─ 공고 작성 폼 → [템플릿으로 저장] 버튼
    │
    ├─ openTemplateModal()
    │  └─ 템플릿 이름/설명 입력 모달
    │
    ├─ handleSaveTemplate(formData)
    │  ├─ Validation: 템플릿명 필수
    │  ├─ dateSpecificRequirements 제외 (날짜 제외)
    │  └─ Firebase: jobPostingTemplates/{id} 저장
    │
    └─ toast: '템플릿이 저장되었습니다'

[템플릿 로드]
    │
    ├─ 공고 작성 페이지 → [템플릿 로드] 버튼
    │
    ├─ openLoadTemplateModal()
    │  └─ 저장된 템플릿 목록 표시
    │
    ├─ handleLoadTemplate(template)
    │  ├─ usageCount += 1
    │  ├─ lastUsedAt = now
    │  ├─ templateToFormData 변환
    │  └─ formData 복원
    │
    └─ 폼이 템플릿 데이터로 채워짐

[템플릿 삭제]
    │
    ├─ 템플릿 목록 → [삭제] 아이콘
    │
    ├─ handleDeleteTemplateConfirm()
    │  └─ Firebase: jobPostingTemplates/{id} 삭제
    │
    └─ 목록에서 제거
```

---

## 25. 신고 시스템 (reports)

### 25.1 신고 타입

```typescript
// 신고 유형 - 스태프가 구인자를 신고
const EMPLOYER_REPORT_TYPES = {
  false_posting: '허위 공고',
  employer_negligence: '구인자 태만',
  unfair_treatment: '부당 대우',
  inappropriate_behavior: '부적절한 행동',
  other: '기타'
};

// 신고 유형 - 구인자가 스태프를 신고
const EMPLOYEE_REPORT_TYPES = {
  tardiness: '지각',
  negligence: '태만',
  no_show: '무단 불참',
  inappropriate_behavior: '부적절한 행동',
  other: '기타'
};

interface Report {
  id: string;
  type: ReportType;
  reporterType: 'employee' | 'employer';
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  eventId: string;
  eventTitle: string;
  date: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
  resolution?: string;
  adminNotes?: string;
}
```

### 25.2 신고 데이터 플로우

```
[신고 생성]
    │
    ├─ 스케줄 → 이벤트 카드 → [신고] 버튼
    │
    ├─ ReportModal 열기
    │  ├─ reporterType 자동 결정 (스태프/구인자)
    │  ├─ 신고 유형 선택
    │  └─ 상세 설명 입력 (필수, 10자 이상)
    │
    ├─ handleSubmit()
    │  ├─ Validation
    │  └─ Firebase: reports/{id} 저장 (또는 inquiries)
    │
    └─ toast: '신고가 접수되었습니다'

[신고 관리 - 관리자]
    │
    ├─ 관리자 대시보드 → 신고 목록
    │
    ├─ status = 'pending' 우선 표시
    │
    ├─ 신고 상세 조회 및 검토
    │
    └─ 상태 업데이트:
       'pending' → 'reviewed' → 'resolved' / 'dismissed'
```

---

## 26. 계정 삭제 (account deletion)

### 26.1 삭제 요청 구조

```typescript
interface DeletionRequest {
  requestId: string;
  userId: string;
  userEmail: string;
  userName: string;
  reason?: string;
  reasonCategory?: DeletionReasonCategory;
  requestedAt: Timestamp;
  scheduledDeletionAt: Timestamp;  // 30일 후
  status: 'pending' | 'cancelled' | 'completed';
  cancelledAt?: Timestamp;
  completedAt?: Timestamp;
  verificationToken: string;
  ipAddress?: string;
}

type DeletionReasonCategory =
  | 'not_useful'
  | 'privacy_concerns'
  | 'switching_service'
  | 'too_many_emails'
  | 'difficult_to_use'
  | 'other';
```

### 26.2 계정 삭제 데이터 플로우

```
[삭제 요청]
    │
    ├─ 계정 설정 → [계정 삭제] 섹션
    │
    ├─ 현재 비밀번호 입력 (본인 확인)
    │
    ├─ 탈퇴 사유 선택 (선택사항)
    │
    ├─ requestAccountDeletion(input)
    │  ├─ reauthenticateWithCredential 본인 확인
    │  ├─ 예정 삭제일 = now + 30일
    │  ├─ verificationToken 생성
    │  ├─ Firebase: deletionRequests/{id} 저장
    │  └─ Auth displayName에 [DELETION_PENDING] 마크
    │
    └─ toast: '30일 후 완전히 삭제됩니다'

[삭제 취소]
    │
    ├─ 계정 설정 → [삭제 취소] 버튼
    │
    ├─ cancelDeletionRequest(requestId)
    │  ├─ status: 'pending' → 'cancelled'
    │  ├─ cancelledAt 기록
    │  └─ displayName에서 [DELETION_PENDING] 제거
    │
    └─ toast: '삭제 요청이 취소되었습니다'

[자동 삭제 - Cloud Function]
    │
    ├─ 매일 자정 실행
    │
    ├─ scheduledDeletionAt <= now인 pending 요청 조회
    │
    ├─ completeAccountDeletion()
    │  ├─ Firestore users/{userId} 삭제
    │  ├─ 서브컬렉션 삭제:
    │  │  consents, securitySettings, tournaments,
    │  │  myApplications, myWorkSessions, settings
    │  ├─ status: 'completed'
    │  └─ completedAt 기록
    │
    └─ Firebase Auth 계정 삭제
```

### 26.3 useAccountDeletion Hook

```typescript
const {
  deletionRequest,     // 현재 삭제 요청
  loading,             // 로딩 상태
  error,               // 에러
  isPending,           // 삭제 요청 대기 중 여부
  remainingDays,       // 남은 일수
  scheduledDate,       // 예정 삭제일
  requestDeletion,     // 요청 함수
  cancelDeletion,      // 취소 함수
} = useAccountDeletion();
```

---

## 27. 관련 문서

- [01-architecture.md](./01-architecture.md) - 아키텍처 설계
- [DATA_SCHEMA.md](../../docs/reference/DATA_SCHEMA.md) - Firestore 스키마 상세
- [09-error-handling.md](./09-error-handling.md) - 에러 처리 전략
- [12-security.md](./12-security.md) - 보안 설계
- [05-components.md](./05-components.md) - 컴포넌트 시스템
- [22-migration-mapping.md](./22-migration-mapping.md) - 코드 변환 가이드

---

*마지막 업데이트: 2025-01-17*
