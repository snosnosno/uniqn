/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * 회귀 테스트 — 회원가입 헤더 뒤로가기 폴백
 *
 * 버그: 웹 URL 직접 진입(localhost:8081/signup)·딥링크·콜드스타트로 signup 이
 * 네비게이션 스택의 첫 화면이면 router.back() 의 GO_BACK 이 미처리로 무시되어
 * 헤더 뒤로가기 버튼이 죽은 것처럼 보였다.
 * 수정: canGoBack() 이 false 이면 로그인 화면으로 replace 폴백.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn(),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/auth', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SignupForm: () => <View testID="signup-form" />,
  };
});

jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
}));

jest.mock('@/lib/autoLoginSession', () => ({
  markCurrentAutoLoginSession: jest.fn(),
}));

jest.mock('@/services', () => ({
  signUp: jest.fn(),
  completeSocialProfile: jest.fn(),
  getCurrentUserAsync: jest.fn(),
  callReverifyIdentity: jest.fn(),
  getUserProfile: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    addToast: jest.fn(),
    clearAllToasts: jest.fn(),
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    setUser: jest.fn(),
    setProfile: jest.fn(),
  }),
}));

jest.mock('@/shared/navigation/authRedirect', () => ({
  getResolvedAuthenticatedRoute: jest.fn(() => '/(app)'),
  normalizePostAuthRedirect: jest.fn((redirect?: string) => redirect ?? null),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/profileConverter', () => ({
  toStoreProfile: jest.fn((p) => p),
}));

jest.mock('@/errors', () => ({
  extractUserMessage: jest.fn((_e) => '오류'),
  isAppError: jest.fn(() => false),
}));

describe('SignUpScreen 헤더 뒤로가기 (default 모드)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockCanGoBack.mockReturnValue(true);
  });

  it('스택에 돌아갈 화면이 있으면 router.back() 을 호출한다', () => {
    mockCanGoBack.mockReturnValue(true);
    const SignUpScreen = require('../signup').default as React.ComponentType;
    const { getByLabelText } = render(<SignUpScreen />);

    fireEvent.press(getByLabelText('뒤로가기'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('스택이 비어 있으면(canGoBack=false) 로그인으로 replace 폴백한다', () => {
    mockCanGoBack.mockReturnValue(false);
    const SignUpScreen = require('../signup').default as React.ComponentType;
    const { getByLabelText } = render(<SignUpScreen />);

    fireEvent.press(getByLabelText('뒤로가기'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('redirect 파라미터가 있으면 replace 폴백에 보존한다', () => {
    mockCanGoBack.mockReturnValue(false);
    mockSearchParams = { redirect: '/jobs/123' };
    const SignUpScreen = require('../signup').default as React.ComponentType;
    const { getByLabelText } = render(<SignUpScreen />);

    fireEvent.press(getByLabelText('뒤로가기'));

    expect(mockReplace).toHaveBeenCalledWith(
      `/(auth)/login?redirect=${encodeURIComponent('/jobs/123')}`
    );
  });
});
