# Quickstart: AuthContext 테스트 실행 가이드

**Feature**: AuthContext 단위 및 통합 테스트
**Branch**: `001-authcontext-tests`
**Created**: 2025-11-06

## 개요

이 문서는 AuthContext 테스트를 실행하고 개발하는 방법을 설명합니다. 테스트 환경 설정부터 CI/CD 통합까지 전 과정을 다룹니다.

---

## 빠른 시작 (Quick Start)

### 1. 테스트 실행

```bash
# app2 디렉토리로 이동
cd app2

# 모든 테스트 실행
npm test

# AuthContext 테스트만 실행
npm test AuthContext

# Watch 모드로 실행 (개발 중)
npm test -- --watch
```

### 2. 커버리지 확인

```bash
# 커버리지 리포트 생성
npm run test:coverage

# AuthContext 커버리지만 확인
npm run test:coverage -- --collectCoverageFrom="src/contexts/AuthContext.tsx"
```

### 3. CI/CD 모드 실행

```bash
# CI 환경에서 실행 (watch 모드 비활성화)
npm run test:ci
```

---

## 환경 설정

### 전제 조건

✅ **이미 설치됨**:
- Node.js 18+
- npm 9+
- TypeScript 4.9.5
- Jest (react-scripts에 포함)
- @testing-library/react 14.0.0

❌ **추가 설치 불필요**:
- Firebase Auth는 Mock으로 대체
- 외부 테스트 라이브러리 불필요

### package.json 스크립트

```json
{
  "scripts": {
    "test": "react-scripts test",
    "test:coverage": "npm test -- --coverage --watchAll=false",
    "test:ci": "npm test -- --watchAll=false --passWithNoTests",
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx"
  }
}
```

---

## 개발 워크플로우

### TDD (Test-Driven Development) 접근

#### Step 1: 테스트 먼저 작성 (Red)

```typescript
// app2/src/contexts/__tests__/AuthContext.test.tsx
describe('useAuth Hook', () => {
  test('returns auth context values', () => {
    // 이 테스트는 실패할 것 (Mock 아직 구현 안 됨)
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.currentUser).toBeDefined();
  });
});
```

**Run**: `npm test AuthContext`
**Expected**: ❌ 테스트 실패

#### Step 2: Mock 구현 (Green)

```typescript
// app2/src/contexts/__tests__/__mocks__/firebase.ts
export const mockAuth = {
  currentUser: mockAdminUser,
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: mockAdminUser,
  }),
  // ...
};
```

**Run**: `npm test AuthContext`
**Expected**: ✅ 테스트 통과

#### Step 3: 리팩토링 (Refactor)

- Mock 코드 정리
- 테스트 가독성 개선
- 중복 코드 제거

**Run**: `npm test AuthContext`
**Expected**: ✅ 테스트 계속 통과

### 테스트 작성 순서

#### Day 1 (8시간)

**1. Firebase Auth Mock 구현 (2시간)**:
```bash
# Mock 파일 생성
touch app2/src/contexts/__tests__/__mocks__/firebase.ts
touch app2/src/contexts/__tests__/__mocks__/test-utils.tsx
touch app2/src/contexts/__tests__/__mocks__/test-users.ts
touch app2/src/contexts/__tests__/__mocks__/test-errors.ts
```

**2. useAuth Hook 단위 테스트 (3시간)**:
```bash
# 테스트 파일 생성
touch app2/src/contexts/__tests__/AuthContext.test.tsx

# 테스트 작성 및 실행
npm test -- --watch AuthContext.test.tsx
```

**3. 에러 핸들링 테스트 (3시간)**:
```bash
# 에러 케이스 테스트 추가
npm test -- --watch AuthContext.test.tsx
```

#### Day 2 (6시간)

**4. 통합 테스트 작성 (4시간)**:
```bash
# 통합 테스트 파일 생성
touch app2/src/contexts/__tests__/AuthContext.integration.test.tsx

# 통합 테스트 실행
npm test -- --watch AuthContext.integration.test.tsx
```

**5. 엣지 케이스 테스트 (2시간)**:
```bash
# 모든 AuthContext 테스트 실행
npm test AuthContext
```

#### Day 2 (2시간)

**6. 커버리지 확인 및 보완 (1시간)**:
```bash
# 커버리지 리포트 생성
npm run test:coverage -- --collectCoverageFrom="src/contexts/AuthContext.tsx"

# 80% 미만인 영역 확인 및 테스트 추가
```

**7. CI/CD 통합 확인 (30분)**:
```bash
# CI 모드로 테스트 실행
npm run test:ci

# 품질 게이트 확인
npm run type-check
npm run lint
npm run build
```

**8. 문서화 및 리뷰 (30분)**:
- 테스트 코드 주석 추가
- README 업데이트
- PR 준비

---

## 테스트 실행 옵션

### 기본 실행

```bash
# 모든 테스트 실행
npm test

# 특정 파일 실행
npm test AuthContext.test.tsx

# 특정 describe 블록 실행
npm test -- --testNamePattern="useAuth Hook"
```

### Watch 모드

```bash
# Watch 모드 (파일 변경 시 자동 재실행)
npm test -- --watch

# 실패한 테스트만 다시 실행
npm test -- --watch --onlyFailures
```

### 커버리지 옵션

```bash
# 전체 커버리지
npm run test:coverage

# 특정 파일 커버리지
npm run test:coverage -- --collectCoverageFrom="src/contexts/AuthContext.tsx"

# 커버리지 리포트 보기
open coverage/lcov-report/index.html  # macOS/Linux
start coverage/lcov-report/index.html  # Windows
```

### 디버깅 옵션

```bash
# Verbose 모드 (상세 로그)
npm test -- --verbose

# 단일 테스트 실행 (디버깅 시)
npm test -- --testNamePattern="should return currentUser"

# Node 디버거 연결
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## 테스트 파일 구조

### 디렉토리 구조

```
app2/src/contexts/
├── AuthContext.tsx                     # 프로덕션 코드
└── __tests__/
    ├── AuthContext.test.tsx            # 단위 테스트 (30개)
    ├── AuthContext.integration.test.tsx # 통합 테스트 (10개)
    └── __mocks__/
        ├── firebase.ts                 # Firebase Auth Mock
        ├── test-utils.tsx              # 테스트 유틸리티
        ├── test-users.ts               # 테스트 사용자 프리셋
        └── test-errors.ts              # 테스트 에러 프리셋
```

### 테스트 파일 템플릿

**AuthContext.test.tsx**:
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../AuthContext';
import { mockAdminUser, mockAdminToken } from './__mocks__/test-users';
import * as firebaseAuth from 'firebase/auth';

// Mock Firebase Auth
jest.mock('firebase/auth');

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useAuth Hook', () => {
    test('returns auth context values', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current).toBeDefined();
      expect(result.current.currentUser).toBeDefined();
    });
  });
});
```

---

## 디버깅 가이드

### 테스트 실패 시

#### 1. 에러 메시지 확인

```bash
npm test AuthContext -- --verbose
```

**Common Errors**:
- `TypeError: Cannot read property 'X' of undefined` → Mock 설정 확인
- `act(...) warning` → `waitFor` 또는 `act` 사용
- `Timeout` → 비동기 작업 타임아웃 증가

#### 2. Mock 상태 확인

```typescript
console.log('Current Mock User:', mockAuth.currentUser);
console.log('Mock Calls:', mockAuth.signInWithEmailAndPassword.mock.calls);
```

#### 3. React Testing Library 디버그

```typescript
import { screen, render } from '@testing-library/react';

render(<YourComponent />);
screen.debug();  // DOM 구조 출력
```

### 커버리지 부족 시

#### 1. 커버리지 리포트 확인

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

#### 2. 미커버 영역 확인

리포트에서 빨간색(uncovered) 영역을 찾습니다:
- **Lines**: 실행되지 않은 코드 라인
- **Branches**: 테스트되지 않은 if/else 분기
- **Functions**: 호출되지 않은 함수
- **Statements**: 실행되지 않은 구문

#### 3. 테스트 추가

```typescript
test('should handle error case', () => {
  // 미커버 분기를 테스트하는 코드 추가
});
```

---

## CI/CD 통합

### GitHub Actions 설정

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: app2/package-lock.json

      - name: Install dependencies
        run: |
          cd app2
          npm ci

      - name: Run type check
        run: |
          cd app2
          npm run type-check

      - name: Run linter
        run: |
          cd app2
          npm run lint

      - name: Run tests
        run: |
          cd app2
          npm run test:ci
        env:
          CI: true

      - name: Generate coverage report
        run: |
          cd app2
          npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          directory: app2/coverage
          flags: unittests
          fail_ci_if_error: true

      - name: Check coverage threshold
        run: |
          cd app2
          npm run test:coverage -- --coverageThreshold='{"global":{"lines":80,"branches":80,"functions":80,"statements":80}}'
```

### 품질 게이트 확인

```bash
# 로컬에서 CI와 동일한 검증 실행
cd app2

# Gate 1: 타입 안전성
npm run type-check

# Gate 2: 코드 품질
npm run lint

# Gate 3: 테스트
npm run test:ci
npm run test:coverage

# Gate 4: 빌드
npm run build

# 모든 게이트 한 번에 실행
npm run type-check && npm run lint && npm run test:ci && npm run build
```

---

## 성능 최적화

### 테스트 실행 시간 단축

#### 1. 병렬 실행

```bash
# Jest의 maxWorkers 옵션 활용 (기본: CPU 코어 수)
npm test -- --maxWorkers=4
```

#### 2. 테스트 격리

```typescript
// beforeEach에서 최소한의 setup만 실행
beforeEach(() => {
  jest.clearAllMocks();
  // 무거운 초기화는 beforeAll로 이동
});
```

#### 3. 비동기 타임아웃 조정

```typescript
// waitFor 타임아웃 단축
await waitFor(() => {
  expect(result.current.currentUser).toBeDefined();
}, { timeout: 100 });  // 기본 1000ms → 100ms
```

### 현재 성능 목표

- **단위 테스트 (30개)**: 약 2초
- **통합 테스트 (10개)**: 약 2초
- **에러 케이스 테스트 (12개)**: 약 1초
- **Total**: 5초 이내 ✅

---

## 자주 묻는 질문 (FAQ)

### Q1: 테스트가 실행되지 않아요

**A**: Jest 설정 확인:
```bash
# package.json의 jest 설정 확인
cat app2/package.json | grep -A 10 "jest"

# node_modules 재설치
rm -rf app2/node_modules
cd app2 && npm install
```

### Q2: Mock이 작동하지 않아요

**A**: Mock 경로 확인:
```typescript
// Firebase Auth Mock
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  signInWithEmailAndPassword: jest.fn(),
}));
```

### Q3: act() 경고가 계속 나와요

**A**: `waitFor` 또는 `act` 사용:
```typescript
import { waitFor, act } from '@testing-library/react';

await waitFor(() => {
  expect(result.current.currentUser).toBeDefined();
});
```

### Q4: 커버리지가 80%에 못 미쳐요

**A**: 커버리지 리포트 확인 후 테스트 추가:
```bash
npm run test:coverage
open coverage/lcov-report/contexts/AuthContext.tsx.html
```

### Q5: CI에서 테스트가 실패해요

**A**: 로컬에서 CI 모드 실행:
```bash
CI=true npm run test:ci
```

---

## 참조

- **Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Contracts**: [contracts/](./contracts/)
- **Plan**: [plan.md](./plan.md)

---

## 다음 단계

1. **Phase 2**: `/speckit.tasks` 명령으로 tasks.md 생성
2. **구현**: tasks.md의 작업 목록에 따라 테스트 코드 작성
3. **검증**: 모든 품질 게이트 통과 확인
4. **배포**: PR 생성 및 리뷰 요청

---

**Last Updated**: 2025-11-06
**Status**: Complete ✅
