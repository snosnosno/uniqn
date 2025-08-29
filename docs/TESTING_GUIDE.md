# 🧪 T-HOLDEM 테스트 가이드

**버전**: 2.1.0 | **업데이트**: 2025년 1월 30일

## 📋 목차

1. [테스트 전략](#테스트-전략)
2. [테스트 환경 설정](#테스트-환경-설정)
3. [테스트 실행](#테스트-실행)
4. [테스트 구조](#테스트-구조)
5. [테스트 작성 가이드](#테스트-작성-가이드)
6. [모킹 전략](#모킹-전략)
7. [테스트 커버리지](#테스트-커버리지)
8. [CI/CD 통합](#cicd-통합)

## 🎯 테스트 전략

### 테스트 피라미드
```
         /\
        /E2E\        (5%)  - 핵심 사용자 시나리오
       /------\
      /통합 테스트\   (25%) - 컴포넌트 간 상호작용
     /------------\
    /  단위 테스트   \  (70%) - 개별 함수 및 컴포넌트
   /________________\
```

### 테스트 원칙
1. **빠른 피드백**: 단위 테스트 우선
2. **신뢰성**: 일관된 결과 보장
3. **유지보수성**: 명확한 테스트 이름과 구조
4. **독립성**: 테스트 간 의존성 제거

## 🛠️ 테스트 환경 설정

### 필요 패키지
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

### Jest 설정 (jest.config.js)
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts'
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

## 🚀 테스트 실행

### 기본 명령어
```bash
# 모든 테스트 실행
npm test

# 특정 파일 테스트
npm test -- StaffCard.test.tsx

# 커버리지 포함
npm test -- --coverage

# Watch 모드 없이 실행 (CI/CD용)
npm test -- --watchAll=false

# 특정 패턴 매칭
npm test -- --testNamePattern="should render"
```

### 디버깅
```bash
# 디버그 모드
npm test -- --debug

# 특정 테스트만 실행
npm test -- --testNamePattern="특정 테스트 이름"

# 실패한 테스트만 재실행
npm test -- --onlyFailures
```

## 📁 테스트 구조

### 현재 테스트 파일 (18개)
```
src/
├── __tests__/
│   └── setup/
│       └── test-utils.tsx          # 테스트 유틸리티
├── components/
│   ├── __tests__/
│   │   ├── AttendanceStatusPopover.test.tsx
│   │   ├── StaffCard.test.tsx
│   │   ├── StaffRow.test.tsx
│   │   └── WorkTimeEditor.test.tsx
│   └── ui/
│       └── __tests__/
│           ├── BaseCard.test.tsx
│           ├── LazyImage.test.tsx
│           └── Modal.test.tsx
├── hooks/
│   └── __tests__/
│       ├── useAttendanceStatus.test.ts
│       ├── useHapticFeedback.test.ts
│       └── useSwipeGesture.test.ts
├── pages/
│   ├── __tests__/
│   │   ├── Login.test.tsx
│   │   └── SignUp.test.tsx
│   ├── admin/
│   │   └── DashboardPage.test.tsx
│   └── JobBoard/
│       └── components/
│           └── __tests__/
│               └── JobCard.test.tsx
└── App.test.tsx
```

## ✍️ 테스트 작성 가이드

### 단위 테스트 예시
```typescript
// StaffCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { StaffCard } from '../StaffCard';

describe('StaffCard', () => {
  const mockStaff = {
    id: '1',
    name: '홍길동',
    role: '딜러',
    status: 'present'
  };

  it('스태프 정보를 올바르게 표시해야 함', () => {
    render(<StaffCard staff={mockStaff} />);
    
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('딜러')).toBeInTheDocument();
  });

  it('클릭 시 상세 모달을 열어야 함', () => {
    const handleClick = jest.fn();
    render(<StaffCard staff={mockStaff} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(mockStaff);
  });
});
```

### 통합 테스트 예시
```typescript
// StaffManagement.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { StaffManagementTab } from '../StaffManagementTab';
import { FirebaseProvider } from '../contexts/FirebaseContext';

describe('StaffManagementTab Integration', () => {
  it('스태프 목록을 로드하고 표시해야 함', async () => {
    render(
      <FirebaseProvider>
        <StaffManagementTab eventId="test-event" />
      </FirebaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('스태프 관리')).toBeInTheDocument();
    });

    // 스태프 목록이 로드되었는지 확인
    const staffCards = await screen.findAllByTestId('staff-card');
    expect(staffCards.length).toBeGreaterThan(0);
  });
});
```

### 커스텀 훅 테스트
```typescript
// useAttendanceStatus.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAttendanceStatus } from '../useAttendanceStatus';

describe('useAttendanceStatus', () => {
  it('출석 상태를 업데이트해야 함', async () => {
    const { result } = renderHook(() => 
      useAttendanceStatus('staff-1')
    );

    expect(result.current.status).toBe('absent');

    await act(async () => {
      await result.current.updateStatus('present');
    });

    expect(result.current.status).toBe('present');
  });
});
```

## 🎭 모킹 전략

### Firebase 모킹
```typescript
// __mocks__/firebase.ts
export const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

jest.mock('firebase/firestore', () => ({
  getFirestore: () => mockFirestore,
  collection: mockFirestore.collection,
  doc: mockFirestore.doc,
  onSnapshot: mockFirestore.onSnapshot
}));
```

### API 모킹
```typescript
// __mocks__/api.ts
export const mockApi = {
  getStaff: jest.fn().mockResolvedValue([
    { id: '1', name: '테스트 스태프' }
  ]),
  updateStaff: jest.fn().mockResolvedValue({ success: true })
};
```

## 📊 테스트 커버리지

### 현재 상태
| 카테고리 | 현재 | 목표 |
|---------|------|------|
| Statements | ~10% | 70% |
| Branches | ~8% | 70% |
| Functions | ~12% | 70% |
| Lines | ~10% | 70% |

### 커버리지 향상 계획
1. **Phase 1** (1주): 핵심 비즈니스 로직 (30%)
2. **Phase 2** (2주): UI 컴포넌트 (50%)
3. **Phase 3** (3주): 통합 테스트 (70%)
4. **Phase 4** (4주): E2E 테스트 추가

### 커버리지 리포트
```bash
# HTML 리포트 생성
npm test -- --coverage --coverageReporters=html

# 리포트 확인
open coverage/index.html
```

## 🔄 CI/CD 통합

### GitHub Actions 설정
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd app2
        npm ci
        
    - name: Run tests
      run: |
        cd app2
        npm test -- --watchAll=false --coverage
        
    - name: Upload coverage
      uses: codecov/codecov-action@v2
      with:
        file: ./app2/coverage/lcov.info
```

## 🐛 문제 해결

### 일반적인 문제

#### 1. 테스트 타임아웃
```typescript
// 타임아웃 증가
jest.setTimeout(10000); // 10초

// 특정 테스트만
it('긴 작업', async () => {
  // 테스트 코드
}, 10000);
```

#### 2. 비동기 테스트 실패
```typescript
// waitFor 사용
await waitFor(() => {
  expect(screen.getByText('로딩 완료')).toBeInTheDocument();
});

// findBy 사용
const element = await screen.findByText('로딩 완료');
```

#### 3. 메모리 누수 경고
```typescript
// cleanup 사용
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

## 📚 베스트 프랙티스

### Do's ✅
- 명확한 테스트 이름 작성
- AAA 패턴 사용 (Arrange, Act, Assert)
- 테스트당 하나의 개념만 검증
- 테스트 데이터 팩토리 사용
- 에러 케이스도 테스트

### Don'ts ❌
- 구현 세부사항 테스트
- 외부 의존성 직접 사용
- 테스트 간 상태 공유
- 너무 많은 모킹
- 스냅샷 테스트 남용

## 🔗 참고 자료

- [Jest 공식 문서](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Firebase 테스트 가이드](https://firebase.google.com/docs/rules/unit-tests)

---

*테스트는 코드의 품질을 보장하는 가장 중요한 도구입니다.*