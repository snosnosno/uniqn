# Data Model: AuthContext 테스트 데이터 구조

**Feature**: AuthContext 단위 및 통합 테스트
**Branch**: `001-authcontext-tests`
**Created**: 2025-11-06

## 개요

이 문서는 AuthContext 테스트에서 사용되는 데이터 모델과 Mock 구조를 정의합니다. 모든 타입은 TypeScript strict mode를 준수하며, Firebase Auth와 호환됩니다.

---

## 1. 테스트 사용자 데이터 모델

### 1.1 User Interface

**Definition**:
```typescript
interface TestUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  phoneNumber: string | null;
  providerId: string;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}
```

**Purpose**: 테스트에서 사용되는 가상 사용자 데이터를 표준화합니다.

**Usage**:
- 단위 테스트: 다양한 사용자 상태 시뮬레이션
- 통합 테스트: 실제 사용자 시나리오 재현
- 에러 테스트: 부분적으로 잘못된 데이터 시뮬레이션

### 1.2 테스트 사용자 프리셋

**Admin User** (관리자):
```typescript
const mockAdminUser: TestUser = {
  uid: 'test-admin-uid',
  email: 'admin@test.com',
  displayName: 'Test Admin',
  emailVerified: true,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};
```

**Manager User** (매니저):
```typescript
const mockManagerUser: TestUser = {
  uid: 'test-manager-uid',
  email: 'manager@test.com',
  displayName: 'Test Manager',
  emailVerified: true,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};
```

**Regular User** (일반 사용자):
```typescript
const mockRegularUser: TestUser = {
  uid: 'test-user-uid',
  email: 'user@test.com',
  displayName: 'Test User',
  emailVerified: true,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};
```

**Unverified User** (미인증 사용자):
```typescript
const mockUnverifiedUser: TestUser = {
  uid: 'test-unverified-uid',
  email: 'unverified@test.com',
  displayName: 'Unverified User',
  emailVerified: false,  // ⚠️ 이메일 미인증
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};
```

---

## 2. 역할(Role) 데이터 모델

### 2.1 IdTokenResult Interface

**Definition**:
```typescript
interface MockIdTokenResult {
  token: string;
  expirationTime: string;
  authTime: string;
  issuedAtTime: string;
  signInProvider: string;
  claims: {
    role?: string;
    [key: string]: unknown;
  };
}
```

**Purpose**: Firebase Auth의 `getIdTokenResult()` 반환값을 시뮬레이션합니다.

### 2.2 역할별 토큰 프리셋

**Admin Token**:
```typescript
const mockAdminToken: MockIdTokenResult = {
  token: 'mock-admin-token',
  expirationTime: '2025-11-07T00:00:00.000Z',
  authTime: '2025-11-06T00:00:00.000Z',
  issuedAtTime: '2025-11-06T00:00:00.000Z',
  signInProvider: 'password',
  claims: {
    role: 'admin',
    aud: 'test-project',
    sub: 'test-admin-uid',
  },
};
```

**Manager Token**:
```typescript
const mockManagerToken: MockIdTokenResult = {
  token: 'mock-manager-token',
  expirationTime: '2025-11-07T00:00:00.000Z',
  authTime: '2025-11-06T00:00:00.000Z',
  issuedAtTime: '2025-11-06T00:00:00.000Z',
  signInProvider: 'password',
  claims: {
    role: 'manager',
    aud: 'test-project',
    sub: 'test-manager-uid',
  },
};
```

**No Role Token** (역할 없음):
```typescript
const mockNoRoleToken: MockIdTokenResult = {
  token: 'mock-no-role-token',
  expirationTime: '2025-11-07T00:00:00.000Z',
  authTime: '2025-11-06T00:00:00.000Z',
  issuedAtTime: '2025-11-06T00:00:00.000Z',
  signInProvider: 'password',
  claims: {
    // role 없음
    aud: 'test-project',
    sub: 'test-user-uid',
  },
};
```

---

## 3. Firebase Auth Mock 구조

### 3.1 Auth Instance Mock

**Definition**:
```typescript
interface MockAuth {
  currentUser: TestUser | null;
  signInWithEmailAndPassword: jest.Mock;
  signOut: jest.Mock;
  onAuthStateChanged: jest.Mock;
  signInWithPopup: jest.Mock;
  signInWithCustomToken: jest.Mock;
  sendPasswordResetEmail: jest.Mock;
  sendEmailVerification: jest.Mock;
  setPersistence: jest.Mock;
  reload: jest.Mock;
}
```

**Purpose**: Firebase Auth 인스턴스를 Mock하여 테스트에서 사용합니다.

### 3.2 Mock 함수 시그니처

**signInWithEmailAndPassword**:
```typescript
signInWithEmailAndPassword: (
  auth: MockAuth,
  email: string,
  password: string
) => Promise<UserCredential>
```

**signOut**:
```typescript
signOut: (auth: MockAuth) => Promise<void>
```

**onAuthStateChanged**:
```typescript
onAuthStateChanged: (
  auth: MockAuth,
  callback: (user: TestUser | null) => void
) => Unsubscribe
```

**getIdTokenResult**:
```typescript
getIdTokenResult: (
  forceRefresh?: boolean
) => Promise<MockIdTokenResult>
```

---

## 4. 에러 데이터 모델

### 4.1 Firebase Auth Error Interface

**Definition**:
```typescript
interface FirebaseAuthError {
  code: string;
  message: string;
  name?: string;
  stack?: string;
}
```

**Purpose**: Firebase Auth의 에러 구조를 시뮬레이션합니다.

### 4.2 에러 프리셋 (12개)

**1. auth/wrong-password**:
```typescript
const wrongPasswordError: FirebaseAuthError = {
  code: 'auth/wrong-password',
  message: 'The password is invalid or the user does not have a password.',
  name: 'FirebaseError',
};
```

**2. auth/user-not-found**:
```typescript
const userNotFoundError: FirebaseAuthError = {
  code: 'auth/user-not-found',
  message: 'There is no user record corresponding to this identifier.',
  name: 'FirebaseError',
};
```

**3. auth/invalid-email**:
```typescript
const invalidEmailError: FirebaseAuthError = {
  code: 'auth/invalid-email',
  message: 'The email address is badly formatted.',
  name: 'FirebaseError',
};
```

**4. auth/user-disabled**:
```typescript
const userDisabledError: FirebaseAuthError = {
  code: 'auth/user-disabled',
  message: 'The user account has been disabled by an administrator.',
  name: 'FirebaseError',
};
```

**5. auth/network-request-failed**:
```typescript
const networkErrorError: FirebaseAuthError = {
  code: 'auth/network-request-failed',
  message: 'A network error has occurred.',
  name: 'FirebaseError',
};
```

**6. auth/too-many-requests**:
```typescript
const tooManyRequestsError: FirebaseAuthError = {
  code: 'auth/too-many-requests',
  message: 'We have blocked all requests from this device due to unusual activity.',
  name: 'FirebaseError',
};
```

**7. auth/popup-closed-by-user**:
```typescript
const popupClosedError: FirebaseAuthError = {
  code: 'auth/popup-closed-by-user',
  message: 'The popup has been closed by the user before finalizing the operation.',
  name: 'FirebaseError',
};
```

**8. auth/expired-action-code**:
```typescript
const expiredActionCodeError: FirebaseAuthError = {
  code: 'auth/expired-action-code',
  message: 'The action code has expired.',
  name: 'FirebaseError',
};
```

**9. auth/invalid-action-code**:
```typescript
const invalidActionCodeError: FirebaseAuthError = {
  code: 'auth/invalid-action-code',
  message: 'The action code is invalid.',
  name: 'FirebaseError',
};
```

**10. auth/token-expired**:
```typescript
const tokenExpiredError: FirebaseAuthError = {
  code: 'auth/id-token-expired',
  message: 'The user\'s credential is no longer valid. The user must sign in again.',
  name: 'FirebaseError',
};
```

**11. auth/claims-too-large**:
```typescript
const claimsTooLargeError: FirebaseAuthError = {
  code: 'auth/claims-too-large',
  message: 'The claims payload provided is too large.',
  name: 'FirebaseError',
};
```

**12. Firebase 초기화 실패**:
```typescript
const firebaseInitError: FirebaseAuthError = {
  code: 'auth/app-not-initialized',
  message: 'Firebase App has not been initialized.',
  name: 'FirebaseError',
};
```

---

## 5. 테스트 시나리오별 데이터

### 5.1 로그인 시나리오

**Success Case**:
```typescript
{
  email: 'admin@test.com',
  password: 'correct-password',
  expectedUser: mockAdminUser,
  expectedRole: 'admin',
  expectedIsAdmin: true,
}
```

**Failure Case**:
```typescript
{
  email: 'admin@test.com',
  password: 'wrong-password',
  expectedError: wrongPasswordError,
}
```

### 5.2 로그아웃 시나리오

**Success Case**:
```typescript
{
  initialUser: mockAdminUser,
  expectedUserAfterLogout: null,
  expectedRoleAfterLogout: null,
  expectedIsAdminAfterLogout: false,
}
```

### 5.3 역할 검증 시나리오

**Admin Role**:
```typescript
{
  user: mockAdminUser,
  token: mockAdminToken,
  expectedRole: 'admin',
  expectedIsAdmin: true,
}
```

**Manager Role**:
```typescript
{
  user: mockManagerUser,
  token: mockManagerToken,
  expectedRole: 'manager',
  expectedIsAdmin: true,  // manager도 isAdmin=true
}
```

**No Role**:
```typescript
{
  user: mockRegularUser,
  token: mockNoRoleToken,
  expectedRole: null,
  expectedIsAdmin: false,
}
```

### 5.4 세션 지속성 시나리오

**Remember Me (로컬 스토리지)**:
```typescript
{
  rememberMe: true,
  expectedPersistence: 'local',
  expectedStorageKey: 'rememberMe',
  expectedStorageValue: 'true',
}
```

**Session Only (세션 스토리지)**:
```typescript
{
  rememberMe: false,
  expectedPersistence: 'session',
  expectedStorageKey: 'rememberMe',
  expectedStorageValue: 'false',
}
```

---

## 6. Mock 상태 전이

### 6.1 인증 상태 전이

**State Diagram**:
```
┌─────────────┐
│   NULL      │  (로그아웃 상태)
│ (loading)   │
└──────┬──────┘
       │ signIn()
       ▼
┌─────────────┐
│   USER      │  (로그인 상태)
│ (role 확인) │
└──────┬──────┘
       │ signOut()
       ▼
┌─────────────┐
│   NULL      │  (로그아웃 상태)
└─────────────┘
```

**State Transitions**:
1. **NULL → USER**: `signIn()` 성공
2. **USER → NULL**: `signOut()` 호출
3. **USER → USER**: 페이지 새로고침 (세션 복원)
4. **NULL → NULL**: `signIn()` 실패

### 6.2 역할 상태 전이

**State Diagram**:
```
┌─────────────┐
│  NULL       │  (역할 없음)
└──────┬──────┘
       │ getIdTokenResult()
       ▼
┌─────────────┐
│  ADMIN      │  or  │ MANAGER │  or  │ NULL │
└─────────────┘
```

---

## 7. Mock 데이터 관리

### 7.1 데이터 파일 구조

```
__tests__/__mocks__/
├── firebase.ts           # Firebase Auth Mock 구현
├── test-users.ts         # 테스트 사용자 프리셋
├── test-tokens.ts        # 테스트 토큰 프리셋
└── test-errors.ts        # 테스트 에러 프리셋
```

### 7.2 데이터 재사용 패턴

**Good Practice**:
```typescript
import { mockAdminUser, mockAdminToken } from './__mocks__/test-users';

test('admin can access admin page', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  });

  // 프리셋 사용
  expect(result.current.currentUser).toEqual(mockAdminUser);
  expect(result.current.role).toBe('admin');
});
```

**Bad Practice**:
```typescript
test('admin can access admin page', () => {
  // ❌ 매번 새로 생성하지 말 것
  const user = {
    uid: 'test-admin-uid',
    email: 'admin@test.com',
    // ... (중복 코드)
  };
});
```

---

## 요약

### 핵심 데이터 모델

1. **TestUser**: 테스트 사용자 데이터 (4개 프리셋)
2. **MockIdTokenResult**: 역할 토큰 데이터 (3개 프리셋)
3. **FirebaseAuthError**: 에러 데이터 (12개 프리셋)
4. **MockAuth**: Firebase Auth 인스턴스 Mock

### 데이터 원칙

- **재사용성**: 프리셋 데이터를 최대한 재사용
- **일관성**: 모든 테스트에서 동일한 데이터 구조 사용
- **타입 안전성**: TypeScript strict mode 준수
- **명확성**: 각 프리셋의 목적이 명확함

### 다음 단계

- **contracts/**: 테스트 인터페이스 및 타입 정의 작성
- **quickstart.md**: 테스트 실행 가이드 작성

---

**Last Updated**: 2025-11-06
**Status**: Complete ✅
