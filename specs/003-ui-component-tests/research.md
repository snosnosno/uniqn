# Research: Phase 2-4 Critical UI Component Tests

**Date**: 2025-11-06
**Feature**: NotificationDropdown 및 JobPostingCard 컴포넌트 테스트

## Research Overview

이 문서는 React 컴포넌트 테스트 작성을 위한 베스트 프랙티스, 도구 선택, 패턴 조사 결과를 담고 있습니다.

---

## 1. React Testing Library 베스트 프랙티스

### Decision: React Testing Library 사용자 중심 쿼리 패턴

**Rationale**:
- React Testing Library는 사용자가 컴포넌트와 상호작용하는 방식을 시뮬레이션하도록 설계됨
- 구현 세부사항이 아닌 동작(behavior)을 테스트하여 리팩토링에 강건한 테스트 작성 가능
- UNIQN 프로젝트의 기존 테스트(`JobPostingCard.test.tsx`)도 동일한 패턴 사용

**Alternatives Considered**:
- **Enzyme**: React 16+ 지원 중단, 구현 세부사항 테스트로 인한 높은 유지보수 비용
- **Cypress Component Testing**: E2E 테스트 도구로 단위 테스트에는 과도한 설정 필요

### Query Priority (추천 순서)

| 우선순위 | Query | 사용 상황 | 예시 |
|---------|-------|----------|------|
| 1 | `getByRole` | 접근성 기반 쿼리 (최우선) | `getByRole('button', { name: '지원하기' })` |
| 2 | `getByLabelText` | 폼 요소 (label과 연결된 input) | `getByLabelText('이메일')` |
| 3 | `getByPlaceholderText` | placeholder 기반 (폼) | `getByPlaceholderText('검색어 입력')` |
| 4 | `getByText` | 텍스트 콘텐츠 기반 | `getByText('알림이 없습니다')` |
| 5 | `getByDisplayValue` | 폼 요소의 현재 값 | `getByDisplayValue('John Doe')` |
| 6 | `getByAltText` | 이미지 alt 속성 | `getByAltText('프로필 사진')` |
| 7 | `getByTitle` | title 속성 기반 | `getByTitle('닫기')` |
| 8 | `getByTestId` | 최후의 수단 (동적 콘텐츠) | `getByTestId('notification-item-1')` |

**적용 예시 (NotificationDropdown)**:
```typescript
// ✅ 좋은 예: 역할 기반 쿼리
const bellButton = screen.getByRole('button', { name: /알림/i });

// ✅ 좋은 예: 텍스트 기반 쿼리
expect(screen.getByText('알림이 없습니다')).toBeInTheDocument();

// ❌ 나쁜 예: CSS 클래스 쿼리 (구현 세부사항)
const dropdown = container.querySelector('.dropdown-menu');
```

---

## 2. 접근성 테스트: axe-core 통합

### Decision: jest-axe 라이브러리 사용

**Rationale**:
- `jest-axe`는 axe-core를 Jest와 통합하여 자동화된 접근성 테스트 제공
- WCAG 2.1 AA 준수 검증 가능
- 기존 Jest 테스트 스위트에 쉽게 통합 가능

**Installation**:
```bash
npm install --save-dev jest-axe axe-core
```

**Usage Pattern**:
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('접근성 위반 사항이 없어야 함', async () => {
  const { container } = render(<NotificationDropdown />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Alternatives Considered**:
- **pa11y**: CLI 기반 도구로 Jest 통합이 복잡함
- **Lighthouse CI**: CI/CD 파이프라인에 적합하지만 단위 테스트에는 과도함

---

## 3. 사용자 인터랙션 테스트: @testing-library/user-event

### Decision: user-event v14 사용 (fireEvent 대신)

**Rationale**:
- `fireEvent`는 저수준 DOM 이벤트만 발생시킴
- `user-event`는 실제 사용자 행동(클릭, 타이핑, 포커스 이동 등)을 시뮬레이션
- 키보드 네비게이션, 포커스 관리 등 접근성 테스트에 필수

**Usage Pattern**:
```typescript
import userEvent from '@testing-library/user-event';

it('알림 클릭 시 읽음 처리되어야 함', async () => {
  const user = userEvent.setup();
  render(<NotificationDropdown />);

  const notification = screen.getByRole('button', { name: /새 알림/i });
  await user.click(notification);

  expect(markAsRead).toHaveBeenCalledWith('notification-1');
});
```

**Alternatives Considered**:
- **fireEvent**: 간단한 이벤트에는 적합하지만, 실제 사용자 행동과 차이가 있음

---

## 4. 다크모드 테스트 전략

### Decision: CSS 클래스 검증 + 스냅샷 테스트

**Rationale**:
- UNIQN 프로젝트는 Tailwind CSS의 `dark:` 클래스 기반 다크모드 사용
- 기존 `JobPostingCard.test.tsx`의 패턴과 일관성 유지

**Pattern 1: 다크모드 클래스 검증**
```typescript
it('다크모드 스타일이 적용되어야 함', () => {
  const { container } = render(<NotificationDropdown />);

  // 다크모드 클래스 존재 여부 확인
  const dropdown = container.querySelector('.dark\\:bg-gray-800');
  expect(dropdown).toBeInTheDocument();
});
```

**Pattern 2: 색상 대비 검증 (axe-core 자동 검증)**
```typescript
it('다크모드에서 색상 대비가 WCAG AA를 충족해야 함', async () => {
  const { container } = render(
    <div className="dark">
      <NotificationDropdown />
    </div>
  );

  const results = await axe(container);
  expect(results).toHaveNoViolations(); // 4.5:1 대비 자동 검증
});
```

**Alternatives Considered**:
- **스냅샷 테스트 단독 사용**: 클래스 변경 시 불필요한 업데이트 필요, 가독성 낮음
- **컴포넌트 prop 기반 테마 전환**: 프로젝트 표준과 불일치

---

## 5. Mock 전략: Firebase 및 React Router

### Decision: Jest Mock Functions + Manual Mocks

**Rationale**:
- UNIQN 프로젝트의 기존 테스트 패턴과 일관성 유지
- Firebase Firestore와 React Router는 외부 의존성으로 mock 필수

**Firebase Mock Pattern** (기존 패턴 재사용):
```typescript
// Firebase 모킹
jest.mock('../../../../firebase', () => ({
  db: {}
}));

// Firestore 함수 모킹
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  getDoc: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn()
}));
```

**React Router Mock Pattern**:
```typescript
// React Router 모킹
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));
```

**useNotifications Hook Mock**:
```typescript
const mockUseNotifications = {
  notifications: [
    { id: '1', title: '테스트 알림', isRead: false, createdAt: new Date() }
  ],
  unreadCount: 1,
  loading: false,
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn()
};

jest.mock('../../../../hooks/useNotifications', () => ({
  useNotifications: () => mockUseNotifications
}));
```

**Alternatives Considered**:
- **MSW (Mock Service Worker)**: API 레벨 mock으로 과도함 (단위 테스트에는 불필요)
- **실제 Firebase 에뮬레이터**: 통합 테스트에 적합하지만 단위 테스트에는 느림

---

## 6. 테스트 구조: Describe/It 패턴

### Decision: Given-When-Then 기반 계층적 Describe 블록

**Rationale**:
- 가독성 향상 및 테스트 의도 명확화
- 기존 `JobPostingCard.test.tsx`의 패턴과 일관성 유지

**Pattern**:
```typescript
describe('NotificationDropdown', () => {
  describe('기본 렌더링', () => {
    it('알림 목록이 표시되어야 함', () => {
      // Given: 알림 데이터가 있을 때
      // When: 컴포넌트를 렌더링하면
      // Then: 알림 목록이 표시되어야 함
    });
  });

  describe('사용자 인터랙션', () => {
    it('알림 클릭 시 읽음 처리되어야 함', async () => {
      // Given: 안읽은 알림이 있을 때
      // When: 알림을 클릭하면
      // Then: 읽음 처리 함수가 호출되어야 함
    });
  });

  describe('접근성', () => {
    it('키보드 네비게이션이 작동해야 함', async () => {
      // Given: 드롭다운이 열려있을 때
      // When: Tab 키를 누르면
      // Then: 포커스가 이동해야 함
    });
  });
});
```

**Alternatives Considered**:
- **Flat 구조 (describe 없이 it만 사용)**: 테스트 개수가 많을 때 가독성 저하
- **BDD 프레임워크 (Jest-Cucumber)**: 과도한 설정, 프로젝트 표준과 불일치

---

## 7. 커버리지 목표 및 측정

### Decision: Jest Coverage with Thresholds

**Rationale**:
- Jest의 내장 커버리지 도구 사용으로 추가 설정 불필요
- 커버리지 임계값 설정으로 품질 게이트 자동화

**Configuration (package.json 또는 jest.config.js)**:
```json
{
  "jest": {
    "collectCoverageFrom": [
      "src/components/notifications/NotificationDropdown.tsx",
      "src/components/common/JobPostingCard.tsx"
    ],
    "coverageThreshold": {
      "src/components/notifications/NotificationDropdown.tsx": {
        "branches": 85,
        "functions": 85,
        "lines": 85,
        "statements": 85
      },
      "src/components/common/JobPostingCard.tsx": {
        "branches": 90,
        "functions": 90,
        "lines": 90,
        "statements": 90
      }
    }
  }
}
```

**Alternatives Considered**:
- **Istanbul (nyc)**: Jest가 이미 Istanbul 사용, 별도 설정 불필요
- **Codecov/Coveralls**: CI/CD 통합은 프로젝트 스코프 외

---

## 8. 테스트 데이터 관리: Fixtures 및 Factory Functions

### Decision: Test Fixtures + Factory Functions

**Rationale**:
- 재사용 가능한 테스트 데이터로 중복 제거
- Factory 패턴으로 다양한 시나리오 생성 용이

**Pattern**:
```typescript
// testUtils/mockNotifications.ts
export const createMockNotification = (overrides = {}) => ({
  id: 'notif-1',
  userId: 'user-1',
  type: 'work' as const,
  title: '테스트 알림',
  message: '테스트 메시지',
  isRead: false,
  createdAt: Timestamp.now(),
  ...overrides
});

export const mockNotifications = {
  unread: createMockNotification({ isRead: false }),
  read: createMockNotification({ isRead: true }),
  urgent: createMockNotification({ type: 'system', title: '긴급 알림' })
};
```

**Alternatives Considered**:
- **Hard-coded 데이터**: 중복 코드 증가, 유지보수 어려움
- **faker.js**: 과도한 랜덤 데이터는 테스트 안정성 저하

---

## 9. 키보드 네비게이션 테스트

### Decision: user-event.tab() + 포커스 검증

**Rationale**:
- 키보드 사용자 접근성 보장 (WCAG 2.1 Success Criterion 2.1.1)
- Tab, Enter, Space, Escape 키 등 표준 키보드 인터랙션 검증

**Pattern**:
```typescript
it('Tab 키로 포커스 이동이 가능해야 함', async () => {
  const user = userEvent.setup();
  render(<NotificationDropdown />);

  // Tab 키로 포커스 이동
  await user.tab();
  expect(screen.getByRole('button', { name: /알림/i })).toHaveFocus();

  await user.tab();
  expect(screen.getByRole('button', { name: /모두 읽음/i })).toHaveFocus();
});

it('Enter 키로 알림을 선택할 수 있어야 함', async () => {
  const user = userEvent.setup();
  render(<NotificationDropdown />);

  const notification = screen.getByRole('button', { name: /새 알림/i });
  notification.focus();
  await user.keyboard('{Enter}');

  expect(markAsRead).toHaveBeenCalled();
});
```

**Alternatives Considered**:
- **fireEvent.keyDown**: 포커스 관리 시뮬레이션 불완전
- **Manual focus()**: 실제 키보드 동작과 차이 있음

---

## 10. 외부 클릭 감지 테스트

### Decision: mousedown 이벤트 + ref 검증

**Rationale**:
- NotificationDropdown은 외부 클릭 시 자동 닫힘 기능 필요
- React의 ref 기반 외부 클릭 감지 패턴 검증

**Pattern**:
```typescript
it('외부 클릭 시 드롭다운이 닫혀야 함', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <div>
      <NotificationDropdown />
      <button>외부 버튼</button>
    </div>
  );

  // 드롭다운 열기
  const bellButton = screen.getByRole('button', { name: /알림/i });
  await user.click(bellButton);
  expect(screen.getByRole('list', { name: /알림 목록/i })).toBeVisible();

  // 외부 클릭
  const outsideButton = screen.getByRole('button', { name: '외부 버튼' });
  await user.click(outsideButton);
  expect(screen.queryByRole('list', { name: /알림 목록/i })).not.toBeInTheDocument();
});
```

**Alternatives Considered**:
- **fireEvent.click**: 이벤트 버블링 시뮬레이션 불완전
- **document.body.click()**: 실제 사용자 행동과 차이 있음

---

## Research Summary

| 연구 항목 | 선택된 도구/패턴 | 주요 근거 |
|----------|-----------------|----------|
| 쿼리 전략 | React Testing Library 사용자 중심 쿼리 | 구현 세부사항이 아닌 동작 테스트, 기존 패턴 일관성 |
| 접근성 테스트 | jest-axe | WCAG 2.1 AA 자동 검증, Jest 통합 용이 |
| 사용자 인터랙션 | @testing-library/user-event v14 | 실제 사용자 행동 시뮬레이션, 접근성 테스트 필수 |
| 다크모드 테스트 | CSS 클래스 검증 + axe-core 색상 대비 | Tailwind dark: 클래스 기반 프로젝트 표준 |
| Mock 전략 | Jest Mock Functions + Manual Mocks | 기존 테스트 패턴 일관성, Firebase/Router mock |
| 테스트 구조 | Given-When-Then 계층적 Describe | 가독성, 기존 JobPostingCard 패턴 일관성 |
| 커버리지 측정 | Jest Coverage with Thresholds | 내장 도구, 자동화된 품질 게이트 |
| 테스트 데이터 | Fixtures + Factory Functions | 재사용성, 다양한 시나리오 생성 용이 |
| 키보드 네비게이션 | user-event.tab() + 포커스 검증 | WCAG 2.1 준수, 실제 키보드 동작 시뮬레이션 |
| 외부 클릭 감지 | mousedown 이벤트 + ref 검증 | React ref 패턴 검증, 실제 동작과 일치 |

---

**Next Steps**: Phase 1 - Data Model 및 Contracts 생성
