# Quickstart: UI Component Tests

**Feature**: Phase 2-4 Critical UI Component Tests
**Date**: 2025-11-06

## Prerequisites

- Node.js 18+ 설치
- npm 또는 yarn 패키지 관리자
- UNIQN 프로젝트 (`app2/`) 로컬 클론

---

## 1. 환경 설정

### 1.1 의존성 설치

```bash
cd app2

# axe-core 및 관련 패키지 설치 (아직 없을 경우)
npm install --save-dev jest-axe axe-core @testing-library/user-event
```

### 1.2 패키지 버전 확인

```bash
# 현재 설치된 테스트 도구 버전 확인
npm list @testing-library/react @testing-library/jest-dom jest
```

**예상 결과**:
- `@testing-library/react`: ^14.0.0 이상
- `@testing-library/jest-dom`: ^6.0.0 이상
- `jest`: ^29.0.0 이상

---

## 2. 테스트 파일 생성

### 2.1 디렉토리 구조 생성

```bash
cd app2/src/__tests__

# NotificationDropdown 테스트 디렉토리 생성
mkdir -p unit/components/notifications

# 테스트 유틸리티 디렉토리 생성
mkdir -p unit/testUtils
```

### 2.2 테스트 유틸리티 파일 생성

**파일 1**: `app2/src/__tests__/unit/testUtils/mockNotifications.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

// (data-model.md의 내용 참조하여 작성)
export const createMockNotification = (overrides = {}) => ({ ...});
export const mockNotifications = { ... };
export const createMockUseNotifications = (overrides = {}) => ({ ... });
```

**파일 2**: `app2/src/__tests__/unit/testUtils/accessibilityHelpers.ts`

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

export const testAccessibility = async (container, options) => {
  const results = await axe(container, options);
  expect(results).toHaveNoViolations();
};
```

---

## 3. NotificationDropdown 테스트 작성

### 3.1 기본 렌더링 테스트

**파일**: `app2/src/__tests__/unit/components/notifications/NotificationDropdown.test.tsx`

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NotificationDropdown } from '../../../../components/notifications/NotificationDropdown';
import { createMockUseNotifications, mockNotifications } from '../../testUtils/mockNotifications';

// Mock useNotifications hook
jest.mock('../../../../hooks/useNotifications', () => ({
  useNotifications: jest.fn()
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'ko' }
  })
}));

describe('NotificationDropdown', () => {
  const { useNotifications } = require('../../../../hooks/useNotifications');

  beforeEach(() => {
    useNotifications.mockReturnValue(createMockUseNotifications());
    mockNavigate.mockClear();
  });

  describe('기본 렌더링', () => {
    it('알림 벨 아이콘이 렌더링되어야 함', () => {
      render(<NotificationDropdown />);
      const bellButton = screen.getByRole('button', { name: /알림/i });
      expect(bellButton).toBeInTheDocument();
    });

    it('안읽은 알림 개수 배지가 표시되어야 함', () => {
      useNotifications.mockReturnValue(
        createMockUseNotifications({ unreadCount: 3 })
      );
      render(<NotificationDropdown />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    // ... 추가 테스트
  });
});
```

### 3.2 인터랙션 테스트

**파일**: `app2/src/__tests__/unit/components/notifications/NotificationDropdown.interaction.test.tsx`

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// ... (3.1과 동일한 mock 설정)

describe('NotificationDropdown - 사용자 인터랙션', () => {
  // ... beforeEach

  it('알림 클릭 시 읽음 처리 및 페이지 이동', async () => {
    const user = userEvent.setup();
    const mockMarkAsRead = jest.fn();
    useNotifications.mockReturnValue(
      createMockUseNotifications({ markAsRead: mockMarkAsRead })
    );

    render(<NotificationDropdown />);

    // 드롭다운 열기
    await user.click(screen.getByRole('button', { name: /알림/i }));

    // 알림 클릭
    await user.click(screen.getByText('근무 배정 알림'));

    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
    expect(mockNavigate).toHaveBeenCalledWith('/app/work-logs');
  });

  // ... 추가 인터랙션 테스트
});
```

### 3.3 접근성 테스트

**파일**: `app2/src/__tests__/unit/components/notifications/NotificationDropdown.accessibility.test.tsx`

```typescript
import { testAccessibility } from '../../testUtils/accessibilityHelpers';
// ... (기본 import)

describe('NotificationDropdown - 접근성', () => {
  it('axe-core 접근성 위반 사항이 없어야 함', async () => {
    const { container } = render(<NotificationDropdown />);
    await testAccessibility(container);
  });

  it('Tab 키로 포커스 이동이 가능해야 함', async () => {
    const user = userEvent.setup();
    render(<NotificationDropdown />);

    await user.tab();
    expect(screen.getByRole('button', { name: /알림/i })).toHaveFocus();
  });

  // ... 추가 접근성 테스트
});
```

---

## 4. JobPostingCard 테스트 확장

### 4.1 기존 테스트 확인

```bash
# 기존 테스트 파일 확인
cat app2/src/__tests__/unit/components/jobPosting/JobPostingCard.test.tsx
```

**현재 상태**: 343줄, 다크모드 포함, 렌더링 및 스타일 테스트 완료

### 4.2 인터랙션 테스트 추가

**파일**: `app2/src/__tests__/unit/components/jobPosting/JobPostingCard.test.tsx` (하단에 추가)

```typescript
describe('사용자 인터랙션', () => {
  const mockOnApply = jest.fn();
  const mockOnBookmark = jest.fn();

  const mockRenderActions = (post: JobPosting) => (
    <div>
      <button onClick={() => mockOnApply(post.id)}>지원하기</button>
      <button onClick={() => mockOnBookmark(post.id, 'add')}>북마크</button>
    </div>
  );

  beforeEach(() => {
    mockOnApply.mockClear();
    mockOnBookmark.mockClear();
  });

  it('지원 버튼 클릭 시 지원 처리 함수가 호출되어야 함', async () => {
    const user = userEvent.setup();
    render(
      <JobPostingCard
        post={basePosting}
        variant="user-card"
        renderActions={mockRenderActions}
      />
    );

    await user.click(screen.getByRole('button', { name: '지원하기' }));
    expect(mockOnApply).toHaveBeenCalledWith(basePosting.id);
  });

  // ... 추가 인터랙션 테스트
});
```

### 4.3 접근성 테스트 추가

```typescript
import { testAccessibility } from '../../testUtils/accessibilityHelpers';

describe('접근성', () => {
  it('axe-core 접근성 위반 사항이 없어야 함', async () => {
    const { container } = render(<JobPostingCard post={basePosting} variant="user-card" />);
    await testAccessibility(container);
  });

  it('키보드 네비게이션으로 버튼에 접근 가능해야 함', async () => {
    const user = userEvent.setup();
    const mockRenderActions = (post) => (
      <button>지원하기</button>
    );

    render(
      <JobPostingCard
        post={basePosting}
        variant="user-card"
        renderActions={mockRenderActions}
      />
    );

    await user.tab(); // 카드로 포커스 이동
    await user.tab(); // 지원 버튼으로 포커스 이동
    expect(screen.getByRole('button', { name: '지원하기' })).toHaveFocus();
  });

  // ... 추가 접근성 테스트
});
```

---

## 5. 테스트 실행

### 5.1 개별 테스트 파일 실행

```bash
cd app2

# NotificationDropdown 기본 렌더링 테스트
npm test -- NotificationDropdown.test.tsx

# NotificationDropdown 인터랙션 테스트
npm test -- NotificationDropdown.interaction.test.tsx

# NotificationDropdown 접근성 테스트
npm test -- NotificationDropdown.accessibility.test.tsx

# JobPostingCard 전체 테스트
npm test -- JobPostingCard.test.tsx
```

### 5.2 전체 테스트 실행

```bash
# 모든 테스트 실행
npm test

# Watch 모드로 실행 (파일 변경 감지)
npm test -- --watch

# 커버리지 리포트와 함께 실행
npm run test:coverage
```

### 5.3 커버리지 확인

```bash
# 커버리지 리포트 생성
npm run test:coverage

# 리포트 확인 (브라우저)
open coverage/lcov-report/index.html
```

**목표 커버리지**:
- NotificationDropdown: 85% 이상
- JobPostingCard: 90% 이상

---

## 6. 트러블슈팅

### 6.1 일반적인 문제

#### 문제 1: `Cannot find module 'jest-axe'`

**해결책**:
```bash
npm install --save-dev jest-axe axe-core
```

#### 문제 2: `TypeError: Cannot read property 'toHaveNoViolations'`

**해결책**: `setup.ts` 파일에 다음 추가
```typescript
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);
```

#### 문제 3: Mock이 작동하지 않음

**해결책**: `beforeEach`에서 mock 초기화 확인
```typescript
beforeEach(() => {
  mockNavigate.mockClear();
  mockMarkAsRead.mockClear();
});
```

### 6.2 접근성 테스트 디버깅

#### axe-core 위반 사항 상세 로그

```typescript
it('접근성 검증 (디버그 모드)', async () => {
  const { container } = render(<NotificationDropdown />);
  const results = await axe(container);

  if (results.violations.length > 0) {
    console.log('Violations:', JSON.stringify(results.violations, null, 2));
  }

  expect(results).toHaveNoViolations();
});
```

---

## 7. 다음 단계

### 7.1 `/speckit.tasks` 실행

테스트 작성 계획이 완료되면 다음 명령어로 태스크 생성:

```bash
/speckit.tasks
```

**예상 산출물**: `specs/003-ui-component-tests/tasks.md` (실행 가능한 작업 목록)

### 7.2 테스트 구현

`tasks.md`에 정의된 순서대로 테스트 작성:
1. NotificationDropdown 기본 렌더링
2. NotificationDropdown 인터랙션
3. NotificationDropdown 접근성
4. JobPostingCard 인터랙션 추가
5. JobPostingCard 접근성 추가

### 7.3 검증

모든 테스트 작성 후 검증:
```bash
npm run test:coverage
npm run lint
npm run type-check
```

---

## 8. 참고 자료

### 공식 문서
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [jest-axe](https://github.com/nickcolley/jest-axe)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [user-event](https://testing-library.com/docs/user-event/intro)

### 프로젝트 문서
- [CLAUDE.md](../../../../CLAUDE.md) - 프로젝트 개발 가이드
- [research.md](research.md) - 테스트 베스트 프랙티스 조사
- [data-model.md](data-model.md) - 테스트 데이터 모델
- [contracts/](contracts/) - 컴포넌트 인터페이스 정의

---

**Last Updated**: 2025-11-06
**Next Command**: `/speckit.tasks` (태스크 생성)
