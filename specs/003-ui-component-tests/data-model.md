# Data Model: Test Fixtures and Mock Data

**Feature**: Phase 2-4 Critical UI Component Tests
**Date**: 2025-11-06

## Overview

이 문서는 NotificationDropdown과 JobPostingCard 컴포넌트 테스트에 사용되는 테스트 데이터 모델, Mock 객체, Fixture 정의를 담고 있습니다.

---

## 1. Notification 데이터 모델

### 1.1 Notification 인터페이스

```typescript
interface Notification {
  id: string;                     // 알림 고유 ID
  userId: string;                 // 수신자 사용자 ID
  type: NotificationType;         // 알림 유형
  title: string;                  // 알림 제목
  message: string;                // 알림 내용
  isRead: boolean;                // 읽음 여부
  createdAt: Timestamp;           // 생성 시각 (Firebase Timestamp)
  relatedId?: string;             // 연관된 엔티티 ID (optional)
  actionUrl?: string;             // 클릭 시 이동할 URL (optional)
}

type NotificationType = 'system' | 'work' | 'schedule' | 'finance';
```

### 1.2 Mock Notification Factory

**파일 위치**: `app2/src/__tests__/unit/testUtils/mockNotifications.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

export const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: `notif-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'test-user-1',
  type: 'work',
  title: '테스트 알림',
  message: '테스트 메시지입니다.',
  isRead: false,
  createdAt: Timestamp.now(),
  ...overrides
});

// 사전 정의된 Fixture
export const mockNotifications = {
  // 안읽은 일반 알림
  unread: createMockNotification({
    id: 'notif-1',
    type: 'work',
    title: '근무 배정 알림',
    message: '2025-11-15 저녁 근무에 배정되었습니다.',
    isRead: false,
    relatedId: 'event-1',
    actionUrl: '/app/work-logs'
  }),

  // 읽은 알림
  read: createMockNotification({
    id: 'notif-2',
    type: 'finance',
    title: '급여 지급 완료',
    message: '10월 급여가 지급되었습니다.',
    isRead: true,
    relatedId: 'payment-1',
    actionUrl: '/app/salary'
  }),

  // 시스템 알림 (긴급)
  systemUrgent: createMockNotification({
    id: 'notif-3',
    type: 'system',
    title: '🚨 시스템 점검 공지',
    message: '오늘 밤 11시부터 시스템 점검이 예정되어 있습니다.',
    isRead: false
  }),

  // 일정 변경 알림
  scheduleChange: createMockNotification({
    id: 'notif-4',
    type: 'schedule',
    title: '일정 변경 알림',
    message: '2025-11-20 근무 일정이 변경되었습니다.',
    isRead: false,
    relatedId: 'event-2',
    actionUrl: '/app/schedule'
  })
};

// 대량 알림 생성 (스크롤 테스트용)
export const createMockNotifications = (count: number): Notification[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockNotification({
      id: `notif-${index + 1}`,
      title: `알림 ${index + 1}`,
      isRead: index % 3 === 0 // 1/3은 읽음 상태
    })
  );
};
```

### 1.3 useNotifications Hook Mock

```typescript
export const createMockUseNotifications = (overrides: Partial<UseNotificationsReturn> = {}) => ({
  notifications: [mockNotifications.unread, mockNotifications.read],
  unreadCount: 1,
  loading: false,
  error: null,
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn().mockResolvedValue(undefined),
  ...overrides
});

// 사용 예시
jest.mock('../../../../hooks/useNotifications', () => ({
  useNotifications: () => createMockUseNotifications()
}));
```

---

## 2. JobPosting 데이터 모델

### 2.1 JobPosting 인터페이스

```typescript
interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  district: string;
  status: 'open' | 'closed';
  createdBy: string;
  postingType: PostingType;
  dateSpecificRequirements: DateSpecificRequirement[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isChipDeducted: boolean;
  chipCost?: number;
  contactPhone?: string;
  applicationCount?: number;  // 지원자 수 (optional)
}

type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';

interface DateSpecificRequirement {
  date: string;              // YYYY-MM-DD 형식
  roles: RoleRequirement[];
}

interface RoleRequirement {
  role: string;              // 역할명 (딜러, 칩러너 등)
  count: number;             // 필요 인원
  salary: number;            // 시급
}
```

### 2.2 Mock JobPosting Factory

**파일 위치**: `app2/src/__tests__/unit/testUtils/mockJobPostings.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

export const createMockJobPosting = (overrides: Partial<JobPosting> = {}): JobPosting => ({
  id: `job-${Math.random().toString(36).substr(2, 9)}`,
  title: '테스트 구인공고',
  description: '테스트 설명',
  location: '서울',
  district: '강남구',
  status: 'open',
  createdBy: 'user-1',
  postingType: 'regular',
  dateSpecificRequirements: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  isChipDeducted: false,
  ...overrides
});

// 사전 정의된 Fixture
export const mockJobPostings = {
  // 일반 공고 (모집중)
  regular: createMockJobPosting({
    id: 'job-1',
    title: '강남 홀덤펍 딜러 모집',
    postingType: 'regular',
    status: 'open',
    location: '서울',
    district: '강남구',
    dateSpecificRequirements: [
      {
        date: '2025-11-15',
        roles: [
          { role: '딜러', count: 2, salary: 50000 },
          { role: '칩러너', count: 1, salary: 30000 }
        ]
      }
    ]
  }),

  // 고정 공고 (상단 고정)
  fixed: createMockJobPosting({
    id: 'job-2',
    title: '⭐ 정규직 딜러 채용 (상시모집)',
    postingType: 'fixed',
    chipCost: 3,
    contactPhone: '010-1234-5678'
  }),

  // 토너먼트 공고
  tournament: createMockJobPosting({
    id: 'job-3',
    title: '🏆 대형 토너먼트 스태프 모집',
    postingType: 'tournament',
    chipCost: 5,
    dateSpecificRequirements: [
      {
        date: '2025-12-01',
        roles: [
          { role: '딜러', count: 10, salary: 80000 },
          { role: '플로어 매니저', count: 2, salary: 100000 }
        ]
      }
    ]
  }),

  // 긴급 공고
  urgent: createMockJobPosting({
    id: 'job-4',
    title: '🚨 긴급! 오늘 저녁 딜러 필요',
    postingType: 'urgent',
    status: 'open',
    dateSpecificRequirements: [
      {
        date: '2025-11-06',
        roles: [{ role: '딜러', count: 1, salary: 60000 }]
      }
    ]
  }),

  // 마감된 공고
  closed: createMockJobPosting({
    id: 'job-5',
    title: '마감된 공고',
    status: 'closed',
    postingType: 'regular'
  }),

  // 지원자 수 포함
  withApplications: createMockJobPosting({
    id: 'job-6',
    title: '인기 공고',
    applicationCount: 15
  })
};
```

---

## 3. React Router Mock

### 3.1 useNavigate Mock

```typescript
export const mockNavigate = jest.fn();

// 사용 예시
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// 각 테스트 전 초기화
beforeEach(() => {
  mockNavigate.mockClear();
});
```

---

## 4. Firebase Mock

### 4.1 Firestore Functions Mock

```typescript
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

// Firebase DB Mock
jest.mock('../../../../firebase', () => ({
  db: {}
}));

// Firestore 함수 Mock
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  Timestamp: {
    now: () => ({ seconds: 1699200000, nanoseconds: 0 }),
    fromDate: (date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })
  }
}));

// getDoc Mock 설정 예시
(getDoc as jest.Mock).mockResolvedValue({
  exists: () => true,
  data: () => ({ name: '테스트 사용자', nickname: '닉네임' })
});
```

---

## 5. i18n (react-i18next) Mock

### 5.1 useTranslation Mock

```typescript
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'ko' }
  })
}));
```

---

## 6. Accessibility Testing Helpers

**파일 위치**: `app2/src/__tests__/unit/testUtils/accessibilityHelpers.ts`

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

// Jest matcher 확장
expect.extend(toHaveNoViolations);

/**
 * 접근성 테스트 헬퍼
 * @param container - 테스트할 DOM 컨테이너
 * @param options - axe-core 옵션
 */
export const testAccessibility = async (
  container: Element,
  options?: any
): Promise<void> => {
  const results = await axe(container, options);
  expect(results).toHaveNoViolations();
};

/**
 * 키보드 포커스 순서 검증 헬퍼
 * @param elements - 포커스 가능한 요소들
 */
export const testFocusOrder = async (
  elements: HTMLElement[]
): Promise<void> => {
  const user = userEvent.setup();

  for (const element of elements) {
    await user.tab();
    expect(element).toHaveFocus();
  }
};

/**
 * 스크린 리더 텍스트 검증 헬퍼
 * @param element - 검증할 요소
 * @param expectedText - 예상되는 접근성 텍스트
 */
export const testScreenReaderText = (
  element: HTMLElement,
  expectedText: string
): void => {
  const accessibleName = element.getAttribute('aria-label') || element.textContent;
  expect(accessibleName).toContain(expectedText);
};
```

---

## 7. 테스트 Setup 파일

**파일 위치**: `app2/src/__tests__/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// Jest matcher 확장
expect.extend(toHaveNoViolations);

// 전역 Mock 설정
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// IntersectionObserver Mock (드롭다운 가시성 테스트용)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));
```

---

## Data Model Summary

| 엔티티 | 파일 위치 | 주요 Factory 함수 | 사용 목적 |
|--------|----------|------------------|----------|
| **Notification** | `testUtils/mockNotifications.ts` | `createMockNotification`, `createMockNotifications` | NotificationDropdown 테스트 |
| **JobPosting** | `testUtils/mockJobPostings.ts` | `createMockJobPosting` | JobPostingCard 인터랙션 테스트 |
| **useNotifications Hook** | `testUtils/mockNotifications.ts` | `createMockUseNotifications` | Hook mock |
| **useNavigate** | 각 테스트 파일 | `mockNavigate` | React Router mock |
| **Firestore Functions** | 각 테스트 파일 | `jest.mock('firebase/firestore')` | Firebase mock |
| **Accessibility Helpers** | `testUtils/accessibilityHelpers.ts` | `testAccessibility`, `testFocusOrder` | 접근성 검증 |

---

**Next Steps**: Phase 1 - Contracts 생성
