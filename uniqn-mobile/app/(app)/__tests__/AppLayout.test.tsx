import React from 'react';
import { render } from '@testing-library/react-native';
import AppLayout from '../_layout';

let mockIsWeb = true;
const mockOnboardingState = {
  needsNotificationOnboarding: true,
  completeNotificationOnboarding: jest.fn(),
  isLoading: false,
};
const mockNotificationHandlerState = {
  isInitialized: false,
  requestPermission: jest.fn(),
  openSettings: jest.fn(),
  permissionStatus: null as 'granted' | 'denied' | 'undetermined' | null,
  isRequestingPermission: false,
};

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
  useOnboarding: () => mockOnboardingState,
}));

jest.mock('@/hooks/useNotificationHandler', () => ({
  useNotificationHandler: () => mockNotificationHandlerState,
}));

jest.mock('@/shared/navigation/authRedirect', () => ({
  AUTH_ENTRY_ROUTES: {
    appTabs: 'appTabs',
    appHome: 'appHome',
  },
  getAuthenticatedEntryRoute: () => 'appHome',
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
  get isWeb() {
    return mockIsWeb;
  },
}));

describe('AppLayout notification onboarding', () => {
  beforeEach(() => {
    mockIsWeb = true;
    mockOnboardingState.needsNotificationOnboarding = true;
    mockOnboardingState.isLoading = false;
    mockNotificationHandlerState.isInitialized = false;
    mockNotificationHandlerState.permissionStatus = null;
    mockNotificationHandlerState.isRequestingPermission = false;
  });

  it('does not show the notification onboarding on web', () => {
    const { queryByText } = render(<AppLayout />);

    expect(queryByText('notification-screen')).toBeNull();
  });

  it('does not show the notification onboarding before native permission state resolves', () => {
    mockIsWeb = false;
    mockNotificationHandlerState.isInitialized = false;
    mockNotificationHandlerState.permissionStatus = null;

    const { queryByText } = render(<AppLayout />);

    expect(queryByText('notification-screen')).toBeNull();
  });

  it('shows the notification onboarding once native permission state is known', () => {
    mockIsWeb = false;
    mockNotificationHandlerState.isInitialized = true;
    mockNotificationHandlerState.permissionStatus = 'denied';

    const { getByText } = render(<AppLayout />);

    expect(getByText('notification-screen')).toBeTruthy();
  });
});
