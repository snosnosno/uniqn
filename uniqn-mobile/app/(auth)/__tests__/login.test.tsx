/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

let mockLastSocialLoginButtonsProps: Record<string, unknown> | null = null;

const mockGetAppleLoginAvailability = jest.fn();
const mockLogin = jest.fn();
const mockSignInWithApple = jest.fn();
const mockAddToast = jest.fn();
const mockSetUser = jest.fn();
const mockSetProfile = jest.fn();
const mockSetAutoLoginEnabled = jest.fn();
const mockLoginWithBiometric = jest.fn();
const mockUpdateBiometricCredentials = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    Divider: ({ label }: { label?: string }) =>
      label ? <Text accessibilityRole="text">{label}</Text> : <View />,
  };
});

jest.mock('@/components/auth', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    BiometricButton: () => null,
    LoginForm: () => <View testID="login-form" />,
    SocialLoginButtons: (props: Record<string, unknown>) => {
      mockLastSocialLoginButtonsProps = props;

      return (
        <View testID="social-login-buttons">
          {props.availabilityMessage ? <Text>{String(props.availabilityMessage)}</Text> : null}
        </View>
      );
    },
  };
});

jest.mock('@/hooks', () => ({
  AUTO_LOGIN_HELPER_TEXT: 'Auto login helper text',
  useAutoLogin: () => ({
    autoLoginEnabled: true,
    setAutoLoginEnabled: mockSetAutoLoginEnabled,
  }),
  useBiometricAuth: () => ({
    isEnabled: false,
    isAvailable: false,
    isAuthenticating: false,
    biometricTypeName: 'Face ID',
    loginWithBiometric: mockLoginWithBiometric,
    updateCredentials: mockUpdateBiometricCredentials,
  }),
}));

const mockUseAuthStore = Object.assign(
  jest.fn(() => ({
    setUser: mockSetUser,
    setProfile: mockSetProfile,
  })),
  {
    getState: jest.fn(() => ({
      profile: null,
      setUser: mockSetUser,
      setProfile: mockSetProfile,
    })),
  }
);

jest.mock('@/stores/authStore', () => ({
  useAuthStore: mockUseAuthStore,
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    addToast: mockAddToast,
  }),
}));

jest.mock('@/lib/autoLoginSession', () => ({
  markCurrentAutoLoginSession: jest.fn(),
}));

jest.mock('@/services', () => ({
  getAppleLoginAvailability: (...args: unknown[]) => mockGetAppleLoginAvailability(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  signInWithApple: (...args: unknown[]) => mockSignInWithApple(...args),
}));

jest.mock('@/shared/errors', () => ({
  extractErrorMessage: jest.fn((_error, fallback) => fallback),
}));

jest.mock('@/shared/navigation/authRedirect', () => ({
  getResolvedAuthenticatedRoute: jest.fn(() => '/(app)'),
  normalizePostAuthRedirect: jest.fn(() => undefined),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/utils/profileConverter', () => ({
  toStoreProfile: jest.fn((profile) => profile),
}));

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('LoginScreen Apple login visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastSocialLoginButtonsProps = null;
    setPlatformOS('ios');
    mockGetAppleLoginAvailability.mockResolvedValue({ enabled: true });
    mockUpdateBiometricCredentials.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('renders the Apple login section when Apple login is available on iOS', async () => {
    const LoginScreen = require('../login').default as React.ComponentType;
    const { getByTestId } = render(<LoginScreen />);

    await waitFor(() => {
      expect(mockGetAppleLoginAvailability).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId('social-login-buttons')).toBeTruthy();
    expect(mockLastSocialLoginButtonsProps).toMatchObject({
      isAppleAvailable: true,
    });
  });

  it('keeps the Apple section visible with an availability message when the device cannot use Apple login', async () => {
    mockGetAppleLoginAvailability.mockResolvedValue({
      enabled: false,
      reason: 'unavailable',
    });

    const LoginScreen = require('../login').default as React.ComponentType;
    const { getByTestId, getByText } = render(<LoginScreen />);

    await waitFor(() => {
      expect(mockLastSocialLoginButtonsProps).toMatchObject({
        isAppleAvailable: false,
      });
    });

    expect(getByTestId('social-login-buttons')).toBeTruthy();
    expect(getByText(/Apple 로그인/)).toBeTruthy();
  });

  it('hides the Apple login section when the feature flag disables it', async () => {
    mockGetAppleLoginAvailability.mockResolvedValue({
      enabled: false,
      reason: 'disabled_by_flag',
    });

    const LoginScreen = require('../login').default as React.ComponentType;
    const { queryByTestId } = render(<LoginScreen />);

    await waitFor(() => {
      expect(mockGetAppleLoginAvailability).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(queryByTestId('social-login-buttons')).toBeNull();
    });
  });
});
