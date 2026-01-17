# 13. 테스트 전략

## 목차
1. [테스트 피라미드](#1-테스트-피라미드)
2. [단위 테스트](#2-단위-테스트)
3. [통합 테스트](#3-통합-테스트)
4. [E2E 테스트 - 모바일 (Maestro)](#4-e2e-테스트)
4.5. [E2E 테스트 - 웹 (Playwright)](#45-웹-e2e-테스트-playwright)
5. [테스트 환경 설정](#5-테스트-환경-설정)
6. [테스트 커버리지](#6-테스트-커버리지)
7. [테스트 자동화](#7-테스트-자동화)

---

## 1. 테스트 피라미드

### 테스트 구조

```
                    ┌─────────┐
                    │   E2E   │  10%  - Maestro
                    │  Tests  │  (Critical Flows)
                   ┌┴─────────┴┐
                   │Integration│  20%  - React Native Testing Library
                   │   Tests   │  (Components + Hooks)
                  ┌┴───────────┴┐
                  │    Unit     │  70%  - Jest
                  │   Tests     │  (Services, Utils, Stores)
                  └─────────────┘
```

### 테스트 도구 스택

| 계층 | 도구 | 목적 |
|------|------|------|
| **Unit** | Jest | 순수 함수, 서비스, 유틸리티 |
| **Integration** | React Native Testing Library | 컴포넌트, 훅, 상호작용 |
| **E2E** | Maestro | 전체 사용자 플로우 |
| **Mocking** | MSW (Mock Service Worker) | API 모킹 |
| **Coverage** | Jest Coverage | 커버리지 리포트 |

### 커버리지 목표

```yaml
전체 목표: 80%

계층별 목표:
  services/: 90%    # 비즈니스 로직 핵심
  utils/: 95%       # 순수 함수
  hooks/: 80%       # 커스텀 훅
  stores/: 85%      # 상태 관리
  components/: 70%  # UI 컴포넌트
  screens/: 60%     # 화면 (E2E로 보완)
```

---

## 2. 단위 테스트

### 테스트 구조

```
src/
├── services/
│   ├── applicationService.ts
│   └── __tests__/
│       └── applicationService.test.ts
├── utils/
│   ├── date.ts
│   └── __tests__/
│       └── date.test.ts
└── stores/
    ├── authStore.ts
    └── __tests__/
        └── authStore.test.ts
```

### 서비스 테스트 예제

```typescript
// src/services/__tests__/applicationService.test.ts
import { applicationService } from '../applicationService';
import { firestore } from '@/lib/firebase';
import {
  AlreadyAppliedError,
} from '@/lib/errors/businessErrors';

// Firebase 모킹
jest.mock('@/lib/firebase', () => ({
  firestore: jest.fn(),
}));

describe('applicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyToJob', () => {
    const mockUserId = 'user-123';
    const mockJobPostingId = 'job-456';

    it('성공적으로 지원을 생성해야 한다', async () => {
      // Arrange
      const mockJobPosting = {
        id: mockJobPostingId,
        status: 'published',
        currentApplicants: 5,
        maxApplicants: 10,
      };

      mockFirestoreGet(mockJobPosting);
      mockFirestoreTransaction();

      // Act
      const result = await applicationService.applyToJob(
        mockUserId,
        mockJobPostingId
      );

      // Assert
      expect(result).toMatchObject({
        applicantId: mockUserId,
        jobPostingId: mockJobPostingId,
        status: 'pending',
      });
    });

    it('이미 지원한 공고에 재지원 시 에러를 던져야 한다', async () => {
      // Arrange
      mockExistingApplication(mockUserId, mockJobPostingId);

      // Act & Assert
      await expect(
        applicationService.applyToJob(mockUserId, mockJobPostingId)
      ).rejects.toThrow(AlreadyAppliedError);
    });

    it('마감된 공고에 지원 시 에러를 던져야 한다', async () => {
      // Arrange
      const mockJobPosting = {
        id: mockJobPostingId,
        status: 'closed',
      };

      mockFirestoreGet(mockJobPosting);

      // Act & Assert
      await expect(
        applicationService.applyToJob(mockUserId, mockJobPostingId)
      ).rejects.toThrow(ApplicationClosedError);
    });
  });

  describe('cancelApplication', () => {
    it('pending 상태의 지원만 취소할 수 있어야 한다', async () => {
      // Arrange
      const mockApplication = {
        id: 'app-789',
        status: 'pending',
        applicantId: 'user-123',
      };

      mockFirestoreGet(mockApplication);

      // Act
      await applicationService.cancelApplication('app-789', 'user-123');

      // Assert
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      );
    });

    it('confirmed 상태의 지원은 취소할 수 없어야 한다', async () => {
      // Arrange
      const mockApplication = {
        id: 'app-789',
        status: 'confirmed',
        applicantId: 'user-123',
      };

      mockFirestoreGet(mockApplication);

      // Act & Assert
      await expect(
        applicationService.cancelApplication('app-789', 'user-123')
      ).rejects.toThrow();
    });
  });
});
```

### 유틸리티 테스트 예제

```typescript
// src/utils/__tests__/date.test.ts
import {
  formatDate,
  formatRelativeTime,
  calculateWorkHours,
  isWithinWorkingHours,
  parseTimeSlot,
} from '../date';

describe('date utils', () => {
  describe('formatDate', () => {
    it('날짜를 YYYY-MM-DD 형식으로 포맷해야 한다', () => {
      const date = new Date('2024-03-15T10:30:00');
      expect(formatDate(date)).toBe('2024-03-15');
    });

    it('커스텀 포맷을 지원해야 한다', () => {
      const date = new Date('2024-03-15T10:30:00');
      expect(formatDate(date, 'MM/DD')).toBe('03/15');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('방금 전을 표시해야 한다', () => {
      const date = new Date('2024-03-15T11:59:30');
      expect(formatRelativeTime(date)).toBe('방금 전');
    });

    it('N분 전을 표시해야 한다', () => {
      const date = new Date('2024-03-15T11:45:00');
      expect(formatRelativeTime(date)).toBe('15분 전');
    });

    it('N시간 전을 표시해야 한다', () => {
      const date = new Date('2024-03-15T09:00:00');
      expect(formatRelativeTime(date)).toBe('3시간 전');
    });

    it('N일 전을 표시해야 한다', () => {
      const date = new Date('2024-03-13T12:00:00');
      expect(formatRelativeTime(date)).toBe('2일 전');
    });
  });

  describe('calculateWorkHours', () => {
    it('근무 시간을 정확히 계산해야 한다', () => {
      const checkIn = new Date('2024-03-15T09:00:00');
      const checkOut = new Date('2024-03-15T18:00:00');

      expect(calculateWorkHours(checkIn, checkOut)).toBe(9);
    });

    it('소수점 시간을 반올림해야 한다', () => {
      const checkIn = new Date('2024-03-15T09:00:00');
      const checkOut = new Date('2024-03-15T17:30:00');

      expect(calculateWorkHours(checkIn, checkOut)).toBe(8.5);
    });

    it('휴게 시간을 제외해야 한다', () => {
      const checkIn = new Date('2024-03-15T09:00:00');
      const checkOut = new Date('2024-03-15T18:00:00');

      expect(calculateWorkHours(checkIn, checkOut, { breakMinutes: 60 })).toBe(8);
    });
  });

  describe('parseTimeSlot', () => {
    it('시간대 문자열을 파싱해야 한다', () => {
      expect(parseTimeSlot('09:00 ~ 18:00')).toEqual({
        startTime: '09:00',
        endTime: '18:00',
      });
    });

    it('- 구분자도 지원해야 한다', () => {
      expect(parseTimeSlot('09:00 - 18:00')).toEqual({
        startTime: '09:00',
        endTime: '18:00',
      });
    });

    it('잘못된 형식은 null을 반환해야 한다', () => {
      expect(parseTimeSlot('invalid')).toBeNull();
    });
  });
});
```

### Zustand 스토어 테스트

```typescript
// src/stores/__tests__/authStore.test.ts
import { act, renderHook } from '@testing-library/react-hooks';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    // 스토어 초기화
    useAuthStore.setState({
      user: null,
      role: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe('setUser', () => {
    it('사용자 정보를 설정해야 한다', () => {
      const { result } = renderHook(() => useAuthStore());

      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      act(() => {
        result.current.setUser(mockUser, 'staff');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.role).toBe('staff');
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('signOut', () => {
    it('로그아웃 시 상태를 초기화해야 한다', () => {
      const { result } = renderHook(() => useAuthStore());

      // 먼저 로그인 상태로 설정
      act(() => {
        result.current.setUser({ uid: 'user-123' }, 'staff');
      });

      // 로그아웃
      act(() => {
        result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('selectors', () => {
    it('isAdmin은 admin 역할일 때 true를 반환해야 한다', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({ uid: 'admin-123' }, 'admin');
      });

      expect(result.current.isAdmin).toBe(true);
    });

    it('isEmployer는 employer 또는 admin일 때 true를 반환해야 한다', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({ uid: 'employer-123' }, 'employer');
      });

      expect(result.current.isEmployer).toBe(true);
    });
  });
});
```

---

## 3. 통합 테스트

### 컴포넌트 테스트

```typescript
// src/components/__tests__/JobCard.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { JobCard } from '../JobCard';
import { ThemeProvider } from '@/providers/ThemeProvider';

const mockJob = {
  id: 'job-123',
  title: '홀덤 딜러 모집',
  location: {
    address: '서울시 강남구',
  },
  workDate: new Date('2024-03-20'),
  timeSlot: '18:00 ~ 02:00',
  roles: [
    { name: '딜러', count: 3, hourlyRate: 15000 },
  ],
  status: 'published',
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>{component}</ThemeProvider>
  );
};

describe('JobCard', () => {
  it('공고 정보를 올바르게 표시해야 한다', () => {
    renderWithProviders(<JobCard job={mockJob} onPress={jest.fn()} />);

    expect(screen.getByText('홀덤 딜러 모집')).toBeTruthy();
    expect(screen.getByText('서울시 강남구')).toBeTruthy();
    expect(screen.getByText('18:00 ~ 02:00')).toBeTruthy();
    expect(screen.getByText(/15,000원/)).toBeTruthy();
  });

  it('카드 클릭 시 onPress가 호출되어야 한다', () => {
    const onPress = jest.fn();
    renderWithProviders(<JobCard job={mockJob} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('job-card'));

    expect(onPress).toHaveBeenCalledWith(mockJob);
  });

  it('마감된 공고는 마감 뱃지를 표시해야 한다', () => {
    const closedJob = { ...mockJob, status: 'closed' };
    renderWithProviders(<JobCard job={closedJob} onPress={jest.fn()} />);

    expect(screen.getByText('마감')).toBeTruthy();
  });

  it('여러 역할이 있으면 역할 수를 표시해야 한다', () => {
    const multiRoleJob = {
      ...mockJob,
      roles: [
        { name: '딜러', count: 3, hourlyRate: 15000 },
        { name: '서버', count: 2, hourlyRate: 12000 },
      ],
    };

    renderWithProviders(<JobCard job={multiRoleJob} onPress={jest.fn()} />);

    expect(screen.getByText('외 1개 역할')).toBeTruthy();
  });
});
```

### 훅 테스트

```typescript
// src/hooks/__tests__/useApplyJob.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApplyJob } from '../useApplyJob';
import { applicationService } from '@/services/applicationService';

// 서비스 모킹
jest.mock('@/services/applicationService');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useApplyJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('지원 성공 시 성공 상태를 반환해야 한다', async () => {
    const mockApplication = {
      id: 'app-123',
      status: 'pending',
    };

    (applicationService.applyToJob as jest.Mock).mockResolvedValue(mockApplication);

    const { result } = renderHook(() => useApplyJob(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        userId: 'user-123',
        jobPostingId: 'job-456',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockApplication);
  });
});
```

### 폼 테스트

```typescript
// src/components/__tests__/SignupForm.test.tsx
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { SignupForm } from '../SignupForm';

describe('SignupForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('유효한 데이터로 폼을 제출할 수 있어야 한다', async () => {
    render(<SignupForm onSubmit={mockOnSubmit} />);

    // 이메일 입력
    fireEvent.changeText(
      screen.getByPlaceholderText('이메일을 입력해주세요'),
      'test@example.com'
    );

    // 비밀번호 입력
    fireEvent.changeText(
      screen.getByPlaceholderText('비밀번호를 입력해주세요'),
      'Password123!'
    );

    // 비밀번호 확인
    fireEvent.changeText(
      screen.getByPlaceholderText('비밀번호를 다시 입력해주세요'),
      'Password123!'
    );

    // 제출
    fireEvent.press(screen.getByText('다음'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
    });
  });

  it('유효하지 않은 이메일은 에러를 표시해야 한다', async () => {
    render(<SignupForm onSubmit={mockOnSubmit} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('이메일을 입력해주세요'),
      'invalid-email'
    );

    fireEvent.press(screen.getByText('다음'));

    await waitFor(() => {
      expect(screen.getByText('올바른 이메일 형식이 아닙니다')).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('비밀번호가 일치하지 않으면 에러를 표시해야 한다', async () => {
    render(<SignupForm onSubmit={mockOnSubmit} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('비밀번호를 입력해주세요'),
      'Password123!'
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('비밀번호를 다시 입력해주세요'),
      'DifferentPassword123!'
    );

    fireEvent.press(screen.getByText('다음'));

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다')).toBeTruthy();
    });
  });

  it('비밀번호 강도가 약하면 경고를 표시해야 한다', async () => {
    render(<SignupForm onSubmit={mockOnSubmit} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('비밀번호를 입력해주세요'),
      'weak'
    );

    await waitFor(() => {
      expect(screen.getByText(/매우 약함|약함/)).toBeTruthy();
    });
  });
});
```

---

## 4. E2E 테스트

### Maestro 설정

```yaml
# maestro/config.yaml
appId: com.uniqn.app
name: UNIQN E2E Tests

# 환경 변수
env:
  TEST_EMAIL: test@example.com
  TEST_PASSWORD: TestPassword123!

# 테스트 설정
timeout: 30000
retries: 2
```

### 로그인 플로우 테스트

```yaml
# maestro/flows/auth/login.yaml
appId: com.uniqn.app
name: Login Flow
---
# 앱 시작
- launchApp

# 로그인 화면 확인
- assertVisible: "로그인"

# 이메일 입력
- tapOn:
    id: "email-input"
- inputText: ${TEST_EMAIL}

# 비밀번호 입력
- tapOn:
    id: "password-input"
- inputText: ${TEST_PASSWORD}

# 로그인 버튼 클릭
- tapOn: "로그인"

# 로딩 대기
- waitForAnimationToEnd

# 홈 화면 확인
- assertVisible: "홈"
- assertVisible:
    id: "tab-bar"

# 스크린샷 저장
- takeScreenshot: "login_success"
```

### 회원가입 플로우 테스트

> ⚠️ **참고**: 4단계 플로우 (계정 → 본인인증 → 프로필 → 완료). 이메일 인증 사용 안함.

```yaml
# maestro/flows/auth/signup.yaml
appId: com.uniqn.app
name: Signup Flow (4 Steps)
---
- launchApp

# 회원가입 화면으로 이동
- tapOn: "회원가입"

# Step 1: 계정 정보
- assertVisible: "계정 만들기"

- tapOn:
    id: "email-input"
- inputText: "newuser_${RANDOM}@example.com"

- tapOn:
    id: "password-input"
- inputText: "NewPassword123!"

- tapOn:
    id: "confirm-password-input"
- inputText: "NewPassword123!"

- tapOn: "다음"

# Step 2: 본인인증 (필수)
- assertVisible: "본인인증"

# PASS 인증 또는 카카오 인증 선택 (테스트 모드에서는 스킵 가능)
- tapOn:
    id: "identity-verify-pass"

# 테스트 환경에서는 모의 인증 처리
- waitForAnimationToEnd
- assertVisible: "인증이 완료되었습니다"

- tapOn: "다음"

# Step 3: 프로필 정보 + 약관 동의
- assertVisible: "프로필 설정"

- tapOn:
    id: "nickname-input"
- inputText: "테스트사용자"

# 역할 선택
- tapOn: "스태프"

# 필수 약관 동의
- tapOn:
    id: "terms-required-checkbox"

- tapOn: "다음"

# Step 4: 완료
- assertVisible: "가입 완료"

- takeScreenshot: "signup_complete"
```

### 공고 지원 플로우 테스트

```yaml
# maestro/flows/job/apply.yaml
appId: com.uniqn.app
name: Job Application Flow
---
# 로그인 플로우 실행
- runFlow: ../auth/login.yaml

# 구인구직 탭으로 이동
- tapOn:
    id: "tab-job-board"

# 공고 목록 확인
- assertVisible: "구인구직"
- waitForAnimationToEnd

# 첫 번째 공고 선택
- tapOn:
    index: 0
    id: "job-card"

# 공고 상세 확인
- assertVisible: "공고 상세"
- scroll:
    direction: DOWN

# 지원하기 버튼 확인 및 클릭
- tapOn: "지원하기"

# 지원 확인 모달
- assertVisible: "지원하시겠습니까?"
- tapOn: "확인"

# 지원 완료 확인
- assertVisible: "지원이 완료되었습니다"

- takeScreenshot: "apply_success"
```

### 출퇴근 QR 플로우 테스트

```yaml
# maestro/flows/attendance/qr-checkin.yaml
appId: com.uniqn.app
name: QR Check-in Flow
---
# 로그인 플로우 실행
- runFlow: ../auth/login.yaml

# 내 스케줄 탭으로 이동
- tapOn:
    id: "tab-schedule"

# 오늘 스케줄 확인
- assertVisible: "내 스케줄"

# 출근 가능한 스케줄 선택
- tapOn:
    id: "schedule-card-today"

# 상세 모달 확인
- assertVisible: "출근하기"

# QR 스캔 버튼 클릭
- tapOn: "출근하기"

# QR 스캐너 화면 확인
- assertVisible: "QR 코드를 스캔해주세요"

# 카메라 권한 허용 (시뮬레이터에서)
- tapOn: "허용"

# 테스트용 QR 코드 입력 (개발 모드)
- tapOn: "수동 입력"
- inputText: "TEST_QR_CODE_123"
- tapOn: "확인"

# 출근 완료 확인
- assertVisible: "출근이 완료되었습니다"

- takeScreenshot: "checkin_success"
```

### 정산 플로우 테스트

```yaml
# maestro/flows/settlement/settle.yaml
appId: com.uniqn.app
name: Settlement Flow
---
# 구인자로 로그인
- runFlow:
    file: ../auth/login.yaml
    env:
      TEST_EMAIL: employer@example.com
      TEST_PASSWORD: EmployerPass123!

# 공고 관리 탭으로 이동
- tapOn:
    id: "tab-management"

# 공고 선택
- tapOn:
    index: 0
    id: "managed-job-card"

# 정산 탭으로 이동
- tapOn: "정산"

# 정산 대상 확인
- assertVisible: "정산 대기"

# 전체 정산 버튼
- tapOn: "전체 정산"

# 확인 모달
- assertVisible: "정산하시겠습니까?"
- tapOn: "확인"

# 정산 완료 확인
- assertVisible: "정산이 완료되었습니다"

- takeScreenshot: "settlement_complete"
```

### Maestro 실행 스크립트

```bash
#!/bin/bash
# scripts/run-e2e.sh

# 환경 설정
export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000

# 모든 E2E 테스트 실행
maestro test maestro/flows/ \
  --format junit \
  --output maestro-results.xml \
  --include-tags "smoke,critical"

# 결과 확인
if [ $? -eq 0 ]; then
  echo "✅ E2E tests passed"
else
  echo "❌ E2E tests failed"
  exit 1
fi
```

---

## 4.5. 웹 E2E 테스트 (Playwright)

> React Native Web을 사용하므로 웹 플랫폼 전용 E2E 테스트가 필요합니다.
> 자세한 내용은 [21-react-native-web.md](./21-react-native-web.md) 참조

### Playwright 설정

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/web',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8081',  // Expo web
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // 모바일 웹 뷰포트
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 웹 E2E 테스트 예제

```typescript
// e2e/web/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication (Web)', () => {
  test('로그인 플로우', async ({ page }) => {
    await page.goto('/login');

    // 폼 입력
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');

    // 로그인 버튼 클릭
    await page.click('[data-testid="login-button"]');

    // 홈 화면 이동 확인
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();
  });

  test('회원가입 플로우', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('[data-testid="email-input"]', `test_${Date.now()}@example.com`);
    await page.fill('[data-testid="password-input"]', 'NewPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123!');

    await page.click('[data-testid="next-button"]');

    // 프로필 설정 화면 확인
    await expect(page.locator('text=프로필 설정')).toBeVisible();
  });
});
```

### 공고 지원 플로우 (웹)

```typescript
// e2e/web/job-application.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Job Application (Web)', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 상태로 시작
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'staff@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/');
  });

  test('공고 목록 조회 및 지원', async ({ page }) => {
    // 구인구직 탭 클릭
    await page.click('[data-testid="tab-job-board"]');

    // 공고 목록 로딩 대기
    await expect(page.locator('[data-testid="job-card"]').first()).toBeVisible();

    // 첫 번째 공고 클릭
    await page.click('[data-testid="job-card"]:first-child');

    // 공고 상세 확인
    await expect(page.locator('text=공고 상세')).toBeVisible();

    // 지원하기 버튼 클릭
    await page.click('text=지원하기');

    // 확인 모달
    await page.click('text=확인');

    // 성공 메시지 확인
    await expect(page.locator('text=지원이 완료되었습니다')).toBeVisible();
  });
});
```

### 반응형 테스트

```typescript
// e2e/web/responsive.spec.ts
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 720 },
];

for (const viewport of viewports) {
  test.describe(`Responsive - ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('홈 화면 레이아웃', async ({ page }) => {
      await page.goto('/');

      // 레이아웃 스크린샷
      await expect(page).toHaveScreenshot(`home-${viewport.name}.png`);

      // 네비게이션 확인
      if (viewport.width < 768) {
        // 모바일: 하단 탭바
        await expect(page.locator('[data-testid="bottom-tab-bar"]')).toBeVisible();
      } else {
        // 데스크톱: 사이드 네비게이션 또는 상단 헤더
        await expect(page.locator('[data-testid="navigation"]')).toBeVisible();
      }
    });
  });
}
```

### 접근성 테스트 (웹)

```typescript
// e2e/web/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (Web)', () => {
  test('홈 화면 접근성 검사', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('로그인 화면 접근성 검사', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // WCAG 2.1 AA 위반 없음 확인
    expect(results.violations).toEqual([]);
  });

  test('키보드 네비게이션', async ({ page }) => {
    await page.goto('/login');

    // Tab 키로 포커스 이동
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();

    // Enter 키로 폼 제출
    await page.keyboard.press('Enter');
  });
});
```

### Playwright 실행 스크립트

```json
// package.json 스크립트 추가
{
  "scripts": {
    "test:e2e:web": "playwright test",
    "test:e2e:web:headed": "playwright test --headed",
    "test:e2e:web:debug": "playwright test --debug",
    "test:e2e:web:ui": "playwright test --ui",
    "test:e2e:web:report": "playwright show-report"
  }
}
```

### CI/CD 통합 (웹 E2E)

```yaml
# .github/workflows/e2e-web.yml
name: Web E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  web-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npm run test:e2e:web

      - name: Upload test report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## 5. 테스트 환경 설정

### Jest 설정

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/utils/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  testTimeout: 10000,
};
```

### Jest 셋업 파일

```javascript
// jest.setup.js
import '@testing-library/jest-native/extend-expect';
import { server } from './src/mocks/server';

// MSW 서버 설정
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// React Native 모킹
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Expo 모듈 모킹
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    currentUser: null,
  })),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
}));

// 글로벌 모킹
global.console = {
  ...console,
  // 테스트 중 불필요한 로그 숨기기
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // 에러와 경고는 유지
  warn: console.warn,
  error: console.error,
};
```

### MSW 핸들러

```typescript
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // 사용자 정보 조회
  rest.get('/api/users/:userId', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
      })
    );
  }),

  // 공고 목록 조회
  rest.get('/api/job-postings', (req, res, ctx) => {
    return res(
      ctx.json({
        items: [
          {
            id: 'job-1',
            title: '테스트 공고',
            status: 'published',
          },
        ],
        total: 1,
      })
    );
  }),

  // 지원하기
  rest.post('/api/applications', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'app-123',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    );
  }),
];
```

---

## 6. 테스트 커버리지

### 커버리지 리포트 설정

```javascript
// jest.config.js (추가)
module.exports = {
  // ...
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};
```

### 커버리지 뱃지

```yaml
# .github/workflows/coverage-badge.yml
name: Coverage Badge

on:
  push:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Generate badge
        uses: cicirello/jacoco-badge-generator@v2
        with:
          coverage-summary-file: coverage/coverage-summary.json
          badges-directory: badges
          generate-coverage-badge: true

      - name: Commit badge
        uses: EndBug/add-and-commit@v9
        with:
          add: 'badges'
          message: 'Update coverage badge'
```

### 커버리지 트렌드

```typescript
// scripts/coverage-trend.ts
import fs from 'fs';
import path from 'path';

interface CoverageData {
  date: string;
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

function updateCoverageTrend() {
  const summaryPath = path.join(__dirname, '../coverage/coverage-summary.json');
  const trendPath = path.join(__dirname, '../coverage/trend.json');

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const total = summary.total;

  const newEntry: CoverageData = {
    date: new Date().toISOString().split('T')[0],
    lines: total.lines.pct,
    branches: total.branches.pct,
    functions: total.functions.pct,
    statements: total.statements.pct,
  };

  let trend: CoverageData[] = [];
  if (fs.existsSync(trendPath)) {
    trend = JSON.parse(fs.readFileSync(trendPath, 'utf-8'));
  }

  // 최근 30일만 유지
  trend.push(newEntry);
  trend = trend.slice(-30);

  fs.writeFileSync(trendPath, JSON.stringify(trend, null, 2));

  console.log('Coverage updated:', newEntry);
}

updateCoverageTrend();
```

---

## 7. 테스트 자동화

### npm 스크립트

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit",
    "test:unit": "jest --testPathPattern=__tests__",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "maestro test maestro/flows/",
    "test:e2e:smoke": "maestro test maestro/flows/ --include-tags smoke",
    "test:all": "npm run test:ci && npm run test:e2e"
  }
}
```

### Pre-commit 훅

```yaml
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 변경된 파일에 대한 테스트만 실행
npm run test -- --onlyChanged --passWithNoTests

# 린트 검사
npm run lint:staged
```

### GitHub Actions 워크플로우

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  e2e-tests:
    runs-on: macos-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          export PATH="$PATH":"$HOME/.maestro/bin"

      - name: Start Metro
        run: npx expo start --ios &

      - name: Wait for Metro
        run: sleep 30

      - name: Run E2E tests
        run: npm run test:e2e:smoke

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: maestro-results
          path: |
            maestro-results.xml
            ~/.maestro/tests/
```

---

## 요약

### 테스트 전략 체크리스트

#### 단위 테스트 (70%)
- [x] 서비스 로직 테스트
- [x] 유틸리티 함수 테스트
- [x] Zustand 스토어 테스트
- [x] Zod 스키마 검증 테스트

#### 통합 테스트 (20%)
- [x] 컴포넌트 렌더링 테스트
- [x] 사용자 상호작용 테스트
- [x] 커스텀 훅 테스트
- [x] 폼 검증 테스트

#### E2E 테스트 - 모바일 (Maestro)
- [x] 로그인/회원가입 플로우
- [x] 공고 지원 플로우
- [x] QR 출퇴근 플로우
- [x] 정산 플로우

#### E2E 테스트 - 웹 (Playwright)
- [x] 인증 플로우 (로그인/회원가입)
- [x] 공고 지원 플로우
- [x] 반응형 레이아웃 테스트
- [x] 접근성 테스트 (axe-core)
- [x] 키보드 네비게이션 테스트

#### 자동화
- [x] Pre-commit 훅
- [x] CI/CD 파이프라인 (모바일 + 웹)
- [x] 커버리지 리포트
- [x] 테스트 트렌드 추적

---

## 관련 문서

- [21-react-native-web.md](./21-react-native-web.md) - React Native Web 전략
- [19-accessibility.md](./19-accessibility.md) - 접근성 설계
- [15-cicd.md](./15-cicd.md) - CI/CD 파이프라인
