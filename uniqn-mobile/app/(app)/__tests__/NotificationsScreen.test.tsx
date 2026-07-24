import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NotificationsScreen from '../notifications';

// 알림 목록 화면 — 모두 삭제(확인 게이트)·알림 설정 진입 버튼 검증

const mockRouterPush = jest.fn();
const mockConfirmAction = jest.fn();
const mockDeleteAllNotifications = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockGroupedResult = {
  groupedNotifications: [] as unknown[],
  rawNotifications: [{ id: 'n-1' }] as unknown[],
  unreadCount: 1,
  isLoading: false,
  isRefreshing: false,
  error: null,
  hasMore: false,
  fetchNextPage: jest.fn(),
  isFetchingNextPage: false,
  refetch: jest.fn(),
  markGroupAsRead: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args), replace: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// StackHeader 는 rightAction 을 실제 렌더해야 헤더 버튼을 단언할 수 있다
jest.mock('@/components/headers', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    StackHeader: ({ rightAction }: { rightAction?: React.ReactNode }) => <View>{rightAction}</View>,
  };
});

jest.mock('@/components/notifications', () => ({
  NotificationList: () => null,
  NotificationCategoryTabs: () => null,
}));

jest.mock('@/components/icons', () => ({
  SettingsIcon: () => null,
}));

jest.mock('@/hooks/useNotifications', () => ({
  useGroupedNotifications: () => mockGroupedResult,
  useMarkAllAsRead: () => ({ markAllAsRead: mockMarkAllAsRead }),
  useDeleteNotification: () => ({ deleteNotification: jest.fn() }),
  useDeleteAllNotifications: () => ({
    deleteAllNotifications: mockDeleteAllNotifications,
    isDeletingAll: false,
  }),
}));

jest.mock('@/hooks/useDeepLink', () => ({
  useNotificationNavigation: () => ({ handleNotificationPress: jest.fn() }),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: (selector: (state: { unreadByCategory: object }) => unknown) =>
    selector({ unreadByCategory: {} }),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: (...args: unknown[]) => mockConfirmAction(...args),
}));

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

describe('알림 목록 화면 헤더 액션', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupedResult.rawNotifications = [{ id: 'n-1' }];
    mockGroupedResult.unreadCount = 1;
  });

  it('알림이 있으면 모두 삭제 버튼이 렌더되고, 확인 후에만 삭제가 실행된다', () => {
    const { getByTestId } = render(<NotificationsScreen />);

    fireEvent.press(getByTestId('notifications-delete-all'));

    // 확인 다이얼로그 게이트 — 즉시 삭제되면 안 된다
    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(mockDeleteAllNotifications).not.toHaveBeenCalled();

    const options = mockConfirmAction.mock.calls[0][0] as {
      destructive: boolean;
      onConfirm: () => void;
    };
    expect(options.destructive).toBe(true);

    options.onConfirm();
    expect(mockDeleteAllNotifications).toHaveBeenCalledTimes(1);
  });

  it('알림이 없으면 모두 삭제 버튼은 숨고 설정 버튼은 유지된다', () => {
    mockGroupedResult.rawNotifications = [];
    mockGroupedResult.unreadCount = 0;

    const { queryByTestId } = render(<NotificationsScreen />);

    expect(queryByTestId('notifications-delete-all')).toBeNull();
    expect(queryByTestId('notifications-mark-all-read')).toBeNull();
    expect(queryByTestId('notifications-open-settings')).not.toBeNull();
  });

  it('설정 버튼을 누르면 알림 설정 화면으로 이동한다', () => {
    const { getByTestId } = render(<NotificationsScreen />);

    fireEvent.press(getByTestId('notifications-open-settings'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/notifications');
  });

  it('미읽음이 있으면 모두 읽음 버튼이 동작한다', () => {
    const { getByTestId } = render(<NotificationsScreen />);

    fireEvent.press(getByTestId('notifications-mark-all-read'));

    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });
});
