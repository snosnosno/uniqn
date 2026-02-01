# 12. 보안 전략

## 목차
1. [보안 아키텍처 개요](#1-보안-아키텍처-개요)
2. [인증 보안](#2-인증-보안)
3. [데이터 검증](#3-데이터-검증)
4. [안전한 저장소](#4-안전한-저장소)
5. [에러 처리 시스템](#5-에러-처리-시스템)
6. [Firebase 보안 규칙](#6-firebase-보안-규칙)
7. [입력 새니타이징](#7-입력-새니타이징)
8. [권한 시스템](#8-권한-시스템)

---

## 1. 보안 아키텍처 개요

### 보안 계층 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Security Architecture                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Layer 1: Network Security                       │ │
│  │  • HTTPS/TLS 1.3   • Certificate Pinning   • API Rate Limiting     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                   Layer 2: Authentication                           │ │
│  │  • Firebase Auth   • JWT Tokens   • Biometric Auth                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                   Layer 3: Authorization                            │ │
│  │  • Role-based Access   • Resource Ownership   • Action Permissions  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                   Layer 4: Data Validation                          │ │
│  │  • Zod Schemas (18개)   • Input Sanitization   • XSS Prevention     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                   Layer 5: Secure Storage                           │ │
│  │  • expo-secure-store (키체인)   • MMKV (암호화 옵션)                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 보안 원칙

| 원칙 | 설명 | 구현 상태 |
|------|------|:--------:|
| **Least Privilege** | 최소 권한 원칙 | ✅ |
| **Defense in Depth** | 다층 방어 | ✅ |
| **Fail Secure** | 안전한 실패 | ✅ |
| **Zero Trust** | 제로 트러스트 | ✅ |
| **Data Minimization** | 최소 데이터 | ✅ |

---

## 2. 인증 보안

### 인증 스토어 (실제 구현)

```typescript
// src/stores/authStore.ts (12.9KB)
interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  isAdmin: boolean;      // 계산된 플래그
  isEmployer: boolean;   // 계산된 플래그
  isStaff: boolean;      // 계산된 플래그
  _hasHydrated: boolean; // Hydration 추적
}

// 저장소: MMKV (uniqn-auth) + Zustand persist
// Firebase Auth와 Firestore User 프로필 동기화
```

### 인증 서비스

```typescript
// src/services/authService.ts (17.2KB)
// 주요 기능:
// - 이메일/비밀번호 로그인
// - 소셜 로그인 (Apple, Google)
// - 토큰 관리 및 갱신
// - 로그아웃
// - 회원 탈퇴

class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15분

  async signInWithEmail(email: string, password: string): Promise<User> {
    // 1. 로그인 시도 횟수 체크
    await this.checkLoginAttempts(email);

    try {
      // 2. Firebase 인증
      const credential = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );

      // 3. 로그인 성공 - 시도 횟수 초기화
      await this.resetLoginAttempts(email);

      // 4. 토큰 저장 (SecureStore)
      const token = await credential.user.getIdToken();
      await secureStorage.setItem('auth_token', token);

      return credential.user;
    } catch (error) {
      // 5. 실패 시 시도 횟수 증가
      await this.incrementLoginAttempts(email);
      throw error;
    }
  }
}
```

### 생체 인증 (실제 구현)

```typescript
// src/services/biometricService.ts (12.3KB)
// src/components/auth/BiometricButton.tsx

import * as LocalAuthentication from 'expo-local-authentication';

async function authenticateWithBiometrics(): Promise<boolean> {
  // 1. 하드웨어 지원 확인
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    throw new AppError({
      code: ERROR_CODES.BIOMETRIC_NOT_AVAILABLE,
      message: '생체인증을 지원하지 않는 기기입니다',
      category: 'system',
    });
  }

  // 2. 등록된 생체 정보 확인
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    throw new AppError({
      code: ERROR_CODES.BIOMETRIC_NOT_ENROLLED,
      message: '등록된 생체정보가 없습니다',
      category: 'system',
    });
  }

  // 3. 생체 인증 실행
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: '로그인을 위해 인증해주세요',
    cancelLabel: '취소',
    disableDeviceFallback: false,
    fallbackLabel: '비밀번호로 로그인',
  });

  return result.success;
}
```

### 휴대폰 본인인증 (필수)

> ⚠️ 이메일 인증 미사용. 휴대폰 본인인증(PASS/카카오)으로 실명 확인 및 중복가입 방지

```typescript
// 지원 인증 방식
type VerificationMethod = 'pass' | 'kakao' | 'nice';

interface VerificationResult {
  success: boolean;
  data?: {
    name: string;           // 실명
    birthDate: string;      // 생년월일 (YYYYMMDD)
    gender: 'M' | 'F';      // 성별
    phone: string;          // 휴대폰 번호
    ci: string;             // 연계정보 (중복 확인용)
    verifiedAt: Date;
    method: VerificationMethod;
  };
}

// CI 값으로 중복 가입 방지
async function checkDuplicateUser(ci: string): Promise<boolean> {
  const snapshot = await firestore()
    .collection('users')
    .where('identity.ci', '==', ci)
    .limit(1)
    .get();
  return !snapshot.empty;
}
```

---

## 3. 데이터 검증

### Zod 스키마 (18개 파일)

```
src/schemas/
├── auth.schema.ts          # 인증 스키마 (252줄)
├── user.schema.ts          # 사용자 스키마
├── application.schema.ts   # 지원 스키마
├── assignment.schema.ts    # 배정 스키마
├── jobPosting.schema.ts    # 공고 스키마
├── settlement.schema.ts    # 정산 스키마
├── workLog.schema.ts       # 근무 기록 스키마
└── ... (총 18개)
```

### 비밀번호 정책 (실제 구현)

```typescript
// src/schemas/auth.schema.ts
export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다')
  .max(128, '비밀번호는 128자 이하여야 합니다')
  .refine((val) => /[a-z]/.test(val), '소문자를 포함해야 합니다')
  .refine((val) => /[A-Z]/.test(val), '대문자를 포함해야 합니다')
  .refine((val) => /[0-9]/.test(val), '숫자를 포함해야 합니다')
  .refine(
    (val) => /[!@#$%^&*]/.test(val),
    '특수문자(!@#$%^&*)를 포함해야 합니다'
  )
  .refine(
    (val) => {
      // 3자 이상 연속 문자 금지 (abc, 123, cba, 321)
      for (let i = 0; i < val.length - 2; i++) {
        const c1 = val.charCodeAt(i);
        const c2 = val.charCodeAt(i + 1);
        const c3 = val.charCodeAt(i + 2);
        // 오름차순 (a→b→c) 또는 내림차순 (c→b→a) 연속 체크
        if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
          return false;
        }
      }
      return true;
    },
    '3자 이상 연속된 문자/숫자를 사용할 수 없습니다'
  );

// 비밀번호 정책 요약:
// - 최소 8자, 최대 128자
// - 대문자 1개 이상
// - 소문자 1개 이상
// - 숫자 1개 이상
// - 특수문자 1개 이상 (!@#$%^&*)
// - 3자 이상 연속 금지 (abc, 123, cba, 321)
```

### 이메일/전화번호 검증

```typescript
// src/schemas/auth.schema.ts
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, '이메일은 5자 이상이어야 합니다')
  .max(100, '이메일은 100자 이하여야 합니다')
  .email('올바른 이메일 형식이 아닙니다');

export const phoneSchema = z
  .string()
  .refine(
    (val) => /^01[0-9]{8,9}$/.test(val.replace(/[-\s]/g, '')),
    '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)'
  );
```

### 회원가입 4단계 검증

```typescript
// 1단계: 계정 정보
export const signupStep1Schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

// 2단계: 본인인증 (필수)
export const signupStep2Schema = z.object({
  isIdentityVerified: z.literal(true, {
    errorMap: () => ({ message: '본인인증이 필요합니다' }),
  }),
  verificationData: z.object({
    name: z.string(),
    phone: phoneSchema,
    ci: z.string(),
  }),
});

// 3단계: 프로필 + 약관
export const signupStep3Schema = z.object({
  nickname: z.string().min(2).max(20),
  role: z.enum(['staff', 'employer']),
  agreeToTerms: z.literal(true),
  agreeToPrivacy: z.literal(true),
  agreeToMarketing: z.boolean().optional(),
});
```

---

## 4. 안전한 저장소

### Secure Storage (실제 구현)

```typescript
// src/lib/secureStorage.ts (476줄)
import * as SecureStore from 'expo-secure-store';

// 플랫폼별 동작:
// | 플랫폼 | 저장소 | 암호화 |
// |--------|--------|--------|
// | iOS    | 키체인 | 네이티브 암호화 |
// | Android| 키스토어 | 네이티브 암호화 |
// | Web    | localStorage | 제한적 (prefix만) |

interface SecureStorageOptions {
  expiresIn?: number;  // TTL (밀리초)
  keychainAccessible?: SecureStore.KeychainAccessible;
}

class SecureStorage {
  private readonly STORAGE_PREFIX = '@uniqn:secure:';

  async setItem<T>(
    key: string,
    value: T,
    options?: SecureStorageOptions
  ): Promise<void> {
    const data = {
      value,
      expiresAt: options?.expiresIn
        ? Date.now() + options.expiresIn
        : null,
    };

    if (Platform.OS === 'web') {
      // 웹: localStorage 사용
      localStorage.setItem(
        this.STORAGE_PREFIX + key,
        JSON.stringify(data)
      );
    } else {
      // 네이티브: SecureStore 사용
      await SecureStore.setItemAsync(
        key,
        JSON.stringify(data),
        {
          keychainAccessible:
            options?.keychainAccessible ??
            SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    // ... 조회 및 TTL 검증
  }

  async deleteItem(key: string): Promise<void> {
    // ... 삭제
  }

  // 만료 여부 확인
  async isExpired(key: string): Promise<boolean> {
    // ... TTL 검증
  }
}

export const secureStorage = new SecureStorage();
```

### 데이터 분류 헬퍼

```typescript
// src/lib/secureStorage.ts 내부

// 인증 데이터
export const authStorage = {
  setAuthToken: (token: string) =>
    secureStorage.setItem('auth_token', token),
  getAuthToken: () =>
    secureStorage.getItem<string>('auth_token'),
  clearAuthToken: () =>
    secureStorage.deleteItem('auth_token'),
};

// 세션 데이터
export const sessionStorage = {
  setUserId: (userId: string) =>
    secureStorage.setItem('user_id', userId),
  getFCMToken: () =>
    secureStorage.getItem<string>('fcm_token'),
};

// 설정 데이터
export const settingsStorage = {
  setBiometricEnabled: (enabled: boolean) =>
    secureStorage.setItem('biometric_enabled', enabled),
  getBiometricEnabled: () =>
    secureStorage.getItem<boolean>('biometric_enabled'),
};
```

### MMKV Storage (실제 구현)

```typescript
// src/lib/mmkvStorage.ts (477줄)
import { MMKV } from 'react-native-mmkv';

// 플랫폼별 동작:
// | 환경 | 사용 저장소 | 비고 |
// |------|-----------|------|
// | 웹 | localStorage 래퍼 | STORAGE_PREFIX 사용 |
// | 네이티브 | react-native-mmkv | AsyncStorage보다 30배 빠름 |
// | Expo Go | 메모리 스토리지 | 네이티브 모듈 미지원 |

// 암호화 MMKV 인스턴스
export async function getSecureMMKVInstance(): Promise<MMKV> {
  // SecureStore에서 32자 암호화 키 관리
  let encryptionKey = await SecureStore.getItemAsync('mmkv_encryption_key');

  if (!encryptionKey) {
    encryptionKey = generateRandomKey(32);
    await SecureStore.setItemAsync('mmkv_encryption_key', encryptionKey);
  }

  return new MMKV({
    id: 'uniqn-secure-mmkv',
    encryptionKey,
  });
}

// Zustand persist 호환 스토리지
export const storage: StateStorage = {
  getItem: (name) => {
    const value = mmkv.getString(name);
    return value ?? null;
  },
  setItem: (name, value) => {
    mmkv.set(name, value);
  },
  removeItem: (name) => {
    mmkv.delete(name);
  },
};
```

### 저장소 키 상수화

```typescript
// src/lib/mmkvStorage.ts
export const STORAGE_KEYS = {
  // Zustand 스토어
  AUTH: 'auth-storage',
  THEME: 'theme-storage',
  TOAST: 'toast-storage',
  NOTIFICATION: 'notification-storage',
  BOOKMARK: 'bookmark-storage',

  // 캐시
  JOB_POSTINGS_CACHE: 'job-postings-cache',
  FORM_DRAFT: 'form-draft',

  // 인앱 메시지
  IN_APP_MESSAGES: 'uniqn-in-app-messages',
} as const;
```

---

## 5. 에러 처리 시스템

### 에러 클래스 계층 (실제 구현)

```typescript
// src/errors/ (6개 파일 + 4개 테스트)
├── AppError.ts            # 기본 에러 클래스
├── BusinessErrors.ts      # 비즈니스 로직 에러 (16개)
├── errorUtils.ts          # 에러 유틸리티
├── firebaseErrorMapper.ts # Firebase 에러 변환
├── NotificationErrors.ts  # 알림 관련 에러
├── serviceErrorHandler.ts # 서비스 에러 처리
└── index.ts               # 배럴 export

// src/shared/errors/
└── hookErrorHandler.ts    # 훅 에러 처리
```

### AppError 기본 클래스

```typescript
// src/errors/AppError.ts
export class AppError extends Error {
  code: string;
  category: 'network' | 'auth' | 'validation' | 'firebase' | 'security' | 'business' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  isRetryable: boolean;
  metadata?: Record<string, unknown>;

  constructor(params: AppErrorParams) {
    super(params.message || params.userMessage);
    this.code = params.code;
    this.category = params.category;
    this.severity = params.severity ?? 'medium';
    this.userMessage = params.userMessage ?? ERROR_MESSAGES[params.code] ?? '오류가 발생했습니다';
    this.isRetryable = params.isRetryable ?? this.determineRetryable();
    this.metadata = params.metadata;
  }
}
```

### 에러 코드 체계

```typescript
// src/errors/AppError.ts
export const ERROR_CODES = {
  // E1xxx: 네트워크
  NETWORK_OFFLINE: 'E1001',
  NETWORK_TIMEOUT: 'E1002',
  NETWORK_SERVER_UNREACHABLE: 'E1003',

  // E2xxx: 인증
  AUTH_INVALID_CREDENTIALS: 'E2001',
  AUTH_TOKEN_EXPIRED: 'E2002',
  AUTH_TOO_MANY_REQUESTS: 'E2003',
  AUTH_USER_NOT_FOUND: 'E2004',

  // E3xxx: 검증
  VALIDATION_REQUIRED: 'E3001',
  VALIDATION_FORMAT: 'E3002',
  VALIDATION_SCHEMA: 'E3003',

  // E4xxx: Firebase
  FIREBASE_PERMISSION_DENIED: 'E4001',
  FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
  FIREBASE_QUOTA_EXCEEDED: 'E4003',

  // E5xxx: 보안
  SECURITY_XSS_DETECTED: 'E5001',
  SECURITY_UNAUTHORIZED_ACCESS: 'E5002',

  // E6xxx: 비즈니스 (16개)
  ALREADY_APPLIED: 'E6001',
  APPLICATION_CLOSED: 'E6002',
  MAX_CAPACITY_REACHED: 'E6003',
  ALREADY_CHECKED_IN: 'E6004',
  NOT_CHECKED_IN: 'E6005',
  INVALID_QR_CODE: 'E6006',
  EXPIRED_QR_CODE: 'E6007',
  QR_SECURITY_MISMATCH: 'E6008',
  QR_WRONG_EVENT: 'E6009',
  QR_WRONG_DATE: 'E6010',
  ALREADY_SETTLED: 'E6011',
  INVALID_WORK_LOG: 'E6012',
  DUPLICATE_REPORT: 'E6013',
  REPORT_NOT_FOUND: 'E6014',
  REPORT_ALREADY_REVIEWED: 'E6015',
  CANNOT_REPORT_SELF: 'E6016',

  // E7xxx: 알 수 없는 에러
  UNKNOWN: 'E7001',
} as const;
```

### 비즈니스 에러 클래스 (16개)

```typescript
// src/errors/BusinessErrors.ts (542줄)

// 지원 관련
export class AlreadyAppliedError extends AppError {
  constructor() {
    super({
      code: ERROR_CODES.ALREADY_APPLIED,
      category: 'business',
      userMessage: '이미 지원한 공고입니다',
      isRetryable: false,
    });
  }
}

export class ApplicationClosedError extends AppError { /* ... */ }
export class MaxCapacityReachedError extends AppError { /* ... */ }

// QR 출퇴근 관련
export class AlreadyCheckedInError extends AppError { /* ... */ }
export class NotCheckedInError extends AppError { /* ... */ }
export class InvalidQRCodeError extends AppError { /* ... */ }
export class ExpiredQRCodeError extends AppError { /* ... */ }
export class QRSecurityMismatchError extends AppError { /* ... */ }
export class QRWrongEventError extends AppError { /* ... */ }
export class QRWrongDateError extends AppError { /* ... */ }

// 정산 관련
export class AlreadySettledError extends AppError { /* ... */ }
export class InvalidWorkLogError extends AppError { /* ... */ }

// 신고 관련
export class DuplicateReportError extends AppError { /* ... */ }
export class ReportNotFoundError extends AppError { /* ... */ }
export class ReportAlreadyReviewedError extends AppError { /* ... */ }
export class CannotReportSelfError extends AppError { /* ... */ }
```

### 에러 유틸리티

```typescript
// src/errors/errorUtils.ts

// 타입 가드
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNetworkError(error: unknown): boolean {
  return isAppError(error) && error.category === 'network';
}

export function isAuthError(error: unknown): boolean {
  return isAppError(error) && error.category === 'auth';
}

export function isBusinessError(error: unknown): boolean {
  return isAppError(error) && error.category === 'business';
}

// 재시도 가능 여부
export function isRetryable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isRetryable;
  }
  // 네트워크 에러는 기본적으로 재시도 가능
  return error instanceof TypeError && error.message.includes('network');
}
```

### Firebase 에러 매핑

```typescript
// src/errors/firebaseErrorMapper.ts
export function mapFirebaseError(error: FirebaseError): AppError {
  const errorMap: Record<string, Partial<AppErrorParams>> = {
    'auth/invalid-email': {
      code: ERROR_CODES.VALIDATION_FORMAT,
      userMessage: '올바른 이메일 형식이 아닙니다',
    },
    'auth/user-disabled': {
      code: ERROR_CODES.AUTH_USER_NOT_FOUND,
      userMessage: '비활성화된 계정입니다',
    },
    'auth/user-not-found': {
      code: ERROR_CODES.AUTH_USER_NOT_FOUND,
      userMessage: '등록되지 않은 이메일입니다',
    },
    'auth/wrong-password': {
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      userMessage: '비밀번호가 일치하지 않습니다',
    },
    'auth/too-many-requests': {
      code: ERROR_CODES.AUTH_TOO_MANY_REQUESTS,
      userMessage: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요',
    },
    'permission-denied': {
      code: ERROR_CODES.FIREBASE_PERMISSION_DENIED,
      userMessage: '접근 권한이 없습니다',
    },
    // ... 추가 매핑
  };

  const mapped = errorMap[error.code];
  if (mapped) {
    return new AppError({
      ...mapped,
      category: error.code.startsWith('auth/') ? 'auth' : 'firebase',
      metadata: { originalCode: error.code },
    } as AppErrorParams);
  }

  return new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'unknown',
    userMessage: '알 수 없는 오류가 발생했습니다',
    metadata: { originalError: error.message },
  });
}
```

---

## 6. Firebase 보안 규칙

### Firestore 보안 규칙

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 공통 함수
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function hasRole(role) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    function isAdmin() {
      return hasRole('admin');
    }

    function isEmployer() {
      return hasRole('employer') || isAdmin();
    }

    function isStaff() {
      return hasRole('staff') || isAdmin();
    }

    // 사용자 컬렉션
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId) &&
        request.resource.data.keys().hasAll(['email', 'name', 'role']) &&
        request.resource.data.role in ['staff', 'employer'];
      allow update: if isOwner(userId) &&
        !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['role', 'email', 'identity.ci', 'identity.verified']);
      allow delete: if false;  // soft delete만 사용
    }

    // 공고 컬렉션
    match /jobPostings/{postingId} {
      allow read: if isAuthenticated() &&
        (resource.data.status == 'published' ||
         isOwner(resource.data.ownerId) ||
         isAdmin());
      allow create: if isEmployer() &&
        request.resource.data.ownerId == request.auth.uid;
      allow update: if (isOwner(resource.data.ownerId) || isAdmin()) &&
        (!resource.data.hasConfirmedApplicants ||
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['workDate', 'timeSlot', 'roles']));
      allow delete: if (isOwner(resource.data.ownerId) || isAdmin()) &&
        !resource.data.hasConfirmedApplicants;
    }

    // 지원 컬렉션
    match /applications/{applicationId} {
      allow read: if isAuthenticated() &&
        (isOwner(resource.data.applicantId) ||
         get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId))
           .data.ownerId == request.auth.uid ||
         isAdmin());
      allow create: if isStaff() &&
        request.resource.data.applicantId == request.auth.uid &&
        request.resource.data.status == 'pending';
      allow update: if isAuthenticated() &&
        ((isOwner(resource.data.applicantId) &&
          resource.data.status == 'pending' &&
          request.resource.data.status == 'cancelled') ||
         (get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId))
           .data.ownerId == request.auth.uid &&
          request.resource.data.status in ['confirmed', 'rejected']));
      allow delete: if false;
    }

    // 근무 로그 컬렉션
    match /workLogs/{logId} {
      allow read: if isAuthenticated() &&
        (isOwner(resource.data.staffId) ||
         get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId))
           .data.ownerId == request.auth.uid ||
         isAdmin());
      allow create: if false;  // Cloud Functions만
      allow update: if isAuthenticated() &&
        ((isOwner(resource.data.staffId) &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['actualCheckIn', 'actualCheckOut'])) ||
         (get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId))
           .data.ownerId == request.auth.uid &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['settlementStatus', 'settledAt', 'finalSalary'])));
      allow delete: if false;
    }

    // 알림 컬렉션
    match /notifications/{notificationId} {
      allow read, update: if isOwner(resource.data.recipientId);
      allow create: if false;  // Cloud Functions만
      allow delete: if isOwner(resource.data.recipientId);
    }
  }
}
```

### Storage 보안 규칙

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isValidImage() {
      return request.resource.contentType.matches('image/.*') &&
             request.resource.size < 5 * 1024 * 1024; // 5MB
    }

    // 프로필 이미지
    match /profiles/{userId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) && isValidImage();
      allow delete: if isOwner(userId);
    }

    // 공고 이미지
    match /jobPostings/{postingId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isValidImage();
      allow delete: if isAuthenticated();
    }

    // 신분증 (민감 정보)
    match /idCards/{userId}/{fileName} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && isValidImage();
      allow delete: if isOwner(userId);
    }
  }
}
```

---

## 7. 입력 새니타이징

### XSS 방지

```typescript
// src/utils/security.ts
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')  // HTML 태그 제거
    .replace(/[<>"'&]/g, (char) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return escapeMap[char] || char;
    })
    .trim();
}

export function xssValidation(input: string): boolean {
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
  ];
  return !dangerousPatterns.some((pattern) => pattern.test(input));
}

// Zod refine과 함께 사용
const safeStringSchema = z
  .string()
  .refine(xssValidation, 'XSS 공격이 감지되었습니다');
```

### 파일명 새니타이징

```typescript
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}
```

---

## 8. 권한 시스템

### 권한 체계

```
┌──────────────────────────────────────────────────────────────────────┐
│                        UNIQN 권한 체계                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  🔓 guest (비로그인)                                                  │
│  └── 공고 목록 조회만 (미리보기 수준)                                  │
│                                                                       │
│  👤 staff (기본 가입자) ─── 로그인 필수                                │
│  └── 공고 검색/필터 + 상세보기 + 지원 + QR 출퇴근 + 내 스케줄          │
│                                                                       │
│  🏢 employer (구인자)                                                 │
│  └── staff 권한 + 공고 작성/관리 + 지원자 확정/거절 + 정산             │
│                                                                       │
│  ⚙️ admin (관리자)                                                    │
│  └── 모든 권한 + 사용자 관리 + 시스템 설정                             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 역할 정의

```typescript
// src/types/permission.ts
export type UserRole = 'staff' | 'employer' | 'admin';

export const UserRoleHierarchy = {
  admin: 100,     // 시스템 관리자
  employer: 50,   // 구인자
  staff: 10,      // 기본 가입자
  // guest: 0     // 비로그인 (role === null)
} as const;
```

### 권한 매트릭스

| 기능 | guest | staff | employer | admin |
|------|:-----:|:-----:|:--------:|:-----:|
| **공고 목록 조회** | ✅ | ✅ | ✅ | ✅ |
| **공고 검색/필터** | ❌ | ✅ | ✅ | ✅ |
| **공고 상세 보기** | ❌ | ✅ | ✅ | ✅ |
| **지원하기** | ❌ | ✅ | ✅ | ✅ |
| **QR 출퇴근** | ❌ | ✅ | ✅ | ✅ |
| **내 스케줄** | ❌ | ✅ | ✅ | ✅ |
| **공고 작성** | ❌ | ❌ | ✅ | ✅ |
| **지원자 관리** | ❌ | ❌ | ✅ | ✅ |
| **정산** | ❌ | ❌ | ✅ | ✅ |
| **사용자 관리** | ❌ | ❌ | ❌ | ✅ |
| **시스템 설정** | ❌ | ❌ | ❌ | ✅ |

### 권한 확인 훅

```typescript
// src/hooks/useAuth.ts (실제 구현)
export function useAuth() {
  const { user, profile, status, isAdmin, isEmployer, isStaff } = useAuthStore();

  const hasRole = useCallback((requiredRole: UserRole): boolean => {
    if (!profile?.role) return false;
    return UserRoleHierarchy[profile.role] >= UserRoleHierarchy[requiredRole];
  }, [profile?.role]);

  return {
    user,
    profile,
    status,
    isAdmin,
    isEmployer,
    isStaff,
    hasRole,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
}

// 사용 예
const { hasRole, isEmployer } = useAuth();
if (hasRole('employer')) {
  // 구인자 이상 권한 필요한 기능
}
```

---

## 요약

### 보안 구현 현황

| 항목 | 상태 | 상세 |
|------|:----:|------|
| 인증 시스템 | ✅ | Firebase Auth + 생체인증 |
| 입력 검증 | ✅ | Zod 스키마 18개 |
| 비밀번호 정책 | ✅ | 8자+, 대소문자/숫자/특수문자, 연속금지 |
| 토큰 저장 | ✅ | SecureStore (키체인/키스토어) |
| 데이터 암호화 | ✅ | MMKV 암호화 옵션 |
| 에러 처리 | ✅ | 6개 파일, 16개 비즈니스 에러 |
| Firebase 규칙 | ✅ | 역할 기반 접근 제어 |
| XSS 방지 | ✅ | 새니타이징 + Zod refine |
| 권한 시스템 | ✅ | 4단계 역할 계층 |

### 보안 체크리스트

- [x] 모든 사용자 입력에 Zod 스키마 적용
- [x] HTML 출력 시 새니타이징
- [x] Firebase Security Rules로 문서 레벨 접근 제어
- [x] 민감한 데이터는 SecureStore 사용
- [x] API 키는 환경변수로 관리
- [x] 비밀번호 정책 강제 (복잡도, 연속 금지)
- [x] 본인인증으로 중복 가입 방지
- [x] 로그인 시도 횟수 제한 (5회 후 15분 잠금)
- [x] 에러 메시지에 민감 정보 노출 금지

---

*마지막 업데이트: 2026-02-02*
*모바일앱 버전: v1.0.0*
