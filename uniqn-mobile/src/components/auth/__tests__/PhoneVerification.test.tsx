import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PhoneVerification } from '@/components/auth/PhoneVerification';

jest.mock('@/hooks/auth/useRecaptcha', () => ({
  useRecaptcha: jest.fn(() => ({
    recaptchaKey: 0,
    getOrCreateVerifier: jest.fn(),
    cleanupOnError: jest.fn(),
  })),
}));

jest.mock('@/hooks/auth/usePhoneSMS', () => ({
  usePhoneSMS: jest.fn(),
}));

jest.mock('@/hooks/auth/useOTPVerification', () => ({
  useOTPVerification: jest.fn(),
}));

const mockPhoneSmsState = {
  phone: '010-1234-5678',
  setPhone: jest.fn(),
  handlePhoneChange: jest.fn(),
  isRequesting: false,
  error: null as string | null,
  setError: jest.fn((value: string | null) => {
    mockPhoneSmsState.error = value;
  }),
  confirmation: null,
  verificationIdRef: { current: null as string | null },
  phoneListenerSettledRef: { current: null },
  phoneListenerRef: { current: null },
  requestedModeRef: { current: 'signIn' as const },
  requestSMS: jest.fn(),
  resetState: jest.fn(),
};

const mockOtpState = {
  otpCode: '123456',
  setOtpCode: jest.fn((value: string) => {
    mockOtpState.otpCode = value;
  }),
  otpAttempts: 0,
  isVerifying: false,
  error: null as string | null,
  setError: jest.fn((value: string | null) => {
    mockOtpState.error = value;
  }),
  confirmOTP: jest.fn(),
  resetOTP: jest.fn(() => {
    mockOtpState.otpCode = '';
    mockOtpState.error = null;
  }),
};

describe('PhoneVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockPhoneSmsState.error = null;
    mockPhoneSmsState.isRequesting = false;
    mockPhoneSmsState.requestSMS = jest
      .fn()
      .mockResolvedValueOnce('otp')
      .mockImplementationOnce(async () => {
        mockPhoneSmsState.error = '인증번호 재발송에 실패했습니다.';
        return null;
      });

    mockPhoneSmsState.resetState = jest.fn();
    mockOtpState.otpCode = '123456';
    mockOtpState.error = null;
    mockOtpState.confirmOTP = jest.fn();
    mockOtpState.resetOTP = jest.fn(() => {
      mockOtpState.otpCode = '';
      mockOtpState.error = null;
    });

    const { usePhoneSMS } = jest.requireMock('@/hooks/auth/usePhoneSMS') as {
      usePhoneSMS: jest.Mock;
    };
    const { useOTPVerification } = jest.requireMock('@/hooks/auth/useOTPVerification') as {
      useOTPVerification: jest.Mock;
    };

    usePhoneSMS.mockImplementation(() => mockPhoneSmsState);
    useOTPVerification.mockImplementation(() => mockOtpState);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears stale OTP errors before resend so the latest SMS error is shown', async () => {
    const onVerified = jest.fn();
    const { getByText, rerender } = render(<PhoneVerification onVerified={onVerified} compact />);

    await act(async () => {
      fireEvent.press(getByText('인증요청'));
    });

    mockOtpState.error =
      '인증번호가 만료되었거나 새 번호가 발급되었습니다. 인증번호를 다시 요청해 주세요.';
    mockOtpState.setError.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    rerender(<PhoneVerification onVerified={jest.fn()} compact />);

    await act(async () => {
      fireEvent.press(getByText('재발송'));
    });

    expect(mockOtpState.setError).toHaveBeenCalledWith(null);

    rerender(<PhoneVerification onVerified={jest.fn()} compact />);

    expect(mockOtpState.error).toBeNull();
    expect(getByText('인증번호 재발송에 실패했습니다.')).toBeTruthy();
  });
});
