import React from 'react';
import { render } from '@testing-library/react-native';
import AppLayout from '../_layout';

jest.mock('expo-router', () => ({
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
  useSegments: () => [],
}));

jest.mock('@/components/onboarding', () => ({
  NotificationPermissionScreen: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.Text>notification-screen</ReactNative.Text>;
  },
}));

jest.mock('@/components/ui', () => ({
  NetworkErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  Loading: () => null,
}));

jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    needsNotificationOnboarding: true,
    completeNotificationOnboarding: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useNotificationHandler', () => ({
  useNotificationHandler: () => ({
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
    permissionStatus: null,
    isRequestingPermission: false,
  }),
}));

jest.mock('@/shared/navigation/authRedirect', () => ({
  AUTH_ENTRY_ROUTES: {
    appTabs: 'appTabs',
  },
  getAuthenticatedEntryRoute: () => 'appTabs',
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isLoading: false,
    profile: {
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    },
  }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/utils/platform', () => ({
  isWeb: true,
}));

describe('AppLayout notification onboarding', () => {
  it('does not show the notification onboarding on web', () => {
    const { queryByText } = render(<AppLayout />);

    expect(queryByText('notification-screen')).toBeNull();
  });
});
