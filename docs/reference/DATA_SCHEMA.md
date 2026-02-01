# 📊 T-HOLDEM 데이터 스키마 가이드

**최종 업데이트**: 2026년 2월 1일
**버전**: v3.1.0 (💎 하트/다이아 포인트 시스템 추가)
**상태**: 🚀 **Production Ready**

> [!SUCCESS]
> **v3.1 변경사항**: 💎 하트/다이아 포인트 시스템 스키마 추가 (heartBatches, pointTransactions, purchases)
>
> **v3.0 변경사항**: 모바일앱(uniqn-mobile) 스키마와 완전 동기화, Assignment 기반 지원 시스템, 역할 체계 개편(employer 추가), 알림 컬렉션 스키마 추가

## 📋 목차

1. [스키마 개요](#-스키마-개요)
2. [Firebase 컬렉션](#-firebase-컬렉션)
3. [TypeScript 인터페이스](#-typescript-인터페이스)
4. [데이터 변환 함수](#-데이터-변환-함수)
5. [인덱스 최적화](#-인덱스-최적화)
6. [마이그레이션 가이드](#-마이그레이션-가이드)

## 🎯 스키마 개요

### 설계 원칙
- **표준 필드명**: `jobPostingId`, `checkInTime/checkOutTime` 통일
- **Repository 패턴**: Service → Repository → Firebase 레이어 분리
- **TypeScript Strict**: any 타입 0개, 완벽한 타입 안전성
- **하위 호환성**: 레거시 필드 읽기 지원 (Firestore Rules)
- **인덱스 최적화**: 복합 인덱스로 쿼리 성능 최적화

### 핵심 컬렉션 구조
```
Firebase Firestore
├── users                 # 사용자 정보 (UserRole 사용)
├── staff                 # 스태프 정보 (StaffRole 사용)
├── jobPostings           # 구인공고
├── applications          # 지원서
├── workLogs              # 근무 기록
├── attendanceRecords     # 출석 기록
├── notifications         # 알림
├── eventQRCodes          # QR 코드 (출퇴근용) ✅ v3.0 추가
├── settlements           # 정산 정보 ✅ v3.0 추가
├── announcements         # 공지사항 ✅ v3.0 추가
├── reports               # 신고 (양방향) ✅ v3.0 추가
├── tournaments           # 토너먼트
├── inquiries             # 문의/신고
├── purchases             # RevenueCat 구매 기록 ✅ v3.1 추가
│
└── users/{userId}/       # 사용자별 서브컬렉션
    ├── heartBatches      # 💖 하트 배치 (만료일별) ✅ v3.1 추가
    └── pointTransactions # 💎 포인트 거래 내역 ✅ v3.1 추가
```

## 🗃️ Firebase 컬렉션

### 1. staff (스태프 정보)

```typescript
Collection: "staff"
Document ID: Auto-generated or custom

{
  "id": string,              // 문서 ID (자동 생성)
  "staffId": string,         // 표준 스태프 ID ✅
  "name": string,            // 스태프 이름 (required)
  "role": StaffRole,         // 직무 역할 (⚠️ UserRole과 다름)
  "customRole"?: string,     // 커스텀 역할명 (role === 'other'일 때)
  "phone"?: string,          // 전화번호 (선택적)
  "email"?: string,          // 이메일 (선택적)
  "isActive": boolean,       // 활성 상태 (기본값: true)
  "specialties"?: string[],  // 특기/전문분야
  "hourlyRate"?: number,     // 기본 시급
  "notes"?: string,          // 비고
  "createdAt": Timestamp,    // 생성일시
  "updatedAt": Timestamp,    // 수정일시
  "createdBy": string,       // 생성자 ID
  "lastModifiedBy"?: string  // 마지막 수정자 ID
}
```

**인덱스**: `staffId`, `role`, `isActive`, `createdAt`

### 2. workLogs (근무 기록)

```typescript
Collection: "workLogs"
Document ID Pattern: "${jobPostingId}_${staffId}_0_${date}"

{
  "id": string,                    // 문서 ID 패턴
  "staffId": string,               // 표준 스태프 ID ✅
  "staffName": string,             // 스태프 이름 (역정규화) ✅
  "jobPostingId": string,          // 공고 ID (표준 필드) ✅
  "jobPostingTitle"?: string,      // 공고 제목 (역정규화)
  "date": string,                  // 근무 날짜 "YYYY-MM-DD"
  "scheduledStartTime"?: Timestamp, // 예정 시작 시간
  "scheduledEndTime"?: Timestamp,   // 예정 종료 시간
  "checkInTime"?: Timestamp,        // 실제 출근 시간 ✅
  "checkOutTime"?: Timestamp,       // 실제 퇴근 시간 ✅
  "role"?: string,                  // 근무 역할
  "hoursWorked"?: number,           // 근무 시간 (자동 계산)
  "overtimeHours"?: number,         // 초과 근무 시간
  "basePay"?: number,               // 기본급
  "overtimePay"?: number,           // 초과근무수당
  "totalPay"?: number,              // 총 급여
  "status": "scheduled" | "checked_in" | "checked_out" | "completed" | "cancelled",
  "location"?: string,              // 근무 장소
  "notes"?: string,                 // 비고
  "createdAt": Timestamp,           // 생성일시
  "updatedAt": Timestamp,           // 수정일시
  "createdBy": string,              // 생성자 ID
  "lastModifiedBy"?: string         // 마지막 수정자 ID
}
```

**필드 변경 이력 (v2.0)**:
| 레거시 필드 | 현재 필드 | 설명 |
|------------|----------|------|
| `eventId` | `jobPostingId` | 공고 참조 ID 표준화 |
| `actualStartTime` | `checkInTime` | QR 출근 시간 |
| `actualEndTime` | `checkOutTime` | QR 퇴근 시간 |

> **하위 호환성**: Firestore Rules에서 `eventId`도 여전히 허용됩니다.

**인덱스**: `staffId`, `jobPostingId`, `date`, `status`, `createdAt`

### 3. applications (지원서)

```typescript
Collection: "applications"
Document ID: Auto-generated

{
  "id": string,                // 문서 ID
  "jobPostingId": string,      // 공고 ID (표준 필드) ✅
  "jobPostingTitle"?: string,  // 공고 제목 (역정규화)
  "applicantId": string,       // 지원자 ID (users 컬렉션 참조)
  "applicantName": string,     // 지원자 이름 (역정규화)
  "applicantPhone"?: string,   // 지원자 전화번호 (역정규화)

  // 상태 (v3.0 확장)
  "status": "applied" | "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "cancellation_pending",

  // Assignment 기반 지원 (v3.0 필수) ✅
  "assignments": Assignment[], // 지원 날짜/역할 정보 (필수)

  // 확정 이력 (v3.0 추가)
  "confirmationHistory"?: ConfirmationHistoryEntry[],

  // 취소 요청 시스템 (v3.0 추가)
  "cancellationRequest"?: {
    "requestedAt": Timestamp,
    "reason": string,
    "status": "pending" | "approved" | "rejected",
    "reviewedAt"?: Timestamp,
    "reviewedBy"?: string,
    "reviewNote"?: string
  },

  // 기타 필드
  "applicationMessage"?: string, // 지원 메시지
  "adminNotes"?: string,         // 관리자 메모
  "rejectionReason"?: string,    // 거절 사유
  "confirmedAt"?: Timestamp,     // 확정일시
  "createdAt": Timestamp,        // 지원일시
  "updatedAt": Timestamp,        // 수정일시
  "lastModifiedBy"?: string      // 마지막 수정자 ID
}

// Assignment 구조 (v3.0 - 완전한 정의)
interface Assignment {
  // === 필수 필드 ===
  "roleIds": string[],           // 역할 ID 배열 ["dealer", "floor", ...]
  "timeSlot": string,            // 시간대 (예: "19:00", "14:00~22:00") ✅ 필수
  "dates": string[],             // 지원 날짜들 ["YYYY-MM-DD", ...]
  "isGrouped": boolean,          // 연속 날짜 그룹 여부 ✅ 필수

  // === 선택 필드 ===
  "groupId"?: string,            // 그룹 식별자 (예: "19:00_dealer_2025-01-09_2025-01-11")
  "checkMethod"?: "group" | "individual",  // 체크 방식
  "requirementId"?: string,      // 모집 공고 구분자 (날짜 중복 모집 구분)
  "duration"?: AssignmentDuration,  // 기간 정보
  "isTimeToBeAnnounced"?: boolean,  // 시간 미정 여부
  "tentativeDescription"?: string   // 미정 사유 (예: "토너먼트 진행 상황에 따라 결정")
}

// 기간 정보 구조체
interface AssignmentDuration {
  "type": "single" | "consecutive" | "multi",  // 단일/연속/다중 날짜
  "startDate": string,           // 시작일 (YYYY-MM-DD)
  "endDate"?: string             // 종료일 (연속/다중일 경우)
}

// 확정 이력 (v3.0)
interface ConfirmationHistoryEntry {
  "action": "confirmed" | "rejected" | "cancelled",
  "timestamp": Timestamp,
  "performedBy": string,
  "reason"?: string,
  "affectedDates"?: string[],
  "affectedRoles"?: string[]
}
```

**상태 흐름**:
```
applied → pending → confirmed → completed
                  ↘ rejected
                  ↘ cancelled
                  ↘ cancellation_pending → cancelled (승인) 또는 confirmed (거절)
```

**필드 변경 이력 (v3.0)**:
| 레거시 필드 | 현재 필드 | 설명 |
|------------|----------|------|
| `eventId` | `jobPostingId` | 공고 참조 ID 표준화 |
| `postId` | `jobPostingId` | 공고 참조 ID 표준화 |
| `postTitle` | `jobPostingTitle` | 필드명 통일 |
| `appliedRoles` | `assignments[].roleIds` | Assignment 구조로 통합 |
| `preferredDates` | `assignments[].dates` | Assignment 구조로 통합 |

> **하위 호환성**: Firestore Rules에서 `eventId`, `postId`도 여전히 허용됩니다.

**인덱스**: `jobPostingId`, `applicantId`, `status`, `createdAt`

### 4. jobPostings (구인공고)

```typescript
Collection: "jobPostings"
Document ID: Auto-generated

{
  "id": string,                // 문서 ID
  "ownerId": string,           // 공고 소유자 ID (employer) ✅
  "title": string,             // 공고 제목 (required)
  "description": string,       // 공고 내용
  "location": string,          // 근무 장소

  // 날짜별 모집 정보 (v2.0 구조)
  "dateSpecificRequirements"?: DateSpecificRequirement[],

  // 레거시 호환용 (eventDates)
  "eventDates"?: {             // 이벤트 날짜별 정보
    "[YYYY-MM-DD]": {
      "roles": {               // 역할별 모집 정보
        "dealer": {
          "count": number,     // 모집 인원
          "hourlyRate": number, // 시급
          "workHours": string,  // 근무시간 "HH:mm-HH:mm"
          "requirements"?: string[] // 요구사항
        },
        "server": { /* 동일 구조 */ }
      },
      "benefits"?: {           // 복리후생
        "meal": boolean,       // 식사 제공
        "transportation": boolean, // 교통비 지원
        "accommodation": boolean,  // 숙박 제공
        "other"?: string       // 기타 혜택
      },
      "additionalInfo"?: string // 추가 정보
    }
  },

  "requirements": {            // 공통 요구사항
    "minAge"?: number,         // 최소 연령
    "experience"?: string,     // 경험 요구사항
    "skills"?: string[],       // 필요 기술
    "certification"?: string[] // 필요 자격증
  },

  "applicationDeadline"?: Timestamp, // 지원 마감일
  "status": "active" | "closed" | "cancelled",  // 공고 상태 ✅
  "isPublic": boolean,         // 공개 여부
  "maxApplications"?: number,  // 최대 지원자 수
  "autoClose"?: boolean,       // 자동 마감 여부
  "tags"?: string[],           // 태그

  // 공고 타입 (v2.0 확장)
  "postingType": "regular" | "fixed" | "tournament" | "urgent",  // ✅ urgent 추가

  // 대회 공고 전용 (postingType === 'tournament')
  "tournamentConfig"?: {
    "approvalStatus": "pending" | "approved" | "rejected",  // 승인 상태
    "submittedAt"?: Timestamp,   // 제출일시
    "approvedBy"?: string,       // 승인자 ID
    "approvedAt"?: Timestamp,    // 승인일시
    "rejectedBy"?: string,       // 거부자 ID
    "rejectedAt"?: Timestamp,    // 거부일시
    "rejectionReason"?: string,  // 거부 사유 (10자 이상)
    "resubmittedAt"?: Timestamp, // 재제출일시
    "resubmittedBy"?: string,    // 재제출자 ID
    "previousRejection"?: {      // 이전 거부 정보 (재제출 시 보존)
      "reason": string,
      "rejectedBy": string,
      "rejectedAt": Timestamp
    }
  },

  "createdAt": Timestamp,      // 생성일시
  "updatedAt": Timestamp,      // 수정일시
  "createdBy": string,         // 생성자 ID
  "lastModifiedBy"?: string    // 마지막 수정자 ID
}

// 날짜별 모집 정보 (v2.0)
interface DateSpecificRequirement {
  "date": string,              // "YYYY-MM-DD"
  "roles": RoleRequirement[],  // 역할별 모집 정보
  "benefits"?: Benefits,       // 복리후생
  "additionalInfo"?: string    // 추가 정보
}

interface RoleRequirement {
  "roleId": string,            // 역할 ID
  "count": number,             // 모집 인원
  "hourlyRate": number,        // 시급
  "workHours"?: {              // 근무 시간
    "start": string,           // "HH:mm"
    "end": string              // "HH:mm"
  },
  "requirements"?: string[]    // 역할별 요구사항
}
```

**상태값 변경 이력**:
| 레거시 상태 | 현재 상태 | 설명 |
|------------|----------|------|
| `draft` | - | 사용 안함 (즉시 게시) |
| `published` | `active` | 공고 활성 상태 |
| `closed` | `closed` | 마감됨 |
| `cancelled` | `cancelled` | 취소됨 |

**공고 타입 설명**:
| 타입 | 설명 |
|------|------|
| `regular` | 일반 공고 |
| `fixed` | 고정 공고 (정기적) |
| `tournament` | 대회 공고 (관리자 승인 필요) |
| `urgent` | 긴급 공고 (상단 노출) ✅ |

**인덱스**: `status`, `ownerId`, `isPublic`, `postingType`, `createdAt`, `postingType + tournamentConfig.approvalStatus + createdAt`

### 5. attendanceRecords (출석 기록)

```typescript
Collection: "attendanceRecords"
Document ID Pattern: "${staffId}_${jobPostingId}_${date}"

{
  "id": string,                // 문서 ID 패턴
  "staffId": string,           // 표준 스태프 ID ✅
  "workLogId"?: string,        // 연결된 WorkLog ID
  "jobPostingId": string,      // 공고 ID (표준 필드) ✅
  "date": string,              // 근무 날짜 "YYYY-MM-DD"
  "status": "not_started" | "checked_in" | "checked_out",
  "checkInTime"?: Timestamp,   // 출근 시간
  "checkOutTime"?: Timestamp,  // 퇴근 시간
  "location"?: {               // GPS 위치 정보
    "latitude": number,
    "longitude": number,
    "address"?: string         // 주소 (역지오코딩)
  },
  "device"?: {                 // 출입 기기 정보
    "type": "qr" | "nfc" | "manual", // 출입 방식
    "deviceId"?: string,       // 기기 식별자
    "userAgent"?: string       // 사용자 에이전트
  },
  "notes"?: string,            // 비고
  "isLate"?: boolean,          // 지각 여부
  "isEarlyLeave"?: boolean,    // 조퇴 여부
  "createdAt": Timestamp,      // 생성일시
  "updatedAt": Timestamp,      // 수정일시
  "recordedBy": string,        // 기록자 ID
  "approvedBy"?: string        // 승인자 ID
}
```

> **하위 호환성**: Firestore Rules에서 `eventId`도 여전히 허용됩니다.

**인덱스**: `staffId`, `jobPostingId`, `date`, `status`, `checkInTime`

### 6. tournaments (토너먼트)

```typescript
Collection: "tournaments"
Document ID: Auto-generated

{
  "id": string,                // 문서 ID
  "name": string,              // 토너먼트 이름
  "description"?: string,      // 설명
  "startDate": Timestamp,      // 시작일시
  "endDate": Timestamp,        // 종료일시
  "venue": {                   // 개최지 정보
    "name": string,            // 장소명
    "address": string,         // 주소
    "capacity": number         // 수용 인원
  },
  "gameSettings": {            // 게임 설정
    "gameType": "holdem" | "omaha" | "mixed",
    "blindStructure": {        // 블라인드 구조
      "levels": {
        "level": number,
        "smallBlind": number,
        "bigBlind": number,
        "duration": number     // 분 단위
      }[]
    },
    "buyIn": number,           // 바이인 금액
    "rebuyAllowed": boolean    // 리바이 허용 여부
  },
  "status": "planned" | "registration" | "ongoing" | "completed" | "cancelled",
  "participants": {            // 참가자 정보
    "registered": number,      // 등록자 수
    "checkedIn": number,       // 체크인 완료
    "active": number,          // 현재 활성
    "eliminated": number       // 탈락자
  },
  "prizes": {                  // 상금 구조
    "total": number,           // 총 상금
    "distribution": {
      "position": number,
      "amount": number,
      "percentage": number
    }[]
  },
  "staffAssignments"?: {       // 스태프 배정
    "date": string,            // "YYYY-MM-DD"
    "staff": {
      "staffId": string,
      "role": string,
      "shift": string
    }[]
  }[],
  "createdAt": Timestamp,      // 생성일시
  "updatedAt": Timestamp,      // 수정일시
  "createdBy": string,         // 생성자 ID
  "lastModifiedBy"?: string    // 마지막 수정자 ID
}
```

**인덱스**: `status`, `startDate`, `endDate`, `createdAt`

### 7. inquiries (문의/신고)

```typescript
Collection: "inquiries"
Document ID: Auto-generated

{
  "id": string,                // 문서 ID
  "userId": string,            // 사용자 ID
  "userEmail": string,         // 사용자 이메일
  "userName": string,          // 사용자 이름
  "category": "general" | "technical" | "payment" | "account" | "report" | "other", // 문의 카테고리
  "subject": string,           // 제목
  "message": string,           // 내용
  "status": "open" | "in_progress" | "closed", // 상태
  "reportMetadata"?: {         // 신고 메타데이터 (카테고리가 'report'인 경우)
    "type": string,
    "reporterType": string,
    "targetId": string,
    "targetName": string,
    "eventId": string,
    "eventTitle": string,
    "date": string
  },
  "response"?: string,         // 관리자 응답
  "responderId"?: string,      // 응답자 ID
  "responderName"?: string,    // 응답자 이름
  "createdAt": Timestamp,      // 생성일시
  "updatedAt": Timestamp,      // 수정일시
  "respondedAt"?: Timestamp    // 응답일시
}
```

**인덱스**: `userId`, `category`, `status`, `createdAt`

### 8. users (사용자 정보)

```typescript
Collection: "users"
Document ID: Firebase Auth UID

{
  "id": string,                // 문서 ID (Firebase Auth UID)
  "email": string,             // 이메일 (Firebase Auth 동기화)
  "name": string,              // 사용자 이름
  "nickname"?: string,         // 닉네임
  "phone"?: string,            // 전화번호
  "photoURL"?: string,         // 프로필 이미지 URL

  // 역할 체계 (v2.0)
  // 역할 계층: admin(100) > employer(50) > staff(10)
  // manager는 employer와 동일 권한 (하위 호환성)
  "role": "admin" | "employer" | "staff",  // 사용자 역할 ✅

  // 본인인증 관련 (v2.0)
  "identityVerified"?: boolean,   // 본인인증 완료 여부
  "identityVerifiedAt"?: Timestamp, // 본인인증 완료 시간

  // 구인자 관련 (role === 'employer')
  "employerAgreements"?: {        // 구인자 동의 정보
    "termsAgreedAt": Timestamp,   // 이용약관 동의
    "liabilityWaiverAgreedAt": Timestamp  // 면책조항 동의
  },
  "employerRegisteredAt"?: Timestamp, // 구인자 등록 시간

  // 프로필 정보 (간소화)
  "profile"?: {
    "bio"?: string,              // 자기소개
    "experience"?: string,       // 경력
    "skills"?: string[]          // 보유 기술
  },

  // 알림 설정
  "notificationSettings"?: {
    "pushEnabled": boolean,
    "emailEnabled": boolean
  },

  // FCM 토큰 (멀티 디바이스 지원)
  "fcmTokens"?: string[],

  "isActive": boolean,           // 활성 상태
  "lastLoginAt"?: Timestamp,     // 마지막 로그인
  "createdAt": Timestamp,        // 계정 생성일
  "updatedAt": Timestamp,        // 수정일시
  "lastModifiedBy"?: string      // 마지막 수정자 ID
}
```

**역할 체계 설명**:
| 역할 | 권한 레벨 | 설명 |
|------|----------|------|
| `admin` | 100 | 전체 관리 권한 |
| `employer` | 50 | 구인공고 생성, 지원자 관리, 정산 |
| `staff` | 10 | 지원, 스케줄 확인, QR 출퇴근 |

> **하위 호환성**: `manager` 역할은 Firestore Rules에서 `employer`와 동일 권한으로 처리됩니다.

**인덱스**: `role`, `isActive`, `email`, `createdAt`

### 9. notifications (알림)

```typescript
Collection: "notifications"
Document ID: Auto-generated

{
  "id": string,                 // 문서 ID
  "recipientId": string,        // 수신자 ID (users 컬렉션 참조)

  // 알림 타입 (23개)
  "type": NotificationType,

  // 알림 카테고리 (6개)
  "category"?: NotificationCategory,

  // 내용
  "title": string,              // 알림 제목
  "body": string,               // 알림 본문
  "link"?: string,              // 딥링크 경로
  "data"?: Record<string, string>, // 추가 데이터 (jobId, staffId 등)

  // 상태
  "isRead": boolean,            // 읽음 여부
  "priority"?: "low" | "normal" | "high" | "urgent",  // 우선순위

  // 시간 정보
  "createdAt": Timestamp,       // 생성 시간
  "readAt"?: Timestamp          // 읽은 시간
}

// 알림 타입 (23개)
type NotificationType =
  // 지원 관련 (5개)
  | "new_application"         // 새로운 지원자 (구인자에게)
  | "application_cancelled"   // 지원 취소됨
  | "application_confirmed"   // 확정됨 (스태프에게)
  | "confirmation_cancelled"  // 확정 취소됨
  | "application_rejected"    // 거절됨

  // 출퇴근/스케줄 관련 (7개)
  | "staff_checked_in"        // 출근 체크인 (구인자에게)
  | "staff_checked_out"       // 퇴근 체크아웃 (구인자에게)
  | "checkin_reminder"        // 출근 리마인더 (스태프에게)
  | "no_show_alert"           // 노쇼 알림
  | "schedule_change"         // 근무 시간 변경
  | "schedule_created"        // 새로운 근무 배정
  | "schedule_cancelled"      // 근무 취소

  // 정산 관련 (2개)
  | "settlement_completed"    // 정산 완료 (스태프에게)
  | "settlement_requested"    // 정산 요청 (구인자에게)

  // 공고 관련 (4개)
  | "job_closing_soon"        // 공고 마감 임박
  | "new_job_in_area"         // 새 공고 (관심 지역)
  | "job_updated"             // 공고 수정됨
  | "job_cancelled"           // 공고 취소됨

  // 시스템 (3개)
  | "announcement"            // 공지사항
  | "maintenance"             // 시스템 점검
  | "app_update"              // 앱 업데이트

  // 관리자 (2개)
  | "inquiry_answered"        // 문의 답변 완료
  | "report_resolved";        // 신고 처리 완료

// 알림 카테고리 (6개)
type NotificationCategory =
  | "application"   // 지원 관련
  | "attendance"    // 출퇴근 관련
  | "settlement"    // 정산 관련
  | "job"           // 공고 관련
  | "system"        // 시스템
  | "admin";        // 관리자
```

**우선순위 가이드**:
| 우선순위 | 알림 타입 예시 |
|---------|--------------|
| `urgent` | 출근 리마인더, 노쇼 알림 |
| `high` | 지원 확정, 확정 취소, 정산 완료 |
| `normal` | 새로운 지원자, 공지사항 |
| `low` | 새 공고 (관심 지역), 앱 업데이트 |

**인덱스**: `recipientId`, `isRead`, `type`, `createdAt`

### 10. eventQRCodes (이벤트 QR 코드)

```typescript
Collection: "eventQRCodes"
Document ID: Auto-generated

{
  "id": string,                  // 문서 ID
  "jobPostingId": string,        // 공고 ID
  "date": string,                // 근무 날짜 "YYYY-MM-DD"
  "type": "check_in" | "check_out",  // QR 타입

  // QR 코드 정보
  "qrCode": string,              // QR 코드 값 (암호화)
  "securityToken": string,       // 보안 토큰

  // 유효성
  "validFrom": Timestamp,        // 유효 시작 시간
  "validUntil": Timestamp,       // 유효 종료 시간 (3분 후)
  "isUsed": boolean,             // 사용 여부

  // 메타데이터
  "createdAt": Timestamp,        // 생성 시간
  "createdBy": string,           // 생성자 ID (구인자)
  "usedAt"?: Timestamp,          // 사용 시간
  "usedBy"?: string              // 사용자 ID (스태프)
}
```

**보안 규칙**:
- QR 코드는 3분간만 유효
- 1회 사용 후 무효화
- securityToken으로 위변조 방지

**인덱스**: `jobPostingId`, `date`, `type`, `validUntil`

### 11. settlements (정산)

```typescript
Collection: "settlements"
Document ID: Auto-generated

{
  "id": string,                  // 문서 ID
  "jobPostingId": string,        // 공고 ID
  "jobPostingTitle"?: string,    // 공고 제목 (역정규화)
  "employerId": string,          // 구인자 ID

  // 정산 대상
  "staffId": string,             // 스태프 ID
  "staffName": string,           // 스태프 이름 (역정규화)
  "workLogIds": string[],        // 연결된 근무 기록 ID들

  // 금액 정보
  "workDates": string[],         // 근무 날짜들
  "totalHours": number,          // 총 근무 시간
  "regularHours": number,        // 정규 근무 시간
  "overtimeHours": number,       // 초과 근무 시간
  "hourlyRate": number,          // 시급
  "overtimeRate": number,        // 초과 근무 배율 (기본 1.5)
  "basePay": number,             // 기본급
  "overtimePay": number,         // 초과근무수당
  "deductions"?: number,         // 공제액
  "bonuses"?: number,            // 추가 수당
  "totalAmount": number,         // 총 정산 금액

  // 상태
  "status": "pending" | "confirmed" | "paid" | "cancelled",

  // 결제 정보
  "paymentMethod"?: string,      // 결제 방법
  "paymentNote"?: string,        // 정산 메모
  "paidAt"?: Timestamp,          // 지급 시간

  // 메타데이터
  "createdAt": Timestamp,        // 생성 시간
  "updatedAt": Timestamp,        // 수정 시간
  "confirmedAt"?: Timestamp,     // 확정 시간
  "confirmedBy"?: string         // 확정자 ID
}
```

**정산 상태 흐름**:
```
pending → confirmed → paid
                    ↘ cancelled
```

**인덱스**: `jobPostingId`, `staffId`, `employerId`, `status`, `createdAt`

### 12. announcements (공지사항)

```typescript
Collection: "announcements"
Document ID: Auto-generated

{
  "id": string,                  // 문서 ID
  "title": string,               // 공지 제목
  "content": string,             // 공지 내용

  // 분류
  "category": "notice" | "update" | "event" | "maintenance" | "policy",
  "priority": "low" | "normal" | "high" | "urgent",

  // 대상
  "targetRoles"?: UserRole[],    // 대상 역할 (없으면 전체)
  "isGlobal": boolean,           // 전체 공지 여부

  // 노출 설정
  "isPinned": boolean,           // 상단 고정
  "isPublished": boolean,        // 게시 상태
  "publishedAt"?: Timestamp,     // 게시 시간
  "expiresAt"?: Timestamp,       // 만료 시간

  // 첨부
  "attachments"?: {
    "name": string,
    "url": string,
    "type": string
  }[],

  // 조회 통계
  "viewCount": number,           // 조회수
  "readByUsers"?: string[],      // 읽은 사용자 ID 목록

  // 메타데이터
  "createdAt": Timestamp,        // 생성 시간
  "updatedAt": Timestamp,        // 수정 시간
  "createdBy": string,           // 작성자 ID (관리자)
  "lastModifiedBy"?: string      // 마지막 수정자 ID
}
```

**카테고리 설명**:
| 카테고리 | 설명 |
|---------|------|
| `notice` | 일반 공지 |
| `update` | 앱 업데이트 안내 |
| `event` | 이벤트/프로모션 |
| `maintenance` | 시스템 점검 |
| `policy` | 정책 변경 |

**인덱스**: `isPublished`, `category`, `priority`, `publishedAt`, `createdAt`

### 13. reports (신고)

```typescript
Collection: "reports"
Document ID: Auto-generated

{
  "id": string,                  // 문서 ID

  // 신고자 정보
  "reporterId": string,          // 신고자 ID
  "reporterName": string,        // 신고자 이름 (역정규화)
  "reporterType": "employer" | "staff",  // 신고자 유형

  // 피신고자 정보
  "targetId": string,            // 피신고자 ID
  "targetName": string,          // 피신고자 이름 (역정규화)
  "targetType": "employer" | "staff",    // 피신고자 유형

  // 관련 정보
  "jobPostingId"?: string,       // 관련 공고 ID
  "jobPostingTitle"?: string,    // 관련 공고 제목
  "incidentDate"?: string,       // 사건 발생일 "YYYY-MM-DD"

  // 신고 내용
  "category": "no_show" | "misconduct" | "fraud" | "harassment" | "safety" | "payment" | "other",
  "description": string,         // 신고 내용
  "evidence"?: {                 // 증거 자료
    "type": "image" | "document" | "link",
    "url": string,
    "description"?: string
  }[],

  // 처리 상태
  "status": "pending" | "reviewing" | "resolved" | "dismissed",
  "priority"?: "low" | "normal" | "high" | "urgent",

  // 처리 결과
  "resolution"?: {
    "action": "warning" | "suspension" | "ban" | "no_action",
    "note": string,
    "resolvedAt": Timestamp,
    "resolvedBy": string
  },

  // 메타데이터
  "createdAt": Timestamp,        // 신고 시간
  "updatedAt": Timestamp,        // 수정 시간
  "reviewedAt"?: Timestamp,      // 검토 시작 시간
  "reviewedBy"?: string          // 검토자 ID
}
```

**신고 카테고리 설명**:
| 카테고리 | 설명 |
|---------|------|
| `no_show` | 노쇼 (무단결근/무단취소) |
| `misconduct` | 부적절한 행동 |
| `fraud` | 사기/허위정보 |
| `harassment` | 괴롭힘 |
| `safety` | 안전 문제 |
| `payment` | 급여/정산 문제 |
| `other` | 기타 |

**양방향 신고 시스템**:
- 구인자 → 스태프 신고 가능
- 스태프 → 구인자 신고 가능
- 중복 신고 방지 (같은 건에 대해 1회)

**인덱스**: `reporterId`, `targetId`, `status`, `category`, `createdAt`

---

### 💎 포인트 시스템 컬렉션 (v3.1 추가)

#### purchases (RevenueCat 구매 기록)

```typescript
Collection: "purchases"
Document ID: RevenueCat transaction_id

{
  "transactionId": string,         // RevenueCat 트랜잭션 ID
  "userId": string,                // 구매자 ID
  "productId": string,             // 상품 ID (e.g., "diamond_starter")
  "store": "app_store" | "play_store",  // 스토어
  "purchaseDate": Timestamp,       // 구매일시
  "expirationDate"?: Timestamp,    // 만료일 (구독용)
  "price": number,                 // 결제 금액 (KRW)
  "currency": string,              // 통화 코드
  "diamondsGranted": number,       // 지급된 다이아 수
  "bonusDiamonds": number,         // 보너스 다이아 수
  "status": "completed" | "refunded" | "pending",
  "receiptData"?: string,          // 영수증 데이터 (검증용)
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

**인덱스**: `userId`, `purchaseDate`, `status`, `productId`

#### users/{userId}/heartBatches (하트 배치)

```typescript
Subcollection: "users/{userId}/heartBatches"
Document ID: Auto-generated

{
  "amount": number,                // 하트 수량
  "source": "signup" | "daily_checkin" | "streak_bonus" | "review" | "referral" | "admin_grant",
  "sourceDetail"?: string,         // 상세 사유
  "earnedAt": Timestamp,           // 획득일시
  "expiresAt": Timestamp,          // 만료일시 (획득 후 90일)
  "remainingAmount": number,       // 남은 하트 수량
  "usedAmount": number,            // 사용된 하트 수량
  "status": "active" | "expired" | "depleted",
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

**만료 규칙**: 획득 후 90일 자동 만료
**사용 우선순위**: 만료 임박 순으로 자동 차감

**인덱스**: `expiresAt`, `status`, `earnedAt`

#### users/{userId}/pointTransactions (포인트 거래 내역)

```typescript
Subcollection: "users/{userId}/pointTransactions"
Document ID: Auto-generated

{
  "type": "earn" | "spend" | "expire" | "refund",
  "pointType": "heart" | "diamond",
  "amount": number,                // 변동량 (양수: 획득, 음수: 사용)
  "balanceAfter": {                // 거래 후 잔액
    "hearts": number,
    "diamonds": number
  },
  "reason": string,                // 거래 사유
  "reasonCode": string,            // 사유 코드 (e.g., "job_posting_regular")
  "relatedDocId"?: string,         // 관련 문서 ID (공고 ID 등)
  "relatedDocType"?: "jobPosting" | "purchase" | "heartBatch",
  "metadata"?: {                   // 추가 메타데이터
    [key: string]: any
  },
  "createdAt": Timestamp
}
```

**거래 사유 코드**:
| 코드 | 설명 | 포인트 타입 |
|------|------|-----------|
| `signup_bonus` | 첫 가입 보너스 | 💖 하트 |
| `daily_checkin` | 출석 체크 | 💖 하트 |
| `streak_bonus` | 연속 출석 보너스 | 💖 하트 |
| `review_reward` | 리뷰 작성 보상 | 💖 하트 |
| `referral_reward` | 친구 초대 보상 | 💖 하트 |
| `diamond_purchase` | 다이아 충전 | 💎 다이아 |
| `job_posting_regular` | 지원 공고 등록 | 💎 다이아 |
| `job_posting_fixed` | 고정 공고 등록 | 💎 다이아 |
| `job_posting_urgent` | 긴급 공고 등록 | 💎 다이아 |
| `heart_expired` | 하트 만료 | 💖 하트 |
| `admin_grant` | 관리자 지급 | 둘 다 |
| `admin_deduct` | 관리자 차감 | 둘 다 |

**인덱스**: `createdAt`, `type`, `pointType`, `reasonCode`

---

## 🔧 TypeScript 인터페이스

### 핵심 타입 정의

```typescript
// types/unifiedData.ts

export interface Staff {
  id: string;
  staffId: string;           // 표준 필드 ✅
  name: string;
  role: StaffRole;
  phone?: string;
  email?: string;
  isActive: boolean;
  specialties?: string[];
  hourlyRate?: number;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface WorkLog {
  id: string;
  staffId: string;           // 표준 필드 ✅
  staffName: string;
  jobPostingId: string;      // 공고 ID (표준 필드) ✅
  jobPostingTitle?: string;  // 공고 제목 (역정규화)
  date: string;              // YYYY-MM-DD
  scheduledStartTime?: Timestamp;
  scheduledEndTime?: Timestamp;
  checkInTime?: Timestamp;   // 실제 출근 시간 ✅
  checkOutTime?: Timestamp;  // 실제 퇴근 시간 ✅
  role?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  basePay?: number;
  overtimePay?: number;
  totalPay?: number;
  status: WorkLogStatus;
  location?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface Application {
  id: string;
  jobPostingId: string;      // 공고 ID (표준 필드) ✅
  jobPostingTitle?: string;  // 공고 제목 (역정규화)
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  status: ApplicationStatus;
  assignments: Assignment[]; // v3.0 필수 ✅
  confirmationHistory?: ConfirmationHistoryEntry[];
  cancellationRequest?: CancellationRequest;
  applicationMessage?: string;
  adminNotes?: string;
  rejectionReason?: string;
  confirmedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastModifiedBy?: string;
}

// ============================================================================
// 역할 타입 정의 (⚠️ 두 가지 역할 체계 구분 필수)
// ============================================================================

/**
 * UserRole (사용자 권한) - 앱 기능 접근 권한
 * - admin: 관리자 (모든 기능)
 * - employer: 구인자 (공고 관리, 지원자 관리, 정산)
 * - staff: 스태프 (지원, 스케줄 확인, QR 출퇴근)
 *
 * ⚠️ users 컬렉션의 role 필드에 사용
 */
export type UserRole = 'admin' | 'employer' | 'staff';

/**
 * StaffRole (직무 역할) - 포커룸에서의 업무 역할
 * - dealer: 딜러
 * - manager: 매니저
 * - chiprunner: 칩러너
 * - floor: 플로어
 * - admin: 관리 (StaffRole의 admin은 UserRole과 다름)
 * - other: 기타 (customRole 필드와 함께 사용)
 *
 * ⚠️ staff 컬렉션, jobPostings 역할 모집, applications 지원 역할에 사용
 */
export type StaffRole = 'dealer' | 'manager' | 'chiprunner' | 'floor' | 'admin' | 'other';

// 역할 계층 상수 (숫자가 높을수록 상위 권한)
export const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,      // 전체 관리 (모든 권한)
  employer: 50,    // 구인자 (공고 관리, 지원자 관리, 정산)
  staff: 10,       // 스태프 (지원, 스케줄 확인, QR 출퇴근)
};

// 직무 역할 한글 표시명
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  dealer: '딜러',
  manager: '매니저',
  chiprunner: '칩러너',
  floor: '플로어',
  admin: '관리',
  other: '기타',
};

// 기타 유니언 타입 정의
export type WorkLogStatus = 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';
export type ApplicationStatus = 'applied' | 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'cancellation_pending';
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

// 복합 타입 정의 (v3.0)
export interface Assignment {
  // === 필수 필드 ===
  roleIds: string[];           // 역할 ID 배열 ["dealer", "floor", ...]
  timeSlot: string;            // 시간대 (예: "19:00", "14:00~22:00") ✅ 필수
  dates: string[];             // 지원 날짜들 ["YYYY-MM-DD", ...]
  isGrouped: boolean;          // 연속 날짜 그룹 여부 ✅ 필수

  // === 선택 필드 ===
  groupId?: string;            // 그룹 식별자
  checkMethod?: 'group' | 'individual';  // 체크 방식
  requirementId?: string;      // 모집 공고 구분자
  duration?: AssignmentDuration;  // 기간 정보
  isTimeToBeAnnounced?: boolean;  // 시간 미정 여부
  tentativeDescription?: string;  // 미정 사유
}

export interface AssignmentDuration {
  type: 'single' | 'consecutive' | 'multi';
  startDate: string;
  endDate?: string;
}

export interface ConfirmationHistoryEntry {
  action: 'confirmed' | 'rejected' | 'cancelled';
  timestamp: Timestamp;
  performedBy: string;
  reason?: string;
  affectedDates?: string[];
  affectedRoles?: string[];
}

export interface CancellationRequest {
  requestedAt: Timestamp;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface PayrollCalculation {
  staffId: string;
  staffName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  totalPay: number;
  workLogs: WorkLog[];
}
```

### 유틸리티 타입

```typescript
// types/common.ts

// 생성용 타입 (ID 제외)
export type CreateStaffData = Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateWorkLogData = Omit<WorkLog, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateApplicationData = Omit<Application, 'id' | 'createdAt' | 'updatedAt'>;

// 업데이트용 타입 (필수 필드만)
export type UpdateStaffData = Partial<Omit<Staff, 'id' | 'createdAt' | 'createdBy'>> & {
  updatedAt: Timestamp;
  lastModifiedBy: string;
};

// 필터링용 타입
export interface StaffFilter {
  role?: StaffRole;
  isActive?: boolean;
  searchTerm?: string;
}

export interface WorkLogFilter {
  staffId?: string;
  eventId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  status?: WorkLogStatus;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

## 🔄 데이터 변환 함수

### Firebase 문서 변환

```typescript
// services/dataTransforms.ts

import { DocumentData, Timestamp } from 'firebase/firestore';

// Firebase 문서를 Staff 객체로 변환
export const transformStaffData = (doc: DocumentData): Staff => ({
  id: doc.id,
  staffId: doc.staffId || doc.id, // fallback
  name: doc.name || '',
  role: doc.role || 'staff',
  phone: doc.phone,
  email: doc.email,
  isActive: doc.isActive ?? true,
  specialties: doc.specialties || [],
  hourlyRate: doc.hourlyRate,
  notes: doc.notes,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  createdBy: doc.createdBy || '',
  lastModifiedBy: doc.lastModifiedBy,
});

// Firebase 문서를 Application 객체로 변환 (v3.0 표준 필드 + 레거시 호환)
export const transformApplicationData = (doc: DocumentData): Application => ({
  id: doc.id,
  // 표준 필드 (레거시 fallback)
  jobPostingId: doc.jobPostingId || doc.eventId || doc.postId || '',  // ✅ 표준
  jobPostingTitle: doc.jobPostingTitle || doc.postTitle || '',        // ✅ 표준
  applicantId: doc.applicantId || '',
  applicantName: doc.applicantName || '',
  applicantPhone: doc.applicantPhone || '',
  status: doc.status || 'applied',
  // v3.0 Assignment 구조 (필수)
  assignments: doc.assignments || [],
  // 확정/취소 이력
  confirmationHistory: doc.confirmationHistory,
  cancellationRequest: doc.cancellationRequest,
  // 기타 필드
  applicationMessage: doc.applicationMessage,
  adminNotes: doc.adminNotes,
  rejectionReason: doc.rejectionReason,
  confirmedAt: doc.confirmedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  lastModifiedBy: doc.lastModifiedBy,
});

// WorkLog ID 패턴 생성 (v3.0 표준 필드명)
export const generateWorkLogId = (
  jobPostingId: string,  // ✅ 표준 필드명
  staffId: string,
  date: string,
  index: number = 0
): string => {
  return `${jobPostingId}_${staffId}_${index}_${date}`;
};

// 날짜 문자열 변환
export const formatDateString = (date: Date | Timestamp | string): string => {
  if (date instanceof Timestamp) {
    return format(date.toDate(), 'yyyy-MM-dd');
  }
  if (date instanceof Date) {
    return format(date, 'yyyy-MM-dd');
  }
  return date;
};

// 시간 계산 유틸리티
export const calculateWorkHours = (
  startTime: Timestamp,
  endTime: Timestamp
): number => {
  if (!startTime || !endTime) return 0;
  
  const diffMs = endTime.toMillis() - startTime.toMillis();
  return Math.max(0, diffMs / (1000 * 60 * 60)); // 시간 단위
};
```

### 급여 계산 함수

```typescript
// utils/payrollCalculations.ts

export interface PayrollSettings {
  regularHours: number;      // 정규 시간 (기본 8시간)
  overtimeRate: number;      // 초과근무 배율 (기본 1.5배)
  minimumWage: number;       // 최저임금
}

export const calculatePayroll = (
  workLogs: WorkLog[],
  settings: PayrollSettings = {
    regularHours: 8,
    overtimeRate: 1.5,
    minimumWage: 9620
  }
): PayrollCalculation[] => {
  const staffGroups = groupBy(workLogs, 'staffId');
  
  return Object.entries(staffGroups).map(([staffId, logs]) => {
    const totalHours = logs.reduce((sum, log) => sum + (log.hoursWorked || 0), 0);
    const regularHours = Math.min(totalHours, settings.regularHours * logs.length);
    const overtimeHours = Math.max(0, totalHours - regularHours);
    
    const hourlyRate = logs[0]?.hourlyRate || settings.minimumWage;
    const basePay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * settings.overtimeRate;
    const totalPay = basePay + overtimePay;
    
    return {
      staffId,
      staffName: logs[0]?.staffName || '',
      totalHours,
      regularHours,
      overtimeHours,
      basePay,
      overtimePay,
      totalPay,
      workLogs: logs,
    };
  });
};
```

## 📈 인덱스 최적화

### Firebase 인덱스 설정

```json
// firestore.indexes.json (최적화된 6개 인덱스)
{
  "indexes": [
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "applicantId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "workLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
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
      "collectionGroup": "attendanceRecords",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "staffId", "order": "ASCENDING" },
        { "fieldPath": "checkInTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "applicationDeadline", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "staff",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 쿼리 최적화 예시

```typescript
// 최적화된 쿼리 예시

// ✅ 인덱스 활용한 효율적 쿼리
const getActiveStaffByRole = async (role: StaffRole) => {
  return query(
    collection(db, 'staff'),
    where('isActive', '==', true),
    where('role', '==', role),
    orderBy('createdAt', 'desc')
  );
};

// ✅ 복합 인덱스 활용
const getWorkLogsByEventAndDate = async (eventId: string, startDate: string) => {
  return query(
    collection(db, 'workLogs'),
    where('eventId', '==', eventId),
    where('date', '>=', startDate),
    orderBy('date', 'desc')
  );
};

// ❌ 비효율적 쿼리 (인덱스 없음)
const badQuery = async () => {
  return query(
    collection(db, 'workLogs'),
    where('staffName', '>=', 'A'),    // 텍스트 검색은 비효율적
    orderBy('totalPay', 'desc')       // 인덱스 없는 정렬
  );
};
```

## 🔄 마이그레이션 가이드

### 필드명 변경 이력 (v2.0 → v3.0)

**공고 참조 ID**:
| 레거시 필드 | 현재 표준 필드 | 상태 |
|------------|--------------|------|
| `eventId` | `jobPostingId` | 🔄 마이그레이션 중 (하위호환 유지) |
| `postId` | `jobPostingId` | 🔄 마이그레이션 중 (하위호환 유지) |

**시간 필드**:
| 레거시 필드 | 현재 표준 필드 | 상태 |
|------------|--------------|------|
| `actualStartTime` | `checkInTime` | 🔄 마이그레이션 중 |
| `actualEndTime` | `checkOutTime` | 🔄 마이그레이션 중 |

**지원서 필드 (v3.0 Assignment 구조)**:
| 레거시 필드 | 현재 표준 필드 | 상태 |
|------------|--------------|------|
| `postTitle` | `jobPostingTitle` | 🔄 마이그레이션 중 |
| `appliedRoles` | `assignments[].roleIds` | ❌ 제거됨 |
| `preferredDates` | `assignments[].dates` | ❌ 제거됨 |

**역할 체계**:
| 레거시 역할 | 현재 역할 | 설명 |
|-----------|---------|------|
| `manager` | `employer` | 동일 권한 (50), 하위호환 유지 |
| `user` | `staff` | 기본 역할로 통합 |

**공고 상태**:
| 레거시 상태 | 현재 상태 | 설명 |
|-----------|---------|------|
| `draft` | - | 사용 안함 |
| `published` | `active` | 활성 공고 |

**공고 타입**:
| v2.0 | v3.0 추가 |
|------|---------|
| `regular`, `fixed`, `tournament` | `urgent` |

### 하위 호환성 유지 정책

Firestore Rules에서 레거시 필드를 계속 허용하므로:
- ✅ 기존 데이터 읽기: 문제 없음
- ✅ 새 데이터 쓰기: 표준 필드명 사용 (`jobPostingId`, `checkInTime` 등)
- ✅ 점진적 마이그레이션 가능

```typescript
// 읽기 시 정규화 (IdNormalizer 패턴)
const jobPostingId = doc.jobPostingId || doc.eventId || doc.postId;
const checkInTime = doc.checkInTime || doc.actualStartTime;
```

### 새로운 필드 추가 가이드

```typescript
// 1. 타입 정의 업데이트
interface Staff {
  // 기존 필드들...
  newField?: string;  // 선택적 필드로 시작
}

// 2. 데이터 변환 함수 업데이트
export const transformStaffData = (doc: DocumentData): Staff => ({
  // 기존 변환...
  newField: doc.newField, // 새 필드 추가
});

// 3. 기본값 처리
const getStaffWithDefaults = (staff: Staff): Staff => ({
  ...staff,
  newField: staff.newField ?? 'defaultValue', // 기본값 설정
});
```

### 스키마 버전 관리

```typescript
// 스키마 버전 추적
interface SchemaMetadata {
  version: string;
  lastUpdated: Timestamp;
  changes: {
    type: 'add' | 'remove' | 'modify';
    field: string;
    description: string;
  }[];
}

const CURRENT_SCHEMA_VERSION = '4.3.0';

// 버전 호환성 체크
const isCompatibleVersion = (version: string): boolean => {
  const [major, minor] = version.split('.').map(Number);
  const [currentMajor, currentMinor] = CURRENT_SCHEMA_VERSION.split('.').map(Number);
  
  // 메이저 버전이 같고, 마이너 버전이 현재 이하인 경우 호환
  return major === currentMajor && minor <= currentMinor;
};
```

## 🔗 관련 문서

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: 데이터 흐름 및 아키텍처
- **[DEVELOPMENT_GUIDE.md](../core/DEVELOPMENT_GUIDE.md)**: 데이터 타입 사용법
- **[API_REFERENCE.md](./API_REFERENCE.md)**: Firebase Functions 및 API
- **[TROUBLESHOOTING.md](../operations/TROUBLESHOOTING.md)**: 데이터 관련 이슈 해결

---

*마지막 업데이트: 2026년 1월 31일 - v3.0 스키마 통합 (Assignment 구조 완성, UserRole/StaffRole 구분, 누락 컬렉션 추가)*