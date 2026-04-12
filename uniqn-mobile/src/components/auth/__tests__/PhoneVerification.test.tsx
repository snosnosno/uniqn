import React from 'react';
import { render } from '@testing-library/react-native';
import { PhoneVerification } from '@/components/auth/PhoneVerification';

// useRecaptcha and usePhoneSMS are now inline stubs in PhoneVerification.tsx
// No external module mock needed

jest.mock('@/hooks/auth/useOTPVerification', () => ({
  useOTPVerification: jest.fn(),
}));

// usePhoneSMS is now inline in PhoneVerification.tsx, stub file exists for test mocking
jest.mock('@/hooks/auth/usePhoneSMS', () => ({
  usePhoneSMS: jest.fn(),
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

  it('renders initial input step with request button', () => {
    const onVerified = jest.fn();
    const { getByText } = render(<PhoneVerification onVerified={onVerified} compact />);

    // usePhoneSMS is now an inline stub (deprecated), so the component renders
    // in the initial 'input' step with the '인증요청' button visible.
    expect(getByText('인증요청')).toBeTruthy();
  });
});
