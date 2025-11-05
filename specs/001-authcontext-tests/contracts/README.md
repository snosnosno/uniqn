# Contracts: TypeScript 타입 정의

**Feature**: AuthContext 단위 및 통합 테스트
**Branch**: `001-authcontext-tests`
**Created**: 2025-11-06

## 개요

이 디렉토리는 AuthContext 테스트에서 사용되는 모든 TypeScript 타입 정의를 포함합니다. 타입 안전성을 보장하고, 테스트 코드의 가독성과 유지보수성을 향상시킵니다.

---

## 파일 구조

```
contracts/
├── README.md              # 이 파일
├── test-types.ts          # 테스트 데이터 타입 정의
└── mock-interfaces.ts     # Mock 인터페이스 정의
```

---

## 파일 설명

### 1. test-types.ts

**Purpose**: 테스트에서 사용되는 데이터 타입을 정의합니다.

**Exports**:
- `TestUser`: 테스트 사용자 인터페이스
- `UserRole`: 역할 타입 (`'admin' | 'manager' | null`)
- `ExtendedUser`: 확장된 사용자 인터페이스
- `MockIdTokenResult`: Mock ID 토큰 결과
- `FirebaseAuthError`: Firebase Auth 에러 인터페이스
- `FirebaseAuthErrorCode`: 에러 코드 타입
- `AuthContextType`: AuthContext 타입
- `LoginScenario`: 로그인 시나리오 데이터
- `LogoutScenario`: 로그아웃 시나리오 데이터
- `RoleVerificationScenario`: 역할 검증 시나리오 데이터
- `SessionPersistenceScenario`: 세션 지속성 시나리오 데이터
- `TestWrapperProps`: 테스트 래퍼 Props
- `RenderHookOptions`: Render Hook 옵션
- `MockFunction`: Mock 함수 타입

**Usage Example**:
```typescript
import type { TestUser, UserRole, LoginScenario } from './contracts/test-types';

const mockAdmin: TestUser = {
  uid: 'test-admin-uid',
  email: 'admin@test.com',
  // ...
};

const loginScenario: LoginScenario = {
  email: 'admin@test.com',
  password: 'correct-password',
  expectedRole: 'admin',
  expectedIsAdmin: true,
};
```

### 2. mock-interfaces.ts

**Purpose**: Firebase Auth Mock의 인터페이스를 정의합니다.

**Exports**:
- `MockAuth`: Mock Firebase Auth 인스턴스
- `MockUserCredential`: Mock UserCredential
- `MockSignInWithEmailAndPassword`: signIn Mock 함수 타입
- `MockSignOut`: signOut Mock 함수 타입
- `MockOnAuthStateChanged`: onAuthStateChanged Mock 함수 타입
- `MockGetIdTokenResult`: getIdTokenResult Mock 함수 타입
- `MockSignInWithPopup`: signInWithPopup Mock 함수 타입
- `MockSignInWithCustomToken`: signInWithCustomToken Mock 함수 타입
- `MockSendPasswordResetEmail`: sendPasswordResetEmail Mock 함수 타입
- `MockSendEmailVerification`: sendEmailVerification Mock 함수 타입
- `MockSetPersistence`: setPersistence Mock 함수 타입
- `MockReload`: reload Mock 함수 타입
- `MockPersistence`: Mock Persistence 객체
- `MockGoogleAuthProvider`: Mock Google Auth Provider
- `CreateFirebaseAuthError`: 에러 생성 함수 타입
- `ResetMocks`: Mock 초기화 함수 타입
- `SetMockUser`: Mock 사용자 설정 함수 타입
- `SetMockRole`: Mock 역할 설정 함수 타입
- `SetMockError`: Mock 에러 설정 함수 타입

**Usage Example**:
```typescript
import type { MockAuth, MockSignInWithEmailAndPassword } from './contracts/mock-interfaces';

const mockAuth: MockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: jest.fn() as MockSignInWithEmailAndPassword,
  // ...
};
```

---

## 타입 안전성 원칙

### 1. `any` 타입 사용 금지

❌ **Bad**:
```typescript
const mockUser: any = { ... };
```

✅ **Good**:
```typescript
import type { TestUser } from './contracts/test-types';
const mockUser: TestUser = { ... };
```

### 2. 명시적 타입 선언

❌ **Bad**:
```typescript
const mockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: jest.fn(),
};
```

✅ **Good**:
```typescript
import type { MockAuth } from './contracts/mock-interfaces';
const mockAuth: MockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: jest.fn() as MockSignInWithEmailAndPassword,
};
```

### 3. TypeScript Strict Mode 준수

모든 타입은 TypeScript strict mode를 준수합니다:
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`
- `strictBindCallApply: true`
- `strictPropertyInitialization: true`
- `noImplicitThis: true`
- `alwaysStrict: true`

---

## 타입 확장 가이드

### 새로운 테스트 시나리오 추가

1. **test-types.ts**에 새로운 시나리오 타입 추가:
```typescript
export interface NewScenario {
  // 시나리오 데이터 정의
}
```

2. **data-model.md**에 시나리오 데이터 추가

3. 테스트 코드에서 사용:
```typescript
import type { NewScenario } from './contracts/test-types';
```

### 새로운 Mock 함수 추가

1. **mock-interfaces.ts**에 Mock 함수 타입 추가:
```typescript
export type MockNewFunction = jest.Mock<ReturnType, Parameters>;
```

2. **MockAuth** 인터페이스에 함수 추가:
```typescript
export interface MockAuth extends Partial<Auth> {
  newFunction: MockNewFunction;
}
```

3. Mock 구현에서 사용:
```typescript
const mockAuth: MockAuth = {
  newFunction: jest.fn() as MockNewFunction,
};
```

---

## 참조

- **Spec**: [../spec.md](../spec.md)
- **Research**: [../research.md](../research.md)
- **Data Model**: [../data-model.md](../data-model.md)
- **Quickstart**: [../quickstart.md](../quickstart.md)

---

**Last Updated**: 2025-11-06
**Status**: Complete ✅
