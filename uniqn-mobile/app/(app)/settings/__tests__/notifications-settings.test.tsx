import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import NotificationSettingsScreen from '../notifications';
import { NOTIFICATION_CATEGORY_LABELS, NotificationCategory } from '@/types/notification';

// 알림 설정 전용 화면 — 마스터/카테고리 토글·마케팅 수신·권한 배너 렌더 검증

const mockCheckPermission = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/ui', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Divider: () => null,
  };
});

jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/components/settings', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    SettingItem: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});
jest.mock('@/components/icons', () => ({
  BellIcon: () => null,
  BellSlashIcon: () => null,
  ChevronRightIcon: () => null,
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    profile: { marketingAgreed: false },
    user: { uid: 'user-1' },
  }),
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { setProfile: () => void }) => unknown) =>
    selector({ setProfile: jest.fn() }),
}));
jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: () => void }) => unknown) =>
    selector({ addToast: jest.fn() }),
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotificationSettingsQuery: () => ({ data: undefined }),
  useSaveNotificationSettings: () => ({ saveSettings: jest.fn(), isSaving: false }),
}));

jest.mock('@/services/notifications/pushNotificationService', () => ({
  pushNotificationService: {
    checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
    requestPermission: jest.fn().mockResolvedValue({ status: 'granted' }),
  },
}));

jest.mock('@/services/auth', () => ({
  updateMarketingConsent: jest.fn(),
}));

describe('알림 설정 화면', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckPermission.mockResolvedValue({ status: 'granted' });
  });

  it('푸시 마스터 토글·카테고리 6종·마케팅 수신 행이 렌더된다', async () => {
    const { queryByText, findAllByText } = render(<NotificationSettingsScreen />);

    // '푸시 알림'은 섹션 헤더와 마스터 토글 라벨 두 곳에 존재한다
    expect(await findAllByText('푸시 알림')).toHaveLength(2);
    expect(queryByText('마케팅 정보 수신')).not.toBeNull();

    // admin 제외 6개 카테고리 라벨
    const categories = [
      NotificationCategory.APPLICATION,
      NotificationCategory.ATTENDANCE,
      NotificationCategory.SETTLEMENT,
      NotificationCategory.JOB,
      NotificationCategory.REVIEW,
      NotificationCategory.SYSTEM,
    ];
    for (const category of categories) {
      expect(queryByText(NOTIFICATION_CATEGORY_LABELS[category])).not.toBeNull();
    }
    // admin 카테고리는 노출하지 않는다
    expect(queryByText(NOTIFICATION_CATEGORY_LABELS[NotificationCategory.ADMIN])).toBeNull();
  });

  it('권한이 거부된 경우 설정 유도 배너가 렌더된다', async () => {
    mockCheckPermission.mockResolvedValue({ status: 'denied' });

    const { queryByText } = render(<NotificationSettingsScreen />);

    await waitFor(() => {
      expect(
        queryByText('알림 권한이 거부되었습니다. 탭하여 설정에서 허용해주세요.')
      ).not.toBeNull();
    });
  });
});
