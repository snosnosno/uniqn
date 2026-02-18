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

### Role 타입 정의 (중요)

시스템에는 두 가지 다른 Role 개념이 존재합니다:

```typescript
// src/types/roles.ts

/**
 * UserRole: 시스템 내 사용자의 권한 등급
 * - users 컬렉션에서 사용
 * - 앱 접근 권한 및 기능 제어에 사용
 *
 * 권한 체계:
 * - guest (비로그인): role === null → 공고 목록만 조회 가능
 * - staff (기본 가입자): 공고 검색/상세/지원, QR 출퇴근, 내 스케줄
 * - employer (구인자): staff 권한 + 공고 작성/관리, 지원자 확정/거절, 정산
 * - admin (관리자): 모든 권한 + 사용자 관리, 시스템 설정
 */
export type UserRole = 'staff' | 'employer' | 'admin'

export const UserRoleHierarchy = {
  admin: 100,     // 시스템 관리자 (전체 권한)
  employer: 50,   // 구인자 (공고 관리 + staff 권한)
  staff: 10,      // 기본 가입자 (지원, 출퇴근)
  // guest: 0     // 비로그인 (role === null)
} as const

export const UserRoleDescriptions = {
  admin: '시스템 관리자 - 모든 권한',
  employer: '구인자 - 공고 작성 및 지원자 관리',
  staff: '스태프 - 공고 지원 및 근무',
} as const

/**
 * StaffRole: 근무 시 담당하는 직무/포지션
 * - staff 컬렉션, workLogs, applications에서 사용
 * - 구인공고 모집 역할 및 근무 배정에 사용
 */
export type StaffRole =
  | 'dealer'      // 딜러
  | 'floor'       // 플로어
  | 'td'          // Tournament Director (토너먼트 디렉터)
  | 'dc'          // Dealer Coordinator (딜러 코디네이터)
  | 'chips'       // Chip Master (칩 마스터)
  | 'register'    // 레지스터 (접수/등록)
  | 'serving'     // 서빙
  | 'guard'       // 가드 (경호/보안)
  | 'manager'     // 매니저

export const StaffRoleLabels: Record<StaffRole, string> = {
  dealer: '딜러',
  floor: '플로어',
  td: '토너먼트 디렉터',
  dc: '딜러 코디네이터',
  chips: '칩 마스터',
  register: '레지스터',
  serving: '서빙',
  guard: '가드',
  manager: '매니저',
} as const

// 역할별 우선순위 (정산/배치 시 참고)
export const StaffRolePriority: Record<StaffRole, number> = {
  td: 9,        // 최고 책임자
  manager: 8,
  dc: 7,
  floor: 6,
  chips: 5,
  dealer: 4,
  register: 3,
  serving: 2,
  guard: 1,
} as const

// 타입 가드
export function isValidUserRole(role: string): role is UserRole {
  return ['admin', 'employer', 'staff'].includes(role)
}

// Guest 여부 확인 (role이 null이면 guest)
export function isGuest(role: UserRole | null): boolean {
  return role === null
}

const STAFF_ROLES: StaffRole[] = ['dealer', 'floor', 'td', 'dc', 'chips', 'register', 'serving', 'guard', 'manager']

export function isValidStaffRole(role: string): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole)
}
```

### users vs staff 컬렉션 책임 분리

| 구분 | users 컬렉션 | staff 컬렉션 |
|------|-------------|--------------|
| **목적** | 시스템 사용자 계정 | 스태프 프로필/이력 |
| **1:1 관계** | Firebase Auth UID | userId로 users 참조 |
| **Role 의미** | 시스템 접근 권한 (UserRole) | 근무 직무 (StaffRole) |
| **생성 시점** | 회원가입 시 자동 (staff 기본) | 스태프 등록 시 수동 |
| **필수 여부** | 모든 사용자 | 스태프로 활동하는 사용자만 |
| **주요 필드** | email, consents | bankName, experience, rating |

```
Guest (비로그인)
└── users/       →  (없음, role === null)

사용자 A (기본 가입자 - 공고 지원만)
├── users/userA  →  role: 'staff' (기본값)
└── staff/staffA →  role: 'dealer' (직무), userId: 'userA'

사용자 B (구인자 - 공고 작성/관리)
├── users/userB  →  role: 'employer'
└── staff/       →  (없음, 직접 근무하지 않음)

사용자 C (관리자)
├── users/userC  →  role: 'admin'
└── staff/staffC →  role: 'td' (직무), userId: 'userC' (선택적)
```

### 역할 업그레이드 플로우

```
┌─────────────────────────────────────────────────────────────┐
│                     역할 업그레이드 플로우                    │
└─────────────────────────────────────────────────────────────┘

Guest (비로그인)
    │
    │ 회원가입
    ▼
Staff (기본 가입자, role: 'staff')
    │
    │ 공고 작성 요청 시 → 사업자 등록 인증
    ▼
Employer (구인자, role: 'employer')
    │
    │ 관리자 승인
    ▼
Admin (관리자, role: 'admin') - 일반적으로 수동 부여
```

### Service 네이밍 컨벤션

```yaml
Service 파일명 규칙:
  기본형: "{도메인}Service.ts"
  예시:
    - jobPostingService.ts       # 구인공고 CRUD
    - applicationService.ts      # 지원서 관리
    - attendanceService.ts       # 출퇴근 관리
    - paymentService.ts          # 결제 처리

금지 패턴:
  - jobPostingCreateService.ts   # ❌ 동작을 파일명에 포함하지 않음
  - createJobPosting.ts          # ❌ 동사로 시작하지 않음
  - JobPostingService.ts         # ❌ PascalCase 사용하지 않음

메서드 네이밍 규칙:
  조회: get{Entity}, get{Entity}List, get{Entity}ById
  생성: create{Entity}
  수정: update{Entity}
  삭제: delete{Entity}
  검색: search{Entity}, filter{Entity}
  상태변경: confirm{Entity}, cancel{Entity}, close{Entity}

예시 (jobPostingService.ts):
  - getJobPosting(id)            # 단건 조회
  - getJobPostings(filters)      # 목록 조회
  - createJobPosting(data)       # 생성
  - updateJobPosting(id, data)   # 수정
  - deleteJobPosting(id)         # 삭제
  - closeJobPosting(id, reason)  # 상태 변경
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
  role: UserRole                // 'staff' | 'employer' | 'admin' (회원가입 시 기본 'staff')
  isActive: boolean             // 활성 상태

  // === 연락처 ===
  phone?: string                // 전화번호 (010-0000-0000)
  phoneVerified?: boolean       // 전화번호 인증 여부

  // === 프로필 ===
  profileImage?: string         // Storage URL
  bio?: string                  // 자기소개

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
  role: StaffRole               // dealer | floor | td | dc | chips | register | serving | guard | manager
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
    createdAt: Timestamp
    priority: 'high'
  }

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

### 2.8 purchases (다이아 충전 기록)

```typescript
interface Purchase {
  // === 기본 정보 ===
  id: string
  userId: string

  // === 패키지 정보 ===
  packageId: 'starter' | 'basic' | 'popular' | 'premium'
  diamonds: number              // 기본 다이아 수량
  bonusDiamonds: number         // 보너스 다이아 수량
  totalDiamonds: number         // 총 지급 다이아
  price: number                 // 결제 금액 (원)

  // === RevenueCat 연동 ===
  revenueCatTransactionId: string
  store: 'app_store' | 'play_store'
  productId: string             // com.uniqn.diamond.{packageId}
  environment: 'sandbox' | 'production'

  // === 상태 ===
  status: 'pending' | 'completed' | 'failed' | 'refunded'

  // === 환불 정보 ===
  refund?: {
    amount: number
    diamondsDeducted: number
    reason: string
    refundedAt: Timestamp
  }

  // === 메타데이터 ===
  createdAt: Timestamp
  completedAt?: Timestamp
}
```

### 2.9 users/{userId}/heartBatches (하트 배치)

```typescript
interface HeartBatch {
  // === 기본 정보 ===
  id: string                    // 자동 생성

  // === 하트 정보 ===
  amount: number                // 획득 수량
  remainingAmount: number       // 남은 수량
  source: HeartSource           // 획득 경로

  // === 기간 ===
  acquiredAt: Timestamp
  expiresAt: Timestamp          // 획득일 + 90일

  // === 메타데이터 ===
  metadata?: {
    referrerId?: string         // 추천인 ID (초대 보상 시)
    workLogId?: string          // 근무 기록 ID (리뷰 작성 시)
    [key: string]: string | undefined
  }
}

type HeartSource =
  | 'signup_bonus'      // 가입 보너스 (+10)
  | 'daily_attendance'  // 일일 출석 (+1)
  | 'weekly_streak'     // 7일 연속 출석 (+3)
  | 'review_bonus'      // 리뷰 작성 (+1)
  | 'referral_bonus'    // 친구 초대 (+5)
  | 'admin_grant'       // 관리자 지급
```

### 2.10 users/{userId}/pointTransactions (포인트 거래 기록)

```typescript
interface PointTransaction {
  // === 기본 정보 ===
  id: string
  userId: string

  // === 거래 정보 ===
  type: 'earn' | 'spend' | 'refund' | 'expire'
  pointType: 'heart' | 'diamond'
  amount: number                // 양수: 획득, 음수: 차감

  // === 상세 정보 ===
  source?: HeartSource          // 하트 획득 시
  purchaseId?: string           // 다이아 충전 시
  jobPostingId?: string         // 공고 등록 차감 시
  postingType?: 'regular' | 'urgent' | 'fixed'  // 공고 타입

  // === 잔액 스냅샷 ===
  balanceAfter: {
    hearts: number
    diamonds: number
  }

  // === 메타데이터 ===
  createdAt: Timestamp
  description?: string          // 거래 설명
}
```

### 2.9 inquiries (문의사항)

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

// === RevenueCat 웹훅 ===

// RevenueCat 결제 웹훅 처리
export const handleRevenueCatWebhook = functions.https.onRequest(async (req, res) => {
  // 서명 검증
  const signature = req.headers['x-revenuecat-signature']
  if (!verifyRevenueCatSignature(req.body, signature)) {
    res.status(401).send('Invalid signature')
    return
  }

  const event = req.body
  const userId = event.app_user_id

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'NON_RENEWING_PURCHASE':
        await handleDiamondPurchase(userId, event)
        break

      case 'REFUND':
        await handleRefund(userId, event)
        break

      default:
        logger.info('Unhandled RevenueCat event', { type: event.type })
    }

    res.status(200).send('OK')
  } catch (error) {
    logger.error('RevenueCat webhook error', { error })
    res.status(500).send('Internal error')
  }
})

// 다이아 충전 처리
async function handleDiamondPurchase(userId: string, event: any) {
  const productId = event.product_id
  const transactionId = event.transaction_id
  const store = event.store as 'app_store' | 'play_store'

  // 패키지별 다이아 수량 매핑
  const packages: Record<string, { diamonds: number; bonus: number }> = {
    'com.uniqn.diamond.starter': { diamonds: 3, bonus: 0 },
    'com.uniqn.diamond.basic': { diamonds: 8, bonus: 3 },
    'com.uniqn.diamond.popular': { diamonds: 30, bonus: 10 },
    'com.uniqn.diamond.premium': { diamonds: 333, bonus: 67 },
  }

  const pkg = packages[productId]
  if (!pkg) {
    throw new Error(`Unknown product: ${productId}`)
  }

  const totalDiamonds = pkg.diamonds + pkg.bonus

  await admin.firestore().runTransaction(async (transaction) => {
    const userRef = admin.firestore().collection('users').doc(userId)
    const userDoc = await transaction.get(userRef)

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const currentDiamonds = userDoc.data()?.points?.diamonds || 0

    // 다이아 지급
    transaction.update(userRef, {
      'points.diamonds': currentDiamonds + totalDiamonds,
      'points.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    })

    // 구매 기록 저장
    const purchaseRef = admin.firestore().collection('purchases').doc()
    transaction.set(purchaseRef, {
      userId,
      packageId: productId.split('.').pop(),
      diamonds: pkg.diamonds,
      bonusDiamonds: pkg.bonus,
      totalDiamonds,
      revenueCatTransactionId: transactionId,
      store,
      productId,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })
}

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
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: '본인인증이 필요합니다',  // 휴대폰 본인인증
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: '계정이 비활성화되었습니다',

  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: '필수 항목을 입력해주세요',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: '올바른 형식으로 입력해주세요',
  [ErrorCodes.VALIDATION_XSS_DETECTED]: '허용되지 않는 문자가 포함되어 있습니다',

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
  ├─── applications (N) ──── jobPostings (1)
  │         │
  │         └─── confirmationHistory (배열)
  │         └─── cancellationRequest (객체)
  │
  ├─── workLogs (N)
  │         └─── settlementBreakdown (캐싱)
  │
  ├─── notifications (N)
  │
  ├─── purchases (N)
  │
  ├─── heartBatches (서브컬렉션)
  │
  ├─── pointTransactions (서브컬렉션)
  │
  ├─── inquiries (N)
  │
  └─── reports (N)

eventQRCodes (N) ──── jobPostings (1)
```

### 표준 필드 규칙

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 문서 고유 ID |
| `userId` | string | 사용자 참조 |
| `jobPostingId` | string | 공고 참조 (표준) |
| `applicantId` | string | 지원자 참조 |
| `createdAt` | Timestamp | 생성 시간 |
| `updatedAt` | Timestamp | 수정 시간 |
| `status` | string | 상태 enum |

> **Note**: `eventId`, `postId`, `staffId`는 레거시 필드로, `jobPostingId`, `userId`로 통합 중

---

## 9. 서비스 레이어 구조

### 9.1 Core 서비스 (7개)

| 서비스 | 파일 | 주요 기능 |
|--------|------|----------|
| **authService** | `authService.ts` | 로그인, 회원가입, 소셜 로그인, 프로필 관리 |
| **jobService** | `jobService.ts` | 공고 목록, 검색, 필터, 상세 조회 |
| **applicationService** | `applicationService.ts` | 지원, 취소 요청, 지원 내역 조회 |
| **workLogService** | `workLogService.ts` | 근무 기록 조회, 실시간 구독 |
| **scheduleService** | `scheduleService.ts` | 스케줄 조회, 그룹핑, 캘린더 뷰 |
| **notificationService** | `notificationService.ts` | 알림 조회, 읽음 처리, 실시간 구독 |
| **reportService** | `reportService.ts` | 양방향 신고 (스태프↔구인자) |

### 9.2 Employer 서비스 (6개)

| 서비스 | 파일 | 주요 기능 |
|--------|------|----------|
| **jobManagementService** | `jobManagementService.ts` | 공고 CRUD, 상태 관리 |
| **applicantManagementService** | `applicantManagementService.ts` | 지원자 확정/거절, 대기자 관리 |
| **applicationHistoryService** | `applicationHistoryService.ts` | 확정/취소 이력 추적, WorkLog 연동 |
| **confirmedStaffService** | `confirmedStaffService.ts` | 확정 스태프 관리, 역할 변경 |
| **settlementService** | `settlement/*.ts` | 정산 계산, 처리 (분할 구조) |
| **applicantConversionService** | `applicantConversionService.ts` | 지원자→스태프 변환 |

### 9.3 Admin 서비스 (4개)

| 서비스 | 파일 | 주요 기능 |
|--------|------|----------|
| **adminService** | `adminService.ts` | 대시보드 통계, 사용자 관리 |
| **announcementService** | `announcementService.ts` | 공지사항 CRUD, 발행 관리 |
| **tournamentApprovalService** | `tournamentApprovalService.ts` | 대회공고 승인/거절 |
| **inquiryService** | `inquiryService.ts` | 문의 관리, FAQ |

### 9.4 Infrastructure 서비스 (17개)

| 서비스 | 파일 | 주요 기능 |
|--------|------|----------|
| **pushNotificationService** | `pushNotificationService.ts` | FCM 토큰 관리, 권한 요청 |
| **eventQRService** | `eventQRService.ts` | QR 생성/검증 (3분 유효) |
| **deepLinkService** | `deepLinkService.ts` | 딥링크 라우팅 |
| **analyticsService** | `analyticsService.ts` | 이벤트 추적 |
| **crashlyticsService** | `crashlyticsService.ts` | 에러 로깅 |
| **performanceService** | `performanceService.ts` | 성능 모니터링 |
| **sessionService** | `sessionService.ts` | 세션 관리, 토큰 갱신 |
| **storageService** | `storageService.ts` | 이미지 업로드 |
| **biometricService** | `biometricService.ts` | 생체인증 |
| **featureFlagService** | `featureFlagService.ts` | 기능 플래그 |
| **inAppMessageService** | `inAppMessageService.ts` | 인앱 메시지 |
| **cacheService** | `cacheService.ts` | 캐시 관리 |
| **versionService** | `versionService.ts` | 앱 버전 체크 |
| **templateService** | `templateService.ts` | 공고 템플릿 |
| **accountDeletionService** | `accountDeletionService.ts` | 계정 삭제 |
| **tokenRefreshService** | `tokenRefreshService.ts` | 토큰 자동 갱신 |
| **searchService** | `searchService.ts` | 클라이언트 사이드 검색 |

---

## 10. 훅 레이어 구조 (46개)

### 10.1 인증/권한 (6개)

| 훅 | 용도 |
|----|------|
| `useAuth` | 인증 상태 통합 래퍼 |
| `useAuthGuard` | 라우트 권한 보호 |
| `useAutoLogin` | 자동 로그인 |
| `useBiometricAuth` | 생체인증 |
| `useOnboarding` | 온보딩 상태 |
| `useAppInitialize` | 앱 초기화 |

### 10.2 공고/지원 (9개)

| 훅 | 용도 |
|----|------|
| `useJobPostings` | 무한스크롤 공고 목록 |
| `useJobDetail` | 공고 상세 |
| `useJobManagement` | 공고 CRUD (구인자용) |
| `useJobRoles` | 역할 정보 정규화 |
| `useJobSchedule` | 일정 정보 정규화 |
| `useApplications` | 지원 제출/취소 |
| `useAssignmentSelection` | 배정 선택 관리 |
| `useBookmarks` | 북마크 관리 |
| `usePostingTypeCounts` | 타입별 공고 개수 |

### 10.3 스케줄/근무 (4개)

| 훅 | 용도 |
|----|------|
| `useSchedules` | 스케줄 조회/캘린더 |
| `useWorkLogs` | 근무 기록 조회 |
| `useQRCode` | QR 스캔/표시 |
| `useEventQR` | 현장 QR 관리 (구인자용) |

### 10.4 정산/구인자 (8개)

| 훅 | 용도 |
|----|------|
| `useSettlement` | 정산 조회/처리 |
| `useSettlementDateNavigation` | 정산 날짜 네비게이션 |
| `useConfirmedStaff` | 확정 스태프 관리 |
| `useApplicantsByJobPosting` | 공고별 지원자 조회 |
| `useApplicantMutations` | 지원자 관리 뮤테이션 |
| `useCancellationManagement` | 취소 요청 관리 |
| `useStaffConversion` | 스태프 변환 |
| `useTemplateManager` | 템플릿 관리 |

### 10.5 알림 (3개)

| 훅 | 용도 |
|----|------|
| `useNotifications` | 알림 조회/읽음/삭제 |
| `useNotificationHandler` | 통합 알림 핸들러 |
| `useDeepLink` | 딥링크 처리 |

### 10.6 관리자 (4개)

| 훅 | 용도 |
|----|------|
| `useAdminDashboard` | 관리자 대시보드 |
| `useAdminReports` | 신고 관리 |
| `useAnnouncement` | 공지사항 관리 |
| `useTournamentApproval` | 대회공고 승인 |

### 10.7 인프라 (8개)

| 훅 | 용도 |
|----|------|
| `useNetworkStatus` | 네트워크 상태 감지 |
| `useNavigationTracking` | Analytics 추적 |
| `useFeatureFlag` | 기능 플래그 |
| `useVersionCheck` | 앱 버전 체크 |
| `useRealtimeQuery` | Firestore 실시간 구독 |
| `useAllowances` | 수당 관리 |
| `useInquiry` | 문의 관리 |
| `useClearCache` | 캐시 삭제 |

---

## 관련 문서

- [00-overview.md](./00-overview.md) - 프로젝트 개요
- [06-firebase.md](./06-firebase.md) - Firebase 연동 전략
- [12-security.md](./12-security.md) - 보안 설계
- [22-migration-mapping.md](./22-migration-mapping.md) - 마이그레이션 매핑

---

*마지막 업데이트: 2026-02-02*
