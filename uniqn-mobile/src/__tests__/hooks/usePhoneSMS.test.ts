import { act, renderHook } from '@testing-library/react-native';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { usePhoneSMS } from '@/hooks/auth/usePhoneSMS';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  getNativeAuth,
  nativeVerifyPhoneNumber,
  nativeSignInWithPhoneNumber,
} from '@/lib/nativeAuth';
import { checkPhoneExists } from '@/services/auth';

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('@/lib/nativeAuth', () => ({
  getNativeAuth: jest.fn(),
  nativeVerifyPhoneNumber: jest.fn(),
  nativeSignInWithPhoneNumber: jest.fn(),
}));

jest.mock('@/services/auth', () => ({
  checkPhoneExists: jest.fn(),
}));

jest.mock('@/components/auth/phoneAuthErrors', () => ({
  getFirebasePhoneAuthErrorMessage: jest.fn(() => 'SMS 인증 요청에 실패했습니다.'),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type NativeAuthGetter = NonNullable<typeof getNativeAuth>;
type NativeVerifyPhoneNumber = NonNullable<typeof nativeVerifyPhoneNumber>;
type NativeSignInWithPhoneNumber = NonNullable<typeof nativeSignInWithPhoneNumber>;
type PhoneAuthListener = ReturnType<NativeVerifyPhoneNumber>;
type PhoneAuthListenerWithCleanup = PhoneAuthListener & {
  _removeAllListeners: jest.Mock<void, [], unknown>;
};

function createPhoneAuthListener(): {
  listener: PhoneAuthListenerWithCleanup;
  removeInternalListeners: jest.Mock<void, [], unknown>;
} {
  const removeInternalListeners = jest.fn<void, [], unknown>();
  const listener = {
    _removeAllListeners: removeInternalListeners,
    on: jest.fn(
      (_event: string, observer: (snapshot: FirebaseAuthTypes.PhoneAuthSnapshot) => void) => {
        observer({
          state: 'sent',
          verificationId: 'verification-id',
          code: null,
          error: null,
        });
        return listener;
      }
    ),
    then: jest.fn(),
    catch: jest.fn(),
  } as unknown as PhoneAuthListenerWithCleanup;

  return { listener, removeInternalListeners };
}

describe('usePhoneSMS', () => {
  const mockGetFirebaseAuth = getFirebaseAuth as jest.MockedFunction<typeof getFirebaseAuth>;
  const mockGetNativeAuth = getNativeAuth as jest.MockedFunction<NativeAuthGetter>;
  const mockNativeVerifyPhoneNumber =
    nativeVerifyPhoneNumber as jest.MockedFunction<NativeVerifyPhoneNumber>;
  const mockNativeSignInWithPhoneNumber =
    nativeSignInWithPhoneNumber as jest.MockedFunction<NativeSignInWithPhoneNumber>;
  const mockCheckPhoneExists = checkPhoneExists as jest.MockedFunction<typeof checkPhoneExists>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetFirebaseAuth.mockReturnValue({
      currentUser: { uid: 'user-1' },
    } as ReturnType<typeof getFirebaseAuth>);

    mockGetNativeAuth.mockReturnValue({} as ReturnType<NativeAuthGetter>);
    mockCheckPhoneExists.mockResolvedValue(false);
    mockNativeSignInWithPhoneNumber.mockResolvedValue(
      {} as Awaited<ReturnType<NativeSignInWithPhoneNumber>>
    );
  });

  it('cleans up link-mode PhoneAuthListener via _removeAllListeners after SMS send', async () => {
    const { listener, removeInternalListeners } = createPhoneAuthListener();

    mockNativeVerifyPhoneNumber.mockReturnValue(listener);

    const { result } = renderHook(() =>
      usePhoneSMS({
        mode: 'link',
        getOrCreateVerifier: jest.fn(),
        cleanupOnError: jest.fn(),
        onError: jest.fn(),
      })
    );

    act(() => {
      result.current.setPhone('01012345678');
    });

    let requestResult: Awaited<ReturnType<typeof result.current.requestSMS>> | undefined;

    await act(async () => {
      requestResult = await result.current.requestSMS(jest.fn());
    });

    expect(requestResult).toBe('otp');
    expect(listener.on).toHaveBeenCalledWith(
      'state_changed',
      expect.any(Function),
      expect.any(Function)
    );
    expect(removeInternalListeners).toHaveBeenCalledTimes(1);
    expect(result.current.verificationIdRef.current).toBe('verification-id');
  });

  it('reuses the same safe cleanup path during resetState', async () => {
    const { listener, removeInternalListeners } = createPhoneAuthListener();

    mockNativeVerifyPhoneNumber.mockReturnValue(listener);

    const { result } = renderHook(() =>
      usePhoneSMS({
        mode: 'link',
        getOrCreateVerifier: jest.fn(),
        cleanupOnError: jest.fn(),
      })
    );

    act(() => {
      result.current.setPhone('01012345678');
    });

    await act(async () => {
      await result.current.requestSMS(jest.fn());
    });

    act(() => {
      result.current.resetState();
    });

    expect(removeInternalListeners).toHaveBeenCalledTimes(2);
    expect(result.current.phoneListenerRef.current).toBeNull();
    expect(result.current.verificationIdRef.current).toBeNull();
  });
});
