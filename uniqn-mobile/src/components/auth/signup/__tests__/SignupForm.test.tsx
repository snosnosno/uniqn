/**
 * SignupForm 순서 재설계 회귀 테스트 (2026-07-25)
 *
 * default 모드 단계 순서를 약관 → 본인인증 → 계정으로 바꾸고, 최종 제출(onSubmit)을
 * 마지막 account 단계로 옮긴 변경을 고정한다. 이전(계정 → 본인인증)에서는 본인인증
 * 완료 후에야 이메일 중복이 확정돼 orphan 계정이 남는 문제가 있었다.
 *
 * 하위 step 컴포넌트는 onNext 를 즉시 호출하는 버튼으로 mock 하여 순서 로직만 검증한다.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { SignupForm } from '../SignupForm';

jest.mock('@/services/auth', () => ({
  clearSignupDraft: jest.fn(),
  loadSignupDraft: jest.fn(() => null),
  saveSignupDraft: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: undefined }),
}));

const mockToastError = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({ error: mockToastError }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/components/auth/StepIndicator', () => ({
  StepIndicator: () => null,
}));

jest.mock('react-native-keyboard-aware-scroll-view', () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    FadeInRight: { duration: () => ({ springify: () => ({}) }) },
  };
});

jest.mock('../SignupStepTerms', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SignupStepTerms: ({ onNext }: { onNext: (d: unknown) => void }) => (
      <Pressable
        testID="terms-next"
        onPress={() =>
          onNext({
            termsAgreed: true,
            privacyAgreed: true,
            thirdPartyAgreed: true,
            marketingAgreed: false,
          })
        }
      >
        <Text>terms</Text>
      </Pressable>
    ),
  };
});

jest.mock('../SignupStepIdentity', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SignupStepIdentity: ({ onNext }: { onNext: (d: unknown) => void }) => (
      <Pressable
        testID="identity-next"
        onPress={() =>
          onNext({
            name: '홍길동',
            birthDate: '1990-01-01',
            gender: 'male',
            phoneVerified: true,
            verifiedPhone: '01012345678',
            identityVerificationId: 'iv-1',
          })
        }
      >
        <Text>identity</Text>
      </Pressable>
    ),
  };
});

jest.mock('../SignupStepAccount', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SignupStepAccount: ({ onNext }: { onNext: (d: unknown) => void }) => (
      <Pressable
        testID="account-next"
        onPress={() =>
          onNext({
            email: 'new@example.com',
            password: 'Password1!',
            passwordConfirm: 'Password1!',
          })
        }
      >
        <Text>account</Text>
      </Pressable>
    ),
  };
});

describe('SignupForm default 순서 재설계', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('순서가 약관 → 본인인증 → 계정이고, 최종 제출은 마지막 계정 단계에서 일어난다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(<SignupForm onSubmit={onSubmit} mode="default" />);

    // 1단계: 약관
    fireEvent.press(getByTestId('terms-next'));

    // 2단계: 본인인증 (계정이 아니라 본인인증이 먼저 와야 한다)
    expect(getByTestId('identity-next')).toBeTruthy();
    fireEvent.press(getByTestId('identity-next'));

    // 본인인증 완료 시점에는 아직 제출되지 않는다 (계정이 최종 단계)
    expect(onSubmit).not.toHaveBeenCalled();

    // 3단계: 계정 — 여기서 최종 제출
    expect(getByTestId('account-next')).toBeTruthy();
    fireEvent.press(getByTestId('account-next'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    // 제출 데이터는 계정(이메일/비번) + 본인인증 + 약관 조합
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        password: 'Password1!',
        name: '홍길동',
        identityVerificationId: 'iv-1',
        phoneVerified: true,
        termsAgreed: true,
      })
    );
  });

  it('social 모드는 본인인증이 최종 단계 — 계정 단계 없이 identity 에서 제출한다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, queryByTestId } = render(<SignupForm onSubmit={onSubmit} mode="social" />);

    fireEvent.press(getByTestId('terms-next'));
    // social flow = [terms, identity] — account 단계가 존재하지 않음
    expect(queryByTestId('account-next')).toBeNull();
    fireEvent.press(getByTestId('identity-next'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: '', identityVerificationId: 'iv-1' })
    );
  });
});
