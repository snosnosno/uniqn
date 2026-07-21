import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { AuthError, BusinessError, ERROR_CODES } from '@/errors';
import { generateNonce, sha256 } from '@/utils/appleAuth';
import { logger } from '@/utils/logger';
import { withTimeout } from '@/utils/timeout';

export type AppleLoginAvailabilityReason = 'not_ios' | 'disabled_by_flag' | 'unavailable';

export interface AppleLoginAvailability {
  enabled: boolean;
  reason?: AppleLoginAvailabilityReason;
}

interface RequestAppleAuthorizationOptions {
  requestedScopes?: AppleAuthentication.AppleAuthenticationScope[];
  operation: 'login' | 'reauth' | 'revocation';
}

export interface AppleAuthorizationResult {
  credential: AppleAuthentication.AppleAuthenticationCredential;
  rawNonce: string;
}

const APPLE_AUTH_CANCEL_CODES = new Set(['ERR_REQUEST_CANCELED', 'ERR_CANCELED']);
const APPLE_SYSTEM_AUTH_TIMEOUT_MS = 60_000;

function getAppleAuthorizationErrorContext(error: unknown) {
  return {
    errorCode: (error as { code?: string })?.code ?? '',
    errorName: (error as { name?: string })?.name ?? '',
    errorMessage: (error as { message?: string })?.message ?? '',
  };
}

function leaveAppleAuthBreadcrumb(
  event: string,
  data: Record<string, string | number | boolean | undefined>
): void {
  void import('@/services/observability/sentryService')
    .then(({ sentryService }) => sentryService.leaveBreadcrumb(event, data))
    .catch(() => {
      // Breadcrumb recording is best-effort only.
    });
}

function getOperationLabel(operation: RequestAppleAuthorizationOptions['operation']): string {
  return operation === 'login' ? 'Apple 로그인' : 'Apple 재인증';
}

function getAuthorizationTimeoutMessage(
  operation: RequestAppleAuthorizationOptions['operation']
): string {
  if (operation === 'login') {
    return 'Apple 로그인 응답이 지연되고 있습니다. Apple 로그인 창을 닫고 다시 시도해주세요.';
  }

  if (operation === 'reauth') {
    return 'Apple 재인증 응답이 지연되고 있습니다. Apple 인증 창을 닫고 다시 시도해주세요.';
  }

  return 'Apple 인증 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
}

function isAppleLoginEnabled(): boolean {
  const extra = Constants.expoConfig?.extra as { appleLoginEnabled?: boolean } | undefined;
  if (typeof extra?.appleLoginEnabled === 'boolean') {
    return extra.appleLoginEnabled;
  }

  // app.config.ts 의 appleLoginEnabled 와 동일하게 opt-in 기본 OFF (2026-07-21 소셜 로그인 동결)
  return process.env.EXPO_PUBLIC_ENABLE_APPLE_LOGIN === 'true';
}

function createAvailabilityError(
  reason: AppleLoginAvailabilityReason,
  operation: RequestAppleAuthorizationOptions['operation']
): AuthError | BusinessError {
  if (reason === 'disabled_by_flag') {
    return new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: 'Apple 로그인이 현재 비활성화되어 있습니다. 다른 로그인 방법을 이용해주세요.',
      metadata: { provider: 'apple', availabilityReason: reason, operation },
    });
  }

  const actionLabel = getOperationLabel(operation);

  if (reason === 'not_ios') {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: `${actionLabel}은 iOS에서만 사용할 수 있습니다.`,
      metadata: { provider: 'apple', availabilityReason: reason, operation },
    });
  }

  return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage:
      operation === 'login'
        ? 'Apple 로그인을 사용할 수 없습니다. 기기 설정에서 Apple ID에 로그인되어 있는지 확인해주세요.'
        : 'Apple 재인증을 사용할 수 없습니다. 기기 설정에서 Apple ID에 로그인되어 있는지 확인해주세요.',
    metadata: { provider: 'apple', availabilityReason: reason, operation },
  });
}

export async function getAppleLoginAvailability(): Promise<AppleLoginAvailability> {
  leaveAppleAuthBreadcrumb('apple_auth_availability', {
    status: 'start',
    platform: Platform.OS,
  });
  logger.debug('Apple 로그인 가용성 확인 시작', {
    component: 'appleAuthService',
    platform: Platform.OS,
  });

  if (Platform.OS !== 'ios') {
    const result = { enabled: false, reason: 'not_ios' } as const;
    leaveAppleAuthBreadcrumb('apple_auth_availability', {
      status: 'success',
      enabled: result.enabled,
      reason: result.reason,
    });
    logger.info('Apple 로그인 가용성 확인 완료', {
      component: 'appleAuthService',
      ...result,
    });
    return result;
  }

  if (!isAppleLoginEnabled()) {
    const result = { enabled: false, reason: 'disabled_by_flag' } as const;
    leaveAppleAuthBreadcrumb('apple_auth_availability', {
      status: 'success',
      enabled: result.enabled,
      reason: result.reason,
    });
    logger.info('Apple 로그인 가용성 확인 완료', {
      component: 'appleAuthService',
      ...result,
    });
    return result;
  }

  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    const result = isAvailable
      ? ({ enabled: true } as const)
      : ({ enabled: false, reason: 'unavailable' } as const);
    leaveAppleAuthBreadcrumb('apple_auth_availability', {
      status: 'success',
      enabled: result.enabled,
      reason: result.reason,
    });
    logger.info('Apple 로그인 가용성 확인 완료', {
      component: 'appleAuthService',
      ...result,
    });
    return result;
  } catch (error) {
    leaveAppleAuthBreadcrumb('apple_auth_availability', {
      status: 'failure',
      ...getAppleAuthorizationErrorContext(error),
    });
    logger.warn('Apple 로그인 가용성 확인 실패', {
      component: 'appleAuthService',
      ...getAppleAuthorizationErrorContext(error),
    });
    return { enabled: false, reason: 'unavailable' };
  }
}

function normalizeAppleAuthorizationError(
  error: unknown,
  operation: RequestAppleAuthorizationOptions['operation']
): Error {
  const errorCode = (error as { code?: string }).code ?? '';
  const errorName = (error as { name?: string }).name ?? '';
  const operationLabel = getOperationLabel(operation);

  if (APPLE_AUTH_CANCEL_CODES.has(errorCode)) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '',
      metadata: { provider: 'apple', errorCode, operation },
    });
  }

  if (errorCode === 'ERR_REQUEST_UNKNOWN') {
    return new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage:
        `${operationLabel}에 실패했습니다. 다음을 확인해주세요:\n` +
        '• 설정 > Apple ID에 로그인되어 있는지\n' +
        '• 이중 인증(2FA)이 활성화되어 있는지\n' +
        '• 네트워크 연결이 정상인지\n\n' +
        '문제가 계속되면 잠시 후 다시 시도해주세요.',
      metadata: { provider: 'apple', errorCode, operation },
    });
  }

  if (errorCode.startsWith('ERR_')) {
    return new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: `${operationLabel}에 실패했습니다. 잠시 후 다시 시도해주세요.`,
      metadata: { provider: 'apple', errorCode, errorName, operation },
    });
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function requestAppleAuthorization({
  requestedScopes = [],
  operation,
}: RequestAppleAuthorizationOptions): Promise<AppleAuthorizationResult> {
  leaveAppleAuthBreadcrumb('apple_auth_request', {
    status: 'start',
    operation,
    requestedScopeCount: requestedScopes.length,
  });
  logger.info('Apple 인증 요청 시작', {
    component: 'appleAuthService',
    operation,
    requestedScopeCount: requestedScopes.length,
  });

  const availability = await getAppleLoginAvailability();
  if (!availability.enabled) {
    leaveAppleAuthBreadcrumb('apple_auth_request', {
      status: 'blocked',
      operation,
      availabilityReason: availability.reason ?? 'unavailable',
    });
    logger.warn('Apple 인증 요청 차단', {
      component: 'appleAuthService',
      operation,
      availabilityReason: availability.reason ?? 'unavailable',
    });
    throw createAvailabilityError(availability.reason ?? 'unavailable', operation);
  }

  const rawNonce = generateNonce();
  const hashedNonce = await sha256(rawNonce);
  const nativeAuthorizationStartedAt = Date.now();
  leaveAppleAuthBreadcrumb('apple_auth_native', {
    status: 'start',
    operation,
    requestedScopeCount: requestedScopes.length,
  });
  logger.info('Apple 네이티브 인증 시작', {
    component: 'appleAuthService',
    operation,
    requestedScopeCount: requestedScopes.length,
  });

  try {
    const credential = await withTimeout(
      AppleAuthentication.signInAsync({
        requestedScopes,
        nonce: hashedNonce,
      }),
      APPLE_SYSTEM_AUTH_TIMEOUT_MS,
      getAuthorizationTimeoutMessage(operation)
    );

    logger.info('Apple 네이티브 인증 완료', {
      component: 'appleAuthService',
      operation,
      elapsedMs: Date.now() - nativeAuthorizationStartedAt,
      hasIdentityToken: Boolean(credential.identityToken),
      hasAuthorizationCode: Boolean(credential.authorizationCode),
      hasEmail: Boolean(credential.email),
      hasFullName: Boolean(credential.fullName),
      hasUserIdentifier: Boolean(credential.user),
    });
    leaveAppleAuthBreadcrumb('apple_auth_native', {
      status: 'success',
      operation,
      elapsedMs: Date.now() - nativeAuthorizationStartedAt,
      hasIdentityToken: Boolean(credential.identityToken),
      hasAuthorizationCode: Boolean(credential.authorizationCode),
      hasEmail: Boolean(credential.email),
      hasFullName: Boolean(credential.fullName),
      hasUserIdentifier: Boolean(credential.user),
    });
    leaveAppleAuthBreadcrumb('apple_auth_request', {
      status: 'success',
      operation,
    });

    return { credential, rawNonce };
  } catch (error) {
    leaveAppleAuthBreadcrumb('apple_auth_native', {
      status: 'failure',
      operation,
      elapsedMs: Date.now() - nativeAuthorizationStartedAt,
      ...getAppleAuthorizationErrorContext(error),
    });
    leaveAppleAuthBreadcrumb('apple_auth_request', {
      status: 'failure',
      operation,
      ...getAppleAuthorizationErrorContext(error),
    });
    logger.warn('Apple 네이티브 인증 실패', {
      component: 'appleAuthService',
      operation,
      elapsedMs: Date.now() - nativeAuthorizationStartedAt,
      ...getAppleAuthorizationErrorContext(error),
    });
    throw normalizeAppleAuthorizationError(error, operation);
  }
}
