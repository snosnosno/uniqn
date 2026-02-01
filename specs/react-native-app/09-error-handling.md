# 09. 에러 처리 전략

> **구현 완료**: v1.0.0 기준 에러 시스템 전체 구현됨
> **파일 위치**: `src/errors/` (6개 파일, 30+ 에러 클래스)

## 목차

1. [에러 분류 체계](#1-에러-분류-체계)
2. [에러 클래스 계층 구조](#2-에러-클래스-계층-구조)
3. [에러 코드 체계](#3-에러-코드-체계)
4. [Firebase 에러 매핑](#4-firebase-에러-매핑)
5. [비즈니스 에러 클래스](#5-비즈니스-에러-클래스)
6. [에러 처리 유틸리티](#6-에러-처리-유틸리티)
7. [사용자 피드백 전략](#7-사용자-피드백-전략)
8. [복구 및 재시도 전략](#8-복구-및-재시도-전략)
9. [오프라인 에러 처리](#9-오프라인-에러-처리)
10. [실제 사용 예제](#10-실제-사용-예제)

---

## 1. 에러 분류 체계

### 에러 카테고리 (8가지)

```typescript
// src/errors/AppError.ts
type ErrorCategory =
  | 'network'      // 네트워크 연결 (E1xxx)
  | 'auth'         // 인증 관련 (E2xxx)
  | 'validation'   // 입력값 검증 (E3xxx)
  | 'firebase'     // Firebase 서비스 (E4xxx)
  | 'security'     // 보안 관련 (E5xxx)
  | 'business'     // 비즈니스 로직 (E6xxx)
  | 'permission'   // 권한 부족 (E4xxx 일부)
  | 'unknown';     // 분류 불가 (E7xxx)
```

### 에러 심각도 (Severity)

```typescript
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
```

| 심각도 | 동작 | 사용 예시 |
|--------|------|----------|
| `low` | Toast 표시 | 이미 지원함, 정원 초과, 중복 신고 |
| `medium` | Alert 표시 | 네트워크 오류, 인증 실패, FCM 토큰 실패 |
| `high` | Alert + 추가 처리 | 권한 거부, 세션 만료 |
| `critical` | 앱 크래시 리포팅 | Firebase 데이터 손실 |

### 기본 심각도 할당

```typescript
NetworkError:     severity: 'medium'
AuthError:        severity: 'medium'
ValidationError:  severity: 'low'
PermissionError:  severity: 'medium'
BusinessError:    severity: 'low'
AppError (기본):  severity: 'medium'
```

---

## 2. 에러 클래스 계층 구조

### 파일 구조

```
src/errors/
├── AppError.ts              # 기본 클래스 + 에러 코드 정의
├── BusinessErrors.ts        # 비즈니스 에러 20개
├── NotificationErrors.ts    # 알림 에러 4개
├── errorUtils.ts            # 유틸리티 함수
├── firebaseErrorMapper.ts   # Firebase 에러 변환
├── serviceErrorHandler.ts   # 서비스 통합 핸들러
└── index.ts                 # 배럴 export
```

### 클래스 계층

```
AppError (기본 클래스)
├── NetworkError           # 네트워크 에러
├── AuthError              # 인증 에러
├── ValidationError        # 검증 에러
├── PermissionError        # 권한 에러
└── BusinessError          # 비즈니스 에러
    ├── 지원 관련
    │   ├── AlreadyAppliedError
    │   ├── ApplicationClosedError
    │   └── MaxCapacityReachedError
    ├── 출퇴근 관련
    │   ├── AlreadyCheckedInError
    │   ├── NotCheckedInError
    │   ├── InvalidQRCodeError
    │   ├── ExpiredQRCodeError
    │   ├── QRSecurityMismatchError
    │   ├── QRWrongEventError
    │   └── QRWrongDateError
    ├── 정산 관련
    │   ├── AlreadySettledError
    │   └── InvalidWorkLogError
    ├── 신고 관련
    │   ├── DuplicateReportError
    │   ├── ReportNotFoundError
    │   ├── ReportAlreadyReviewedError
    │   └── CannotReportSelfError
    └── 알림 관련 (NotificationErrors.ts)
        ├── NotificationPermissionError
        ├── FCMTokenError
        ├── NotificationSendError
        └── InvalidNotificationLinkError
```

### AppError 기본 구조

```typescript
// src/errors/AppError.ts
class AppError extends Error {
  // 필수 속성
  readonly code: string;                      // E1001, E2005 등
  readonly category: ErrorCategory;           // 8가지 카테고리
  readonly severity: ErrorSeverity;           // low/medium/high/critical
  readonly userMessage: string;               // 사용자 표시 메시지 (한글)
  readonly isRetryable: boolean;              // 재시도 가능 여부

  // 선택 속성
  readonly originalError?: Error;             // 원본 에러
  readonly metadata?: Record<string, unknown>; // 추가 정보

  // 메서드
  toJSON(): object                            // 로깅용 직렬화
}
```

---

## 3. 에러 코드 체계

### 에러 코드 범위

| 범위 | 카테고리 | 설명 |
|------|----------|------|
| **E1xxx** | Network | 오프라인, 타임아웃, 서버 도달 불가, 요청 실패 |
| **E2xxx** | Auth | 유효성 검사, 계정 없음, 약한 비밀번호, 토큰 만료 |
| **E3xxx** | Validation | 필수 필드, 형식 오류, 길이 오류, 스키마 검증 |
| **E4xxx** | Firebase | 권한 거부, 문서 없음, 할당량 초과, 사용 불가 |
| **E5xxx** | Security | XSS 감지, 권한 없음, 속도 제한 |
| **E6xxx** | Business | 지원/출퇴근/정산/신고/알림 관련 |
| **E7xxx** | Unknown | 알 수 없는 에러 |

### 에러 코드 상수

```typescript
// src/errors/AppError.ts
export const ERROR_CODES = {
  // Network (E1xxx)
  NETWORK_OFFLINE: 'E1001',
  NETWORK_TIMEOUT: 'E1002',
  NETWORK_SERVER_UNREACHABLE: 'E1003',
  NETWORK_REQUEST_FAILED: 'E1004',

  // Auth (E2xxx)
  AUTH_INVALID_CREDENTIALS: 'E2001',
  AUTH_USER_NOT_FOUND: 'E2002',
  AUTH_EMAIL_ALREADY_EXISTS: 'E2003',
  AUTH_WEAK_PASSWORD: 'E2004',
  AUTH_TOKEN_EXPIRED: 'E2005',
  AUTH_SESSION_EXPIRED: 'E2006',
  AUTH_ACCOUNT_DISABLED: 'E2007',
  AUTH_INVALID_VERIFICATION_CODE: 'E2008',
  AUTH_TOO_MANY_REQUESTS: 'E2009',
  AUTH_REQUIRES_RECENT_LOGIN: 'E2010',
  AUTH_POPUP_CLOSED: 'E2011',

  // Validation (E3xxx)
  VALIDATION_REQUIRED: 'E3001',
  VALIDATION_FORMAT: 'E3002',
  VALIDATION_LENGTH: 'E3003',
  VALIDATION_RANGE: 'E3004',
  VALIDATION_SCHEMA: 'E3005',

  // Firebase (E4xxx)
  FIREBASE_PERMISSION_DENIED: 'E4001',
  FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
  FIREBASE_QUOTA_EXCEEDED: 'E4003',
  FIREBASE_UNAVAILABLE: 'E4004',
  FIREBASE_ABORTED: 'E4005',

  // Security (E5xxx)
  SECURITY_XSS_DETECTED: 'E5001',
  SECURITY_UNAUTHORIZED: 'E5002',
  SECURITY_RATE_LIMITED: 'E5003',

  // Business (E6xxx)
  BUSINESS_ALREADY_APPLIED: 'E6002',
  BUSINESS_APPLICATION_CLOSED: 'E6003',
  BUSINESS_MAX_CAPACITY_REACHED: 'E6004',
  BUSINESS_ALREADY_CHECKED_IN: 'E6005',
  BUSINESS_NOT_CHECKED_IN: 'E6006',
  BUSINESS_INVALID_QR_CODE: 'E6007',
  BUSINESS_EXPIRED_QR_CODE: 'E6008',
  BUSINESS_ALREADY_SETTLED: 'E6009',
  BUSINESS_INVALID_WORK_LOG: 'E6010',
  BUSINESS_QR_SECURITY_MISMATCH: 'E6011',
  BUSINESS_QR_WRONG_EVENT: 'E6012',
  BUSINESS_QR_WRONG_DATE: 'E6013',
  BUSINESS_PARTIAL_SCHEDULE_FAILURE: 'E6020',
  BUSINESS_DUPLICATE_REPORT: 'E6030',
  BUSINESS_REPORT_NOT_FOUND: 'E6031',
  BUSINESS_REPORT_ALREADY_REVIEWED: 'E6032',
  BUSINESS_CANNOT_REPORT_SELF: 'E6033',
  BUSINESS_REPORT_COOLDOWN: 'E6034',
  BUSINESS_CANCELLATION_ALREADY_REQUESTED: 'E6040',
  BUSINESS_CANCELLATION_NOT_FOUND: 'E6041',
  BUSINESS_CANCELLATION_ALREADY_PROCESSED: 'E6042',
  BUSINESS_CANNOT_CANCEL_CHECKED_IN: 'E6043',
  BUSINESS_CANCELLATION_DEADLINE_PASSED: 'E6044',
  NOTIFICATION_PERMISSION_DENIED: 'E6050',
  NOTIFICATION_TOKEN_ERROR: 'E6051',
  NOTIFICATION_SEND_ERROR: 'E6052',
  NOTIFICATION_INVALID_LINK: 'E6053',

  // Unknown (E7xxx)
  UNKNOWN: 'E7000',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

### 사용자 친화적 메시지

```typescript
// src/errors/AppError.ts
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Network
  E1001: '인터넷 연결을 확인해주세요',
  E1002: '요청 시간이 초과되었습니다. 다시 시도해주세요',
  E1003: '서버에 연결할 수 없습니다',
  E1004: '요청에 실패했습니다. 다시 시도해주세요',

  // Auth
  E2001: '이메일 또는 비밀번호가 올바르지 않습니다',
  E2002: '등록되지 않은 사용자입니다',
  E2003: '이미 사용 중인 이메일입니다',
  E2004: '비밀번호가 너무 약합니다',
  E2005: '로그인이 만료되었습니다. 다시 로그인해주세요',
  E2006: '세션이 만료되었습니다. 다시 로그인해주세요',
  E2007: '비활성화된 계정입니다. 고객센터에 문의해주세요',
  E2008: '인증 코드가 올바르지 않습니다',
  E2009: '너무 많은 요청이 있었습니다. 잠시 후 다시 시도해주세요',
  E2010: '보안을 위해 다시 로그인해주세요',
  E2011: '로그인 창이 닫혔습니다. 다시 시도해주세요',

  // Validation
  E3001: '필수 항목을 입력해주세요',
  E3002: '입력 형식이 올바르지 않습니다',
  E3003: '입력 길이가 올바르지 않습니다',
  E3004: '허용된 범위를 벗어났습니다',
  E3005: '입력값이 올바르지 않습니다',

  // Firebase
  E4001: '접근 권한이 없습니다',
  E4002: '데이터를 찾을 수 없습니다',
  E4003: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요',
  E4004: '서비스를 일시적으로 사용할 수 없습니다',
  E4005: '요청이 중단되었습니다',

  // Security
  E5001: '보안상 위험한 입력이 감지되었습니다',
  E5002: '권한이 없습니다',
  E5003: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',

  // Business
  E6002: '이미 지원한 공고입니다',
  E6003: '지원이 마감되었습니다',
  E6004: '모집 인원이 마감되었습니다',
  E6005: '이미 출근 처리되었습니다',
  E6006: '출근 기록이 없습니다. 먼저 출근 처리해주세요',
  E6007: '유효하지 않은 QR 코드입니다',
  E6008: 'QR 코드가 만료되었습니다',
  E6009: '이미 정산이 완료되었습니다',
  E6010: '유효하지 않은 근무 기록입니다',
  E6011: 'QR 코드 보안 검증에 실패했습니다',
  E6012: '해당 공고의 QR 코드가 아닙니다',
  E6013: '오늘 날짜의 QR 코드가 아닙니다',
  E6020: '일부 스케줄 조회에 실패했습니다',
  E6030: '이미 해당 건에 대해 신고하셨습니다',
  E6031: '신고 내역을 찾을 수 없습니다',
  E6032: '이미 처리된 신고입니다',
  E6033: '본인을 신고할 수 없습니다',
  E6034: '신고는 24시간에 한 번만 가능합니다',
  E6040: '이미 취소 요청 중입니다',
  E6041: '취소 요청을 찾을 수 없습니다',
  E6042: '이미 처리된 취소 요청입니다',
  E6043: '출근 후에는 취소할 수 없습니다',
  E6044: '취소 가능 기한이 지났습니다',
  E6050: '알림 권한이 거부되었습니다',
  E6051: '알림 토큰 발급에 실패했습니다',
  E6052: '알림 전송에 실패했습니다',
  E6053: '유효하지 않은 알림 링크입니다',

  // Unknown
  E7000: '알 수 없는 오류가 발생했습니다',
};
```

---

## 4. Firebase 에러 매핑

### 매핑 전략

```
Firebase 에러 코드 → AppError로 자동 변환
                  ↓
              에러 코드 확인
              (auth/, storage/, firestore/)
                  ↓
              매핑 테이블 조회
              (FIREBASE_*_ERROR_MAP)
                  ↓
          전문화된 에러 클래스 생성
    (AuthError, NetworkError, PermissionError 등)
```

### Firebase Auth 에러 매핑

```typescript
// src/errors/firebaseErrorMapper.ts
const FIREBASE_AUTH_ERROR_MAP: Record<string, { code: ErrorCode; category: ErrorCategory }> = {
  'auth/invalid-email': { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, category: 'auth' },
  'auth/invalid-credential': { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, category: 'auth' },
  'auth/user-disabled': { code: ERROR_CODES.AUTH_ACCOUNT_DISABLED, category: 'auth' },
  'auth/user-not-found': { code: ERROR_CODES.AUTH_USER_NOT_FOUND, category: 'auth' },
  'auth/wrong-password': { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, category: 'auth' },
  'auth/email-already-in-use': { code: ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS, category: 'auth' },
  'auth/weak-password': { code: ERROR_CODES.AUTH_WEAK_PASSWORD, category: 'auth' },
  'auth/too-many-requests': { code: ERROR_CODES.AUTH_TOO_MANY_REQUESTS, category: 'auth' },
  'auth/id-token-expired': { code: ERROR_CODES.AUTH_TOKEN_EXPIRED, category: 'auth' },
  'auth/session-cookie-expired': { code: ERROR_CODES.AUTH_SESSION_EXPIRED, category: 'auth' },
  'auth/requires-recent-login': { code: ERROR_CODES.AUTH_REQUIRES_RECENT_LOGIN, category: 'auth' },
  'auth/popup-closed-by-user': { code: ERROR_CODES.AUTH_POPUP_CLOSED, category: 'auth' },
  'auth/network-request-failed': { code: ERROR_CODES.NETWORK_OFFLINE, category: 'network' },
  'auth/timeout': { code: ERROR_CODES.NETWORK_TIMEOUT, category: 'network' },
};
```

### Firebase Firestore 에러 매핑

```typescript
const FIREBASE_FIRESTORE_ERROR_MAP: Record<string, { code: ErrorCode; category: ErrorCategory }> = {
  'permission-denied': { code: ERROR_CODES.FIREBASE_PERMISSION_DENIED, category: 'permission' },
  'not-found': { code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, category: 'firebase' },
  'already-exists': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  'resource-exhausted': { code: ERROR_CODES.FIREBASE_QUOTA_EXCEEDED, category: 'firebase' },
  'failed-precondition': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  'aborted': { code: ERROR_CODES.FIREBASE_ABORTED, category: 'firebase' },
  'unavailable': { code: ERROR_CODES.FIREBASE_UNAVAILABLE, category: 'network' },
  'unauthenticated': { code: ERROR_CODES.AUTH_SESSION_EXPIRED, category: 'auth' },
  'deadline-exceeded': { code: ERROR_CODES.NETWORK_TIMEOUT, category: 'network' },
  'cancelled': { code: ERROR_CODES.FIREBASE_ABORTED, category: 'firebase' },
};
```

### Firebase Storage 에러 매핑

```typescript
const FIREBASE_STORAGE_ERROR_MAP: Record<string, { code: ErrorCode; category: ErrorCategory }> = {
  'storage/object-not-found': { code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, category: 'firebase' },
  'storage/quota-exceeded': { code: ERROR_CODES.FIREBASE_QUOTA_EXCEEDED, category: 'firebase' },
  'storage/unauthenticated': { code: ERROR_CODES.AUTH_SESSION_EXPIRED, category: 'auth' },
  'storage/unauthorized': { code: ERROR_CODES.FIREBASE_PERMISSION_DENIED, category: 'permission' },
  'storage/retry-limit-exceeded': { code: ERROR_CODES.NETWORK_REQUEST_FAILED, category: 'network' },
  'storage/invalid-checksum': { code: ERROR_CODES.VALIDATION_SCHEMA, category: 'validation' },
  'storage/invalid-url': { code: ERROR_CODES.VALIDATION_FORMAT, category: 'validation' },
};
```

### 매핑 함수

```typescript
// src/errors/firebaseErrorMapper.ts
export function mapFirebaseError(error: unknown): AppError {
  if (!isFirebaseError(error)) {
    return normalizeError(error);
  }

  const firebaseError = error as FirebaseError;
  const errorCode = firebaseError.code;

  // Auth 에러
  if (errorCode.startsWith('auth/')) {
    const mapping = FIREBASE_AUTH_ERROR_MAP[errorCode];
    if (mapping) {
      return new AuthError({
        code: mapping.code,
        category: mapping.category,
        originalError: firebaseError,
        metadata: { firebaseCode: errorCode },
      });
    }
  }

  // Storage 에러
  if (errorCode.startsWith('storage/')) {
    const mapping = FIREBASE_STORAGE_ERROR_MAP[errorCode];
    if (mapping) {
      return createAppErrorByCategory(mapping, firebaseError);
    }
  }

  // Firestore 에러
  const firestoreMapping = FIREBASE_FIRESTORE_ERROR_MAP[errorCode];
  if (firestoreMapping) {
    return createAppErrorByCategory(firestoreMapping, firebaseError);
  }

  // 기본 AppError
  return new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'firebase',
    originalError: firebaseError,
    metadata: { firebaseCode: errorCode },
  });
}

function isFirebaseError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}
```

---

## 5. 비즈니스 에러 클래스

### 지원 관련 에러

```typescript
// src/errors/BusinessErrors.ts
export class AlreadyAppliedError extends AppError {
  constructor(options: { jobPostingId: string; applicationId?: string }) {
    super({
      code: ERROR_CODES.BUSINESS_ALREADY_APPLIED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      metadata: options,
    });
    this.name = 'AlreadyAppliedError';
  }
}

export class ApplicationClosedError extends AppError {
  constructor(options: { jobPostingId: string }) {
    super({
      code: ERROR_CODES.BUSINESS_APPLICATION_CLOSED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      metadata: options,
    });
    this.name = 'ApplicationClosedError';
  }
}

export class MaxCapacityReachedError extends AppError {
  constructor(options: { jobPostingId: string; maxCapacity?: number; currentCount?: number }) {
    super({
      code: ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      metadata: options,
    });
    this.name = 'MaxCapacityReachedError';
  }
}
```

### QR 관련 에러

```typescript
export class InvalidQRCodeError extends AppError {
  constructor(options?: { reason?: string }) {
    super({
      code: ERROR_CODES.BUSINESS_INVALID_QR_CODE,
      category: 'business',
      severity: 'low',
      isRetryable: true, // 재스캔 가능
      metadata: options,
    });
    this.name = 'InvalidQRCodeError';
  }
}

export class ExpiredQRCodeError extends AppError {
  constructor(options?: { expiredAt?: string }) {
    super({
      code: ERROR_CODES.BUSINESS_EXPIRED_QR_CODE,
      category: 'business',
      severity: 'low',
      isRetryable: true, // 새 QR 코드 가능
      metadata: options,
    });
    this.name = 'ExpiredQRCodeError';
  }
}

export class QRSecurityMismatchError extends AppError {
  constructor() {
    super({
      code: ERROR_CODES.BUSINESS_QR_SECURITY_MISMATCH,
      category: 'business',
      severity: 'medium',
      isRetryable: true,
    });
    this.name = 'QRSecurityMismatchError';
  }
}

export class QRWrongEventError extends AppError {
  constructor(options: { expectedEventId: string; actualEventId: string }) {
    super({
      code: ERROR_CODES.BUSINESS_QR_WRONG_EVENT,
      category: 'business',
      severity: 'low',
      isRetryable: true,
      metadata: options,
    });
    this.name = 'QRWrongEventError';
  }
}

export class QRWrongDateError extends AppError {
  constructor(options: { expectedDate: string; actualDate: string }) {
    super({
      code: ERROR_CODES.BUSINESS_QR_WRONG_DATE,
      category: 'business',
      severity: 'low',
      isRetryable: true,
      metadata: options,
    });
    this.name = 'QRWrongDateError';
  }
}
```

### 신고 관련 에러

```typescript
export class DuplicateReportError extends AppError {
  constructor(options: { targetId: string; existingReportId?: string }) {
    super({
      code: ERROR_CODES.BUSINESS_DUPLICATE_REPORT,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      metadata: options,
    });
    this.name = 'DuplicateReportError';
  }
}

export class CannotReportSelfError extends AppError {
  constructor() {
    super({
      code: ERROR_CODES.BUSINESS_CANNOT_REPORT_SELF,
      category: 'business',
      severity: 'low',
      isRetryable: false,
    });
    this.name = 'CannotReportSelfError';
  }
}
```

### 알림 관련 에러

```typescript
// src/errors/NotificationErrors.ts
export class NotificationPermissionError extends AppError {
  constructor() {
    super({
      code: ERROR_CODES.NOTIFICATION_PERMISSION_DENIED,
      category: 'business',
      severity: 'medium',
      isRetryable: false,
    });
    this.name = 'NotificationPermissionError';
  }
}

export class FCMTokenError extends AppError {
  constructor(options?: { reason?: string }) {
    super({
      code: ERROR_CODES.NOTIFICATION_TOKEN_ERROR,
      category: 'business',
      severity: 'medium',
      isRetryable: true,
      metadata: options,
    });
    this.name = 'FCMTokenError';
  }
}
```

---

## 6. 에러 처리 유틸리티

### 에러 정규화 (normalizeError)

```typescript
// src/errors/errorUtils.ts
export function normalizeError(error: unknown, context?: string): AppError {
  // 이미 AppError인 경우
  if (isAppError(error)) {
    return error;
  }

  // Firebase 에러
  if (isFirebaseError(error)) {
    return mapFirebaseError(error);
  }

  // TypeError (네트워크 관련)
  if (error instanceof TypeError) {
    return new NetworkError({
      code: ERROR_CODES.NETWORK_REQUEST_FAILED,
      originalError: error,
      metadata: { context },
    });
  }

  // Error 객체
  if (error instanceof Error) {
    // 네트워크 패턴 매칭
    if (/network|timeout|offline|fetch/i.test(error.message)) {
      return new NetworkError({
        code: ERROR_CODES.NETWORK_REQUEST_FAILED,
        originalError: error,
        metadata: { context },
      });
    }

    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      originalError: error,
      metadata: { context },
    });
  }

  // 알 수 없는 에러
  return new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'unknown',
    metadata: { context, originalValue: String(error) },
  });
}
```

### 에러 처리 래퍼

```typescript
// src/errors/errorUtils.ts
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw normalizeError(error, context);
  }
}

export function withSyncErrorHandling<T>(
  fn: () => T,
  context: string
): T {
  try {
    return fn();
  } catch (error) {
    throw normalizeError(error, context);
  }
}
```

### 서비스 에러 핸들러

```typescript
// src/errors/serviceErrorHandler.ts
interface ServiceErrorOptions {
  operation: string;
  component: string;
  context?: Record<string, unknown>;
}

export function handleServiceError(
  error: unknown,
  options: ServiceErrorOptions
): AppError {
  const appError = normalizeError(error, options.operation);

  // 민감정보 마스킹
  const maskedContext = maskSensitiveData(options.context);

  // 로깅
  logger.error(`[${options.component}] ${options.operation} 실패`, {
    error: appError.toJSON(),
    context: maskedContext,
  });

  return appError;
}

// 민감정보 마스킹
const SENSITIVE_FIELDS = [
  'userId', 'staffId', 'uid',
  'email', 'phone',
  'password', 'token', 'apikey', 'secret',
  'credential', 'applicantId', 'ownerId',
];

function maskSensitiveData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
        return [key, maskValue(value)];
      }
      return [key, value];
    })
  );
}

function maskValue(value: unknown): string {
  if (typeof value !== 'string') return '[MASKED]';
  if (value.length >= 6) {
    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }
  return '***';
}
```

### Result 패턴 (에러 throw 방지)

```typescript
// src/errors/errorUtils.ts
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

// 사용 예시
const result = await tryCatch(() => fetchData());
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.userMessage);
}
```

### 타입 가드

```typescript
// src/errors/errorUtils.ts
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

export function isBusinessError(error: unknown): error is AppError {
  return isAppError(error) && error.category === 'business';
}

// 비즈니스 에러 세부 타입 가드
export function isAlreadyAppliedError(error: unknown): error is AlreadyAppliedError {
  return error instanceof AlreadyAppliedError;
}

export function isMaxCapacityReachedError(error: unknown): error is MaxCapacityReachedError {
  return error instanceof MaxCapacityReachedError;
}

export function isInvalidQRCodeError(error: unknown): error is InvalidQRCodeError {
  return error instanceof InvalidQRCodeError;
}

// ... 30+ 타입 가드
```

---

## 7. 사용자 피드백 전략

### 에러 심각도별 UI 전략

```typescript
// src/lib/errors/errorFeedback.ts
export function getErrorAction(error: AppError): 'toast' | 'alert' | 'redirect' | 'crash' {
  switch (error.severity) {
    case 'low':
      return 'toast';
    case 'medium':
      if (error.category === 'auth') return 'redirect';
      return 'alert';
    case 'high':
      return 'alert';
    case 'critical':
      return 'crash';
    default:
      return 'toast';
  }
}
```

### Hook에서 에러 표시

```typescript
// src/hooks/useJobApplication.ts
export function useJobApplication() {
  return useMutation({
    mutationFn: (jobId: string) => applicationService.apply(jobId),
    onError: (error) => {
      if (isMaxCapacityReachedError(error)) {
        toast.error('모집이 마감되었습니다');
      } else if (isAlreadyAppliedError(error)) {
        toast.error('이미 지원한 공고입니다');
      } else if (isAppError(error)) {
        toast.error(error.userMessage);
      } else {
        toast.error('알 수 없는 오류가 발생했습니다');
      }
    },
  });
}
```

---

## 8. 복구 및 재시도 전략

### isRetryable 속성

```typescript
// 기본값
NetworkError:        isRetryable: true   // 네트워크 재연결
AuthError:           isRetryable: false  // 자격증명 문제
ValidationError:     isRetryable: false  // 입력 오류
PermissionError:     isRetryable: false  // 권한 정책
BusinessError:       isRetryable: false  // 비즈니스 규칙

// 예외 (일부 QR 에러는 재시도 가능)
InvalidQRCodeError:        isRetryable: true  // 재스캔 가능
ExpiredQRCodeError:        isRetryable: true  // 새 QR 코드
QRSecurityMismatchError:   isRetryable: true  // 새 QR 코드
FCMTokenError:             isRetryable: true  // 재시도 가능
```

### 자동 재시도 (withRetry)

```typescript
// src/errors/errorUtils.ts
interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (error: AppError, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: AppError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = normalizeError(error);

      // 재시도 불가능한 에러
      if (!lastError.isRetryable) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        // 지수 백오프 + 지터
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        const jitter = delay * 0.3 * Math.random();
        await sleep(delay + jitter);

        onRetry?.(lastError, attempt);
      }
    }
  }

  throw lastError!;
}

// 사용 예시
await withRetry(
  () => fetchJobPostings(),
  {
    maxRetries: 3,
    delayMs: 1000,
    onRetry: (error, attempt) => {
      console.log(`재시도 ${attempt}회: ${error.userMessage}`);
    },
  }
);
```

### React Query 에러 복구

```typescript
// src/lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const appError = normalizeError(error);

        // 재시도 불가능한 에러
        if (!appError.isRetryable) return false;

        // 인증/권한 에러
        if (appError.category === 'auth') return false;
        if (appError.category === 'permission') return false;

        // 비즈니스 에러
        if (appError.category === 'business') return false;

        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});
```

---

## 9. 오프라인 에러 처리

### 네트워크 상태 관리

```typescript
// src/hooks/useNetworkStatus.ts
export function useNetworkStatus() {
  const [status, setStatus] = useState({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? null,
      });
    });

    return () => unsubscribe();
  }, []);

  return status;
}
```

### 오프라인 배너

```typescript
// src/components/ui/OfflineBanner.tsx
export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <Animated.View
      entering={SlideInUp}
      exiting={SlideOutUp}
      className="bg-amber-500 dark:bg-amber-600 px-4 py-2"
    >
      <Text className="text-white text-center text-sm">
        오프라인 상태입니다
      </Text>
    </Animated.View>
  );
}
```

---

## 10. 실제 사용 예제

### 서비스 레이어

```typescript
// src/services/applicationService.ts
export async function applyToJob(jobPostingId: string, staffId: string) {
  try {
    // 중복 지원 확인
    const existing = await checkDuplicateApplication(jobPostingId, staffId);
    if (existing) {
      throw new AlreadyAppliedError({
        jobPostingId,
        applicationId: existing.id,
      });
    }

    // 정원 확인
    const posting = await getJobPosting(jobPostingId);
    if (posting.applicantCount >= posting.maxCapacity) {
      throw new MaxCapacityReachedError({
        jobPostingId,
        maxCapacity: posting.maxCapacity,
        currentCount: posting.applicantCount,
      });
    }

    // 지원 처리
    return await createApplication(jobPostingId, staffId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 지원',
      component: 'applicationService',
      context: { jobPostingId, staffId },
    });
  }
}
```

### Hook 레이어

```typescript
// src/hooks/useApplyJob.ts
export function useApplyJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobPostingId, staffId }: ApplyJobParams) =>
      applicationService.applyToJob(jobPostingId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine });
      toast.success('지원이 완료되었습니다');
    },
    onError: (error) => {
      if (isAlreadyAppliedError(error)) {
        toast.warning('이미 지원한 공고입니다');
      } else if (isMaxCapacityReachedError(error)) {
        toast.warning('모집이 마감되었습니다');
      } else if (isAppError(error)) {
        toast.error(error.userMessage);
      } else {
        toast.error('알 수 없는 오류가 발생했습니다');
      }
    },
  });
}
```

---

## 요약

### 에러 처리 체크리스트

- [x] 8가지 에러 카테고리 정의 (network, auth, validation, firebase, security, business, permission, unknown)
- [x] 에러 코드 체계 (E1xxx ~ E7xxx)
- [x] 30+ 비즈니스 에러 클래스
- [x] Firebase 에러 자동 매핑 (auth, firestore, storage)
- [x] 사용자 친화적 한글 메시지
- [x] 심각도별 UI 피드백
- [x] 재시도 가능 여부 (isRetryable)
- [x] 지수 백오프 + 지터 재시도
- [x] 민감정보 자동 마스킹
- [x] 타입 가드 (40+개)
- [x] 오프라인 상태 처리

### 에러 처리 흐름

```
try {
  작업 수행
} catch (error)
       │
       ├─→ isAppError(error) ✓ → 그대로 throw
       │
       ├─→ isFirebaseError(error) ✓ → mapFirebaseError()
       │
       ├─→ TypeError (네트워크) ✓ → NetworkError
       │
       └─→ 기타 → AppError(UNKNOWN)
              │
              ▼
       handleServiceError()
       ├─→ 민감정보 마스킹
       ├─→ 로깅 (logger.error)
       └─→ AppError throw
```
