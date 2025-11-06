# NotificationDropdown Component Interface

**Component**: `NotificationDropdown`
**File**: `app2/src/components/notifications/NotificationDropdown.tsx`
**Date**: 2025-11-06

## Component Signature

```typescript
interface NotificationDropdownProps {
  /** 추가 CSS 클래스 */
  className?: string;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps>;
```

---

## Dependencies

### External Dependencies

| Dependency | Version | Usage |
|-----------|---------|-------|
| `react` | 18.2 | useState, useRef, useEffect, useCallback, memo |
| `react-router-dom` | Latest | useNavigate for routing |
| `react-i18next` | Latest | useTranslation for i18n |

### Internal Dependencies

| Dependency | Path | Usage |
|-----------|------|-------|
| `useNotifications` | `hooks/useNotifications` | 알림 데이터 및 상태 관리 |
| `NotificationBadge` | `components/notifications/NotificationBadge` | 안읽은 알림 배지 |
| `NotificationItem` | `components/notifications/NotificationItem` | 개별 알림 아이템 |
| `Icons` | `components/Icons/ReactIconsReplacement` | FaBell, FaCog 아이콘 |

---

## Component Behavior Contract

### 1. 렌더링 계약

#### 1.1 초기 렌더링 (드롭다운 닫힘)
```typescript
// Given: 알림 데이터가 로드됨
// When: NotificationDropdown을 렌더링
// Then:
{
  bellIcon: 'visible',
  badge: unreadCount > 0 ? 'visible with count' : 'hidden',
  dropdown: 'hidden',
  state: 'closed'
}
```

#### 1.2 드롭다운 열림 상태
```typescript
// Given: 벨 아이콘 클릭
// When: 드롭다운 오픈
// Then:
{
  dropdown: {
    visible: true,
    position: 'absolute, top-right',
    content: notifications.length > 0 ? 'notification list' : 'empty state'
  },
  overlay: 'click-outside detector active'
}
```

### 2. 사용자 인터랙션 계약

#### 2.1 드롭다운 토글
```typescript
interface ToggleBehavior {
  trigger: 'click on bell icon';
  currentState: 'closed' | 'open';
  nextState: currentState === 'closed' ? 'open' : 'closed';
  sideEffects: currentState === 'open' ? ['add outside click listener'] : ['remove listener'];
}
```

#### 2.2 알림 클릭
```typescript
interface NotificationClickBehavior {
  trigger: 'click on notification item';
  actions: [
    'call markAsRead(notificationId)',
    'navigate to actionUrl or default page',
    'close dropdown'
  ];
  routing: {
    '/app/work-logs': 'work type',
    '/app/schedule': 'schedule type',
    '/app/salary': 'finance type',
    '/app/notifications': 'default fallback'
  };
}
```

#### 2.3 모두 읽음 버튼
```typescript
interface MarkAllAsReadBehavior {
  trigger: 'click on "모두 읽음" button';
  precondition: 'unreadCount > 0';
  action: 'call markAllAsRead()';
  postcondition: 'unreadCount === 0';
}
```

#### 2.4 모두 보기 버튼
```typescript
interface ViewAllBehavior {
  trigger: 'click on "모두 보기" button';
  actions: [
    'close dropdown',
    'navigate to /app/notifications'
  ];
}
```

#### 2.5 설정 버튼
```typescript
interface SettingsBehavior {
  trigger: 'click on settings icon';
  actions: [
    'close dropdown',
    'navigate to /app/notification-settings'
  ];
}
```

### 3. 키보드 네비게이션 계약

#### 3.1 ESC 키
```typescript
interface EscKeyBehavior {
  trigger: 'press ESC key';
  precondition: 'dropdown is open';
  action: 'close dropdown';
}
```

#### 3.2 Tab 키 포커스 순서
```typescript
interface FocusOrder {
  elements: [
    'bell icon button',
    'first notification item',
    'second notification item',
    '...',
    '모두 읽음 button',
    '모두 보기 button',
    'settings icon button'
  ];
  behavior: 'tab moves focus forward, shift+tab moves backward';
}
```

#### 3.3 Enter/Space 키 (알림 선택)
```typescript
interface SelectNotificationByKeyboard {
  trigger: 'press Enter or Space on focused notification';
  action: 'same as click behavior (mark as read + navigate)';
}
```

### 4. 외부 클릭 감지 계약

```typescript
interface OutsideClickBehavior {
  trigger: 'mousedown event outside dropdown';
  precondition: 'dropdown is open';
  detection: 'ref-based containment check';
  action: 'close dropdown';
  exceptions: ['clicks on bell icon itself']; // 토글 동작 보장
}
```

### 5. 로딩 및 에러 상태 계약

#### 5.1 로딩 상태
```typescript
interface LoadingState {
  condition: 'loading === true';
  display: {
    spinner: 'visible',
    notificationList: 'hidden or skeleton'
  };
}
```

#### 5.2 빈 상태 (알림 없음)
```typescript
interface EmptyState {
  condition: 'notifications.length === 0 && !loading';
  display: {
    message: '알림이 없습니다',
    icon: 'optional empty state icon',
    notificationList: 'hidden'
  };
}
```

#### 5.3 에러 상태
```typescript
interface ErrorState {
  condition: 'error !== null';
  display: {
    message: 'error.message or generic message',
    retry: 'optional retry button'
  };
}
```

---

## Accessibility Contract (WCAG 2.1 AA)

### 1. 시맨틱 마크업

```typescript
interface SemanticStructure {
  bellButton: {
    role: 'button',
    ariaLabel: '알림',
    ariaExpanded: isOpen ? 'true' : 'false',
    ariaHaspopup: 'true'
  },
  dropdown: {
    role: 'region',
    ariaLabelledby: 'notification-dropdown-heading',
    ariaLive: 'polite' // 새 알림 실시간 업데이트 시
  },
  notificationList: {
    role: 'list',
    ariaLabel: '알림 목록'
  },
  notificationItem: {
    role: 'listitem button',
    ariaLabel: `${notification.title} - ${isRead ? '읽음' : '안읽음'}`
  }
}
```

### 2. 키보드 접근성

```typescript
interface KeyboardAccessibility {
  requirements: [
    'All interactive elements must be keyboard accessible',
    'Tab order must be logical (bell → notifications → actions)',
    'ESC key must close dropdown',
    'Enter/Space must activate focused elements'
  ];
  focusManagement: {
    onOpen: 'focus moves to first notification (optional)',
    onClose: 'focus returns to bell button'
  };
}
```

### 3. 색상 대비 (다크모드 포함)

```typescript
interface ColorContrast {
  lightMode: {
    text: 'gray-900 on white (21:1)',
    unreadText: 'blue-600 on white (8:1)',
    badge: 'white on red-500 (5:1)'
  },
  darkMode: {
    text: 'gray-100 on gray-800 (15:1)',
    unreadText: 'blue-400 on gray-800 (7:1)',
    badge: 'white on red-600 (5:1)'
  },
  requirement: 'All contrasts must meet WCAG AA (4.5:1 for normal text)'
}
```

### 4. 스크린 리더 지원

```typescript
interface ScreenReaderSupport {
  announcements: [
    'Bell button announces unread count ("5개의 읽지 않은 알림")',
    'Notification item announces title, message, read status',
    'Mark all as read button announces action ("모든 알림을 읽음으로 표시")'
  ];
  updates: {
    newNotification: 'aria-live region announces new notification',
    readStatusChange: 'aria-live region announces status change'
  };
}
```

---

## Test Coverage Requirements

### 1. 렌더링 테스트 (85% 커버리지)

| Test Case | Priority | Description |
|-----------|----------|-------------|
| 기본 렌더링 | P1 | 벨 아이콘, 배지, 드롭다운(닫힘) 표시 |
| 알림 목록 표시 | P1 | 5개 알림 → 5개 아이템 렌더링 |
| 빈 상태 표시 | P1 | 알림 0개 → 빈 상태 메시지 |
| 로딩 상태 | P2 | loading=true → 스피너 표시 |

### 2. 인터랙션 테스트

| Test Case | Priority | Description |
|-----------|----------|-------------|
| 드롭다운 토글 | P1 | 벨 클릭 → 열림/닫힘 |
| 알림 클릭 | P1 | 알림 클릭 → markAsRead + navigate |
| 모두 읽음 | P1 | 버튼 클릭 → markAllAsRead 호출 |
| 모두 보기 | P1 | 버튼 클릭 → /app/notifications 이동 |
| 외부 클릭 닫힘 | P1 | 외부 클릭 → 드롭다운 닫힘 |
| ESC 키 닫힘 | P2 | ESC → 드롭다운 닫힘 |

### 3. 접근성 테스트

| Test Case | Priority | Description |
|-----------|----------|-------------|
| axe-core 검증 | P1 | 0개 위반 사항 |
| 키보드 네비게이션 | P1 | Tab으로 포커스 이동 |
| Enter/Space 선택 | P2 | 키보드로 알림 선택 |
| 스크린 리더 텍스트 | P2 | aria-label 정확성 검증 |

### 4. 다크모드 테스트

| Test Case | Priority | Description |
|-----------|----------|-------------|
| dark: 클래스 적용 | P1 | 모든 UI 요소에 dark: 존재 |
| 색상 대비 검증 | P2 | axe-core로 대비 자동 검증 |

---

## Mock Dependencies (테스트용)

### useNotifications Hook Mock

```typescript
const mockUseNotifications = {
  notifications: [
    createMockNotification({ id: '1', isRead: false }),
    createMockNotification({ id: '2', isRead: true })
  ],
  unreadCount: 1,
  loading: false,
  error: null,
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../../hooks/useNotifications', () => ({
  useNotifications: () => mockUseNotifications
}));
```

### React Router Mock

```typescript
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));
```

---

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| 초기 렌더링 | <50ms | React DevTools Profiler |
| 드롭다운 오픈 | <100ms | 사용자 체감 지연 없음 |
| 알림 100개 렌더링 | <200ms | 가상 스크롤 고려 가능 |
| 테스트 실행 시간 | <3초 | Jest 실행 시간 |

---

**Contract Version**: 1.0
**Last Updated**: 2025-11-06
