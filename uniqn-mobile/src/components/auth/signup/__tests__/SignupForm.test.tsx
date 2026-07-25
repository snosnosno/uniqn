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
  isIdentityVerificationInvalidError: jest.fn(() => false),
  loadSignupDraft: jest.fn(() => null),
  saveSignupDraft: jest.fn(),
}));

// mock 함수 참조 (모듈 스코프 spyOn 무력화 함정 회피 — jest.mock 팩토리 참조를 직접 사용)
const {
  clearSignupDraft: mockClearSignupDraft,
  isIdentityVerificationInvalidError: mockIsIdentityInvalid,
  loadSignupDraft: mockLoadSignupDraft,
} = jest.requireMock('@/services/auth');

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: undefined }),
}));

const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({ error: mockToastError, info: mockToastInfo }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/components/auth/StepIndicator', () => ({
  StepIndicator: () => null,
}));

jest.mock('react-native-keyboard-controller', () => ({
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
  const { Pressable, Text, View } = require('react-native');
  return {
    SignupStepIdentity: ({
      onNext,
      initialData,
    }: {
      onNext: (d: unknown) => void;
      initialData?: unknown;
    }) => (
      <View>
        {/* 만료 복귀 시 identity 초기화 검증용 마커 */}
        <Text testID="identity-initial">{initialData ? 'has-identity' : 'no-identity'}</Text>
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
      </View>
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

describe('SignupForm 본인인증 만료 복구 (2026-07-25)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** 약관 → 본인인증 → 계정 단계까지 진행시키는 헬퍼 */
  async function advanceToAccountStep(getByTestId: (id: string) => unknown) {
    fireEvent.press(getByTestId('terms-next') as never);
    fireEvent.press(getByTestId('identity-next') as never);
    await waitFor(() => {
      expect(getByTestId('account-next')).toBeTruthy();
    });
  }

  it('제출이 본인인증 만료 에러로 실패하면 identity 를 폐기하고 본인인증 단계로 복귀한다', async () => {
    mockIsIdentityInvalid.mockReturnValue(true);
    const onSubmit = jest.fn().mockRejectedValue(new Error('IV_TIMESTAMP_EXPIRED'));
    const { getByTestId } = render(<SignupForm onSubmit={onSubmit} mode="default" />);

    await advanceToAccountStep(getByTestId);
    fireEvent.press(getByTestId('account-next'));

    // 본인인증 단계로 자동 복귀 + 만료된 identity 초기화 (재인증 유도)
    await waitFor(() => {
      expect(getByTestId('identity-next')).toBeTruthy();
    });
    expect(getByTestId('identity-initial').props.children).toBe('no-identity');
    // 실패했으므로 draft 는 보존 (성공 시에만 clear)
    expect(mockClearSignupDraft).not.toHaveBeenCalled();
  });

  it('social 모드: 제출이 본인인증 만료 에러로 실패하면 identity 만 폐기한다 (리뷰 M1)', async () => {
    mockIsIdentityInvalid.mockReturnValue(true);
    const onSubmit = jest.fn().mockRejectedValue(new Error('IV_TIMESTAMP_EXPIRED'));
    const { getByTestId } = render(<SignupForm onSubmit={onSubmit} mode="social" />);

    fireEvent.press(getByTestId('terms-next'));
    fireEvent.press(getByTestId('identity-next'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    // "완료 카드 + 만료 toast" 모순 방지 — identity 초기화로 시작 버튼 상태 복귀
    expect(getByTestId('identity-initial').props.children).toBe('no-identity');
    expect(mockClearSignupDraft).not.toHaveBeenCalled();
  });

  it('제출이 일반 에러로 실패하면 계정 단계에 머물고 draft 를 지우지 않는다', async () => {
    mockIsIdentityInvalid.mockReturnValue(false);
    const onSubmit = jest.fn().mockRejectedValue(new Error('network')); // signup.tsx 가 toast 후 rethrow 한 상황
    const { getByTestId } = render(<SignupForm onSubmit={onSubmit} mode="default" />);

    await advanceToAccountStep(getByTestId);
    fireEvent.press(getByTestId('account-next'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    // 계정 단계 유지 + draft 보존
    expect(getByTestId('account-next')).toBeTruthy();
    expect(mockClearSignupDraft).not.toHaveBeenCalled();
  });
});

describe('SignupForm draft 복원 신선도 게이트 (2026-07-25)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseDraft = {
    version: 1,
    mode: 'default' as const,
    formData: {
      terms: {
        termsAgreed: true,
        privacyAgreed: true,
        thirdPartyAgreed: true,
        marketingAgreed: false,
      },
      accountEmail: 'saved@example.com',
      identity: {
        name: '홍길동',
        birthDate: '19900101',
        phoneVerified: true,
        verifiedPhone: '01012345678',
        identityVerificationId: 'iv-restored',
      },
    },
  };

  it('savedAt 이 5분을 넘긴 draft 는 identity 를 폐기하고 본인인증 단계로 복원한다', async () => {
    mockLoadSignupDraft.mockReturnValue({
      ...baseDraft,
      stepIndex: 2, // 계정 단계에서 이탈했던 draft
      savedAt: Date.now() - 6 * 60 * 1000, // 6분 전 — 서버 가드(5분) 초과
    });
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, queryByTestId } = render(
      <SignupForm onSubmit={onSubmit} mode="default" />
    );

    // 계정 단계가 아니라 본인인증 단계로 복원 + identity 초기화
    await waitFor(() => {
      expect(getByTestId('identity-next')).toBeTruthy();
    });
    expect(queryByTestId('account-next')).toBeNull();
    expect(getByTestId('identity-initial').props.children).toBe('no-identity');
    // 리뷰 L1: 무통보 폐기 방지 — 재인증 필요 안내 toast
    expect(mockToastInfo).toHaveBeenCalledWith('본인인증 유효시간이 지나 다시 인증이 필요해요.');
  });

  it('savedAt 이 5분 이내인 draft 는 identity 를 보존하고 계정 단계로 복원한다', async () => {
    mockLoadSignupDraft.mockReturnValue({
      ...baseDraft,
      stepIndex: 2,
      savedAt: Date.now() - 60 * 1000, // 1분 전 — 신선
    });
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(<SignupForm onSubmit={onSubmit} mode="default" />);

    await waitFor(() => {
      expect(getByTestId('account-next')).toBeTruthy();
    });
  });
});
