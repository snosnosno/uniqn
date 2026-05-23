/* eslint-disable @typescript-eslint/no-require-imports */

import { BusinessError, ERROR_CODES, NetworkError } from '@/errors';

const mockSignInWithCredential = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSyncSignOut = jest.fn();
const mockCreateOrMerge = jest.fn();
const mockGetUserProfile = jest.fn();
const mockSanitizeInput = jest.fn();
const mockTrackLogin = jest.fn();
const mockTrackSignup = jest.fn();
const mockSetUserId = jest.fn();
const mockSetUserProperties = jest.fn();
const mockRequestAppleAuthorization = jest.fn();
const mockWithTimeout = jest.fn();
const mockGetMMKVInstance = jest.fn();
const mockLeaveBreadcrumb = jest.fn();
const mockProtectAuthFlow = jest.fn();
const mockClearProtectedAuthFlow = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

const mockMmkv = {
  set: jest.fn(),
  getString: jest.fn(),
};

const mockAuthUser = {
  id: 'mock-user-id',
  uid: 'mock-user-id',
  email: 'apple@example.com',
  getIdToken: jest.fn<Promise<string>, [boolean?]>(),
};

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Appearance: { getColorScheme: jest.fn(() => 'light') },
}));

jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((arr: Uint8Array) => arr),
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: (...args: unknown[]) => mockSignInWithCredential(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
      signUp: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
      signOut: (...args: unknown[]) => mockSyncSignOut(...args),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUser: (...args: unknown[]) => mockUpdateProfile(...args),
    },
  },
}));

jest.mock('@/shared/auth/protectedAuthFlow', () => ({
  protectAuthFlow: (...args: unknown[]) => mockProtectAuthFlow(...args),
  clearProtectedAuthFlow: (...args: unknown[]) => mockClearProtectedAuthFlow(...args),
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    createOrMerge: (...args: unknown[]) => mockCreateOrMerge(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/observability/sentryService', () => ({
  sentryService: {
    leaveBreadcrumb: (...args: unknown[]) => mockLeaveBreadcrumb(...args),
  },
}));

jest.mock('@/utils/security', () => ({
  sanitizeInput: (...args: unknown[]) => mockSanitizeInput(...args),
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackLogin: (...args: unknown[]) => mockTrackLogin(...args),
  trackSignup: (...args: unknown[]) => mockTrackSignup(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

jest.mock('../userProfileService', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}));

jest.mock('../appleAuthService', () => ({
  requestAppleAuthorization: (...args: unknown[]) => mockRequestAppleAuthorization(...args),
}));

jest.mock('@/utils/timeout', () => ({
  withTimeout: (...args: unknown[]) => mockWithTimeout(...args),
}));

jest.mock('@/lib/mmkvStorage', () => ({
  getMMKVInstance: (...args: unknown[]) => mockGetMMKVInstance(...args),
}));

type SocialLoginServiceModule = typeof import('../socialLoginService');

function loadModule(): SocialLoginServiceModule {
  let moduleUnderTest: SocialLoginServiceModule | undefined;

  jest.isolateModules(() => {
    moduleUnderTest = require('../socialLoginService') as SocialLoginServiceModule;
  });

  return moduleUnderTest!;
}

describe('socialLoginService signInWithApple', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useRealTimers();

    (global as typeof global & { __DEV__?: boolean }).__DEV__ = false;

    mockSyncSignOut.mockResolvedValue(undefined);
    mockWithTimeout.mockImplementation((promise: Promise<unknown>) => promise);
    mockSanitizeInput.mockImplementation((value: string) => value);
    mockGetMMKVInstance.mockReturnValue(mockMmkv);
    mockMmkv.getString.mockReturnValue(undefined);
    mockAuthUser.getIdToken.mockResolvedValue('token');
    mockSignInWithCredential.mockResolvedValue({
      data: { user: mockAuthUser, session: { access_token: 'token' } },
      error: null,
    });
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: 'identity-token',
        user: 'apple-user',
        fullName: null,
      },
    });
    mockGetUserProfile.mockResolvedValue({
      uid: 'mock-user-id',
      email: 'apple@example.com',
      role: 'staff',
      socialProvider: 'apple',
      phoneVerified: true,
      isActive: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an existing verified Apple profile', async () => {
    const { signInWithApple } = loadModule();

    const result = await signInWithApple();

    expect(mockRequestAppleAuthorization).toHaveBeenCalledWith({
      requestedScopes: ['FULL_NAME', 'EMAIL'],
      operation: 'login',
    });
    expect(mockSignInWithCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'apple',
        token: 'identity-token',
        nonce: 'raw-nonce',
      })
    );
    expect(mockTrackLogin).toHaveBeenCalledWith('apple');
    expect(result.profile.phoneVerified).toBe(true);
  });

  it('returns an incomplete existing profile without recreating it', async () => {
    mockGetUserProfile.mockResolvedValue({
      uid: 'mock-user-id',
      email: 'apple@example.com',
      role: 'staff',
      socialProvider: 'apple',
      phoneVerified: false,
      isActive: true,
    });

    const { signInWithApple } = loadModule();

    const result = await signInWithApple();

    expect(result.profile.phoneVerified).toBe(false);
    expect(mockCreateOrMerge).not.toHaveBeenCalled();
    expect(mockTrackLogin).not.toHaveBeenCalled();
  });

  it('creates a minimal profile for a new Apple user', async () => {
    mockGetUserProfile.mockResolvedValue(null);

    const { signInWithApple } = loadModule();

    const result = await signInWithApple();

    expect(mockCreateOrMerge).toHaveBeenCalledWith(
      'mock-user-id',
      expect.objectContaining({
        uid: 'mock-user-id',
        email: 'apple@example.com',
        status: 'active',
        socialProvider: 'apple',
        phoneVerified: false,
        profileCompleted: false,
        isActive: true,
      })
    );
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  // 그룹 A: withTimeout 시퀀스 재매핑
  // sleep() 호출이 포함되어 있으므로 jest.useFakeTimers() + runAllTimersAsync()로 실제 대기 방지
  it('retries profile creation once after a timeout and completes the Apple login flow', async () => {
    jest.useFakeTimers();

    // 신규 유저: profile lookup → null, 1차 createOrMerge 타임아웃, verify 후 없음, 2차 createOrMerge 성공
    const timeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 후 프로필 생성이 지연되고 있습니다.',
    });

    mockGetUserProfile.mockResolvedValue(null);

    // withTimeout 호출 순서:
    // call 1: signInWithIdToken → 통과 (기본값)
    // call 2: getUserProfile (lookup) → null 반환
    // call 3: createOrMerge (1차) → 타임아웃 에러
    // call 4: getUserProfile (verify, 1회) → null
    // call 5: getUserProfile (verify, 2회) → null
    // call 6: createOrMerge (2차 재시도) → 성공
    mockWithTimeout
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 1: signInWithIdToken
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 2: getUserProfile lookup
      .mockImplementationOnce(() => Promise.reject(timeoutError)) // call 3: createOrMerge 타임아웃
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 4: verify getUserProfile 1회
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 5: verify getUserProfile 2회
      .mockImplementationOnce((promise: Promise<unknown>) => promise); // call 6: createOrMerge 재시도 성공

    const { signInWithApple } = loadModule();

    const signInPromise = signInWithApple();
    await Promise.resolve();
    await Promise.resolve();
    await jest.runAllTimersAsync();
    const result = await signInPromise;

    expect(mockCreateOrMerge).toHaveBeenCalledTimes(2);
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  it('continues the Apple login flow when the profile becomes visible after a timed out write', async () => {
    jest.useFakeTimers();

    // 신규 유저: 1차 createOrMerge 타임아웃 후 verify에서 프로필 발견 → 재시도 없이 계속
    const timeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 후 프로필 생성이 지연되고 있습니다.',
    });

    const resolvedProfile = {
      uid: 'mock-user-id',
      email: 'apple@example.com',
      role: 'staff' as const,
      socialProvider: 'apple',
      phoneVerified: false,
      isActive: true,
    };

    // call 1: signInWithIdToken → 통과
    // call 2: getUserProfile (lookup) → null (신규)
    // call 3: createOrMerge (1차) → 타임아웃
    // call 4: getUserProfile (verify, 1회) → 프로필 발견 → 재시도 불필요
    mockWithTimeout
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 1: signInWithIdToken
      .mockImplementationOnce(() => Promise.resolve(null)) // call 2: getUserProfile lookup → null
      .mockImplementationOnce(() => Promise.reject(timeoutError)) // call 3: createOrMerge 타임아웃
      .mockImplementationOnce(() => Promise.resolve(resolvedProfile)); // call 4: verify → 발견

    const { signInWithApple } = loadModule();

    const signInPromise = signInWithApple();
    await Promise.resolve();
    await Promise.resolve();
    await jest.runAllTimersAsync();
    const result = await signInPromise;

    // verify에서 프로필을 발견했으므로 createOrMerge는 1번만 시도
    expect(mockCreateOrMerge).toHaveBeenCalledTimes(1);
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  it('falls back to the social signup flow when profile creation keeps timing out', async () => {
    jest.useFakeTimers();

    // 신규 유저: 1차 타임아웃 → verify 실패 → 2차 타임아웃 → verify 실패 → protectAuthFlow 호출
    const timeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 후 프로필 생성이 지연되고 있습니다.',
    });

    // call 1: signInWithIdToken → 통과
    // call 2: getUserProfile (lookup) → null
    // call 3: createOrMerge (1차) → 타임아웃
    // call 4: getUserProfile (verify1, 1회) → null
    // call 5: getUserProfile (verify1, 2회) → null
    // call 6: createOrMerge (2차) → 타임아웃
    // call 7: getUserProfile (verify2, 1회) → null
    // call 8: getUserProfile (verify2, 2회) → null
    mockWithTimeout
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 1: signInWithIdToken
      .mockImplementationOnce(() => Promise.resolve(null)) // call 2: getUserProfile lookup → null
      .mockImplementationOnce(() => Promise.reject(timeoutError)) // call 3: createOrMerge 1차 타임아웃
      .mockImplementationOnce(() => Promise.resolve(null)) // call 4: verify1 attempt1 → null
      .mockImplementationOnce(() => Promise.resolve(null)) // call 5: verify1 attempt2 → null
      .mockImplementationOnce(() => Promise.reject(timeoutError)) // call 6: createOrMerge 2차 타임아웃
      .mockImplementationOnce(() => Promise.resolve(null)) // call 7: verify2 attempt1 → null
      .mockImplementationOnce(() => Promise.resolve(null)); // call 8: verify2 attempt2 → null

    const { signInWithApple } = loadModule();

    const signInPromise = signInWithApple();
    await Promise.resolve();
    await Promise.resolve();
    await jest.runAllTimersAsync();
    const result = await signInPromise;

    // 2번 createOrMerge 시도, 모두 타임아웃이지만 social_signup 보호 후 최소 프로필 반환
    expect(mockCreateOrMerge).toHaveBeenCalledTimes(2);
    expect(mockProtectAuthFlow).toHaveBeenCalledWith(
      'mock-user-id',
      'social_signup',
      expect.any(Number)
    );
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  // B-1 관측성: 프로필 DB 쓰기를 끝내 확인 못한 채 optimistic 반환하는 경로는
  // 확인된 경로와 구분되는 logger.warn 을 남겨 실제 빈도를 측정할 수 있어야 한다.
  it('warns that the profile write was unconfirmed when creation keeps timing out', async () => {
    jest.useFakeTimers();

    const timeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 후 프로필 생성이 지연되고 있습니다.',
    });

    mockWithTimeout
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // signInWithIdToken
      .mockImplementationOnce(() => Promise.resolve(null)) // lookup → null
      .mockImplementationOnce(() => Promise.reject(timeoutError)) // create 1차 타임아웃
      .mockImplementationOnce(() => Promise.resolve(null)) // verify1 attempt1
      .mockImplementationOnce(() => Promise.resolve(null)) // verify1 attempt2
      .mockImplementationOnce(() => Promise.reject(timeoutError)) // create 2차 타임아웃
      .mockImplementationOnce(() => Promise.resolve(null)) // verify2 attempt1
      .mockImplementationOnce(() => Promise.resolve(null)); // verify2 attempt2

    const { signInWithApple } = loadModule();

    const signInPromise = signInWithApple();
    await Promise.resolve();
    await Promise.resolve();
    await jest.runAllTimersAsync();
    await signInPromise;

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('미확인'),
      expect.objectContaining({ uid: 'mock-user-id' })
    );
  });

  it('does not warn when the new-user profile write is confirmed on first try', async () => {
    mockGetUserProfile.mockResolvedValue(null);

    const { signInWithApple } = loadModule();

    await signInWithApple();

    // 1차 createOrMerge 가 성공한 확인된 경로 → 미확인 warn 이 없어야 한다.
    expect(mockLoggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('미확인'),
      expect.anything()
    );
  });

  it('rethrows a cancel event without signing out', async () => {
    mockRequestAppleAuthorization.mockRejectedValue(
      new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '',
      })
    );

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toMatchObject({
      userMessage: '',
    });
    expect(mockSyncSignOut).not.toHaveBeenCalled();
  });

  it('keeps the invalid credential error when Apple does not return an identity token', async () => {
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: null,
        user: 'apple-user',
        fullName: null,
      },
    });

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  // 그룹 B: account-conflict 에러
  // Supabase는 별도 에러 코드로 분기하지 않고 AUTH_INVALID_CREDENTIALS로 통일
  it('maps Supabase user_already_exists error to AUTH_INVALID_CREDENTIALS', async () => {
    // Supabase signInWithIdToken이 error 필드에 account-conflict를 담아 반환
    mockSignInWithCredential.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'User already registered',
        code: 'user_already_exists',
        name: 'AuthApiError',
        status: 422,
      },
    });

    const { signInWithApple } = loadModule();

    const caughtError = await signInWithApple().catch((e: unknown) => e);

    expect(caughtError).toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('maps operation-not-allowed to an Apple-disabled auth error', async () => {
    jest.useFakeTimers();

    const disabledError = new Error('Provider disabled');
    (disabledError as { code?: string }).code = 'auth/operation-not-allowed';
    mockSignInWithCredential.mockRejectedValue(disabledError);

    const { signInWithApple } = loadModule();

    // Attach rejection handler immediately to avoid unhandled rejection
    const signInPromise = signInWithApple().catch((error: unknown) => error);

    // Let microtasks settle + advance past retry delay
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);

    const caughtError = await signInPromise;

    expect(caughtError).toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  // 그룹 C: jest.isolateModules 경계를 넘는 에러 검증
  //
  // isolateModules 환경에서 모듈별로 클래스 인스턴스가 달라 instanceof가 실패할 수 있음.
  // isAppError는 __isAppError 브랜드 속성(=true)으로도 판별하므로,
  // 테스트 파일의 import에서 직접 생성한 NetworkError는 __isAppError 브랜드가 붙어
  // 프로덕션의 isAppError(error) → true → 그대로 rethrow됨.
  // 검증은 __isAppError, code, category 등 에러 프로퍼티 기반으로 수행.
  it('retries once after a Supabase timeout and preserves the network error', async () => {
    jest.useFakeTimers();

    const networkTimeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 서버 인증이 지연되고 있습니다.',
    });

    // withTimeout이 signInWithIdToken을 두 번 모두 NetworkError로 reject
    mockWithTimeout
      .mockImplementationOnce(() => Promise.reject(networkTimeoutError)) // call 1: 1차 시도
      .mockImplementationOnce(() => Promise.reject(networkTimeoutError)); // call 2: 재시도

    const { signInWithApple } = loadModule();

    const signInPromise = signInWithApple().catch((e: unknown) => e);

    // 재시도 딜레이(1초) 통과
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1500);

    const caughtError = await signInPromise;

    // NetworkError(__isAppError=true) → isAppError 통과 → 그대로 rethrow
    expect(caughtError).toMatchObject({
      __isAppError: true,
      code: ERROR_CODES.NETWORK_TIMEOUT,
      category: 'network',
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces a timed out profile lookup instead of hanging', async () => {
    // signInWithIdToken 성공 후 profile lookup withTimeout이 NetworkError 던짐
    const lookupTimeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 처리 중 사용자 정보를 확인하는 데 시간이 오래 걸리고 있습니다.',
    });

    // call 1: signInWithIdToken → 성공
    // call 2: getUserProfile (lookup) → 타임아웃 에러
    mockWithTimeout
      .mockImplementationOnce((promise: Promise<unknown>) => promise) // call 1
      .mockImplementationOnce(() => Promise.reject(lookupTimeoutError)); // call 2

    const { signInWithApple } = loadModule();

    const caughtError = await signInWithApple().catch((e: unknown) => e);

    // NetworkError(__isAppError=true) → isAppError 통과 → 그대로 rethrow
    expect(caughtError).toMatchObject({
      __isAppError: true,
      code: ERROR_CODES.NETWORK_TIMEOUT,
      category: 'network',
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces a timed out token refresh for an existing Apple user', async () => {
    // 기존 인증 사용자의 토큰 갱신 지연: signInWithIdToken 두 번 모두 NetworkError
    jest.useFakeTimers();

    const tokenTimeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple 로그인 서버 인증이 지연되고 있습니다.',
    });

    mockWithTimeout
      .mockImplementationOnce(() => Promise.reject(tokenTimeoutError)) // call 1: 1차
      .mockImplementationOnce(() => Promise.reject(tokenTimeoutError)); // call 2: 재시도

    const { signInWithApple } = loadModule();

    const signInPromise = signInWithApple().catch((e: unknown) => e);

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1500);

    const caughtError = await signInPromise;

    // NetworkError(__isAppError=true) → isAppError 통과 → 그대로 rethrow
    expect(caughtError).toMatchObject({
      __isAppError: true,
      code: ERROR_CODES.NETWORK_TIMEOUT,
      category: 'network',
    });
    // catch 블록에서 signOut 호출
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });
});
