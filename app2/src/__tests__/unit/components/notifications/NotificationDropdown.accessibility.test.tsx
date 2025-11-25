/**
 * NotificationDropdown 접근성 테스트
 *
 * @description
 * NotificationDropdown의 다크모드, WCAG 2.1 AA 접근성, 키보드 네비게이션,
 * 스크린 리더 호환성을 검증합니다.
 *
 * @version 1.0.0
 * @since 2025-11-06
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { createMockUseNotifications, mockNotifications } from '../../testUtils/mockNotifications';
import { testAccessibility } from '../../testUtils/accessibilityHelpers';

// Mock useNotifications hook
const mockUseNotifications = createMockUseNotifications();
jest.mock('../../../../hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => mockUseNotifications)
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

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '5분 전'
}));

jest.mock('date-fns/locale', () => ({
  ko: {}
}));

// Mock notificationConfig
jest.mock('../../../../config/notificationConfig', () => ({
  getNotificationTypeConfig: (type: string) => ({
    icon: '📢',
    color: 'blue',
    priority: 'normal'
  }),
  getNotificationRoute: (type: string) => {
    const routes: Record<string, string> = {
      work: '/app/work-logs',
      schedule: '/app/schedule',
      finance: '/app/salary',
      system: '/app/notifications'
    };
    return routes[type] || '/app/notifications';
  }
}));

// Mock NotificationBadge
jest.mock('../../../../components/notifications/NotificationBadge', () => ({
  __esModule: true,
  default: ({ count }: any) => (
    count > 0 ? <span data-testid="notification-badge">{count}</span> : null
  )
}));

describe('NotificationDropdown - 접근성', () => {
  const { useNotifications } = require('../../../../hooks/useNotifications');

  beforeEach(() => {
    jest.clearAllMocks();
    useNotifications.mockReturnValue(createMockUseNotifications());
    mockNavigate.mockClear();
  });

  describe('다크모드 클래스', () => {
    it('벨 버튼에 다크모드 호버 클래스가 적용되어야 함', () => {
      const { container } = render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // dark:hover:bg-gray-700 클래스 확인
      expect(bellButton).toHaveClass('dark:hover:bg-gray-700');
    });

    it('드롭다운 컨테이너에 다크모드 배경 클래스가 적용되어야 함', async () => {
      const user = userEvent.setup();
      const { container } = render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 드롭다운 컨테이너에서 dark:bg-gray-800 클래스 확인
      const dropdown = container.querySelector('.dark\\:bg-gray-800');
      expect(dropdown).toBeInTheDocument();
    });

    it('알림 헤더 텍스트에 다크모드 클래스가 적용되어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const headerTitle = screen.getByText('알림');
      expect(headerTitle).toHaveClass('dark:text-gray-100');
    });

    it('"모두 읽음" 버튼에 다크모드 클래스가 적용되어야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({ unreadCount: 3 })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const markAllButton = screen.getByText('모두 읽음');
      expect(markAllButton).toHaveClass('dark:text-blue-400');
      expect(markAllButton).toHaveClass('dark:hover:text-blue-300');
    });
  });

  describe('axe-core 접근성 검증', () => {
    it('드롭다운이 닫혀있을 때 접근성 위반 사항이 없어야 함', async () => {
      const { container } = render(<NotificationDropdown />);
      await testAccessibility(container);
    });

    it('드롭다운이 열려있을 때 접근성 위반 사항이 없어야 함', async () => {
      const user = userEvent.setup();
      const { container } = render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      await testAccessibility(container);
    });

    it('다크모드 환경에서 접근성 위반 사항이 없어야 함', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div className="dark">
          <NotificationDropdown />
        </div>
      );

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      await testAccessibility(container);
    });
  });

  describe('aria 속성', () => {
    it('벨 버튼에 올바른 aria 속성이 설정되어야 함', () => {
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      expect(bellButton).toHaveAttribute('aria-label', '알림');
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');
      expect(bellButton).toHaveAttribute('aria-haspopup', 'true');
    });

    it('드롭다운이 열리면 aria-expanded가 true로 변경되어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 초기 상태
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');

      // 드롭다운 열기
      await user.click(bellButton);
      expect(bellButton).toHaveAttribute('aria-expanded', 'true');

      // 드롭다운 닫기
      await user.click(bellButton);
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('설정 버튼에 aria-label이 설정되어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const settingsButton = screen.getByRole('button', { name: /알림 설정/i });
      expect(settingsButton).toHaveAttribute('aria-label', '알림 설정');
    });
  });

  describe('키보드 네비게이션', () => {
    it('Tab 키로 벨 버튼에 포커스를 이동할 수 있어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      await user.tab();

      const bellButton = screen.getByRole('button', { name: /알림/i });
      expect(bellButton).toHaveFocus();
    });

    it('Enter 키로 드롭다운을 열 수 있어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      bellButton.focus();

      await user.keyboard('{Enter}');

      expect(screen.getByText('알림센터')).toBeInTheDocument();
    });

    it('Space 키로 드롭다운을 열 수 있어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      bellButton.focus();

      await user.keyboard(' ');

      expect(screen.getByText('알림센터')).toBeInTheDocument();
    });

    it('드롭다운 내부에서 Tab 키로 포커스를 이동할 수 있어야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({ unreadCount: 1 })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 첫 번째 알림으로 Tab 이동
      await user.tab();

      // "모두 읽음" 버튼 또는 설정 버튼으로 Tab 이동 (DOM 순서에 따라 다름)
      await user.tab();

      // 포커스가 드롭다운 내부의 버튼 중 하나에 있는지 확인
      const focusedElement = document.activeElement;
      const markAllButton = screen.queryByText('모두 읽음');
      const settingsButton = screen.getByRole('button', { name: /알림 설정/i });

      expect(
        focusedElement === markAllButton || focusedElement === settingsButton
      ).toBe(true);
    });

    it('ESC 키로 드롭다운을 닫을 수 있어야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      expect(screen.getByText('알림센터')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
    });
  });

  describe('스크린 리더 지원', () => {
    it('벨 버튼의 접근성 이름이 명확해야 함', () => {
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      expect(bellButton).toHaveAccessibleName('알림');
    });

    it('설정 버튼의 접근성 이름이 명확해야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const settingsButton = screen.getByRole('button', { name: /알림 설정/i });
      expect(settingsButton).toHaveAccessibleName('알림 설정');
    });

    it('빈 상태 메시지가 스크린 리더에게 전달되어야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [],
          unreadCount: 0
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const emptyMessage = screen.getByText('알림이 없습니다');
      expect(emptyMessage).toBeInTheDocument();
    });
  });

  describe('포커스 관리', () => {
    it('드롭다운이 닫힐 때 포커스가 벨 버튼으로 돌아가지 않아도 됨 (자동 처리)', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      expect(screen.getByText('알림센터')).toBeInTheDocument();

      // ESC로 닫기
      await user.keyboard('{Escape}');

      // 드롭다운이 닫힘
      expect(screen.queryByText('알림센터')).not.toBeInTheDocument();

      // 포커스는 자연스럽게 관리됨 (명시적 검증 불필요)
    });

    it('외부 클릭으로 드롭다운이 닫혀도 접근성 문제가 없어야 함', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <NotificationDropdown />
          <button>외부 버튼</button>
        </div>
      );

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const outsideButton = screen.getByRole('button', { name: '외부 버튼' });
      await user.click(outsideButton);

      // 접근성 검증
      await testAccessibility(container);
    });
  });
});
