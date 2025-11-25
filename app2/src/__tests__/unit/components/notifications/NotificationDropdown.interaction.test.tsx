/**
 * NotificationDropdown 인터랙션 테스트
 *
 * @description
 * NotificationDropdown의 알림 클릭, 모두 읽음, 모두 보기, 설정, ESC 키 등
 * 사용자 인터랙션을 검증합니다.
 *
 * @version 1.0.0
 * @since 2025-11-06
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { createMockUseNotifications, mockNotifications } from '../../testUtils/mockNotifications';

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

// Mock date-fns (NotificationItem 의존성 해결)
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '5분 전'
}));

jest.mock('date-fns/locale', () => ({
  ko: {}
}));

// Mock notificationConfig (NotificationItem 의존성)
jest.mock('../../../../config/notificationConfig', () => ({
  getNotificationTypeConfig: (type: string) => ({
    icon: '📢',
    color: 'blue',
    priority: 'normal'
  }),
  getNotificationRoute: (type: string, relatedId?: string) => {
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

describe('NotificationDropdown - 사용자 인터랙션', () => {
  const { useNotifications } = require('../../../../hooks/useNotifications');

  beforeEach(() => {
    jest.clearAllMocks();
    useNotifications.mockReturnValue(createMockUseNotifications());
    mockNavigate.mockClear();
  });

  describe('알림 클릭 인터랙션', () => {
    it('알림 클릭 시 markAsRead가 호출되고 관련 페이지로 이동해야 함', async () => {
      const user = userEvent.setup();
      const mockMarkAsRead = jest.fn();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.unread],
          unreadCount: 1,
          markAsRead: mockMarkAsRead
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 알림 클릭 (NotificationItem이 실제로 렌더링됨)
      const notificationItem = screen.getByText('근무 배정 알림');
      await user.click(notificationItem);

      // markAsRead 호출 확인
      expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');

      // 관련 페이지로 라우팅 확인
      expect(mockNavigate).toHaveBeenCalledWith('/app/work-logs');
    });

    it('읽은 알림 클릭 시에도 페이지 이동은 되어야 함', async () => {
      const user = userEvent.setup();
      const mockMarkAsRead = jest.fn();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.read],
          unreadCount: 0,
          markAsRead: mockMarkAsRead
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 읽은 알림 클릭
      const notificationItem = screen.getByText('급여 지급 완료');
      await user.click(notificationItem);

      // 이미 읽은 알림이므로 markAsRead는 호출되지 않음
      expect(mockMarkAsRead).not.toHaveBeenCalled();

      // 페이지 이동은 됨
      expect(mockNavigate).toHaveBeenCalledWith('/app/salary');
    });
  });

  describe('알림 타입별 라우팅', () => {
    it('work 타입 알림 클릭 시 /app/work-logs로 이동해야 함', async () => {
      const user = userEvent.setup();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.workUnread],
          unreadCount: 1
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const notificationItem = screen.getByText('새로운 근무 요청');
      await user.click(notificationItem);

      expect(mockNavigate).toHaveBeenCalledWith('/app/work-logs');
    });

    it('schedule 타입 알림 클릭 시 /app/schedule로 이동해야 함', async () => {
      const user = userEvent.setup();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.scheduleChange],
          unreadCount: 1
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const notificationItem = screen.getByText('일정 변경 알림');
      await user.click(notificationItem);

      expect(mockNavigate).toHaveBeenCalledWith('/app/schedule');
    });

    it('finance 타입 알림 클릭 시 /app/salary로 이동해야 함', async () => {
      const user = userEvent.setup();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.financeUnread],
          unreadCount: 1
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const notificationItem = screen.getByText('급여 명세서 확인 필요');
      await user.click(notificationItem);

      expect(mockNavigate).toHaveBeenCalledWith('/app/salary');
    });

    it('system 타입 알림 클릭 시 /app/notifications로 이동해야 함', async () => {
      const user = userEvent.setup();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.systemUrgent],
          unreadCount: 1
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const notificationItem = screen.getByText('🚨 시스템 점검 공지');
      await user.click(notificationItem);

      expect(mockNavigate).toHaveBeenCalledWith('/app/notifications');
    });
  });

  describe('"모두 읽음" 버튼 인터랙션', () => {
    it('"모두 읽음" 버튼 클릭 시 markAllAsRead 함수가 호출되어야 함', async () => {
      const user = userEvent.setup();
      const mockMarkAllAsRead = jest.fn();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [
            mockNotifications.unread,
            mockNotifications.workUnread,
            mockNotifications.financeUnread
          ],
          unreadCount: 3,
          markAllAsRead: mockMarkAllAsRead
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const markAllButton = screen.getByText('모두 읽음');
      await user.click(markAllButton);

      expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
    });

    it('안읽은 알림이 0개일 때 "모두 읽음" 버튼이 표시되지 않아야 함', async () => {
      const user = userEvent.setup();

      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.read, mockNotifications.systemRead],
          unreadCount: 0
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      expect(screen.queryByText('모두 읽음')).not.toBeInTheDocument();
    });
  });

  describe('"모두 보기" 버튼 인터랙션', () => {
    it('"모두 보기" 버튼 클릭 시 /app/notifications로 이동하고 드롭다운이 닫혀야 함', async () => {
      const user = userEvent.setup();

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const viewAllButton = screen.getByText('알림센터');
      await user.click(viewAllButton);

      expect(mockNavigate).toHaveBeenCalledWith('/app/notifications');

      // 드롭다운이 닫힘
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });
  });

  describe('설정 버튼 인터랙션', () => {
    it('설정 아이콘 클릭 시 /app/notification-settings로 이동하고 드롭다운이 닫혀야 함', async () => {
      const user = userEvent.setup();

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      const settingsButton = screen.getByRole('button', { name: /알림 설정/i });
      await user.click(settingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/app/notification-settings');

      // 드롭다운이 닫힘
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });
  });

  describe('ESC 키 인터랙션', () => {
    it('ESC 키를 누르면 드롭다운이 닫혀야 함', async () => {
      const user = userEvent.setup();

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      expect(screen.getByText('알림센터')).toBeInTheDocument();

      // ESC 키 누르기
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });

    it('드롭다운이 닫혀있을 때 ESC 키를 눌러도 에러가 발생하지 않아야 함', async () => {
      const user = userEvent.setup();

      render(<NotificationDropdown />);

      // 드롭다운이 닫혀있는 상태에서 ESC 키 누르기
      await user.keyboard('{Escape}');

      // 에러 없이 동작해야 함
      expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
    });
  });
});
