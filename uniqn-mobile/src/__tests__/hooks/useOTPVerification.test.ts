import { act, renderHook } from '@testing-library/react-native';
import { useOTPVerification } from '@/hooks/auth/useOTPVerification';
import { checkPhoneExists } from '@/services/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';

jest.mock('@/services/auth', () => ({
  checkPhoneExists: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@/lib/nativeAuth', () => ({
  getNativeAuth: jest.fn(() => ({ currentUser: null })),
}));

const mockMemoryStorage = new Map<string, string>();

jest.mock('@/lib/mmkvStorage', () => ({
  getMMKVInstance: jest.fn(() => ({
    getString: (key: string) => mockMemoryStorage.get(key),
    set: (key: string, value: string) => mockMemoryStorage.set(key, value),
    delete: (key: string) => mockMemoryStorage.delete(key),
    contains: (key: string) => mockMemoryStorage.has(key),
    getAllKeys: () => Array.from(mockMemoryStorage.keys()),
    clearAll: () => mockMemoryStorage.clear(),
  })),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('useOTPVerification', () => {
  const mockCheckPhoneExists = checkPhoneExists as jest.MockedFunction<typeof checkPhoneExists>;
  const mockGetFirebaseAuth = getFirebaseAuth as jest.MockedFunction<typeof getFirebaseAuth>;
  const mockLoggerError = logger.error as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemoryStorage.clear();
    mockCheckPhoneExists.mockResolvedValue(false);
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    } as ReturnType<typeof getFirebaseAuth>);
  });

  it('treats an expired code as a resend flow instead of a failed attempt', async () => {
    const clearVerificationState = jest.fn();
    const onVerified = jest.fn();
    const onError = jest.fn();
    const confirmation = {
      confirm: jest.fn().mockRejectedValue({
        code: 'auth/session-expired',
        message: 'expired',
      }),
    };
    const verificationIdRef = { current: 'verification-id' };
    const requestedModeRef = { current: 'signIn' as const };

    const { result } = renderHook(() =>
      useOTPVerification({
        mode: 'signIn',
        confirmation,
        verificationIdRef,
        requestedModeRef,
        clearVerificationState,
        phone: '010-1234-5678',
        onVerified,
        onError,
      })
    );

    act(() => {
      result.current.setOtpCode('123456');
    });

    let confirmResult: Awaited<ReturnType<typeof result.current.confirmOTP>> | undefined;

    await act(async () => {
      confirmResult = await result.current.confirmOTP();
    });

    expect(confirmResult).toEqual({
      status: 'expired',
      message: '인증번호가 만료되었거나 새 번호가 발급되었습니다. 인증번호를 다시 요청해 주세요.',
      firebaseCode: 'auth/session-expired',
    });
    expect(result.current.error).toBe(
      '인증번호가 만료되었거나 새 번호가 발급되었습니다. 인증번호를 다시 요청해 주세요.'
    );
    expect(result.current.otpCode).toBe('');
    expect(result.current.otpAttempts).toBe(0);
    expect(clearVerificationState).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onVerified).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      'OTP 인증 세션 만료 - 재요청 필요',
      expect.any(Error),
      expect.objectContaining({
        mode: 'signIn',
        firebaseCode: 'auth/session-expired',
      })
    );
  });
});
