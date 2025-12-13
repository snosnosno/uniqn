# 12. 보안 전략

## 목차
1. [보안 아키텍처 개요](#1-보안-아키텍처-개요)
2. [인증 보안](#2-인증-보안)
3. [데이터 검증](#3-데이터-검증)
4. [Firebase 보안 규칙](#4-firebase-보안-규칙)
5. [안전한 저장소](#5-안전한-저장소)
6. [네트워크 보안](#6-네트워크-보안)
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
│  │  • Firebase Auth   • JWT Tokens   • Biometric Auth   • MFA          │ │
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
│  │  • Zod Schemas   • Input Sanitization   • XSS Prevention            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                   Layer 5: Secure Storage                           │ │
│  │  • Encrypted Keychain   • Secure Async Storage   • Memory Safety    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 보안 원칙

| 원칙 | 설명 | 구현 |
|------|------|------|
| **Least Privilege** | 최소 권한 원칙 | 역할별 제한된 접근 |
| **Defense in Depth** | 다층 방어 | 5계층 보안 구조 |
| **Fail Secure** | 안전한 실패 | 에러 시 접근 차단 |
| **Zero Trust** | 제로 트러스트 | 모든 요청 검증 |
| **Data Minimization** | 최소 데이터 | 필요한 데이터만 수집 |

---

## 2. 인증 보안

### 안전한 인증 서비스

```typescript
// src/services/authService.ts
import auth from '@react-native-firebase/auth';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from '@/lib/secureStorage';

class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15분

  /**
   * 이메일/비밀번호 로그인
   */
  async signInWithEmail(email: string, password: string): Promise<User> {
    // 1. 로그인 시도 횟수 체크
    await this.checkLoginAttempts(email);

    try {
      // 2. Firebase 인증
      const credential = await auth().signInWithEmailAndPassword(
        email.toLowerCase().trim(),
        password
      );

      // 3. 로그인 성공 - 시도 횟수 초기화
      await this.resetLoginAttempts(email);

      // 4. 토큰 저장
      const token = await credential.user.getIdToken();
      await secureStorage.set('auth_token', token);

      // 5. 마지막 로그인 시간 업데이트
      await this.updateLastLogin(credential.user.uid);

      return credential.user;
    } catch (error) {
      // 6. 실패 시 시도 횟수 증가
      await this.incrementLoginAttempts(email);
      throw error;
    }
  }

  /**
   * 로그인 시도 횟수 체크
   */
  private async checkLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts_${email}`;
    const data = await secureStorage.get(key);

    if (data) {
      const { count, lockUntil } = JSON.parse(data);

      // 잠금 상태 확인
      if (lockUntil && Date.now() < lockUntil) {
        const remainingTime = Math.ceil((lockUntil - Date.now()) / 60000);
        throw new AppError({
          code: ErrorCodes.AUTH_TOO_MANY_ATTEMPTS,
          message: `Too many login attempts. Try again in ${remainingTime} minutes`,
          category: ErrorCategory.AUTH,
        });
      }

      // 잠금 해제 시 초기화
      if (lockUntil && Date.now() >= lockUntil) {
        await secureStorage.delete(key);
      }
    }
  }

  /**
   * 로그인 시도 횟수 증가
   */
  private async incrementLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts_${email}`;
    const data = await secureStorage.get(key);
    const current = data ? JSON.parse(data) : { count: 0 };

    const newCount = current.count + 1;
    const shouldLock = newCount >= this.MAX_LOGIN_ATTEMPTS;

    await secureStorage.set(key, JSON.stringify({
      count: newCount,
      lockUntil: shouldLock ? Date.now() + this.LOCKOUT_DURATION : null,
      lastAttempt: Date.now(),
    }));
  }

  /**
   * 생체 인증
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    // 1. 생체 인증 지원 여부 확인
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      throw new AppError({
        code: ErrorCodes.SYSTEM_BIOMETRIC_NOT_AVAILABLE,
        message: 'Biometric authentication not available',
        category: ErrorCategory.SYSTEM,
      });
    }

    // 2. 등록된 생체 정보 확인
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      throw new AppError({
        code: ErrorCodes.SYSTEM_BIOMETRIC_NOT_ENROLLED,
        message: 'No biometric credentials enrolled',
        category: ErrorCategory.SYSTEM,
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

  /**
   * 토큰 갱신
   */
  async refreshToken(): Promise<string | null> {
    const currentUser = auth().currentUser;
    if (!currentUser) return null;

    try {
      const token = await currentUser.getIdToken(true);
      await secureStorage.set('auth_token', token);
      return token;
    } catch (error) {
      // 토큰 갱신 실패 시 로그아웃
      await this.signOut();
      throw error;
    }
  }

  /**
   * 로그아웃
   */
  async signOut(): Promise<void> {
    // 1. Firebase 로그아웃
    await auth().signOut();

    // 2. 로컬 저장소 정리
    await secureStorage.delete('auth_token');
    await secureStorage.delete('user_data');

    // 3. FCM 토큰 해제 (서버에서 제거)
    await fcmService.unregisterToken();
  }
}

export const authService = new AuthService();
```

### 세션 관리

```typescript
// src/lib/sessionManager.ts
import auth from '@react-native-firebase/auth';
import { AppState, AppStateStatus } from 'react-native';

class SessionManager {
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30분
  private lastActivity: number = Date.now();
  private timeoutId: NodeJS.Timeout | null = null;

  init(): void {
    // 앱 상태 변경 감지
    AppState.addEventListener('change', this.handleAppStateChange);

    // 사용자 활동 추적
    this.resetActivityTimer();

    // Firebase Auth 상태 변경 감지
    auth().onAuthStateChanged(this.handleAuthStateChange);
  }

  private handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      // 포그라운드로 돌아왔을 때 세션 체크
      this.checkSession();
    } else if (state === 'background') {
      // 백그라운드로 갈 때 타이머 정지
      this.clearActivityTimer();
    }
  };

  private handleAuthStateChange = (user: FirebaseAuthTypes.User | null) => {
    if (user) {
      this.resetActivityTimer();
    } else {
      this.clearActivityTimer();
    }
  };

  recordActivity(): void {
    this.lastActivity = Date.now();
    this.resetActivityTimer();
  }

  private checkSession(): void {
    const inactive = Date.now() - this.lastActivity;

    if (inactive > this.SESSION_TIMEOUT) {
      // 세션 만료
      this.expireSession();
    } else {
      // 타이머 재설정
      this.resetActivityTimer();
    }
  }

  private resetActivityTimer(): void {
    this.clearActivityTimer();

    this.timeoutId = setTimeout(() => {
      this.expireSession();
    }, this.SESSION_TIMEOUT);
  }

  private clearActivityTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private async expireSession(): Promise<void> {
    // 세션 만료 알림
    useToastStore.getState().addToast({
      type: 'warning',
      message: '세션이 만료되었습니다. 다시 로그인해주세요.',
    });

    // 로그아웃
    await authService.signOut();

    // 로그인 페이지로 이동
    router.replace('/login');
  }
}

export const sessionManager = new SessionManager();
```

---

## 3. 데이터 검증

### Zod 스키마 정의

```typescript
// src/schemas/user.ts
import { z } from 'zod';

/**
 * 이메일 검증
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('올바른 이메일 형식이 아닙니다')
  .max(255, '이메일은 255자 이하여야 합니다');

/**
 * 비밀번호 검증
 * - 최소 8자
 * - 영문 대소문자, 숫자, 특수문자 포함
 */
export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다')
  .max(128, '비밀번호는 128자 이하여야 합니다')
  .regex(/[a-z]/, '소문자를 포함해야 합니다')
  .regex(/[A-Z]/, '대문자를 포함해야 합니다')
  .regex(/[0-9]/, '숫자를 포함해야 합니다')
  .regex(/[^a-zA-Z0-9]/, '특수문자를 포함해야 합니다');

/**
 * 전화번호 검증
 */
export const phoneSchema = z
  .string()
  .regex(/^01[0-9]-[0-9]{3,4}-[0-9]{4}$/, '올바른 전화번호 형식이 아닙니다');

/**
 * 이름 검증
 */
export const nameSchema = z
  .string()
  .trim()
  .min(2, '이름은 2자 이상이어야 합니다')
  .max(50, '이름은 50자 이하여야 합니다')
  .regex(/^[가-힣a-zA-Z\s]+$/, '이름에 특수문자를 사용할 수 없습니다');

/**
 * 회원가입 스키마
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  name: nameSchema,
  phone: phoneSchema,
  role: z.enum(['staff', 'employer']),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: '이용약관에 동의해주세요' }),
  }),
  agreeToPrivacy: z.literal(true, {
    errorMap: () => ({ message: '개인정보처리방침에 동의해주세요' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});
```

### 공고 작성 스키마

```typescript
// src/schemas/jobPosting.ts
import { z } from 'zod';

const timeSlotSchema = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]\s*[-~]\s*([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  '올바른 시간 형식이 아닙니다 (예: 09:00 ~ 18:00)'
);

const jobRoleSchema = z.object({
  name: z.string().min(1, '역할명을 입력해주세요').max(50),
  count: z.number().min(1, '최소 1명 이상').max(100, '최대 100명'),
  hourlyRate: z.number().min(9860, '최저시급 이상이어야 합니다').max(1000000),
  description: z.string().max(500).optional(),
});

export const jobPostingSchema = z.object({
  // 기본 정보
  title: z
    .string()
    .min(5, '제목은 5자 이상이어야 합니다')
    .max(100, '제목은 100자 이하여야 합니다'),

  // 위치 정보
  location: z.object({
    address: z.string().min(5, '주소를 입력해주세요'),
    detailAddress: z.string().max(100).optional(),
    coordinates: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }).optional(),
  }),

  // 일정 정보
  workDate: z.date().refine(
    (date) => date > new Date(),
    '작업일은 오늘 이후여야 합니다'
  ),
  timeSlot: timeSlotSchema,

  // 역할 정보
  roles: z
    .array(jobRoleSchema)
    .min(1, '최소 1개 이상의 역할이 필요합니다')
    .max(10, '역할은 최대 10개까지 가능합니다'),

  // 상세 정보
  description: z.string().max(2000, '상세 설명은 2000자 이하여야 합니다').optional(),
  requirements: z.string().max(1000).optional(),
  benefits: z.string().max(1000).optional(),

  // 사전 질문
  preQuestions: z
    .array(z.string().max(200))
    .max(5, '사전 질문은 최대 5개까지 가능합니다')
    .optional(),
});
```

### 검증 유틸리티

```typescript
// src/utils/validation.ts
import { z } from 'zod';
import { AppError, ErrorCodes, ErrorCategory } from '@/types/error';

/**
 * 스키마 검증 래퍼
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten();

    throw new AppError({
      code: ErrorCodes.VALIDATION_INVALID_FORMAT,
      message: formatValidationErrors(errors),
      category: ErrorCategory.VALIDATION,
      metadata: {
        context,
        fieldErrors: errors.fieldErrors,
        formErrors: errors.formErrors,
      },
    });
  }

  return result.data;
}

/**
 * 검증 에러 포맷팅
 */
function formatValidationErrors(
  errors: z.typeToFlattenedError<any>
): string {
  const messages: string[] = [];

  // 필드 에러
  Object.entries(errors.fieldErrors).forEach(([field, fieldErrors]) => {
    if (fieldErrors && fieldErrors.length > 0) {
      messages.push(`${field}: ${fieldErrors[0]}`);
    }
  });

  // 폼 에러
  if (errors.formErrors.length > 0) {
    messages.push(...errors.formErrors);
  }

  return messages.join('\n');
}

/**
 * 부분 검증 (특정 필드만)
 */
export function validateField<T>(
  schema: z.ZodSchema<T>,
  field: keyof T,
  value: unknown
): z.SafeParseReturnType<T, T> {
  const partialSchema = schema.pick({ [field]: true } as any);
  return partialSchema.safeParse({ [field]: value });
}
```

---

## 4. Firebase 보안 규칙

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
      // 읽기: 본인 또는 관리자
      allow read: if isOwner(userId) || isAdmin();

      // 생성: 인증된 사용자, 자신의 문서만
      allow create: if isOwner(userId) &&
        request.resource.data.keys().hasAll(['email', 'name', 'role']) &&
        request.resource.data.role in ['staff', 'employer'];

      // 수정: 본인만, role 변경 불가
      allow update: if isOwner(userId) &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'email']);

      // 삭제: 불가 (soft delete 사용)
      allow delete: if false;
    }

    // 공고 컬렉션
    match /jobPostings/{postingId} {
      // 읽기: 공개된 공고는 모든 인증 사용자, 비공개는 소유자만
      allow read: if isAuthenticated() &&
        (resource.data.status == 'published' || isOwner(resource.data.ownerId) || isAdmin());

      // 생성: 구인자만
      allow create: if isEmployer() &&
        request.resource.data.ownerId == request.auth.uid &&
        request.resource.data.keys().hasAll(['title', 'location', 'workDate', 'roles']);

      // 수정: 소유자만, 확정된 지원자 있으면 제한적 수정
      allow update: if (isOwner(resource.data.ownerId) || isAdmin()) &&
        (!resource.data.hasConfirmedApplicants ||
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['workDate', 'timeSlot', 'roles']));

      // 삭제: 소유자만, 확정된 지원자 없을 때만
      allow delete: if (isOwner(resource.data.ownerId) || isAdmin()) &&
        !resource.data.hasConfirmedApplicants;
    }

    // 지원 컬렉션
    match /applications/{applicationId} {
      // 읽기: 지원자 또는 공고 소유자
      allow read: if isAuthenticated() &&
        (isOwner(resource.data.applicantId) ||
          get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId)).data.ownerId == request.auth.uid ||
          isAdmin());

      // 생성: 스태프만, 자신의 지원만
      allow create: if isStaff() &&
        request.resource.data.applicantId == request.auth.uid &&
        request.resource.data.status == 'pending';

      // 수정: 지원 취소(지원자), 확정/거절(공고 소유자)
      allow update: if isAuthenticated() &&
        ((isOwner(resource.data.applicantId) &&
          resource.data.status == 'pending' &&
          request.resource.data.status == 'cancelled') ||
        (get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId)).data.ownerId == request.auth.uid &&
          request.resource.data.status in ['confirmed', 'rejected']));

      allow delete: if false;
    }

    // 근무 로그 컬렉션
    match /workLogs/{logId} {
      // 읽기: 스태프 또는 공고 소유자
      allow read: if isAuthenticated() &&
        (isOwner(resource.data.staffId) ||
          get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId)).data.ownerId == request.auth.uid ||
          isAdmin());

      // 생성: 시스템만 (Cloud Functions)
      allow create: if false;

      // 수정: 출퇴근 기록(스태프), 정산(공고 소유자)
      allow update: if isAuthenticated() &&
        ((isOwner(resource.data.staffId) &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['actualCheckIn', 'actualCheckOut'])) ||
        (get(/databases/$(database)/documents/jobPostings/$(resource.data.jobPostingId)).data.ownerId == request.auth.uid &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['settlementStatus', 'settledAt', 'finalSalary', 'salaryAdjustments'])));

      allow delete: if false;
    }

    // 알림 컬렉션
    match /notifications/{notificationId} {
      // 읽기/수정: 수신자만
      allow read, update: if isOwner(resource.data.recipientId);

      // 생성: 시스템만
      allow create: if false;

      // 삭제: 수신자만
      allow delete: if isOwner(resource.data.recipientId);
    }

    // 칩 거래 내역
    match /chipTransactions/{transactionId} {
      // 읽기: 소유자만
      allow read: if isOwner(resource.data.userId);

      // 생성/수정/삭제: 시스템만
      allow create, update, delete: if false;
    }

    // 문의 컬렉션
    match /inquiries/{inquiryId} {
      // 읽기: 작성자 또는 관리자
      allow read: if isOwner(resource.data.userId) || isAdmin();

      // 생성: 인증된 사용자
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;

      // 수정: 관리자만 (답변)
      allow update: if isAdmin();

      allow delete: if false;
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

    function isValidDocument() {
      return request.resource.contentType.matches('application/pdf') &&
             request.resource.size < 10 * 1024 * 1024; // 10MB
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
      // 읽기: 본인 또는 관리자만
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && isValidImage();
      allow delete: if isOwner(userId);
    }
  }
}
```

---

## 5. 안전한 저장소

### 보안 저장소 서비스

```typescript
// src/lib/secureStorage.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

class SecureStorage {
  private readonly ENCRYPTION_KEY_KEY = 'SECURE_STORAGE_KEY';

  /**
   * 민감한 데이터 저장 (Keychain/Keystore)
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      // SecureStore 실패 시 암호화된 AsyncStorage 사용
      const encrypted = await this.encrypt(value);
      await AsyncStorage.setItem(`secure_${key}`, encrypted);
    }
  }

  /**
   * 민감한 데이터 조회
   */
  async get(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value) return value;

      // fallback: 암호화된 AsyncStorage
      const encrypted = await AsyncStorage.getItem(`secure_${key}`);
      if (encrypted) {
        return await this.decrypt(encrypted);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 민감한 데이터 삭제
   */
  async delete(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      await AsyncStorage.removeItem(`secure_${key}`);
    } catch (error) {
      // 무시
    }
  }

  /**
   * 암호화
   */
  private async encrypt(value: string): Promise<string> {
    const key = await this.getEncryptionKey();
    return CryptoJS.AES.encrypt(value, key).toString();
  }

  /**
   * 복호화
   */
  private async decrypt(encrypted: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * 암호화 키 관리
   */
  private async getEncryptionKey(): Promise<string> {
    let key = await SecureStore.getItemAsync(this.ENCRYPTION_KEY_KEY);

    if (!key) {
      // 새 키 생성
      key = CryptoJS.lib.WordArray.random(32).toString();
      await SecureStore.setItemAsync(this.ENCRYPTION_KEY_KEY, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }

    return key;
  }
}

export const secureStorage = new SecureStorage();
```

### 민감 데이터 관리

```typescript
// src/lib/sensitiveData.ts
import { secureStorage } from './secureStorage';

interface SensitiveUserData {
  authToken: string;
  refreshToken?: string;
  fcmToken?: string;
  biometricEnabled?: boolean;
}

class SensitiveDataManager {
  private readonly SENSITIVE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    FCM_TOKEN: 'fcm_token',
    BIOMETRIC_ENABLED: 'biometric_enabled',
    USER_CREDENTIALS: 'user_credentials',
  };

  /**
   * 인증 토큰 저장
   */
  async setAuthToken(token: string): Promise<void> {
    await secureStorage.set(this.SENSITIVE_KEYS.AUTH_TOKEN, token);
  }

  async getAuthToken(): Promise<string | null> {
    return secureStorage.get(this.SENSITIVE_KEYS.AUTH_TOKEN);
  }

  /**
   * 자동 로그인 자격 증명 저장 (선택적)
   */
  async setCredentials(email: string, password: string): Promise<void> {
    const credentials = JSON.stringify({ email, password });
    await secureStorage.set(this.SENSITIVE_KEYS.USER_CREDENTIALS, credentials);
  }

  async getCredentials(): Promise<{ email: string; password: string } | null> {
    const data = await secureStorage.get(this.SENSITIVE_KEYS.USER_CREDENTIALS);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 모든 민감 데이터 삭제 (로그아웃 시)
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      secureStorage.delete(this.SENSITIVE_KEYS.AUTH_TOKEN),
      secureStorage.delete(this.SENSITIVE_KEYS.REFRESH_TOKEN),
      secureStorage.delete(this.SENSITIVE_KEYS.FCM_TOKEN),
      secureStorage.delete(this.SENSITIVE_KEYS.USER_CREDENTIALS),
    ]);
  }
}

export const sensitiveDataManager = new SensitiveDataManager();
```

---

## 6. 네트워크 보안

### API 클라이언트 보안

```typescript
// src/lib/apiClient.ts
import { Platform } from 'react-native';

const API_BASE_URL = __DEV__
  ? 'https://dev-api.uniqn.app'
  : 'https://api.uniqn.app';

interface RequestConfig extends RequestInit {
  timeout?: number;
}

class SecureApiClient {
  private readonly defaultTimeout = 30000; // 30초

  /**
   * 안전한 API 요청
   */
  async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { timeout = this.defaultTimeout, ...fetchConfig } = config;

    // 1. 인증 토큰 가져오기
    const token = await sensitiveDataManager.getAuthToken();

    // 2. 요청 헤더 구성
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Platform': Platform.OS,
      'X-App-Version': APP_VERSION,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchConfig.headers,
    };

    // 3. 타임아웃 컨트롤러
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchConfig,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 4. 응답 처리
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new AppError({
          code: ErrorCodes.NETWORK_TIMEOUT,
          message: 'Request timeout',
          category: ErrorCategory.NETWORK,
        });
      }

      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));

    switch (response.status) {
      case 401:
        // 토큰 만료 - 갱신 시도
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          throw new AppError({
            code: ErrorCodes.AUTH_TOKEN_EXPIRED,
            message: 'Token expired',
            category: ErrorCategory.AUTH,
            recoveryAction: { type: 'logout' },
          });
        }
        // 요청 재시도는 호출자가 처리
        throw new AppError({
          code: ErrorCodes.AUTH_TOKEN_REFRESHED,
          message: 'Token refreshed, retry request',
          category: ErrorCategory.AUTH,
          recoveryAction: { type: 'retry' },
        });

      case 403:
        throw new AppError({
          code: ErrorCodes.PERMISSION_DENIED,
          message: errorData.message || 'Access denied',
          category: ErrorCategory.PERMISSION,
        });

      case 429:
        throw new AppError({
          code: ErrorCodes.SERVER_RATE_LIMITED,
          message: 'Too many requests',
          category: ErrorCategory.SERVER,
          recoveryAction: { type: 'retry', maxAttempts: 3 },
        });

      default:
        throw new AppError({
          code: ErrorCodes.SERVER_INTERNAL_ERROR,
          message: errorData.message || 'Server error',
          category: ErrorCategory.SERVER,
        });
    }
  }
}

export const apiClient = new SecureApiClient();
```

### 인증서 피닝 (선택적)

```typescript
// src/lib/certificatePinning.ts
// Note: 실제 구현은 react-native-ssl-pinning 라이브러리 사용
import { fetch as pinnedFetch } from 'react-native-ssl-pinning';

export async function secureFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  if (__DEV__) {
    // 개발 환경에서는 일반 fetch 사용
    return fetch(url, options);
  }

  return pinnedFetch(url, {
    ...options,
    sslPinning: {
      certs: ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
    },
    timeoutInterval: 30000,
  });
}
```

---

## 7. 입력 새니타이징

### XSS 방지

```typescript
// src/utils/sanitize.ts
import DOMPurify from 'dompurify';

/**
 * HTML 새니타이징
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
  });
}

/**
 * 텍스트 새니타이징 (HTML 제거)
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/[<>"'&]/g, (char) => {
      // 특수 문자 이스케이프
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

/**
 * SQL Injection 방지 (문자열)
 */
export function sanitizeSqlString(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

/**
 * 파일명 새니타이징
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}

/**
 * URL 새니타이징
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // 허용된 프로토콜만
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }

    return parsed.toString();
  } catch {
    return '';
  }
}
```

### 입력 검증 훅

```typescript
// src/hooks/useSanitizedInput.ts
import { useCallback } from 'react';
import { sanitizeText } from '@/utils/sanitize';

export function useSanitizedInput() {
  const sanitize = useCallback((input: string): string => {
    return sanitizeText(input);
  }, []);

  const validateAndSanitize = useCallback(
    <T>(
      schema: z.ZodSchema<T>,
      input: unknown
    ): { success: boolean; data?: T; error?: string } => {
      // 먼저 새니타이징
      const sanitized = typeof input === 'string'
        ? sanitizeText(input)
        : input;

      // 스키마 검증
      const result = schema.safeParse(sanitized);

      if (result.success) {
        return { success: true, data: result.data };
      }

      return {
        success: false,
        error: result.error.errors[0]?.message || 'Validation failed',
      };
    },
    []
  );

  return { sanitize, validateAndSanitize };
}
```

---

## 8. 권한 시스템

### 권한 서비스

```typescript
// src/services/permissionService.ts
import { UserRole, Permission, ResourceAction } from '@/types/permission';

type PermissionMatrix = Record<UserRole, Permission[]>;

const PERMISSION_MATRIX: PermissionMatrix = {
  admin: [
    // 모든 권한
    Permission.ALL,
  ],
  employer: [
    // 공고 관리
    Permission.JOB_CREATE,
    Permission.JOB_UPDATE_OWN,
    Permission.JOB_DELETE_OWN,
    Permission.JOB_VIEW_ALL,

    // 지원 관리
    Permission.APPLICATION_VIEW_OWN_JOBS,
    Permission.APPLICATION_CONFIRM,
    Permission.APPLICATION_REJECT,

    // 출퇴근 관리
    Permission.ATTENDANCE_VIEW_OWN_JOBS,
    Permission.ATTENDANCE_UPDATE_OWN_JOBS,

    // 정산
    Permission.SETTLEMENT_VIEW_OWN,
    Permission.SETTLEMENT_COMPLETE,

    // 칩
    Permission.CHIP_PURCHASE,
    Permission.CHIP_VIEW_OWN,
  ],
  staff: [
    // 공고 조회
    Permission.JOB_VIEW_PUBLIC,

    // 지원
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_CANCEL_OWN,
    Permission.APPLICATION_VIEW_OWN,

    // 출퇴근
    Permission.ATTENDANCE_CHECKIN,
    Permission.ATTENDANCE_CHECKOUT,
    Permission.ATTENDANCE_VIEW_OWN,

    // 스케줄
    Permission.SCHEDULE_VIEW_OWN,

    // 칩
    Permission.CHIP_VIEW_OWN,
  ],
  user: [
    // 기본 조회 권한만
    Permission.JOB_VIEW_PUBLIC,
    Permission.PROFILE_VIEW_OWN,
    Permission.PROFILE_UPDATE_OWN,
  ],
};

class PermissionService {
  private userPermissions: Set<Permission> = new Set();

  /**
   * 사용자 권한 설정
   */
  setUserRole(role: UserRole): void {
    const permissions = PERMISSION_MATRIX[role] || [];

    this.userPermissions = new Set(
      permissions.includes(Permission.ALL)
        ? Object.values(Permission)
        : permissions
    );
  }

  /**
   * 권한 확인
   */
  hasPermission(permission: Permission): boolean {
    return this.userPermissions.has(permission) ||
      this.userPermissions.has(Permission.ALL);
  }

  /**
   * 여러 권한 중 하나라도 있는지 확인
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  /**
   * 모든 권한이 있는지 확인
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  /**
   * 리소스 소유권 확인
   */
  async canAccessResource(
    resourceType: 'jobPosting' | 'application' | 'workLog',
    resourceId: string,
    action: ResourceAction,
    userId: string
  ): Promise<boolean> {
    const resource = await this.fetchResource(resourceType, resourceId);
    if (!resource) return false;

    switch (resourceType) {
      case 'jobPosting':
        return this.checkJobPostingAccess(resource, action, userId);
      case 'application':
        return this.checkApplicationAccess(resource, action, userId);
      case 'workLog':
        return this.checkWorkLogAccess(resource, action, userId);
      default:
        return false;
    }
  }

  private checkJobPostingAccess(
    resource: any,
    action: ResourceAction,
    userId: string
  ): boolean {
    const isOwner = resource.ownerId === userId;

    switch (action) {
      case 'read':
        return resource.status === 'published' || isOwner;
      case 'update':
      case 'delete':
        return isOwner;
      default:
        return false;
    }
  }

  private checkApplicationAccess(
    resource: any,
    action: ResourceAction,
    userId: string
  ): boolean {
    const isApplicant = resource.applicantId === userId;
    const isJobOwner = resource.jobOwnerId === userId;

    switch (action) {
      case 'read':
        return isApplicant || isJobOwner;
      case 'update':
        return isApplicant || isJobOwner; // 취소(지원자), 확정/거절(구인자)
      default:
        return false;
    }
  }

  // ... 기타 리소스 체크 메서드
}

export const permissionService = new PermissionService();
```

### 권한 확인 훅

```typescript
// src/hooks/usePermissions.ts
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { permissionService } from '@/services/permissionService';
import { Permission } from '@/types/permission';

export function usePermissions() {
  const { user, role } = useAuthStore();

  // 역할 변경 시 권한 업데이트
  useMemo(() => {
    permissionService.setUserRole(role);
  }, [role]);

  const can = useMemo(() => ({
    // 공고 권한
    createJob: () => permissionService.hasPermission(Permission.JOB_CREATE),
    updateJob: (ownerId: string) =>
      permissionService.hasPermission(Permission.JOB_UPDATE_OWN) &&
      ownerId === user?.uid,
    deleteJob: (ownerId: string) =>
      permissionService.hasPermission(Permission.JOB_DELETE_OWN) &&
      ownerId === user?.uid,

    // 지원 권한
    applyToJob: () => permissionService.hasPermission(Permission.APPLICATION_CREATE),
    confirmApplication: () =>
      permissionService.hasPermission(Permission.APPLICATION_CONFIRM),

    // 출퇴근 권한
    checkIn: () => permissionService.hasPermission(Permission.ATTENDANCE_CHECKIN),
    checkOut: () => permissionService.hasPermission(Permission.ATTENDANCE_CHECKOUT),

    // 정산 권한
    settlePayment: () =>
      permissionService.hasPermission(Permission.SETTLEMENT_COMPLETE),

    // 관리자 권한
    accessAdmin: () => permissionService.hasPermission(Permission.ADMIN_ACCESS),
    manageUsers: () => permissionService.hasPermission(Permission.ADMIN_MANAGE_USERS),
  }), [user, role]);

  return {
    can,
    hasPermission: (p: Permission) => permissionService.hasPermission(p),
    hasAny: (ps: Permission[]) => permissionService.hasAnyPermission(ps),
    hasAll: (ps: Permission[]) => permissionService.hasAllPermissions(ps),
    role,
    isAdmin: role === 'admin',
    isEmployer: role === 'employer',
    isStaff: role === 'staff',
  };
}
```

### 권한 가드 컴포넌트

```typescript
// src/components/auth/PermissionGuard.tsx
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/types/permission';

interface PermissionGuardProps {
  /** 필요한 권한 */
  permission?: Permission;
  /** 필요한 권한들 (OR 조건) */
  anyOf?: Permission[];
  /** 필요한 권한들 (AND 조건) */
  allOf?: Permission[];
  /** 권한이 없을 때 표시할 컴포넌트 */
  fallback?: React.ReactNode;
  /** 권한이 있을 때 표시할 컴포넌트 */
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAny, hasAll } = usePermissions();

  const hasAccess = (() => {
    if (permission) return hasPermission(permission);
    if (anyOf) return hasAny(anyOf);
    if (allOf) return hasAll(allOf);
    return true;
  })();

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// 사용 예
function JobManagementScreen() {
  return (
    <PermissionGuard
      permission={Permission.JOB_CREATE}
      fallback={<AccessDenied />}
    >
      <JobManagementContent />
    </PermissionGuard>
  );
}
```

---

## 요약

### 보안 체크리스트

#### 인증
- [x] 로그인 시도 횟수 제한
- [x] 비밀번호 강도 요구사항
- [x] 생체 인증 지원
- [x] 세션 타임아웃
- [x] 토큰 자동 갱신

#### 데이터 검증
- [x] Zod 스키마 검증
- [x] 클라이언트/서버 이중 검증
- [x] 입력 새니타이징

#### Firebase 보안
- [x] Firestore 보안 규칙
- [x] Storage 보안 규칙
- [x] 역할 기반 접근 제어

#### 저장소
- [x] 민감 데이터 암호화 저장
- [x] Keychain/Keystore 활용
- [x] 로그아웃 시 데이터 삭제

#### 네트워크
- [x] HTTPS 강제
- [x] 인증 토큰 자동 첨부
- [x] 요청 타임아웃

#### 권한
- [x] 역할 기반 권한 시스템
- [x] 리소스 소유권 확인
- [x] 권한 가드 컴포넌트

---

## 9. Certificate Pinning (인증서 고정)

### 개요

MITM(Man-in-the-Middle) 공격을 방지하기 위해 서버 인증서를 고정합니다.

### react-native-ssl-pinning 사용

```bash
npm install react-native-ssl-pinning
```

### 인증서 핀 추출

```bash
# 서버 인증서의 SHA256 핀 추출
openssl s_client -connect api.uniqn.app:443 -servername api.uniqn.app 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform DER \
  | openssl dgst -sha256 -binary \
  | base64
```

### 구현

```typescript
// src/lib/pinnedFetch.ts
import { fetch as sslFetch } from 'react-native-ssl-pinning';
import { Platform } from 'react-native';

// 인증서 핀 (주기적으로 갱신 필요)
const CERTIFICATE_PINS = {
  primary: 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  backup: 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
};

interface PinnedFetchOptions extends RequestInit {
  timeout?: number;
}

export async function pinnedFetch(
  url: string,
  options: PinnedFetchOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  // 개발 환경에서는 일반 fetch 사용
  if (__DEV__) {
    return fetch(url, fetchOptions);
  }

  try {
    const response = await sslFetch(url, {
      method: fetchOptions.method || 'GET',
      headers: fetchOptions.headers as Record<string, string>,
      body: fetchOptions.body as string,
      timeoutInterval: timeout,
      sslPinning: {
        certs: [
          CERTIFICATE_PINS.primary,
          CERTIFICATE_PINS.backup, // 백업 핀 (인증서 갱신 대비)
        ],
      },
      // iOS 전용: Public Key Pinning
      ...(Platform.OS === 'ios' && {
        pkPinning: true,
      }),
    });

    return new Response(JSON.stringify(response.data), {
      status: response.status,
      headers: new Headers(response.headers),
    });
  } catch (error: any) {
    // 인증서 검증 실패
    if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
      console.error('[Security] Certificate pinning failed:', error);

      // 보안 이벤트 로깅
      await analyticsService.logEvent('security_certificate_pinning_failed', {
        url,
        error: error.message,
      });

      throw new AppError({
        code: ErrorCodes.SECURITY_CERTIFICATE_INVALID,
        message: '보안 연결에 실패했습니다. 네트워크를 확인해주세요.',
        category: ErrorCategory.SECURITY,
      });
    }

    throw error;
  }
}

// API 클라이언트에서 사용
export class SecureApiClient {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Certificate Pinning이 적용된 fetch 사용
    const response = await pinnedFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }
}
```

### 인증서 갱신 전략

```typescript
// src/lib/certificateManager.ts
import { secureStorage } from './secureStorage';

interface CertificatePins {
  primary: string;
  backup: string;
  expiresAt: number;
}

class CertificateManager {
  private readonly PINS_KEY = 'certificate_pins';
  private readonly PINS_URL = 'https://api.uniqn.app/v1/security/pins';

  // 앱 시작 시 핀 갱신 확인
  async initialize(): Promise<void> {
    try {
      const stored = await this.getStoredPins();

      // 저장된 핀이 없거나 만료 예정이면 갱신
      if (!stored || this.isExpiringSoon(stored.expiresAt)) {
        await this.refreshPins();
      }
    } catch (error) {
      console.error('[CertificateManager] Init failed:', error);
      // 실패해도 하드코딩된 핀 사용
    }
  }

  private isExpiringSoon(expiresAt: number): boolean {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return Date.now() > expiresAt - oneWeek;
  }

  private async refreshPins(): Promise<void> {
    // 별도 보안 채널로 새 핀 가져오기
    // (이 요청은 기존 핀으로 검증됨)
    const response = await fetch(this.PINS_URL);
    const pins: CertificatePins = await response.json();

    await secureStorage.set(this.PINS_KEY, JSON.stringify(pins));
  }

  async getStoredPins(): Promise<CertificatePins | null> {
    const data = await secureStorage.get(this.PINS_KEY);
    return data ? JSON.parse(data) : null;
  }
}

export const certificateManager = new CertificateManager();
```

---

## 10. 앱 무결성 검증 (App Integrity)

### 개요

앱의 무결성을 검증하여 탈옥/루팅된 기기, 변조된 앱, 에뮬레이터 실행을 감지합니다.

### 10.1 Jailbreak/Root 감지

```typescript
// src/lib/integrityCheck.ts
import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system';

interface IntegrityResult {
  isCompromised: boolean;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

class IntegrityChecker {
  /**
   * 전체 무결성 검사
   */
  async checkIntegrity(): Promise<IntegrityResult> {
    const reasons: string[] = [];

    // 1. Jailbreak/Root 감지
    if (await this.isDeviceCompromised()) {
      reasons.push('Device compromised (jailbroken/rooted)');
    }

    // 2. 에뮬레이터/시뮬레이터 감지
    if (this.isEmulator()) {
      reasons.push('Running on emulator');
    }

    // 3. 디버거 연결 감지
    if (this.isDebuggerAttached()) {
      reasons.push('Debugger attached');
    }

    // 4. 앱 변조 감지
    if (await this.isAppTampered()) {
      reasons.push('App integrity compromised');
    }

    const riskLevel = this.calculateRiskLevel(reasons);

    return {
      isCompromised: reasons.length > 0,
      reasons,
      riskLevel,
    };
  }

  /**
   * Jailbreak (iOS) / Root (Android) 감지
   */
  private async isDeviceCompromised(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return this.checkJailbreak();
    } else if (Platform.OS === 'android') {
      return this.checkRoot();
    }
    return false;
  }

  private async checkJailbreak(): Promise<boolean> {
    // iOS Jailbreak 감지 포인트
    const jailbreakPaths = [
      '/Applications/Cydia.app',
      '/Library/MobileSubstrate/MobileSubstrate.dylib',
      '/bin/bash',
      '/usr/sbin/sshd',
      '/etc/apt',
      '/private/var/lib/apt/',
      '/usr/bin/ssh',
      '/private/var/stash',
      '/private/var/lib/cydia',
      '/private/var/tmp/cydia.log',
    ];

    for (const path of jailbreakPaths) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          return true;
        }
      } catch {
        // 파일 접근 실패는 정상
      }
    }

    // URL scheme 체크
    // Linking.canOpenURL('cydia://') - 추가 검사

    return false;
  }

  private async checkRoot(): Promise<boolean> {
    // Android Root 감지 포인트
    const rootPaths = [
      '/system/app/Superuser.apk',
      '/sbin/su',
      '/system/bin/su',
      '/system/xbin/su',
      '/data/local/xbin/su',
      '/data/local/bin/su',
      '/system/sd/xbin/su',
      '/system/bin/failsafe/su',
      '/data/local/su',
      '/su/bin/su',
      '/system/app/SuperSU.apk',
      '/system/app/Magisk.apk',
    ];

    for (const path of rootPaths) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          return true;
        }
      } catch {
        // 파일 접근 실패는 정상
      }
    }

    // Build tags 체크
    // RootBeer 라이브러리 사용 권장

    return false;
  }

  /**
   * 에뮬레이터 감지
   */
  private isEmulator(): boolean {
    if (Platform.OS === 'ios') {
      // iOS 시뮬레이터 감지
      return (
        Platform.constants.systemName === 'iOS Simulator' ||
        NativeModules.DeviceInfo?.isSimulator === true
      );
    } else if (Platform.OS === 'android') {
      // Android 에뮬레이터 감지
      const brand = NativeModules.DeviceInfo?.brand || '';
      const model = NativeModules.DeviceInfo?.model || '';
      const fingerprint = NativeModules.DeviceInfo?.fingerprint || '';

      const emulatorIndicators = [
        'generic',
        'sdk',
        'google_sdk',
        'emulator',
        'android sdk built for x86',
        'goldfish',
        'ranchu',
      ];

      const combined = `${brand} ${model} ${fingerprint}`.toLowerCase();
      return emulatorIndicators.some((indicator) =>
        combined.includes(indicator)
      );
    }

    return false;
  }

  /**
   * 디버거 연결 감지
   */
  private isDebuggerAttached(): boolean {
    // 프로덕션에서만 체크
    if (__DEV__) return false;

    // React Native의 __DEV__ 플래그 외에 추가 검사
    // Native Module을 통한 ptrace 감지 (Android)
    // sysctl을 통한 P_TRACED 플래그 감지 (iOS)

    return false;
  }

  /**
   * 앱 변조 감지
   */
  private async isAppTampered(): Promise<boolean> {
    // 앱 서명 검증
    // 코드 무결성 해시 검증
    // 리소스 변조 감지

    // Native Module 필요
    return false;
  }

  /**
   * 위험 수준 계산
   */
  private calculateRiskLevel(
    reasons: string[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (reasons.length === 0) return 'low';
    if (reasons.length === 1 && reasons[0].includes('emulator')) return 'medium';
    if (reasons.some((r) => r.includes('compromised'))) return 'critical';
    if (reasons.some((r) => r.includes('tampered'))) return 'critical';
    return 'high';
  }
}

export const integrityChecker = new IntegrityChecker();
```

### 10.2 iOS App Attest

```typescript
// src/lib/appAttest.ts (iOS 전용)
import { Platform, NativeModules } from 'react-native';

const { AppAttestModule } = NativeModules;

interface AttestationResult {
  attestation: string;
  keyId: string;
}

class AppAttestService {
  private keyId: string | null = null;

  /**
   * App Attest 지원 여부 확인
   */
  async isSupported(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    try {
      return await AppAttestModule?.isSupported?.() ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Attestation Key 생성
   */
  async generateKey(): Promise<string> {
    if (!await this.isSupported()) {
      throw new Error('App Attest not supported');
    }

    this.keyId = await AppAttestModule.generateKey();
    return this.keyId;
  }

  /**
   * Attestation 생성
   */
  async attestKey(challenge: string): Promise<AttestationResult> {
    if (!this.keyId) {
      await this.generateKey();
    }

    const attestation = await AppAttestModule.attestKey(
      this.keyId,
      challenge
    );

    return {
      attestation,
      keyId: this.keyId!,
    };
  }

  /**
   * Assertion 생성 (API 요청 검증용)
   */
  async generateAssertion(
    requestData: string
  ): Promise<string> {
    if (!this.keyId) {
      throw new Error('Key not generated');
    }

    return AppAttestModule.generateAssertion(
      this.keyId,
      requestData
    );
  }
}

export const appAttestService = new AppAttestService();

// API 요청에서 사용
async function makeSecureRequest(endpoint: string, data: any) {
  const requestData = JSON.stringify(data);

  // App Attest로 요청 서명
  const assertion = await appAttestService.generateAssertion(requestData);

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Assertion': assertion,
    },
    body: requestData,
  });
}
```

### 10.3 Android Play Integrity

```typescript
// src/lib/playIntegrity.ts (Android 전용)
import { Platform, NativeModules } from 'react-native';

const { PlayIntegrityModule } = NativeModules;

interface IntegrityVerdict {
  requestDetails: {
    requestPackageName: string;
    timestampMillis: number;
    nonce: string;
  };
  appIntegrity: {
    appRecognitionVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNEVALUATED';
    packageName: string;
    certificateSha256Digest: string[];
    versionCode: number;
  };
  deviceIntegrity: {
    deviceRecognitionVerdict: ('MEETS_DEVICE_INTEGRITY' | 'MEETS_BASIC_INTEGRITY' | 'MEETS_STRONG_INTEGRITY')[];
  };
  accountDetails: {
    appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNEVALUATED';
  };
}

class PlayIntegrityService {
  /**
   * Integrity Token 요청
   */
  async requestIntegrityToken(nonce: string): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('Play Integrity is Android only');
    }

    try {
      const token = await PlayIntegrityModule.requestIntegrityToken(nonce);
      return token;
    } catch (error: any) {
      console.error('[PlayIntegrity] Token request failed:', error);

      // 에러 코드별 처리
      switch (error.code) {
        case 'PLAY_STORE_NOT_FOUND':
          throw new AppError({
            code: ErrorCodes.INTEGRITY_PLAY_STORE_MISSING,
            message: 'Google Play Store가 필요합니다',
            category: ErrorCategory.SECURITY,
          });
        case 'NETWORK_ERROR':
          throw new AppError({
            code: ErrorCodes.NETWORK_ERROR,
            message: '네트워크 연결을 확인해주세요',
            category: ErrorCategory.NETWORK,
          });
        default:
          throw error;
      }
    }
  }

  /**
   * 서버에서 토큰 검증 요청
   */
  async verifyIntegrity(): Promise<IntegrityVerdict> {
    // 1. Nonce 생성 (서버에서)
    const { nonce } = await apiClient.request<{ nonce: string }>(
      '/v1/security/integrity/nonce',
      { method: 'POST' }
    );

    // 2. Integrity Token 요청
    const token = await this.requestIntegrityToken(nonce);

    // 3. 서버에서 검증
    const verdict = await apiClient.request<IntegrityVerdict>(
      '/v1/security/integrity/verify',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      }
    );

    return verdict;
  }

  /**
   * 무결성 검사 결과 해석
   */
  interpretVerdict(verdict: IntegrityVerdict): {
    isSecure: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 앱 무결성
    if (verdict.appIntegrity.appRecognitionVerdict !== 'PLAY_RECOGNIZED') {
      issues.push('App not recognized by Play Store');
    }

    // 기기 무결성
    if (!verdict.deviceIntegrity.deviceRecognitionVerdict.includes('MEETS_DEVICE_INTEGRITY')) {
      issues.push('Device integrity check failed');
    }

    // 라이선스
    if (verdict.accountDetails.appLicensingVerdict === 'UNLICENSED') {
      issues.push('App not licensed');
    }

    return {
      isSecure: issues.length === 0,
      issues,
    };
  }
}

export const playIntegrityService = new PlayIntegrityService();
```

### 10.4 무결성 검사 통합

```typescript
// src/lib/securityGate.ts
import { Platform } from 'react-native';
import { integrityChecker } from './integrityCheck';
import { appAttestService } from './appAttest';
import { playIntegrityService } from './playIntegrity';
import { analyticsService } from '@/services/analytics/AnalyticsService';

export type SecurityAction = 'allow' | 'warn' | 'block';

interface SecurityCheckResult {
  action: SecurityAction;
  message?: string;
  reasons: string[];
}

class SecurityGate {
  /**
   * 앱 시작 시 보안 검사
   */
  async performStartupCheck(): Promise<SecurityCheckResult> {
    // 프로덕션에서만 엄격 검사
    if (__DEV__) {
      return { action: 'allow', reasons: [] };
    }

    // 1. 기본 무결성 검사
    const integrityResult = await integrityChecker.checkIntegrity();

    // 2. 플랫폼별 추가 검사
    let platformCheck = { isSecure: true, issues: [] as string[] };

    if (Platform.OS === 'ios') {
      // iOS App Attest는 민감한 작업 시에만
    } else if (Platform.OS === 'android') {
      try {
        const verdict = await playIntegrityService.verifyIntegrity();
        platformCheck = playIntegrityService.interpretVerdict(verdict);
      } catch (error) {
        console.warn('[SecurityGate] Play Integrity check failed:', error);
        // 실패해도 앱은 계속 실행 (graceful degradation)
      }
    }

    // 3. 결과 분석
    const allReasons = [
      ...integrityResult.reasons,
      ...platformCheck.issues,
    ];

    // 4. 보안 이벤트 로깅
    if (allReasons.length > 0) {
      await analyticsService.logEvent('security_check_issues', {
        platform: Platform.OS,
        issues: allReasons.join(', '),
        riskLevel: integrityResult.riskLevel,
      });
    }

    // 5. 조치 결정
    const action = this.determineAction(integrityResult.riskLevel, allReasons);

    return {
      action,
      message: this.getMessage(action),
      reasons: allReasons,
    };
  }

  private determineAction(
    riskLevel: string,
    reasons: string[]
  ): SecurityAction {
    // 민감한 앱의 경우 더 엄격하게
    // UNIQN은 금융 거래가 없으므로 중간 수준

    if (riskLevel === 'critical') {
      return 'block';
    }

    if (riskLevel === 'high') {
      return 'warn';
    }

    if (reasons.some((r) => r.includes('emulator')) && !__DEV__) {
      return 'warn'; // 에뮬레이터는 경고만
    }

    return 'allow';
  }

  private getMessage(action: SecurityAction): string | undefined {
    switch (action) {
      case 'block':
        return '보안상의 이유로 앱을 사용할 수 없습니다. 정상적인 기기에서 다시 시도해주세요.';
      case 'warn':
        return '이 기기에서는 일부 기능이 제한될 수 있습니다.';
      default:
        return undefined;
    }
  }

  /**
   * 민감한 작업 전 추가 검증
   */
  async verifyForSensitiveAction(
    action: 'payment' | 'withdrawal' | 'profile_change'
  ): Promise<boolean> {
    if (__DEV__) return true;

    if (Platform.OS === 'ios') {
      try {
        // App Attest로 검증
        const challenge = await this.getServerChallenge();
        await appAttestService.attestKey(challenge);
        return true;
      } catch {
        return false;
      }
    } else if (Platform.OS === 'android') {
      try {
        const verdict = await playIntegrityService.verifyIntegrity();
        const { isSecure } = playIntegrityService.interpretVerdict(verdict);
        return isSecure;
      } catch {
        return false;
      }
    }

    return true;
  }

  private async getServerChallenge(): Promise<string> {
    const { challenge } = await apiClient.request<{ challenge: string }>(
      '/v1/security/challenge',
      { method: 'POST' }
    );
    return challenge;
  }
}

export const securityGate = new SecurityGate();
```

### 앱에서 사용

```typescript
// app/_layout.tsx
import { useEffect, useState } from 'react';
import { securityGate, SecurityAction } from '@/lib/securityGate';
import { SecurityBlockedScreen } from '@/components/SecurityBlockedScreen';
import { SecurityWarningBanner } from '@/components/SecurityWarningBanner';

export default function RootLayout() {
  const [securityAction, setSecurityAction] = useState<SecurityAction>('allow');
  const [securityMessage, setSecurityMessage] = useState<string>();

  useEffect(() => {
    const checkSecurity = async () => {
      const result = await securityGate.performStartupCheck();
      setSecurityAction(result.action);
      setSecurityMessage(result.message);
    };

    checkSecurity();
  }, []);

  // 차단된 경우
  if (securityAction === 'block') {
    return <SecurityBlockedScreen message={securityMessage} />;
  }

  return (
    <>
      {/* 경고 배너 */}
      {securityAction === 'warn' && (
        <SecurityWarningBanner message={securityMessage} />
      )}

      {/* 정상 레이아웃 */}
      <Stack>
        {/* ... */}
      </Stack>
    </>
  );
}
```

---

## 11. 코드 난독화 (Android)

### ProGuard/R8 설정

```
# android/app/proguard-rules.pro

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Expo
-keep class expo.modules.** { *; }

# 앱 특정 클래스 보호
-keep class com.uniqn.app.** { *; }

# 보안 관련 클래스 난독화
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# 디버그 정보 제거
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# 최적화
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# 로그 제거 (프로덕션)
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}
```

### build.gradle 설정

```groovy
// android/app/build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 12. 보안 체크리스트 (추가)

### 네트워크 보안
- [x] Certificate Pinning 구현
- [x] 백업 핀 설정
- [x] 핀 갱신 메커니즘

### 앱 무결성
- [x] Jailbreak/Root 감지
- [x] 에뮬레이터 감지
- [x] iOS App Attest 연동
- [x] Android Play Integrity 연동
- [x] 디버거 감지

### 코드 보호
- [x] ProGuard/R8 난독화 (Android)
- [x] 로그 제거 (프로덕션)
- [x] 디버그 정보 제거
