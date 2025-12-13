# 23. Firestore 스키마 및 API 참조

## 목차
1. [개요](#1-개요)
2. [Firestore 컬렉션 구조](#2-firestore-컬렉션-구조)
3. [핵심 스키마 정의](#3-핵심-스키마-정의)
4. [쿼리 패턴](#4-쿼리-패턴)
5. [인덱스 설정](#5-인덱스-설정)
6. [보안 규칙](#6-보안-규칙)
7. [API 엔드포인트](#7-api-엔드포인트)
8. [에러 코드](#8-에러-코드)

---

## 1. 개요

### 데이터베이스 구조

```
Firebase Project: tholdem-ebc18
├── Firestore Database
│   ├── users/              # 사용자 정보
│   ├── staff/              # 스태프 프로필
│   ├── jobPostings/        # 구인공고
│   ├── applications/       # 지원서
│   ├── workLogs/           # 근무 기록
│   ├── attendanceRecords/  # 출퇴근 기록
│   ├── notifications/      # 알림
│   ├── tournaments/        # 토너먼트 (비활성화)
│   ├── payments/           # 결제 기록
│   ├── chips/              # 칩 거래
│   └── inquiries/          # 문의사항
│
├── Authentication
│   ├── Email/Password
│   ├── Google OAuth
│   └── Kakao OAuth
│
├── Cloud Functions
│   ├── 푸시 알림
│   ├── 결제 웹훅
│   └── 예약 작업
│
└── Cloud Storage
    ├── profileImages/
    └── documents/
```

### 표준화된 필드 규칙

```yaml
ID 필드:
  - 문서 ID: id (자동 생성 또는 UUID)
  - 사용자 참조: userId
  - 스태프 참조: staffId
  - 공고 참조: eventId 또는 postId
  - 지원서 참조: applicationId

시간 필드:
  - 생성일: createdAt (Timestamp)
  - 수정일: updatedAt (Timestamp)
  - 예정 시간: scheduledStartTime, scheduledEndTime
  - 실제 시간: actualStartTime, actualEndTime

상태 필드:
  - status: enum 문자열 (예: 'active', 'inactive')
  - isActive: boolean (간단한 활성화 여부)

네이밍:
  - camelCase 사용
  - 명확한 의미 전달 (startTime vs time)
```

---

## 2. Firestore 컬렉션 구조

### 2.1 users (사용자)

```typescript
interface User {
  // === 기본 정보 ===
  id: string                    // Firebase Auth UID
  email: string                 // 이메일 (고유)
  name: string                  // 실명
  nickname?: string             // 닉네임

  // === 역할 및 권한 ===
  role: 'admin' | 'manager' | 'dealer' | 'staff' | 'user'
  isActive: boolean             // 활성 상태

  // === 연락처 ===
  phone?: string                // 전화번호 (010-0000-0000)
  phoneVerified?: boolean       // 전화번호 인증 여부

  // === 프로필 ===
  profileImage?: string         // Storage URL
  bio?: string                  // 자기소개

  // === 칩 (앱 내 화폐) ===
  chipBalance: number           // 현재 칩 잔액

  // === 알림 설정 ===
  notificationSettings: {
    push: boolean               // 푸시 알림
    email: boolean              // 이메일 알림
    sms: boolean                // SMS 알림
  }

  // === FCM 토큰 ===
  fcmTokens?: Array<{
    token: string
    platform: 'ios' | 'android' | 'web'
    updatedAt: Timestamp
  }>

  // === 동의 정보 ===
  consents: {
    termsOfService: { agreed: boolean; agreedAt: Timestamp }
    privacyPolicy: { agreed: boolean; agreedAt: Timestamp }
    marketing?: { agreed: boolean; agreedAt: Timestamp }
  }

  // === 보안 ===
  lastLoginAt?: Timestamp
  loginHistory?: Array<{
    timestamp: Timestamp
    platform: string
    ip?: string
  }>

  // === 메타데이터 ===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.2 staff (스태프 프로필)

```typescript
interface Staff {
  // === 기본 정보 ===
  id: string                    // 스태프 고유 ID
  userId: string                // Firebase Auth UID 참조
  name: string                  // 이름
  phone: string                 // 연락처

  // === 역할 및 상태 ===
  role: 'dealer' | 'manager' | 'chiprunner' | 'admin'
  status: 'active' | 'inactive'

  // === 연락처 ===
  email?: string

  // === 계좌 정보 (정산용) ===
  bankName?: string             // 은행명
  accountNumber?: string        // 계좌번호
  accountHolder?: string        // 예금주

  // === 경력 정보 ===
  experience?: {
    years: number               // 경력 년수
    specialties: string[]       // 전문 분야
    certifications?: string[]   // 자격증
  }

  // === 평가 ===
  rating?: {
    average: number             // 평균 평점 (1-5)
    count: number               // 평가 수
  }

  // === 비고 ===
  notes?: string

  // === 메타데이터 ===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### staff/{staffId}/qrCodes (서브컬렉션)

```typescript
interface StaffQRCode {
  id: string
  qrData: string                // QR 코드 데이터 (암호화)
  createdAt: Timestamp
  expiresAt?: Timestamp
  isActive: boolean
}
```

### 2.3 jobPostings (구인공고)

```typescript
interface JobPosting {
  // === 기본 정보 ===
  id: string
  title: string                 // 공고 제목
  description: string           // 상세 설명

  // === 공고 타입 ===
  postingType: 'regular' | 'fixed' | 'tournament' | 'urgent'

  // === 위치 정보 ===
  location: string              // 지역명
  district?: string             // 시/군/구
  detailedAddress?: string      // 상세 주소

  // === 연락처 ===
  contactPhone?: string

  // === 모집 조건 ===
  dateSpecificRequirements: Array<{
    date: string                // YYYY-MM-DD
    timeSlots: Array<{
      startTime: string         // HH:mm
      endTime: string           // HH:mm
      roles: Array<{
        role: string            // 역할명
        count: number           // 모집 인원
      }>
    }>
  }>

  requiredRoles?: string[]      // 모집 역할 목록

  // === 급여 정보 ===
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other'
  salaryAmount?: string

  useRoleSalary?: boolean       // 역할별 급여 사용
  roleSalaries?: {
    [role: string]: {
      salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other'
      salaryAmount: string
    }
  }

  // === 복리후생 ===
  benefits?: {
    meals: boolean              // 식사 제공
    parking: boolean            // 주차 지원
    transportation: boolean     // 교통비 지원
    accommodation: boolean      // 숙박 지원
    other?: string              // 기타 복리후생
  }

  // === 세금 설정 ===
  taxSettings?: {
    enabled: boolean
    taxRate?: number            // 세율 (%)
    taxAmount?: number          // 고정 세금
  }

  // === 사전 질문 ===
  usesPreQuestions?: boolean
  preQuestions?: Array<{
    id: string
    question: string
    required: boolean
    type: 'text' | 'select' | 'multiselect'
    options?: string[]
  }>

  // === 상태 관리 ===
  status: 'open' | 'closed'
  autoManageStatus?: boolean    // 자동 상태 관리

  statusChangeReason?: string
  statusChangedAt?: Timestamp
  statusChangedBy?: string

  // === 지원자 관리 ===
  applicants?: string[]         // 지원자 ID 목록
  confirmedStaff?: Array<{
    staffId: string
    date: string
    role: string
    timeSlot: string
    confirmedAt: Timestamp
  }>

  // === 고정 공고 설정 ===
  fixedConfig?: {
    durationDays: 7 | 30 | 90
    chipCost: 3 | 5 | 10
    expiresAt: Timestamp
    createdAt: Timestamp
  }

  fixedData?: {
    workSchedule: {
      daysPerWeek: number
      startTime: string
      endTime: string
    }
    requiredRolesWithCount: Array<{
      name: string
      count: number
    }>
    viewCount: number
  }

  // === 대회 공고 설정 ===
  tournamentConfig?: {
    approvalStatus: 'pending' | 'approved' | 'rejected'
    approvedBy?: string
    approvedAt?: Timestamp
    rejectedBy?: string
    rejectedAt?: Timestamp
    rejectionReason?: string
    submittedAt: Timestamp
  }

  // === 긴급 공고 설정 ===
  urgentConfig?: {
    chipCost: 5
    createdAt: Timestamp
    priority: 'high'
  }

  // === 칩 비용 ===
  chipCost?: number
  isChipDeducted: boolean

  // === 작성자 정보 ===
  createdBy: string             // userId
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.4 applications (지원서)

```typescript
interface Application {
  // === 기본 정보 ===
  id: string
  applicantId: string           // userId
  applicantName: string
  applicantEmail?: string
  applicantPhone?: string

  // === 공고 정보 ===
  eventId: string               // jobPostingId (표준 필드)
  postId: string                // 하위 호환성
  postTitle: string

  // === 상태 ===
  status: 'applied' | 'confirmed' | 'cancelled' | 'pending' | 'pending_confirmation'
  recruitmentType?: 'event' | 'fixed'

  // === 배정 정보 (Single Source of Truth) ===
  assignments: Array<{
    role?: string               // 단일 역할
    roles?: string[]            // 다중 역할
    timeSlot: string            // 시간대
    dates: string[]             // 날짜 배열
    isGrouped: boolean          // 그룹 여부
    groupId?: string            // 그룹 ID
    checkMethod?: 'group' | 'individual'
    requirementId?: string
    duration?: {
      type: 'single' | 'consecutive' | 'multi'
      startDate: string
      endDate?: string
    }
  }>

  // === 원본 지원 정보 (이력 추적) ===
  originalApplication?: {
    assignments: Assignment[]
    appliedAt: Timestamp
  }

  // === 확정 이력 ===
  confirmationHistory?: Array<{
    confirmedAt: Timestamp
    cancelledAt?: Timestamp
    assignments: Assignment[]
  }>

  // === 사전 질문 답변 ===
  preQuestionAnswers?: Array<{
    questionId: string
    question: string
    answer: string
    required: boolean
  }>

  // === 비고 ===
  notes?: string

  // === 메타데이터 ===
  appliedAt: Timestamp
  confirmedAt?: Timestamp
  cancelledAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.5 workLogs (근무 기록)

```typescript
interface WorkLog {
  // === 기본 정보 ===
  id: string
  staffId: string               // staff 문서 ID
  eventId?: string              // jobPosting ID (선택)

  // === 근무 일시 ===
  date: string                  // YYYY-MM-DD

  // === 예정 시간 ===
  scheduledStartTime?: string   // HH:mm
  scheduledEndTime?: string     // HH:mm

  // === 실제 시간 ===
  actualStartTime?: string | Timestamp
  actualEndTime?: string | Timestamp

  // === 근무 정보 ===
  role?: string                 // 역할
  tableNumber?: number          // 테이블 번호

  // === 상태 ===
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'

  // === 정산 정보 ===
  payroll?: {
    baseSalary: number          // 기본급
    overtime?: number           // 초과근무
    deductions?: number         // 공제
    bonus?: number              // 보너스
    total: number               // 총액
    isPaid: boolean             // 지급 여부
    paidAt?: Timestamp
  }

  // === 비고 ===
  notes?: string

  // === 메타데이터 ===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.6 attendanceRecords (출퇴근 기록)

```typescript
interface AttendanceRecord {
  // === 기본 정보 ===
  id: string
  staffId: string
  eventId?: string              // jobPosting ID
  workLogId?: string            // workLog 참조

  // === 날짜 ===
  date: string                  // YYYY-MM-DD

  // === 상태 ===
  status: 'not_started' | 'checked_in' | 'checked_out'

  // === 출퇴근 시간 ===
  checkInTime?: Timestamp
  checkOutTime?: Timestamp

  // === QR 코드 정보 ===
  qrCodeId?: string
  checkInMethod?: 'qr' | 'manual' | 'gps'
  checkOutMethod?: 'qr' | 'manual' | 'gps'

  // === 위치 정보 ===
  checkInLocation?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  checkOutLocation?: {
    latitude: number
    longitude: number
    accuracy: number
  }

  // === 비고 ===
  notes?: string
  adminNotes?: string           // 관리자 메모

  // === 메타데이터 ===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.7 notifications (알림)

```typescript
interface Notification {
  // === 기본 정보 ===
  id: string
  userId: string                // 수신자

  // === 알림 내용 ===
  type: 'application' | 'confirmation' | 'cancellation' |
        'payment' | 'system' | 'reminder' | 'announcement'
  title: string
  body: string

  // === 관련 데이터 ===
  data?: {
    eventId?: string
    applicationId?: string
    paymentId?: string
    [key: string]: string | undefined
  }

  // === 상태 ===
  isRead: boolean
  readAt?: Timestamp

  // === 딥링크 ===
  actionUrl?: string            // 앱 내 이동 경로

  // === 메타데이터 ===
  createdAt: Timestamp
}
```

### 2.8 payments (결제 기록)

```typescript
interface Payment {
  // === 기본 정보 ===
  id: string
  userId: string

  // === 결제 정보 ===
  type: 'chip_purchase' | 'subscription' | 'refund'
  amount: number                // 결제 금액 (원)
  chipAmount?: number           // 충전 칩 수량

  // === 결제 수단 ===
  method: 'card' | 'transfer' | 'virtual_account' | 'phone'

  // === 상태 ===
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'

  // === 토스페이먼츠 연동 ===
  tossPaymentKey?: string
  tossOrderId?: string
  tossReceipt?: string

  // === 환불 정보 ===
  refund?: {
    amount: number
    reason: string
    refundedAt: Timestamp
    refundedBy?: string
  }

  // === 메타데이터 ===
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt?: Timestamp
}
```

### 2.9 chips (칩 거래 내역)

```typescript
interface ChipTransaction {
  // === 기본 정보 ===
  id: string
  userId: string

  // === 거래 정보 ===
  type: 'purchase' | 'spend' | 'refund' | 'bonus' | 'admin_grant'
  amount: number                // 칩 수량 (양수: 획득, 음수: 사용)
  balanceAfter: number          // 거래 후 잔액

  // === 사유 ===
  reason: string                // 거래 사유
  referenceId?: string          // 관련 문서 ID (paymentId, jobPostingId 등)
  referenceType?: 'payment' | 'jobPosting' | 'admin'

  // === 메타데이터 ===
  createdAt: Timestamp
  createdBy?: string            // admin grant의 경우 admin userId
}
```

### 2.10 inquiries (문의사항)

```typescript
interface Inquiry {
  // === 기본 정보 ===
  id: string
  userId: string

  // === 문의 내용 ===
  category: 'general' | 'payment' | 'technical' | 'report' | 'other'
  subject: string
  content: string

  // === 첨부파일 ===
  attachments?: Array<{
    url: string
    filename: string
    size: number
  }>

  // === 상태 ===
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'

  // === 답변 ===
  responses?: Array<{
    content: string
    respondedBy: string         // admin userId
    respondedAt: Timestamp
  }>

  // === 메타데이터 ===
  createdAt: Timestamp
  updatedAt: Timestamp
  resolvedAt?: Timestamp
}
```

---

## 3. 핵심 스키마 정의

### 3.1 Zod 스키마 (검증용)

```typescript
// src/schemas/user.schema.ts
import { z } from 'zod'

export const userProfileSchema = z.object({
  name: z.string()
    .min(2, '이름은 2자 이상')
    .max(50, '이름은 50자 이하'),
  nickname: z.string()
    .min(2, '닉네임은 2자 이상')
    .max(20, '닉네임은 20자 이하')
    .optional(),
  phone: z.string()
    .regex(/^01[0-9]-\d{3,4}-\d{4}$/, '올바른 전화번호 형식 (010-0000-0000)')
    .optional(),
  bio: z.string()
    .max(500, '자기소개는 500자 이하')
    .optional(),
})

// src/schemas/jobPosting.schema.ts
export const jobPostingSchema = z.object({
  title: z.string()
    .min(5, '제목은 5자 이상')
    .max(100, '제목은 100자 이하'),
  description: z.string()
    .min(20, '설명은 20자 이상')
    .max(2000, '설명은 2000자 이하'),
  location: z.string()
    .min(2, '위치를 입력하세요'),
  postingType: z.enum(['regular', 'fixed', 'tournament', 'urgent']),
  salaryType: z.enum(['hourly', 'daily', 'monthly', 'negotiable', 'other'])
    .optional(),
  salaryAmount: z.string()
    .regex(/^\d+$/, '숫자만 입력')
    .optional(),
  dateSpecificRequirements: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlots: z.array(z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      roles: z.array(z.object({
        role: z.string(),
        count: z.number().min(1),
      })),
    })),
  })).min(1, '최소 1개 날짜 필요'),
})

// src/schemas/application.schema.ts
export const applicationSchema = z.object({
  eventId: z.string().min(1),
  assignments: z.array(z.object({
    role: z.string().optional(),
    roles: z.array(z.string()).optional(),
    timeSlot: z.string().min(1),
    dates: z.array(z.string()).min(1),
    isGrouped: z.boolean(),
  })).min(1, '최소 1개 선택 필요'),
  preQuestionAnswers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
  })).optional(),
})
```

### 3.2 타입 가드 함수

```typescript
// src/types/guards.ts

// User 역할 검증
export function isAdmin(user: User): boolean {
  return user.role === 'admin'
}

export function isManager(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

export function isStaff(user: User): boolean {
  return ['admin', 'manager', 'dealer', 'staff'].includes(user.role)
}

// JobPosting 타입 검증
export function isFixedPosting(posting: JobPosting): posting is FixedJobPosting {
  return posting.postingType === 'fixed' &&
    posting.fixedConfig !== undefined &&
    posting.fixedData !== undefined
}

export function isTournamentPosting(posting: JobPosting): boolean {
  return posting.postingType === 'tournament' &&
    posting.tournamentConfig !== undefined
}

export function isUrgentPosting(posting: JobPosting): boolean {
  return posting.postingType === 'urgent'
}

// Application 상태 검증
export function isConfirmedApplication(app: Application): boolean {
  return app.status === 'confirmed'
}

export function isPendingApplication(app: Application): boolean {
  return app.status === 'applied' || app.status === 'pending'
}
```

---

## 4. 쿼리 패턴

### 4.1 구인공고 조회

```typescript
// 활성 공고 목록 (페이지네이션)
const getActiveJobPostings = async (
  lastDoc?: QueryDocumentSnapshot,
  limit: number = 20
): Promise<{ postings: JobPosting[], lastDoc: QueryDocumentSnapshot | null }> => {
  let q = query(
    collection(db, 'jobPostings'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
    limit(limit)
  )

  if (lastDoc) {
    q = query(q, startAfter(lastDoc))
  }

  const snapshot = await getDocs(q)
  const postings = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobPosting[]

  return {
    postings,
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
  }
}

// 지역별 필터링
const getPostingsByLocation = async (location: string): Promise<JobPosting[]> => {
  const q = query(
    collection(db, 'jobPostings'),
    where('status', '==', 'open'),
    where('location', '==', location),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobPosting[]
}

// 내 공고 조회
const getMyPostings = async (userId: string): Promise<JobPosting[]> => {
  const q = query(
    collection(db, 'jobPostings'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobPosting[]
}
```

### 4.2 지원서 조회

```typescript
// 내 지원 목록
const getMyApplications = async (userId: string): Promise<Application[]> => {
  const q = query(
    collection(db, 'applications'),
    where('applicantId', '==', userId),
    orderBy('appliedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Application[]
}

// 공고별 지원자 목록
const getApplicationsByPosting = async (eventId: string): Promise<Application[]> => {
  const q = query(
    collection(db, 'applications'),
    where('eventId', '==', eventId),
    orderBy('appliedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Application[]
}

// 상태별 지원서 조회
const getApplicationsByStatus = async (
  eventId: string,
  status: Application['status']
): Promise<Application[]> => {
  const q = query(
    collection(db, 'applications'),
    where('eventId', '==', eventId),
    where('status', '==', status),
    orderBy('appliedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Application[]
}
```

### 4.3 근무 기록 조회

```typescript
// 스태프별 근무 기록
const getWorkLogsByStaff = async (
  staffId: string,
  dateRange?: { start: string, end: string }
): Promise<WorkLog[]> => {
  let q = query(
    collection(db, 'workLogs'),
    where('staffId', '==', staffId),
    orderBy('date', 'desc')
  )

  if (dateRange) {
    q = query(q,
      where('date', '>=', dateRange.start),
      where('date', '<=', dateRange.end)
    )
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WorkLog[]
}

// 날짜별 근무 기록
const getWorkLogsByDate = async (date: string): Promise<WorkLog[]> => {
  const q = query(
    collection(db, 'workLogs'),
    where('date', '==', date),
    orderBy('scheduledStartTime', 'asc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WorkLog[]
}
```

### 4.4 실시간 구독

```typescript
// 공고 실시간 구독
const subscribeToJobPosting = (
  postingId: string,
  callback: (posting: JobPosting | null) => void
): () => void => {
  const docRef = doc(db, 'jobPostings', postingId)

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as JobPosting)
    } else {
      callback(null)
    }
  }, (error) => {
    logger.error('JobPosting subscription error', error)
    callback(null)
  })
}

// 알림 실시간 구독
const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): () => void => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[]
    callback(notifications)
  }, (error) => {
    logger.error('Notifications subscription error', error)
    callback([])
  })
}
```

---

## 5. 인덱스 설정

### 5.1 복합 인덱스 (firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "location", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "applicantId", "order": "ASCENDING" },
        { "fieldPath": "appliedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "appliedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "workLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "staffId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 6. 보안 규칙

### 6.1 Firestore 보안 규칙

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 헬퍼 함수
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isManagerOrAdmin() {
      let role = get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
      return isAuthenticated() && (role == 'admin' || role == 'manager');
    }

    // users 컬렉션
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // staff 컬렉션
    match /staff/{staffId} {
      allow read: if isAuthenticated();
      allow write: if isManagerOrAdmin();

      // QR 코드 서브컬렉션
      match /qrCodes/{qrId} {
        allow read: if isAuthenticated();
        allow write: if isManagerOrAdmin();
      }
    }

    // jobPostings 컬렉션
    match /jobPostings/{postingId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
        request.resource.data.createdBy == request.auth.uid;
      allow update: if isAuthenticated() &&
        (resource.data.createdBy == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    // applications 컬렉션
    match /applications/{applicationId} {
      allow read: if isAuthenticated() &&
        (resource.data.applicantId == request.auth.uid ||
         isManagerOrAdmin());
      allow create: if isAuthenticated() &&
        request.resource.data.applicantId == request.auth.uid;
      allow update: if isAuthenticated() &&
        (resource.data.applicantId == request.auth.uid ||
         isManagerOrAdmin());
      allow delete: if isAdmin();
    }

    // workLogs 컬렉션
    match /workLogs/{workLogId} {
      allow read: if isAuthenticated();
      allow write: if isManagerOrAdmin();
    }

    // attendanceRecords 컬렉션
    match /attendanceRecords/{recordId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() &&
        (resource.data.staffId == request.auth.uid ||
         isManagerOrAdmin());
      allow delete: if isAdmin();
    }

    // notifications 컬렉션
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
      allow delete: if isOwner(resource.data.userId);
    }

    // payments 컬렉션
    match /payments/{paymentId} {
      allow read: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin();
      allow delete: if false; // 결제 기록은 삭제 불가
    }

    // chips 컬렉션
    match /chips/{chipId} {
      allow read: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if false; // 칩 거래 기록은 수정/삭제 불가
    }

    // inquiries 컬렉션
    match /inquiries/{inquiryId} {
      allow read: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }
  }
}
```

---

## 7. API 엔드포인트

### 7.1 Cloud Functions

```typescript
// functions/src/index.ts

// === 푸시 알림 ===

// 지원서 확정 알림
export const onApplicationConfirmed = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()

    // 상태가 confirmed로 변경된 경우
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
      await sendPushNotification({
        userId: after.applicantId,
        title: '지원 확정!',
        body: `${after.postTitle} 공고에 확정되었습니다.`,
        data: {
          type: 'confirmation',
          applicationId: context.params.applicationId,
          eventId: after.eventId,
        }
      })
    }
  })

// 새 지원 알림 (구인자에게)
export const onNewApplication = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snapshot, context) => {
    const application = snapshot.data()

    // 공고 작성자 조회
    const postingDoc = await admin.firestore()
      .collection('jobPostings')
      .doc(application.eventId)
      .get()

    if (postingDoc.exists) {
      const posting = postingDoc.data()
      await sendPushNotification({
        userId: posting.createdBy,
        title: '새 지원자!',
        body: `${application.applicantName}님이 지원했습니다.`,
        data: {
          type: 'application',
          applicationId: context.params.applicationId,
          eventId: application.eventId,
        }
      })
    }
  })

// === 결제 웹훅 ===

// 토스페이먼츠 결제 확인
export const confirmTossPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다')
  }

  const { paymentKey, orderId, amount } = data

  try {
    // 토스페이먼츠 API 호출
    const response = await axios.post(
      'https://api.tosspayments.com/v1/payments/confirm',
      { paymentKey, orderId, amount },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        }
      }
    )

    // 결제 기록 저장
    await admin.firestore().collection('payments').doc(orderId).update({
      status: 'completed',
      tossPaymentKey: paymentKey,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 칩 충전
    const payment = (await admin.firestore().collection('payments').doc(orderId).get()).data()
    await admin.firestore().collection('users').doc(context.auth.uid).update({
      chipBalance: admin.firestore.FieldValue.increment(payment.chipAmount),
    })

    // 칩 거래 기록
    await admin.firestore().collection('chips').add({
      userId: context.auth.uid,
      type: 'purchase',
      amount: payment.chipAmount,
      reason: '칩 구매',
      referenceId: orderId,
      referenceType: 'payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { success: true }
  } catch (error) {
    throw new functions.https.HttpsError('internal', '결제 처리 실패')
  }
})

// === 스케줄 함수 ===

// 만료된 고정 공고 자동 종료
export const expireFixedPostings = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now()

    const expiredPostings = await admin.firestore()
      .collection('jobPostings')
      .where('postingType', '==', 'fixed')
      .where('status', '==', 'open')
      .where('fixedConfig.expiresAt', '<=', now)
      .get()

    const batch = admin.firestore().batch()

    expiredPostings.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'closed',
        statusChangeReason: '기간 만료',
        statusChangedAt: now,
      })
    })

    await batch.commit()
    console.log(`${expiredPostings.size} postings expired`)
  })
```

---

## 8. 에러 코드

### 8.1 에러 코드 정의

```typescript
// src/lib/errors/codes.ts

export const ErrorCodes = {
  // === 인증 (1xxx) ===
  AUTH_INVALID_CREDENTIALS: 'E1001',
  AUTH_SESSION_EXPIRED: 'E1002',
  AUTH_UNAUTHORIZED: 'E1003',
  AUTH_EMAIL_NOT_VERIFIED: 'E1004',
  AUTH_ACCOUNT_DISABLED: 'E1005',

  // === 검증 (2xxx) ===
  VALIDATION_REQUIRED_FIELD: 'E2001',
  VALIDATION_INVALID_FORMAT: 'E2002',
  VALIDATION_MIN_LENGTH: 'E2003',
  VALIDATION_MAX_LENGTH: 'E2004',
  VALIDATION_XSS_DETECTED: 'E2005',

  // === 비즈니스 로직 (3xxx) ===
  BUSINESS_INSUFFICIENT_CHIPS: 'E3001',
  BUSINESS_ALREADY_APPLIED: 'E3002',
  BUSINESS_POSTING_CLOSED: 'E3003',
  BUSINESS_APPLICATION_NOT_FOUND: 'E3004',
  BUSINESS_STAFF_NOT_FOUND: 'E3005',

  // === 결제 (4xxx) ===
  PAYMENT_FAILED: 'E4001',
  PAYMENT_CANCELLED: 'E4002',
  PAYMENT_REFUND_FAILED: 'E4003',
  PAYMENT_INVALID_AMOUNT: 'E4004',

  // === Firebase (5xxx) ===
  FIREBASE_PERMISSION_DENIED: 'E5001',
  FIREBASE_NOT_FOUND: 'E5002',
  FIREBASE_QUOTA_EXCEEDED: 'E5003',
  FIREBASE_NETWORK_ERROR: 'E5004',

  // === 보안 (6xxx) ===
  SECURITY_INTEGRITY_FAILED: 'E6001',
  SECURITY_CERTIFICATE_INVALID: 'E6002',
  SECURITY_RATE_LIMIT: 'E6003',

  // === 네트워크 (7xxx) ===
  NETWORK_OFFLINE: 'E7001',
  NETWORK_TIMEOUT: 'E7002',
  NETWORK_SERVER_ERROR: 'E7003',

  // === 알 수 없음 (9xxx) ===
  UNKNOWN: 'E9999',
} as const

// 에러 메시지 매핑
export const ErrorMessages: Record<string, string> = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: '세션이 만료되었습니다. 다시 로그인해주세요',
  [ErrorCodes.AUTH_UNAUTHORIZED]: '접근 권한이 없습니다',
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: '이메일 인증이 필요합니다',
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: '계정이 비활성화되었습니다',

  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: '필수 항목을 입력해주세요',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: '올바른 형식으로 입력해주세요',
  [ErrorCodes.VALIDATION_XSS_DETECTED]: '허용되지 않는 문자가 포함되어 있습니다',

  [ErrorCodes.BUSINESS_INSUFFICIENT_CHIPS]: '칩이 부족합니다',
  [ErrorCodes.BUSINESS_ALREADY_APPLIED]: '이미 지원한 공고입니다',
  [ErrorCodes.BUSINESS_POSTING_CLOSED]: '마감된 공고입니다',
  [ErrorCodes.BUSINESS_APPLICATION_NOT_FOUND]: '지원서를 찾을 수 없습니다',

  [ErrorCodes.PAYMENT_FAILED]: '결제에 실패했습니다',
  [ErrorCodes.PAYMENT_CANCELLED]: '결제가 취소되었습니다',

  [ErrorCodes.FIREBASE_PERMISSION_DENIED]: '접근 권한이 없습니다',
  [ErrorCodes.FIREBASE_NOT_FOUND]: '요청한 데이터를 찾을 수 없습니다',

  [ErrorCodes.SECURITY_INTEGRITY_FAILED]: '보안 검증에 실패했습니다',
  [ErrorCodes.SECURITY_RATE_LIMIT]: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',

  [ErrorCodes.NETWORK_OFFLINE]: '인터넷 연결을 확인해주세요',
  [ErrorCodes.NETWORK_TIMEOUT]: '요청 시간이 초과되었습니다',

  [ErrorCodes.UNKNOWN]: '문제가 발생했습니다. 잠시 후 다시 시도해주세요',
}
```

---

## 요약

### 핵심 컬렉션 관계도

```
users (1)
  └─── staff (1) ──── qrCodes (N)
  │
  └─── applications (N) ──── jobPostings (1)
  │
  └─── workLogs (N)
  │
  └─── attendanceRecords (N)
  │
  └─── notifications (N)
  │
  └─── payments (N) ──── chips (N)
  │
  └─── inquiries (N)
```

### 표준 필드 규칙

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 문서 고유 ID |
| `userId` | string | 사용자 참조 |
| `staffId` | string | 스태프 참조 |
| `eventId` | string | 공고 참조 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |
| `status` | string | 상태 enum |

---

## 관련 문서

- [00-overview.md](./00-overview.md) - 프로젝트 개요
- [06-firebase.md](./06-firebase.md) - Firebase 연동 전략
- [12-security.md](./12-security.md) - 보안 설계
- [22-migration-mapping.md](./22-migration-mapping.md) - 마이그레이션 매핑
