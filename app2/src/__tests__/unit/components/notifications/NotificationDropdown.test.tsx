/**
 * NotificationDropdown 컴포넌트 테스트
 *
 * @description
 * NotificationDropdown 컴포넌트의 기본 렌더링, 드롭다운 토글, 알림 목록 표시,
 * 배지 표시, 빈 상태, 외부 클릭 닫힘 기능을 검증합니다.
 *
 * @version 1.0.0
 * @since 2025-11-06
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { NotificationDropdown } from '../../../../components/notifications/NotificationDropdown';
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

// Mock NotificationItem 컴포넌트 (date-fns 의존성 제거)
jest.mock('../../../../components/notifications/NotificationItem', () => ({
  __esModule: true,
  default: ({ notification }: any) => (
    <div data-testid="notification-item">
      <div>{notification.title}</div>
      <div>{notification.message}</div>
    </div>
  )
}));

// Mock NotificationBadge 컴포넌트
jest.mock('../../../../components/notifications/NotificationBadge', () => ({
  __esModule: true,
  default: ({ count }: any) => (
    count > 0 ? <span data-testid="notification-badge">{count}</span> : null
  )
}));

describe('NotificationDropdown', () => {
  const { useNotifications } = require('../../../../hooks/useNotifications');

  beforeEach(() => {
    // 각 테스트 전 mock 초기화
    jest.clearAllMocks();
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
        createMockUseNotifications({
          unreadCount: 3,
          notifications: [
            mockNotifications.unread,
            mockNotifications.workUnread,
            mockNotifications.financeUnread,
            mockNotifications.read
          ]
        })
      );

      render(<NotificationDropdown />);
      // NotificationBadge 컴포넌트가 count를 표시하는지 확인
      // 배지는 count > 0일 때만 렌더링됨
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('드롭다운이 초기에는 닫혀있어야 함', () => {
      render(<NotificationDropdown />);

      // 드롭다운이 열려있지 않으므로 알림 목록이 표시되지 않음
      expect(screen.queryByText('모두 읽음')).not.toBeInTheDocument();
      expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
    });
  });

  describe('드롭다운 토글', () => {
    it('벨 아이콘 클릭 시 드롭다운이 열려야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 드롭다운이 열리면 "알림센터" 버튼이 표시됨
      expect(screen.getByText('알림센터')).toBeInTheDocument();
    });

    it('벨 아이콘 다시 클릭 시 드롭다운이 닫혀야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 드롭다운 열기
      await user.click(bellButton);
      expect(screen.getByText('알림센터')).toBeInTheDocument();

      // 드롭다운 닫기
      await user.click(bellButton);
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });

    it('aria-expanded 속성이 드롭다운 상태를 반영해야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 초기 상태: 닫혀있음
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');

      // 드롭다운 열기
      await user.click(bellButton);
      expect(bellButton).toHaveAttribute('aria-expanded', 'true');

      // 드롭다운 닫기
      await user.click(bellButton);
      await waitFor(() => {
        expect(bellButton).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('알림 목록 렌더링', () => {
    it('5개 알림이 있을 때 5개 아이템이 표시되어야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [
            mockNotifications.unread,
            mockNotifications.read,
            mockNotifications.systemUrgent,
            mockNotifications.scheduleChange,
            mockNotifications.workUnread
          ],
          unreadCount: 3
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 알림 제목이 모두 표시되는지 확인
      expect(screen.getByText('근무 배정 알림')).toBeInTheDocument();
      expect(screen.getByText('급여 지급 완료')).toBeInTheDocument();
      expect(screen.getByText('🚨 시스템 점검 공지')).toBeInTheDocument();
      expect(screen.getByText('일정 변경 알림')).toBeInTheDocument();
      expect(screen.getByText('새로운 근무 요청')).toBeInTheDocument();
    });

    it('알림 목록은 최근 5개만 표시되어야 함', async () => {
      const user = userEvent.setup();
      // 6개 알림 생성 (컴포넌트는 최근 5개만 표시)
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [
            mockNotifications.unread,
            mockNotifications.read,
            mockNotifications.systemUrgent,
            mockNotifications.scheduleChange,
            mockNotifications.workUnread,
            mockNotifications.financeUnread // 6번째 알림 (표시되지 않아야 함)
          ],
          unreadCount: 4
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // 처음 5개 알림만 표시됨
      expect(screen.getByText('근무 배정 알림')).toBeInTheDocument();
      expect(screen.getByText('급여 지급 완료')).toBeInTheDocument();
      expect(screen.getByText('🚨 시스템 점검 공지')).toBeInTheDocument();
      expect(screen.getByText('일정 변경 알림')).toBeInTheDocument();
      expect(screen.getByText('새로운 근무 요청')).toBeInTheDocument();

      // 6번째 알림은 표시되지 않음
      expect(screen.queryByText('급여 명세서 확인 필요')).not.toBeInTheDocument();
    });
  });

  describe('빈 상태 및 로딩', () => {
    it('알림이 없을 때 빈 상태 메시지가 표시되어야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [],
          unreadCount: 0,
          loading: false
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      expect(screen.getByText('알림이 없습니다')).toBeInTheDocument();
    });

    it('로딩 중일 때 로딩 메시지가 표시되어야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [],
          unreadCount: 0,
          loading: true
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      expect(screen.getByText('로딩 중...')).toBeInTheDocument();
    });

    it('안읽은 알림이 없을 때 "모두 읽음" 버튼이 표시되지 않아야 함', async () => {
      const user = userEvent.setup();
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          notifications: [mockNotifications.read, mockNotifications.systemRead],
          unreadCount: 0,
          loading: false
        })
      );

      render(<NotificationDropdown />);

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i });
      await user.click(bellButton);

      // "모두 읽음" 버튼이 표시되지 않음 (unreadCount = 0)
      expect(screen.queryByText('모두 읽음')).not.toBeInTheDocument();
    });
  });

  describe('외부 클릭 및 ESC 키', () => {
    it('외부 클릭 시 드롭다운이 닫혀야 함', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <NotificationDropdown />
          <button>외부 버튼</button>
        </div>
      );

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 드롭다운 열기
      await user.click(bellButton);
      expect(screen.getByText('알림센터')).toBeInTheDocument();

      // 외부 버튼 클릭
      const outsideButton = screen.getByRole('button', { name: '외부 버튼' });
      await user.click(outsideButton);

      // 드롭다운이 닫힘
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });

    it('ESC 키를 누르면 드롭다운이 닫혀야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 드롭다운 열기
      await user.click(bellButton);
      expect(screen.getByText('알림센터')).toBeInTheDocument();

      // ESC 키 누르기
      await user.keyboard('{Escape}');

      // 드롭다운이 닫힘
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });
  });

  describe('버튼 동작', () => {
    it('"알림센터" 버튼 클릭 시 /app/notifications로 이동해야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 드롭다운 열기
      await user.click(bellButton);

      // "알림센터" 버튼 클릭
      const viewAllButton = screen.getByText('알림센터');
      await user.click(viewAllButton);

      expect(mockNavigate).toHaveBeenCalledWith('/app/notifications');

      // 드롭다운이 닫힘
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });

    it('"모두 읽음" 버튼 클릭 시 markAllAsRead가 호출되어야 함', async () => {
      const user = userEvent.setup();
      const mockMarkAllAsRead = jest.fn();
      useNotifications.mockReturnValue(
        createMockUseNotifications({
          unreadCount: 3,
          markAllAsRead: mockMarkAllAsRead
        })
      );

      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 드롭다운 열기
      await user.click(bellButton);

      // "모두 읽음" 버튼 클릭
      const markAllButton = screen.getByText('모두 읽음');
      await user.click(markAllButton);

      expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
    });

    it('설정 아이콘 클릭 시 /app/notification-settings로 이동해야 함', async () => {
      const user = userEvent.setup();
      render(<NotificationDropdown />);

      const bellButton = screen.getByRole('button', { name: /알림/i });

      // 드롭다운 열기
      await user.click(bellButton);

      // 설정 버튼 클릭 (aria-label로 찾기)
      const settingsButton = screen.getByRole('button', { name: /알림 설정/i });
      await user.click(settingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/app/notification-settings');

      // 드롭다운이 닫힘
      await waitFor(() => {
        expect(screen.queryByText('알림센터')).not.toBeInTheDocument();
      });
    });
  });
});
