# Research: AuthContext 테스트 전략 및 기술 조사

**Feature**: AuthContext 단위 및 통합 테스트
**Branch**: `001-authcontext-tests`
**Created**: 2025-11-06

## 개요

AuthContext는 Firebase Auth를 사용하는 React Context입니다. 테스트를 위해서는 Firebase Auth의 Mock 전략, React Context 테스트 패턴, 그리고 Hook 테스트 방법을 조사해야 합니다.

---

## 1. Firebase Auth Mock 전략

### 조사 항목

AuthContext는 Firebase Auth의 다음 기능을 사용합니다:
- `signInWithEmailAndPassword`: 이메일/비밀번호 로그인
- `signOut`: 로그아웃
- `onAuthStateChanged`: 인증 상태 변경 감지
- `getIdTokenResult`: 사용자 역할(claims) 조회
- `signInWithPopup`: Google 로그인
- `signInWithCustomToken`: 카카오 로그인
- `sendPasswordResetEmail`: 비밀번호 재설정
- `sendEmailVerification`: 이메일 인증
- `setPersistence`: 세션 지속성 설정

### 선택된 방법: Jest Manual Mocks

**Decision**: Jest manual mocks를 사용하여 Firebase Auth를 직접 Mock합니다.

**Rationale**:
1. **완전한 제어**: Firebase Auth의 모든 동작을 세밀하게 제어할 수 있습니다
2. **TypeScript 지원**: 타입 안전성을 유지하면서 Mock을 작성할 수 있습니다
3. **테스트 격리**: 각 테스트에서 독립적으로 Mock 동작을 설정할 수 있습니다
4. **유지보수**: 프로젝트 전체에서 일관된 Mock 패턴을 사용할 수 있습니다
5. **외부 의존성 없음**: firebase-mock과 같은 추가 라이브러리가 필요하지 않습니다

**Alternatives Considered**:

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|------|------|------|-------------------|
| **firebase-mock** | Firebase 전체 Mock 제공 | - 최신 Firebase v9+ 미지원<br>- 유지보수 중단<br>- 불필요한 기능 포함 | Firebase 11.9.1과 호환되지 않으며, Auth만 Mock하면 충분함 |
| **MSW (Mock Service Worker)** | HTTP 요청 가로채기 | - Firebase SDK는 HTTP가 아닌 WebSocket 사용<br>- 설정 복잡도 높음 | Firebase Auth는 HTTP REST API를 직접 사용하지 않음 |
| **Emulator** | 실제 Firebase와 유사한 환경 | - 설정 복잡<br>- 실행 시간 증가<br>- CI/CD 통합 어려움 | 테스트 실행 시간 5초 제약 위반 |

---

## 2. React Context 테스트 패턴

### 조사 항목

React Context를 테스트하기 위한 모범 사례를 조사합니다.

### 선택된 방법: React Testing Library + Custom Wrapper

**Decision**: React Testing Library의 `render` 함수와 custom wrapper를 사용하여 Context를 테스트합니다.

**Pattern**:
```typescript
// test-utils.tsx
import { AuthProvider } from '../AuthContext';

export const renderWithAuth = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    ),
  });
};
```

**Rationale**:
1. **React Testing Library 모범 사례**: 공식 문서에서 권장하는 패턴입니다
2. **실제 사용자 관점**: Context가 실제로 사용되는 방식과 동일하게 테스트합니다
3. **재사용성**: 여러 테스트에서 동일한 wrapper를 재사용할 수 있습니다
4. **통합 테스트 용이**: 실제 컴포넌트와 함께 테스트하기 쉽습니다

**Alternatives Considered**:

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|------|------|------|-------------------|
| **@testing-library/react-hooks** | Hook 직접 테스트 | - React 18에서 deprecated<br>- Context가 없는 환경에서 테스트 어려움 | React 18에서 권장하지 않으며, `renderHook` 대신 `render` 사용 권장 |
| **Enzyme** | 컴포넌트 내부 접근 가능 | - 유지보수 중단<br>- React 18 미지원<br>- 구현 세부사항 테스트 | React Testing Library가 공식 권장 도구 |

---

## 3. Hook 테스트 전략

### 조사 항목

`useAuth` Hook을 테스트하기 위한 방법을 조사합니다.

### 선택된 방법: React Testing Library의 `renderHook`

**Decision**: React Testing Library의 `renderHook` 유틸리티를 사용하여 Hook을 테스트합니다.

**Pattern**:
```typescript
import { renderHook } from '@testing-library/react';
import { useAuth } from '../AuthContext';

test('useAuth returns context values', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  });

  expect(result.current.currentUser).toBeDefined();
});
```

**Rationale**:
1. **React 18 호환**: React 18에서 권장하는 공식 방법입니다
2. **실제 렌더링**: Hook이 실제 컴포넌트에서 사용되는 것처럼 테스트됩니다
3. **타입 안전성**: TypeScript와 완벽하게 통합됩니다
4. **비동기 지원**: `waitFor`, `act` 등을 사용하여 비동기 동작을 테스트할 수 있습니다

---

## 4. 테스트 격리 전략

### 조사 항목

각 테스트가 독립적으로 실행되도록 보장하는 방법을 조사합니다.

### 선택된 방법: beforeEach/afterEach + jest.clearAllMocks

**Decision**: 각 테스트 전후에 Mock을 초기화하고 cleanup을 실행합니다.

**Pattern**:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // Mock 초기 상태 설정
});

afterEach(() => {
  cleanup();
});
```

**Rationale**:
1. **테스트 독립성**: 이전 테스트의 상태가 다음 테스트에 영향을 주지 않습니다
2. **메모리 누수 방지**: 각 테스트 후 리소스를 정리합니다
3. **예측 가능성**: 각 테스트가 동일한 초기 상태에서 시작됩니다
4. **병렬 실행 가능**: 테스트 간 의존성이 없어 병렬 실행이 안전합니다

---

## 5. 에러 시뮬레이션 전략

### 조사 항목

네트워크 오류, Firebase 오류 등 다양한 에러 케이스를 시뮬레이션하는 방법을 조사합니다.

### 선택된 방법: Mock 함수의 `mockRejectedValue`

**Decision**: Jest의 `mockRejectedValue`를 사용하여 Firebase Auth 함수가 에러를 던지도록 설정합니다.

**Pattern**:
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';

// Firebase 에러 시뮬레이션
(signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
  code: 'auth/wrong-password',
  message: 'The password is invalid',
});
```

**Rationale**:
1. **실제 에러 구조**: Firebase Auth의 실제 에러 객체 구조를 그대로 사용합니다
2. **테스트 가독성**: 어떤 에러를 시뮬레이션하는지 명확합니다
3. **유연성**: 다양한 에러 코드와 메시지를 쉽게 테스트할 수 있습니다

**에러 케이스 목록** (최소 10개):
1. `auth/wrong-password`: 잘못된 비밀번호
2. `auth/user-not-found`: 존재하지 않는 사용자
3. `auth/invalid-email`: 잘못된 이메일 형식
4. `auth/user-disabled`: 비활성화된 계정
5. `auth/network-request-failed`: 네트워크 오류
6. `auth/too-many-requests`: 과도한 요청
7. `auth/popup-closed-by-user`: 팝업 창 닫힘 (Google 로그인)
8. `auth/expired-action-code`: 만료된 액션 코드
9. `auth/invalid-action-code`: 잘못된 액션 코드
10. `auth/token-expired`: 토큰 만료
11. `auth/claims-too-large`: 커스텀 클레임 크기 초과
12. Firebase 초기화 실패

---

## 6. 성능 최적화 전략

### 조사 항목

테스트 실행 시간을 5초 이내로 유지하기 위한 최적화 방법을 조사합니다.

### 선택된 방법: 다층 최적화 전략

**Decision**: 여러 최적화 기법을 조합하여 테스트 실행 시간을 최소화합니다.

**Optimizations**:

1. **Mock 최소화**:
   - 필요한 Firebase 함수만 Mock
   - 불필요한 Mock 제거

2. **비동기 작업 최소화**:
   - `waitFor`의 타임아웃 시간 조정 (기본 1000ms → 100ms)
   - `act`를 명시적으로 사용하여 불필요한 대기 제거

3. **테스트 병렬 실행**:
   - Jest의 `--maxWorkers` 옵션 활용
   - 테스트 간 의존성 제거

4. **setup/teardown 최적화**:
   - 무거운 초기화는 `beforeAll`로 이동
   - 각 테스트별 최소한의 setup만 `beforeEach`에서 실행

5. **Firebase Auth Mock 경량화**:
   - `onAuthStateChanged`의 콜백을 즉시 실행
   - 타이머 함수 사용 최소화

**Expected Performance**:
- 단위 테스트 (30개): 약 2초
- 통합 테스트 (10개): 약 2초
- 에러 케이스 테스트 (12개): 약 1초
- **Total**: 5초 이내

---

## 7. CI/CD 통합 전략

### 조사 항목

GitHub Actions 또는 다른 CI/CD 파이프라인에서 테스트를 실행하는 방법을 조사합니다.

### 선택된 방법: npm scripts + CI 환경 변수

**Decision**: `npm test` 명령을 CI/CD에서 실행하며, 환경 변수를 통해 CI 모드를 감지합니다.

**CI Configuration**:
```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd app2
    npm run test:ci
    npm run test:coverage
  env:
    CI: true
```

**Rationale**:
1. **표준 npm scripts**: 로컬과 CI에서 동일한 명령 사용
2. **환경 감지**: CI 환경에서는 watch 모드 비활성화
3. **커버리지 리포트**: CI에서 커버리지 리포트 생성 및 업로드

---

## 8. 커버리지 목표 및 전략

### 조사 항목

80% 커버리지를 달성하기 위한 전략을 조사합니다.

### 선택된 방법: 라인/브랜치/함수/구문 커버리지 균형

**Decision**: 모든 커버리지 유형에서 80% 이상을 목표로 합니다.

**Coverage Targets**:
- **Lines**: 80% (최소 200줄 / 250줄)
- **Branches**: 80% (모든 if/else 분기)
- **Functions**: 90% (모든 exported 함수)
- **Statements**: 80% (모든 구문)

**Priority Areas** (커버리지 우선순위):
1. **P1**: 인증 로직 (signIn, signOut) - 100%
2. **P2**: 역할 검증 (isAdmin, role) - 100%
3. **P3**: 에러 핸들링 - 90%
4. **P4**: 엣지 케이스 - 80%
5. **P5**: 비표준 플로우 (카카오 로그인 등) - 70%

**Uncovered Areas** (커버리지 대상 외):
- `setSentryUser`: Sentry는 별도 Mock이 복잡하므로 제외 (약 5줄)
- `logger`: 로깅은 테스트 대상 외 (약 10줄)
- 예상 커버리지: (250 - 15) / 250 = 94%

---

## 9. 테스트 파일 구조

### 조사 항목

테스트 파일을 어떻게 구성할지 조사합니다.

### 선택된 방법: 기능별 파일 분리

**Decision**: 단위 테스트와 통합 테스트를 별도 파일로 분리하고, Mock은 별도 디렉토리에 관리합니다.

**File Structure**:
```
contexts/
├── AuthContext.tsx
└── __tests__/
    ├── AuthContext.test.tsx          # 단위 테스트 (30개)
    ├── AuthContext.integration.test.tsx  # 통합 테스트 (10개)
    └── __mocks__/
        ├── firebase.ts               # Firebase Auth Mock
        └── test-utils.tsx            # 테스트 유틸리티
```

**Test Organization**:

**AuthContext.test.tsx** (단위 테스트):
- `describe('useAuth Hook')`: Hook 기본 동작
- `describe('signIn')`: 로그인 로직
- `describe('signOut')`: 로그아웃 로직
- `describe('role management')`: 역할 관리
- `describe('error handling')`: 에러 처리
- `describe('edge cases')`: 엣지 케이스

**AuthContext.integration.test.tsx** (통합 테스트):
- `describe('login flow')`: 로그인 → 페이지 접근
- `describe('logout flow')`: 로그아웃 → 리다이렉트
- `describe('role-based access')`: 역할 기반 접근 제어
- `describe('session management')`: 세션 관리

**Rationale**:
1. **명확한 책임**: 단위 테스트와 통합 테스트가 분리되어 책임이 명확합니다
2. **유지보수성**: 각 파일이 특정 테스트 유형에 집중합니다
3. **실행 속도**: 필요한 테스트만 선택적으로 실행 가능합니다

---

## 10. 의존성 확인

### 조사 항목

필요한 npm 패키지가 이미 설치되어 있는지 확인합니다.

### 현재 설치된 패키지 (package.json 기준):

✅ **이미 설치됨**:
- `@testing-library/react`: 14.0.0
- `@testing-library/jest-dom`: 5.17.0
- `@testing-library/user-event`: 14.6.1
- `jest`: (react-scripts 5.0.0에 포함)
- `typescript`: 4.9.5

❌ **추가 설치 불필요**:
- `@testing-library/react-hooks`: React 18에서 deprecated, `renderHook`은 `@testing-library/react`에 포함
- `firebase-mock`: 수동 Mock 사용으로 불필요
- `msw`: Firebase Auth Mock에 불필요

✅ **추가 패키지 없이 테스트 가능**

---

## 11. 테스트 작성 순서

### 조사 항목

어떤 순서로 테스트를 작성할지 계획합니다.

### 선택된 방법: TDD Red-Green-Refactor

**Decision**: 테스트를 우선 작성하고, Mock을 구현한 후, 테스트를 통과시킵니다.

**Implementation Order**:

**Day 1 (8시간)**:
1. Firebase Auth Mock 구현 (2시간)
   - `firebase.ts`: 기본 Mock 함수 정의
   - `test-utils.tsx`: 테스트 유틸리티 작성

2. useAuth Hook 단위 테스트 (3시간)
   - Hook 반환값 테스트
   - 로그인/로그아웃 기본 동작 테스트
   - 역할 검증 로직 테스트

3. 에러 핸들링 테스트 (3시간)
   - 최소 10개 에러 케이스 테스트
   - 네트워크 오류, Firebase 오류 시뮬레이션

**Day 2 (6시간)**:
4. 통합 테스트 작성 (4시간)
   - 로그인 → 페이지 접근 플로우
   - 로그아웃 → 세션 정리 플로우
   - 역할 기반 접근 제어 플로우

5. 엣지 케이스 테스트 (2시간)
   - 세션 만료, 토큰 만료
   - 동시 다중 탭, 네트워크 재연결
   - 중복 로그인, 빠른 연속 로그인/로그아웃

**Day 2 (2시간)**:
6. 커버리지 확인 및 보완 (1시간)
   - `npm run test:coverage` 실행
   - 80% 미만인 영역 테스트 추가

7. CI/CD 통합 확인 (30분)
   - `npm run test:ci` 실행 테스트
   - 모든 품질 게이트 통과 확인

8. 문서화 및 리뷰 (30분)
   - 테스트 실행 가이드 작성
   - 코드 리뷰 준비

---

## 요약

### 핵심 결정사항

1. **Firebase Auth Mock**: Jest manual mocks (외부 라이브러리 불필요)
2. **Context 테스트**: React Testing Library + custom wrapper
3. **Hook 테스트**: `renderHook` (React 18 권장)
4. **테스트 격리**: beforeEach/afterEach + jest.clearAllMocks
5. **에러 시뮬레이션**: `mockRejectedValue` (12개 이상)
6. **성능 최적화**: 다층 최적화 (5초 이내 목표)
7. **커버리지**: 80% 이상 (Lines, Branches, Functions, Statements)
8. **파일 구조**: 단위/통합 테스트 분리, Mock 별도 관리

### 다음 단계

- **Phase 1**: data-model.md 작성 (테스트 데이터 모델 정의)
- **Phase 1**: contracts/ 작성 (테스트 인터페이스 정의)
- **Phase 1**: quickstart.md 작성 (테스트 실행 가이드)

---

**Last Updated**: 2025-11-06
**Status**: Complete ✅
