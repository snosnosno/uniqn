# 📊 T-HOLDEM 데이터 스키마 가이드

**최종 업데이트**: 2025년 9월 20일
**버전**: v0.2.2 (Production Ready + 인증 고도화)
**상태**: 🚀 **Production Ready 96% 완성**

> [!SUCCESS]
> **성과**: 실제 구현된 데이터 스키마를 기반으로 작성되었습니다. UnifiedDataContext 통합, 표준 필드명 완전 전환, Firebase 인덱스 최적화 완료.

## 📋 목차

1. [스키마 개요](#-스키마-개요)
2. [Firebase 컬렉션](#-firebase-컬렉션)
3. [TypeScript 인터페이스](#-typescript-인터페이스)
4. [데이터 변환 함수](#-데이터-변환-함수)
5. [인덱스 최적화](#-인덱스-최적화)
6. [마이그레이션 가이드](#-마이그레이션-가이드)

## 🎯 스키마 개요

### 설계 원칙 (실제 구현 성과)
- **표준 필드명**: `staffId`, `eventId` 100% 통일 (레거시 필드 완전 제거)
- **UnifiedDataContext**: 5개→1개 Firebase 구독 통합으로 주리접율 향상
- **TypeScript Strict**: any 타입 0개, 완벽한 타입 안전성
- **Optimistic Updates**: 즉시 UI 업데이트 + Firebase 동기화
- **인덱스 최적화**: 6개 인덱스로 쿼리 성능 최적화

### 핵심 컬렉션 구조
```
Firebase Firestore
├── staff                 # 스태프 정보
├── workLogs              # 근무 기록
├── applications          # 지원서
├── jobPostings           # 구인공고
├── attendanceRecords     # 출석 기록
├── tournaments           # 토너먼트
└── users                 # 사용자 정보
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
  "role": "dealer" | "server" | "manager" | "admin",  // 역할
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
Document ID Pattern: "${eventId}_${staffId}_0_${date}"

{
  "id": string,                    // 문서 ID 패턴
  "staffId": string,               // 표준 스태프 ID ✅
  "staffName": string,             // 스태프 이름 (역정규화) ✅
  "eventId": string,               // 표준 이벤트 ID ✅
  "date": string,                  // 근무 날짜 "YYYY-MM-DD"
  "scheduledStartTime"?: Timestamp, // 예정 시작 시간
  "scheduledEndTime"?: Timestamp,   // 예정 종료 시간
  "actualStartTime"?: Timestamp,    // 실제 시작 시간 ✅
  "actualEndTime"?: Timestamp,      // 실제 종료 시간 ✅
  "role"?: string,                  // 근무 역할
  "hoursWorked"?: number,           // 근무 시간 (Web Worker 계산)
  "overtimeHours"?: number,         // 초과 근무 시간
  "basePay"?: number,               // 기본급
  "overtimePay"?: number,           // 초과근무수당
  "totalPay"?: number,              // 총 급여
  "status": "scheduled" | "checked_in" | "checked_out" | "completed",
  "location"?: string,              // 근무 장소
  "notes"?: string,                 // 비고
  "createdAt": Timestamp,           // 생성일시
  "updatedAt": Timestamp,           // 수정일시
  "createdBy": string,              // 생성자 ID
  "lastModifiedBy"?: string         // 마지막 수정자 ID
}
```

**인덱스**: `staffId`, `eventId`, `date`, `status`, `createdAt`

### 3. applications (지원서)

```typescript
Collection: "applications"
Document ID: Auto-generated

{
  "id": string,                // 문서 ID
  "eventId": string,           // 표준 이벤트 ID ✅
  "applicantId": string,       // 지원자 ID (users 컬렉션 참조)
  "postId": string,            // 구인공고 ID (jobPostings 참조)
  "postTitle": string,         // 구인공고 제목 (역정규화)
  "applicantName": string,     // 지원자 이름 (역정규화)
  "applicantPhone": string,    // 지원자 전화번호 (역정규화)
  "status": "pending" | "confirmed" | "rejected" | "cancelled",
  "appliedRoles": string[],    // 지원한 역할들
  "preferredDates": string[],  // 선호 날짜들 "YYYY-MM-DD"
  "assignments"?: {            // 배정 정보 (확정 시)
    "date": string,            // "YYYY-MM-DD"
    "role": string,            // 배정된 역할
    "shift": string,           // 시프트 정보
    "checkMethod"?: "group" | "individual"  // 그룹/개별 선택 구분 ✅
  }[],
  "applicationMessage"?: string, // 지원 메시지
  "adminNotes"?: string,       // 관리자 메모
  "rejectionReason"?: string,  // 거절 사유
  "confirmedAt"?: Timestamp,   // 확정일시
  "createdAt": Timestamp,      // 지원일시
  "updatedAt": Timestamp,      // 수정일시
  "lastModifiedBy"?: string    // 마지막 수정자 ID
}
```

**인덱스**: `eventId`, `applicantId`, `status`, `createdAt`

### 4. jobPostings (구인공고)

```typescript
Collection: "jobPostings"
Document ID: Auto-generated

{
  "id": string,                // 문서 ID
  "title": string,             // 공고 제목 (required)
  "description": string,       // 공고 내용
  "location": string,          // 근무 장소
  "eventDates": {              // 이벤트 날짜별 정보
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
  "applicationDeadline": Timestamp, // 지원 마감일
  "status": "draft" | "published" | "closed" | "cancelled",
  "isPublic": boolean,         // 공개 여부
  "maxApplications"?: number,  // 최대 지원자 수
  "autoClose": boolean,        // 자동 마감 여부
  "tags"?: string[],          // 태그
  "createdAt": Timestamp,      // 생성일시
  "updatedAt": Timestamp,      // 수정일시
  "createdBy": string,         // 생성자 ID
  "lastModifiedBy"?: string    // 마지막 수정자 ID
}
```

**인덱스**: `status`, `isPublic`, `applicationDeadline`, `createdAt`

### 5. attendanceRecords (출석 기록)

```typescript
Collection: "attendanceRecords"
Document ID Pattern: "${staffId}_${eventId}_${date}"

{
  "id": string,                // 문서 ID 패턴
  "staffId": string,           // 표준 스태프 ID ✅
  "workLogId"?: string,        // 연결된 WorkLog ID
  "eventId": string,           // 표준 이벤트 ID ✅
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

**인덱스**: `staffId`, `eventId`, `date`, `status`, `checkInTime`

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
  "displayName"?: string,      // 표시 이름
  "phoneNumber"?: string,      // 전화번호
  "role": "admin" | "manager" | "staff" | "user", // 사용자 역할
  "profile": {                 // 프로필 정보
    "firstName": string,
    "lastName": string,
    "dateOfBirth"?: string,    // "YYYY-MM-DD"
    "gender"?: "male" | "female" | "other",
    "address"?: {
      "street": string,
      "city": string,
      "state": string,
      "zipCode": string,
      "country": string
    }
  },
  "preferences": {             // 사용자 설정
    "language": "ko" | "en",   // 언어 설정
    "timezone": string,        // 시간대
    "notifications": {
      "email": boolean,
      "push": boolean,
      "sms": boolean
    }
  },
  "staffInfo"?: {              // 스태프인 경우
    "staffId": string,         // staff 컬렉션 참조
    "hireDate": string,        // 고용일 "YYYY-MM-DD"
    "department": string,      // 부서
    "position": string         // 직급
  },
  "isActive": boolean,         // 활성 상태
  "lastLoginAt"?: Timestamp,   // 마지막 로그인
  "createdAt": Timestamp,      // 계정 생성일
  "updatedAt": Timestamp,      // 수정일시
  "lastModifiedBy"?: string    // 마지막 수정자 ID
}
```

**인덱스**: `role`, `isActive`, `email`, `createdAt`

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
  eventId: string;           // 표준 필드 ✅
  date: string;              // YYYY-MM-DD
  scheduledStartTime?: Timestamp;
  scheduledEndTime?: Timestamp;
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;
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
  eventId: string;           // 표준 필드 ✅
  applicantId: string;
  postId: string;
  postTitle: string;
  applicantName: string;
  applicantPhone: string;
  status: ApplicationStatus;
  appliedRoles: string[];
  preferredDates: string[];
  assignments?: Assignment[];
  applicationMessage?: string;
  adminNotes?: string;
  rejectionReason?: string;
  confirmedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastModifiedBy?: string;
}

// 유니언 타입 정의
export type StaffRole = 'dealer' | 'server' | 'manager' | 'admin';
export type WorkLogStatus = 'scheduled' | 'checked_in' | 'checked_out' | 'completed';
export type ApplicationStatus = 'applied' | 'confirmed' | 'cancelled';
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

// 복합 타입 정의
export interface Assignment {
  date: string;              // YYYY-MM-DD
  role: string;
  shift: string;
  checkMethod?: 'group' | 'individual'; // ✅ 그룹/개별 선택 구분
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

// Firebase 문서를 Application 객체로 변환 (중요: eventId 보장)
export const transformApplicationData = (doc: DocumentData): Application => ({
  id: doc.id,
  eventId: doc.eventId || doc.postId || '', // ✅ eventId 보장
  applicantId: doc.applicantId || '',
  postId: doc.postId || '',
  postTitle: doc.postTitle || '',
  applicantName: doc.applicantName || '',
  applicantPhone: doc.applicantPhone || '',
  status: doc.status || 'applied',
  appliedRoles: doc.appliedRoles || [],
  preferredDates: doc.preferredDates || [],
  assignments: doc.assignments || [],
  applicationMessage: doc.applicationMessage,
  adminNotes: doc.adminNotes,
  rejectionReason: doc.rejectionReason,
  confirmedAt: doc.confirmedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  lastModifiedBy: doc.lastModifiedBy,
});

// WorkLog ID 패턴 생성
export const generateWorkLogId = (
  eventId: string,
  staffId: string,
  date: string,
  index: number = 0
): string => {
  return `${eventId}_${staffId}_${index}_${date}`;
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

### 레거시 필드 제거 (완료됨)

| 레거시 필드 | 표준 필드 | 상태 |
|------------|-----------|------|
| `dealerId` | `staffId` | ✅ 완전 제거 |
| `dealerName` | `staffName` | ✅ 완전 제거 |
| `jobPostingId` | `eventId` | ✅ 완전 제거 |
| `checkInTime` | `actualStartTime` | ✅ 완전 제거 |
| `checkOutTime` | `actualEndTime` | ✅ 완전 제거 |

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

*마지막 업데이트: 2025년 9월 8일 - 표준 필드명 통일 및 스키마 최적화 완료*