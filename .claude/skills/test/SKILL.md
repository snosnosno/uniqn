---
name: test
description: 테스트 코드 작성 및 실행. 테스트, test, 테스트 작성, 테스트 실행 요청 시 활성화
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# 테스트 스킬

테스트 코드를 작성하고 실행합니다.

## 테스트 스택

| 프로젝트 | 프레임워크 | 위치 |
|----------|-----------|------|
| uniqn-mobile | Jest + @testing-library/react-native | `__tests__/` |
| app2 | Jest + @testing-library/react | `src/**/*.test.ts` |
| functions | Jest | `functions/__tests__/` |

## 테스트 종류

### 1. 단위 테스트 (Unit Test)
- 개별 함수/유틸리티 테스트
- 서비스 레이어 테스트
- 커스텀 훅 테스트

### 2. 컴포넌트 테스트 (Component Test)
- 렌더링 테스트
- 사용자 인터랙션 테스트
- 상태 변화 테스트

### 3. 통합 테스트 (Integration Test)
- 서비스 + 훅 연동 테스트
- API 호출 테스트

## 테스트 작성 규칙

### AAA 패턴
```typescript
describe('함수명 또는 컴포넌트명', () => {
  it('기대 동작 설명', () => {
    // Arrange: 준비
    const input = { ... };

    // Act: 실행
    const result = myFunction(input);

    // Assert: 검증
    expect(result).toBe(expected);
  });
});
```

### 네이밍 규칙
```typescript
// 파일명: 대상.test.ts 또는 대상.spec.ts
// describe: 대상 이름
// it: "should [동작] when [조건]" 또는 한글 설명

describe('calculateSettlement', () => {
  it('시급 기준 정산 금액을 계산한다', () => {});
  it('should return 0 when workHours is 0', () => {});
});
```

## 테스트 템플릿

### 유틸리티 함수 테스트
```typescript
import { myUtil } from '@/utils/myUtil';

describe('myUtil', () => {
  describe('정상 케이스', () => {
    it('입력값이 유효할 때 올바른 결과를 반환한다', () => {
      const result = myUtil('valid');
      expect(result).toBe('expected');
    });
  });

  describe('엣지 케이스', () => {
    it('빈 문자열일 때 기본값을 반환한다', () => {
      const result = myUtil('');
      expect(result).toBe('default');
    });

    it('null일 때 에러를 던진다', () => {
      expect(() => myUtil(null)).toThrow();
    });
  });
});
```

### 서비스 테스트 (Firebase 모킹)
```typescript
import { jobManagementService } from '@/services/jobManagementService';

// Firebase 모킹
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  // ...
}));

describe('jobManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('공고를 생성한다', async () => {
    const mockSetDoc = require('firebase/firestore').setDoc;
    mockSetDoc.mockResolvedValue(undefined);

    await jobManagementService.createJob(mockJobData);

    expect(mockSetDoc).toHaveBeenCalled();
  });
});
```

### 커스텀 훅 테스트
```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMyHook } from '@/hooks/useMyHook';

// Provider 래퍼 (필요시)
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useMyHook', () => {
  it('초기 상태를 반환한다', () => {
    const { result } = renderHook(() => useMyHook(), { wrapper });

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('데이터를 로드한다', async () => {
    const { result } = renderHook(() => useMyHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(expectedData);
  });
});
```

### 컴포넌트 테스트
```typescript
import { render, fireEvent, screen } from '@testing-library/react-native';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  const defaultProps = {
    title: '테스트',
    onPress: jest.fn(),
  };

  it('타이틀을 렌더링한다', () => {
    render(<MyComponent {...defaultProps} />);

    expect(screen.getByText('테스트')).toBeTruthy();
  });

  it('버튼 클릭 시 onPress를 호출한다', () => {
    render(<MyComponent {...defaultProps} />);

    fireEvent.press(screen.getByRole('button'));

    expect(defaultProps.onPress).toHaveBeenCalled();
  });
});
```

## 테스트 실행

```bash
# 전체 테스트
npm test

# 특정 파일
npm test -- myUtil.test.ts

# 커버리지
npm run test:coverage

# Watch 모드
npm test -- --watch
```

## 커버리지 목표

| 대상 | 목표 |
|------|------|
| utils/ | 90%+ |
| services/ | 85%+ |
| hooks/ | 75%+ |
| components/ | 70%+ |

## QA 체크리스트 (gstack qa 연동)

테스트 작성 시 다음 QA 항목도 함께 검증합니다:

### 보안 QA
- [ ] 사용자 입력에 xssValidation 적용 여부
- [ ] 권한 체크 로직 테스트 (admin/employer/staff 각각)
- [ ] Firebase Security Rules 시뮬레이터 테스트

### 데이터 무결성 QA
- [ ] 다중 문서 수정 시 runTransaction 사용 확인
- [ ] undefined → null 변환 테스트
- [ ] 낙관적 업데이트 롤백 테스트

### UI QA
- [ ] 로딩 상태 렌더링 테스트
- [ ] 에러 상태 렌더링 테스트
- [ ] 빈 데이터 상태 렌더링 테스트
- [ ] 다크모드 스타일 적용 확인

### 커버리지 게이트
테스트 실행 후 커버리지가 목표 미달이면 경고합니다:
- utils: 90% 미달 → **경고**
- services: 85% 미달 → **경고**
- hooks: 75% 미달 → **주의**
- components: 70% 미달 → **주의**

## 주의사항

- **모킹 최소화**: 실제 동작과 가까운 테스트 작성
- **독립적 테스트**: 테스트 간 의존성 없음
- **빠른 실행**: 느린 테스트는 분리
- **의미 있는 단언**: 구현이 아닌 동작 테스트
