/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Apple 로그인 kill switch 기본값 회귀 테스트 (2026-07-21 소셜 로그인 동결)
 *
 * 기존 appleAuthService.test.ts 는 expo-constants 를 `appleLoginEnabled: true` 로
 * 하드 모킹하기 때문에 **기본값 경로를 전혀 덮지 못한다**. 이 파일은 extra 플래그가
 * 부재하는 상황(= OTA/빌드에서 값이 안 실린 상황)에서 env fallback 이 어느 방향으로
 * 수렴하는지를 고정한다. opt-in(=== 'true') 이므로 값이 없으면 반드시 OFF 여야 한다.
 */

const mockIsAvailableAsync = jest.fn();
const mockSignInAsync = jest.fn();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    // extra 에 appleLoginEnabled 를 의도적으로 넣지 않는다 — env fallback 경로를 태우기 위함.
    expoConfig: { extra: {} },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// appleAuth 는 expo-crypto 를 끌어와 RN 네이티브 체인을 로드하므로 반드시 모킹한다.
jest.mock('@/utils/appleAuth', () => ({
  generateNonce: jest.fn().mockReturnValue('raw-nonce'),
  sha256: jest.fn().mockResolvedValue('hashed-nonce'),
}));

jest.mock('@/utils/timeout', () => ({
  withTimeout: (promise: Promise<unknown>) => promise,
}));

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/services/observability/sentryService', () => ({
  sentryService: { leaveBreadcrumb: jest.fn() },
}));

type AppleAuthServiceModule = typeof import('../appleAuthService');

function loadModule(): AppleAuthServiceModule {
  let moduleUnderTest: AppleAuthServiceModule | undefined;

  jest.isolateModules(() => {
    moduleUnderTest = require('../appleAuthService') as AppleAuthServiceModule;
  });

  return moduleUnderTest!;
}

describe('Apple 로그인 kill switch 기본값', () => {
  const originalEnvValue = process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockSignInAsync.mockResolvedValue({ identityToken: 'identity-token' });
  });

  afterEach(() => {
    if (originalEnvValue === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN = originalEnvValue;
    }
  });

  it('env 가 없으면 iOS 에서도 disabled_by_flag 로 꺼진다', async () => {
    delete process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN;

    const { getAppleLoginAvailability } = loadModule();

    await expect(getAppleLoginAvailability()).resolves.toEqual({
      enabled: false,
      reason: 'disabled_by_flag',
    });
    // 플래그에서 끊겼으므로 네이티브 가용성 조회까지 내려가지 않아야 한다.
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
  });

  it("env 가 'false' 가 아닌 임의 값이어도 꺼진 상태를 유지한다 (opt-out 회귀 방지)", async () => {
    process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN = '1';

    const { getAppleLoginAvailability } = loadModule();

    await expect(getAppleLoginAvailability()).resolves.toEqual({
      enabled: false,
      reason: 'disabled_by_flag',
    });
  });

  it("env 가 정확히 'true' 일 때만 다시 켜진다 (되돌릴 수 있는 동결)", async () => {
    process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN = 'true';

    const { getAppleLoginAvailability } = loadModule();

    await expect(getAppleLoginAvailability()).resolves.toEqual({ enabled: true });
    expect(mockIsAvailableAsync).toHaveBeenCalledTimes(1);
  });
});

/**
 * kill switch 가 회원탈퇴를 깨뜨리지 않아야 한다.
 *
 * accountDeletionService.ts 는 Apple 사용자의 탈퇴 시 requestAppleAuthorization 으로
 * 재인증하고 Apple 토큰을 파기한다. 로그인 진입을 막는 플래그가 이 경로까지 막으면
 * 이미 가입한 Apple 사용자가 계정을 삭제할 수 없게 된다(App Store 필수 기능).
 */
describe('kill switch 가 꺼져도 재인증·토큰 파기는 살아있다', () => {
  const originalEnvValue = process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockSignInAsync.mockResolvedValue({ identityToken: 'identity-token' });
    delete process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN;
  });

  afterEach(() => {
    if (originalEnvValue === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN = originalEnvValue;
    }
  });

  it.each(['reauth', 'revocation'] as const)(
    'operation=%s 는 플래그가 꺼져 있어도 Apple 다이얼로그를 띄운다',
    async (operation) => {
      const { requestAppleAuthorization } = loadModule();

      await expect(
        requestAppleAuthorization({ operation, requestedScopes: [] })
      ).resolves.toMatchObject({ credential: { identityToken: 'identity-token' } });
      expect(mockSignInAsync).toHaveBeenCalledTimes(1);
    }
  );

  it('operation=login 은 여전히 플래그로 차단된다', async () => {
    const { requestAppleAuthorization } = loadModule();

    await expect(
      requestAppleAuthorization({ operation: 'login', requestedScopes: [] })
    ).rejects.toBeDefined();
    expect(mockSignInAsync).not.toHaveBeenCalled();
  });

  it('기기 자체가 Apple 인증을 못 쓰면 revocation 도 차단된다 (정책 아닌 실제 제약)', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    const { requestAppleAuthorization } = loadModule();

    await expect(
      requestAppleAuthorization({ operation: 'revocation', requestedScopes: [] })
    ).rejects.toBeDefined();
    expect(mockSignInAsync).not.toHaveBeenCalled();
  });
});
