/**
 * UNIQN Mobile - 인증 코어 서비스
 *
 * @description 로그인, 회원가입, 세션 관리, 전화번호/이메일/닉네임 중복 확인
 * @version 1.0.0
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  deleteUser as webDeleteUser,
  unlink as webUnlink,
  User as FirebaseUser,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';
import { syncToWebAuth, syncSignOut } from '@/lib/authBridge';
import {
  getNativeAuth,
  nativeSignInWithEmailAndPassword,
  nativeLinkWithCredential,
  nativeDeleteUser,
  NativeEmailAuthProvider,
  nativeUnlink,
} from '@/lib/nativeAuth';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';
import { clearProtectedAuthFlow, protectAuthFlow } from '@/shared/auth/protectedAuthFlow';
import { RealtimeManager } from '@/shared/realtime';
import { AuthError, ERROR_CODES, isRetryableError } from '@/errors';
import { createClientRateLimiter } from '@/utils/security';
import { handleServiceError, maskValue } from '@/errors/serviceErrorHandler';
import {
  trackLogin,
  trackSignup,
  trackLogout,
  setUserId,
  setUserProperties,
} from '@/services/observability/analyticsService';
import {
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
} from '@/services/observability/sessionService';
import type { SignUpFormData, LoginFormData } from '@/schemas';
import {
  type UserProfile,
  type AuthResult,
  type VerifyAndSavePayload,
  callVerifyAndSaveProfile,
} from './authTypes';
import { callVerifyAndSavePortOneProfile } from './portOneIdentityService';
import { getUserProfile as fetchUserProfile } from './userProfileService';

// ============================================================================
// Internal Helpers
// ============================================================================

/** 이메일 마스킹 (로깅용) - maskValue 래퍼 */
const maskEmail = (email: string) => maskValue(email, 'email');

/** Email Enumeration 완화: 분당 5회 제한 (클라이언트측) */
const emailCheckLimiter = createClientRateLimiter(5, 60_000);
/** Email 존재 확인 최소 응답 시간 (타이밍 공격 완화) */
const EMAIL_CHECK_MIN_RESPONSE_MS = 300;

/**
 * [H3] Native Auth 안전 가드
 * getNativeAuth!() 강제 언래핑 대신 사용. Native SDK 미초기화 시 명확한 에러.
 */
function requireNativeAuth() {
  if (!getNativeAuth) {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '네이티브 인증을 사용할 수 없습니다. 앱을 다시 시작해주세요.',
    });
  }
  return getNativeAuth();
}

export async function rollbackPhoneOnlyAccount(
  uid: string,
  reason: string,
  phone?: string,
  options: RollbackPhoneOnlyAccountOptions = {}
): Promise<void> {
  logger.warn('phone-only rollback started', { uid, reason, component: 'authService' });

  let deleted = false;

  try {
    if (Platform.OS === 'web') {
      const webUser = getFirebaseAuth().currentUser;
      if (webUser && webUser.uid === uid) {
        await webDeleteUser(webUser);
        deleted = true;
      }
    } else {
      const nativeAuth = getNativeAuth?.();
      const nativeUser = nativeAuth?.currentUser;
      if (nativeUser && nativeUser.uid === uid && nativeDeleteUser) {
        await nativeDeleteUser(nativeUser);
        deleted = true;
      }
    }
  } catch (primaryError) {
    logger.warn('phone-only rollback primary delete failed - trying cross-platform fallback', {
      uid,
      platform: Platform.OS,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    try {
      if (Platform.OS !== 'web') {
        const webUser = getFirebaseAuth().currentUser;
        if (webUser && webUser.uid === uid) {
          await webDeleteUser(webUser);
          deleted = true;
        }
      } else {
        const nativeAuth = getNativeAuth?.();
        const nativeUser = nativeAuth?.currentUser;
        if (nativeUser && nativeUser.uid === uid && nativeDeleteUser) {
          await nativeDeleteUser(nativeUser);
          deleted = true;
        }
      }
    } catch (fallbackError) {
      logger.error('phone-only rollback cross-platform delete failed', {
        uid,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }

  let orphanMarkingFailed: Error | null = null;

  if (deleted) {
    logger.info('phone-only account deleted during rollback', { uid });
  } else {
    try {
      await markOrphanAccount(uid, reason, phone, options);
    } catch (orphanError) {
      if (isCurrentPhoneOnlyAuthSession(uid)) {
        logger.warn(
          'Skipping orphan account mark because the account is back to phone-only state',
          {
            component: 'authService',
            uid,
            reason,
          }
        );
      } else {
        orphanMarkingFailed =
          orphanError instanceof Error ? orphanError : new Error(String(orphanError));

        logger.error(
          'CRITICAL: failed to mark orphan account after rollback delete failure',
          orphanMarkingFailed,
          {
            uid,
            reason,
            phone: phone ? maskValue(phone, 'phone') : undefined,
            component: 'authService',
            orphanFailure: true,
          }
        );

        try {
          const { recordError } = await import('@/services/observability/crashlyticsService');
          await recordError(orphanMarkingFailed, {
            component: 'authService',
            action: 'rollbackPhoneOnlyAccount',
            orphanFailure: true,
            uid,
            reason,
          });
        } catch {
          // Ignore secondary telemetry failures.
        }
      }
    }
  }

  clearProtectedAuthFlow(uid);
  try {
    await syncSignOut();
  } catch {
    // Ignore sign-out cleanup failures.
  }

  if (orphanMarkingFailed) {
    throw new AuthError(ERROR_CODES.UNKNOWN, {
      userMessage: '회원가입 복구를 완료하지 못했습니다. 고객센터로 문의해주세요.',
      originalError: orphanMarkingFailed,
      metadata: { orphanFailure: true, uid, reason },
    });
  }
}

function requireNativeLink() {
  if (!nativeLinkWithCredential) {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '네이티브 인증을 사용할 수 없습니다.',
    });
  }
  return nativeLinkWithCredential;
}

function requireNativeEmailProvider() {
  if (!NativeEmailAuthProvider) {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '네이티브 인증을 사용할 수 없습니다.',
    });
  }
  return NativeEmailAuthProvider;
}

async function waitForWebAuthSession(expectedUid: string, timeoutMs = 5_000): Promise<void> {
  const auth = getFirebaseAuth() as ReturnType<typeof getFirebaseAuth> & {
    authStateReady?: () => Promise<void>;
  };

  const waitForExpectedUser = async (): Promise<void> => {
    if (auth.currentUser?.uid === expectedUid) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        unsubscribe();
        reject(new Error(`Timed out waiting for Firebase auth session: ${expectedUid}`));
      }, timeoutMs);

      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (settled || user?.uid !== expectedUid) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        unsubscribe?.();
        resolve();
      });
    });
  };

  if (typeof auth.authStateReady === 'function') {
    await Promise.race([
      auth.authStateReady(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Timed out waiting for authStateReady')), timeoutMs);
      }),
    ]);
  }

  await waitForExpectedUser();
}

interface EnsureWebAuthSessionOptions {
  context: string;
  email?: string;
  password?: string;
  missingUserMessage?: string;
}

async function ensureWebAuthSession(
  expectedUid: string,
  options: EnsureWebAuthSessionOptions
): Promise<FirebaseUser> {
  const currentUid = getFirebaseAuth().currentUser?.uid;
  const canResyncWithPassword =
    Platform.OS !== 'web' && Boolean(options.email) && Boolean(options.password);

  if (currentUid !== expectedUid && canResyncWithPassword) {
    logger.warn('Web SDK session mismatch detected - resyncing with email credential', {
      component: 'authService',
      context: options.context,
      expectedUid,
      currentUid,
    });
    await syncToWebAuth(options.email!, options.password!);
  }

  try {
    await waitForWebAuthSession(expectedUid);
  } catch (waitError) {
    if (!canResyncWithPassword) {
      throw waitError;
    }

    logger.warn('Timed out waiting for Web SDK session - retrying syncToWebAuth', {
      component: 'authService',
      context: options.context,
      expectedUid,
      error: waitError instanceof Error ? waitError.message : String(waitError),
    });
    await syncToWebAuth(options.email!, options.password!);
    await waitForWebAuthSession(expectedUid);
  }

  const webUser = getFirebaseAuth().currentUser;
  if (!webUser || webUser.uid !== expectedUid) {
    throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
      userMessage:
        options.missingUserMessage ?? '인증 정보를 찾을 수 없습니다. 다시 로그인해주세요.',
    });
  }

  return webUser;
}

/**
 * Dual SDK UID 불일치 검증 (네이티브 전용)
 *
 * 로그인/회원가입 성공 후 Native SDK와 Web SDK의 currentUser UID가 일치하는지 검증.
 * 불일치 시 syncSignOut으로 양쪽 모두 로그아웃하여 데이터 혼합을 보호.
 */
async function verifyDualSDKConsistency(context: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const nativeUid = getNativeAuth?.()?.currentUser?.uid;
  const webUid = getFirebaseAuth().currentUser?.uid;

  if (nativeUid && webUid && nativeUid !== webUid) {
    logger.error('Dual SDK UID 불일치 감지 → 양쪽 로그아웃', {
      component: 'authService',
      context,
      nativeUid,
      webUid,
    });
    await syncSignOut();
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '인증 상태가 일치하지 않습니다. 다시 로그인해주세요.',
    });
  }
}

/** SignUpFormData → VerifyAndSavePayload 변환 (프론트 필드 제외 후 가공된 별도 입력) */
function toVerifyPayload(data: SignUpFormData): VerifyAndSavePayload {
  return {
    verifiedPhone: data.verifiedPhone,
    name: data.name,
    birthDate: data.birthDate,
    gender: data.gender,
    termsAgreed: data.termsAgreed,
    privacyAgreed: data.privacyAgreed,
    marketingAgreed: data.marketingAgreed,
    email: data.email,
    mode: 'signup',
  };
}

function createPostCommitSessionRestoreError(error: unknown): AuthError {
  return new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
    userMessage: '회원가입은 완료되었지만 로그인 세션 복원에 실패했습니다. 다시 로그인해주세요.',
    originalError: error instanceof Error ? error : new Error(String(error)),
  });
}

/** 회원가입 Analytics 이벤트 (Web/Native 공통) */
interface RollbackPhoneOnlyAccountOptions {
  email?: string;
  password?: string;
}

function hasPasswordProvider(
  user?: {
    providerData?: {
      providerId?: string;
    }[];
  } | null
): boolean {
  return Array.isArray(user?.providerData)
    ? user.providerData.some((provider) => provider.providerId === 'password')
    : false;
}

function isCurrentPhoneOnlyAuthSession(uid: string): boolean {
  const nativeUser = getNativeAuth?.()?.currentUser;
  if (nativeUser?.uid === uid) {
    return !hasPasswordProvider(nativeUser);
  }

  const webUser = getFirebaseAuth().currentUser as
    | (FirebaseUser & {
        providerData?: {
          providerId?: string;
        }[];
      })
    | null;

  if (webUser?.uid === uid) {
    return !hasPasswordProvider(webUser);
  }

  return false;
}

async function restoreWebSessionForRollback(
  uid: string,
  options: RollbackPhoneOnlyAccountOptions
): Promise<boolean> {
  const currentUid = getFirebaseAuth().currentUser?.uid;
  if (currentUid === uid) {
    return true;
  }

  if (!options.email || !options.password) {
    return false;
  }

  try {
    logger.warn('Attempting to restore Web SDK session for rollback cleanup', {
      component: 'authService',
      uid,
    });

    if (Platform.OS === 'web') {
      await signInWithEmailAndPassword(getFirebaseAuth(), options.email, options.password);
    } else {
      await syncToWebAuth(options.email, options.password);
    }

    await waitForWebAuthSession(uid);
    return getFirebaseAuth().currentUser?.uid === uid;
  } catch (error) {
    logger.warn('Failed to restore Web SDK session for rollback cleanup', {
      component: 'authService',
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function trackSignupAnalytics(uid: string, role: 'staff' | 'employer' | 'admin'): void {
  trackSignup('email');
  setUserId(uid);
  setUserProperties({
    user_role: role,
    account_created_date: new Date().toISOString().split('T')[0],
    has_verified_phone: true,
  });
}

async function rollbackFreshEmailSignupAccount(uid: string): Promise<void> {
  let deleted = false;

  try {
    const nativeUser = getNativeAuth?.()?.currentUser;
    if (nativeUser && nativeUser.uid === uid && nativeDeleteUser) {
      await nativeDeleteUser(nativeUser);
      deleted = true;
    }
  } catch (nativeError) {
    logger.warn('Fresh signup rollback native delete failed', {
      component: 'authService',
      uid,
      error: nativeError instanceof Error ? nativeError.message : String(nativeError),
    });
  }

  try {
    const webUser = getFirebaseAuth().currentUser;
    if (webUser && webUser.uid === uid) {
      await webDeleteUser(webUser);
      deleted = true;
    }
  } catch (webError) {
    logger.warn('Fresh signup rollback web delete failed', {
      component: 'authService',
      uid,
      error: webError instanceof Error ? webError.message : String(webError),
    });
  }

  try {
    await syncSignOut();
  } catch {
    // Ignore cleanup failures during rollback.
  }

  if (!deleted) {
    logger.warn('Fresh signup rollback could not confirm user deletion', {
      component: 'authService',
      uid,
    });
  }
}

async function signUpWithPortOneIdentity(data: SignUpFormData): Promise<AuthResult> {
  const identityVerificationId = data.identityVerificationId;
  if (!identityVerificationId) {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '본인인증 정보가 누락되었습니다. 다시 시도해주세요.',
    });
  }

  logger.info('PortOne identity signup started', {
    component: 'authService',
    email: maskEmail(data.email),
    platform: Platform.OS,
  });

  let createdUid: string | null = null;
  let profilePersisted = false;

  try {
    const webCredential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      data.email,
      data.password
    );
    const webUser = webCredential.user;
    createdUid = webUser.uid;

    protectAuthFlow(createdUid, 'email_signup');

    if (Platform.OS !== 'web') {
      const nativeAuth = requireNativeAuth();
      if (!nativeSignInWithEmailAndPassword) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: '네이티브 인증 SDK가 준비되지 않았습니다.',
        });
      }

      await nativeSignInWithEmailAndPassword(nativeAuth, data.email, data.password);
      await verifyDualSDKConsistency('signUpWithPortOneIdentity');
    }

    await waitForWebAuthSession(createdUid);

    await callVerifyAndSavePortOneProfile({
      identityVerificationId,
      termsAgreed: data.termsAgreed,
      privacyAgreed: data.privacyAgreed,
      marketingAgreed: data.marketingAgreed,
      email: data.email,
      mode: 'signup',
    });
    profilePersisted = true;

    await webUser.getIdToken(true);

    const profile = await getUserProfile(createdUid);
    if (!profile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '회원가입은 완료되었지만 프로필 정보를 가져오지 못했습니다.',
      });
    }

    logger.info('PortOne identity signup completed', {
      component: 'authService',
      uid: createdUid,
    });
    trackSignupAnalytics(createdUid, 'staff');

    return { user: webUser, profile };
  } catch (error) {
    if (profilePersisted) {
      try {
        await syncSignOut();
      } catch {
        // Ignore cleanup failures after profile persistence.
      }
      throw createPostCommitSessionRestoreError(error);
    }

    if (createdUid) {
      await rollbackFreshEmailSignupAccount(createdUid);
    }

    throw error;
  } finally {
    if (createdUid) {
      clearProtectedAuthFlow(createdUid);
    }
  }
}

// ============================================================================
// Phone-only Account Management
// ============================================================================

/**
 * [H5] Phone-only 고아 계정 롤백 (Web/Native 공통)
 *
 * 회원가입 실패 시 phone-only 계정을 삭제하고, 실패 시 고아 계정으로 마킹.
 */
/* export async function rollbackPhoneOnlyAccount(
  uid: string,
  reason: string,
  phone?: string,
  options: RollbackPhoneOnlyAccountOptions = {}
): Promise<void> {
  logger.warn('phone-only 계정 롤백 시도', { uid, reason, component: 'authService' });

  let deleted = false;

  try {

  // 1차 시도: 현재 플랫폼 SDK로 삭제
  try {
    if (Platform.OS === 'web') {
      const webUser = getFirebaseAuth().currentUser;
      if (webUser && webUser.uid === uid) {
        await webDeleteUser(webUser);
        deleted = true;
      }
    } else {
      const nativeAuth = getNativeAuth?.();
      const nativeUser = nativeAuth?.currentUser;
      if (nativeUser && nativeUser.uid === uid && nativeDeleteUser) {
        await nativeDeleteUser(nativeUser);
        deleted = true;
      }
    }
  } catch (primaryError) {
    logger.warn('phone-only 계정 1차 삭제 실패 → cross-platform fallback 시도', {
      uid,
      platform: Platform.OS,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    // 2차 시도: 반대편 SDK로 삭제 (Native 실패 시 Web, Web 실패 시 Native)
    try {
      if (Platform.OS !== 'web') {
        const webUser = getFirebaseAuth().currentUser;
        if (webUser && webUser.uid === uid) {
          await webDeleteUser(webUser);
          deleted = true;
        }
      } else {
        const nativeAuth = getNativeAuth?.();
        const nativeUser = nativeAuth?.currentUser;
        if (nativeUser && nativeUser.uid === uid && nativeDeleteUser) {
          await nativeDeleteUser(nativeUser);
          deleted = true;
        }
      }
    } catch (fallbackError) {
      logger.error('phone-only 계정 cross-platform 삭제도 실패 → 고아 마킹', {
        uid,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }

  let orphanMarkingFailed: Error | null = null;

  if (deleted) {
    logger.info('phone-only 고아 계정 삭제 완료', { uid });
  } else {
    try {
      await markOrphanAccount(uid, reason, phone, options);
    } catch (orphanError) {
      if (isCurrentPhoneOnlyAuthSession(uid)) {
        logger.warn('Skipping orphan account mark because the account is back to phone-only state', {
          component: 'authService',
          uid,
          reason,
        });
      } else {
        orphanMarkingFailed =
          orphanError instanceof Error ? orphanError : new Error(String(orphanError));

    // CRITICAL: 삭제도 실패, 마킹도 실패 시 수동 개입 필수
      logger.error(
          'CRITICAL: 고아 계정 삭제+마킹 모두 실패 → 수동 정리 필요',
        orphanMarkingFailed,
        {
          uid,
          reason,
          phone: phone ? maskValue(phone, 'phone') : undefined,
          component: 'authService',
          orphanFailure: true,
        }
      );

    // Sentry에 명시적으로 전송
      try {
        const { recordError } = await import('@/services/observability/crashlyticsService');
        await recordError(orphanMarkingFailed, {
          component: 'authService',
          action: 'rollbackPhoneOnlyAccount',
          orphanFailure: true,
          uid,
          reason,
        });
      } catch {
        // Sentry ?꾩넚 ?ㅽ뙣 ?쒖뿉???먮윭??諛섎뱶??throw
      }
      }
    }
  }

  // SDK 세션 정리 (양쪽 모두 → syncSignOut은 Native+Web 동시 처리)
  clearProtectedAuthFlow(uid);
  try {
    await syncSignOut();
  } catch {
    // 세션 정리 실패는 무시
  }

  // 삭제도 마킹도 실패한 경우 호출자에게 전파
  if (orphanMarkingFailed) {
    throw new AuthError(ERROR_CODES.UNKNOWN, {
      userMessage: '계정 정리 중 오류가 발생했습니다. 고객센터로 문의해주세요.',
      originalError: orphanMarkingFailed,
      metadata: { orphanFailure: true, uid, reason },
    });
  }
}
*/

/**
 * 현재 사용자에게 설정된 전화번호 반환
 *
 * admin.auth().updateUser로 설정된 phoneNumber도 포함
 */
export function getLinkedPhoneNumber(): string | null {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  // phoneNumber??providerData? Auth ?덉퐫???묒そ??議댁옱?????덉쓬
  const phoneProvider = user.providerData.find((p) => p.providerId === 'phone');
  return phoneProvider?.phoneNumber ?? user.phoneNumber ?? null;
}

/**
 * 고아 계정 마킹 (삭제 실패 시 Firestore에 기록)
 *
 * Cloud Function Scheduler가 주기적으로 정리합니다.
 */
export async function markOrphanAccount(
  uid: string,
  reason: string,
  phone?: string,
  options: RollbackPhoneOnlyAccountOptions = {}
): Promise<void> {
  let webUid = getFirebaseAuth().currentUser?.uid;

  if (webUid !== uid) {
    const restored = await restoreWebSessionForRollback(uid, options);
    webUid = getFirebaseAuth().currentUser?.uid;

    if (!restored || webUid !== uid) {
      throw new Error(`Unable to restore Web SDK session for orphan account mark: ${uid}`);
    }
  }

  await userRepository.markAsOrphan(uid, reason, phone, Platform.OS);
}

// ============================================================================
// Auth Service - Login / SignUp / Session
// ============================================================================

/**
 * 이메일/비밀번호 로그인 */
export async function login(data: LoginFormData): Promise<AuthResult> {
  try {
    // Rate Limiting 泥댄겕 (?좉툑 ?곹깭硫?AuthError throw)
    await checkLoginAttempts(data.email);

    logger.info('로그인 시도', { email: maskEmail(data.email), platform: Platform.OS });

    let userCredential;

    if (Platform.OS === 'web') {
      // ?? web SDK留??ъ슜
      userCredential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        data.email,
        data.password
      );
    } else {
      // 네이티브: Native SDK + Web SDK 동시 로그인 (Dual SDK)
      const nativeAuth = requireNativeAuth();
      if (!nativeSignInWithEmailAndPassword) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: '네이티브 인증을 사용할 수 없습니다. 앱을 다시 시작해주세요.',
        });
      }
      const [, webCredential] = await Promise.all([
        nativeSignInWithEmailAndPassword(nativeAuth, data.email, data.password),
        signInWithEmailAndPassword(getFirebaseAuth(), data.email, data.password),
      ]);
      userCredential = webCredential;
    }

    // Web login 직후에는 강제 토큰 리로드를 가급적으로 abort할 수 없다.
    // 현재 인증 세션을 유지하고, 필요하면 비즈니스 로직 경로에서 claims를 다시 매핑한다.
    if (Platform.OS === 'web') {
      try {
        const tokenResult = await userCredential.user.getIdTokenResult();
        const roleClaim = tokenResult.claims?.role;

        if (typeof roleClaim !== 'string' || roleClaim.length === 0) {
          await userCredential.user.getIdToken(true);
        }
      } catch (tokenRefreshError) {
        logger.warn('Web login token refresh failed, continuing with current auth session', {
          component: 'authService',
          uid: userCredential.user.uid,
          error:
            tokenRefreshError instanceof Error
              ? tokenRefreshError.message
              : String(tokenRefreshError),
        });
      }
    } else {
      // 네이티브는 freshly-assigned custom claims를 바로 반영해야 한다.
      await userCredential.user.getIdToken(true);
    }

    // Dual SDK UID 불일치 검증 (네이티브) → Firestore 쿼리 전에 SDK 정합성 확인
    await verifyDualSDKConsistency('login');
    await waitForWebAuthSession(userCredential.user.uid);

    // 사용자 프로필 조회
    const profile = await getUserProfile(userCredential.user.uid);

    if (!profile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '?ъ슜???뺣낫瑜?李얠쓣 ???놁뒿?덈떎',
      });
    }

    // 비활성화된 계정 체크 (명시적으로 false인 경우만)
    if (profile.isActive === false) {
      throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
        userMessage: '비활성화된 계정입니다. 고객센터로 문의해주세요',
      });
    }

    logger.info('로그인 성공', { uid: userCredential.user.uid });

    // 로그인 성공 시도 횟수 초기화
    await resetLoginAttempts(data.email);

    // Analytics 이벤트
    trackLogin('email');
    setUserId(userCredential.user.uid);
    setUserProperties({
      user_role: profile.role,
      has_verified_phone: !!profile.phoneVerified,
    });

    return {
      user: userCredential.user,
      profile,
    };
  } catch (error) {
    // 로그인 실패 시 시도 횟수 증가
    // Rate Limiting 에러와 프로필 미존재 에러는 제외 (정상 동작 범주인데 데이터 불일치인 경우 초과 방지)
    const skipIncrement =
      error instanceof AuthError &&
      (error.code === ERROR_CODES.AUTH_RATE_LIMITED ||
        error.code === ERROR_CODES.AUTH_USER_NOT_FOUND);
    if (!skipIncrement) {
      try {
        await incrementLoginAttempts(data.email);
      } catch {
        // Rate limiting 업데이트 실패는 무시 (원래 에러가 우선)
      }
    }

    // 부분 로그인 상태 정리 (네이티브만 성공한 경우)
    try {
      await syncSignOut();
    } catch {
      // ?뺣━ ?ㅽ뙣??臾댁떆 (?대? ?먮윭 ?곹깭)
    }
    throw handleServiceError(error, {
      operation: '로그인',
      component: 'authService',
      context: { email: maskEmail(data.email) },
    });
  }
}

/**
 * 이메일 중복 확인
 *
 * @description Step 1에서 다음 단계로 넘어가기 전에 이메일 중복 여부 확인
 * Cloud Function???듯빐 ?쒕쾭 痢≪뿉??Firebase Auth瑜?吏곸젒 議고쉶?⑸땲??
 * (클라이언트의 fetchSignInMethodsForEmail은 Email Enumeration Protection으로 무력화됨)
 *
 * @param email 확인할 이메일
 * @returns 이메일이 이미 존재하면 true, 없으면 false
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  // 클라이언트측 Rate Limit (자동화 공격 시간 벌기)
  if (!emailCheckLimiter.tryAcquire()) {
    throw new AuthError(ERROR_CODES.AUTH_RATE_LIMITED, {
      userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      metadata: { waitMs: emailCheckLimiter.getWaitTime() },
    });
  }

  const startTime = Date.now();

  try {
    logger.info('이메일 중복 확인', { email: maskEmail(email) });

    // ※ reCAPTCHA v3 스크립트 로드를 스킵하여 Firebase RecaptchaVerifier(Enterprise)와 충돌 방지
    // (v3 api.js가 window.grecaptcha를 점거하면 이속 Phone Auth Enterprise 토큰이 무효화됨)
    let recaptchaToken: string | undefined;
    if (Platform.OS !== 'web') {
      const { getRecaptchaToken } = await import('@/utils/recaptcha');
      const token = await getRecaptchaToken('check_email');
      recaptchaToken = token || undefined;
    }

    const functions = getFirebaseFunctions();
    const checkEmail = httpsCallable<
      { email: string; recaptchaToken?: string; platform?: string },
      { exists: boolean }
    >(functions, 'checkEmailExists');

    const payload = {
      email: email.trim().toLowerCase(),
      recaptchaToken: recaptchaToken || undefined,
      platform: Platform.OS,
    };

    let result;
    try {
      result = await checkEmail(payload);
    } catch (cfError) {
      if (!isRetryableError(cfError)) throw cfError;

      logger.warn('이메일 중복 확인 네트워크 에러 - 2초 후 재시도', {
        component: 'authService',
        error: cfError instanceof Error ? cfError.message : String(cfError),
      });
      await new Promise((r) => setTimeout(r, 2000));
      result = await checkEmail(payload);
    }

    logger.info('이메일 중복 확인 완료', {
      email: maskEmail(email),
      exists: result.data.exists,
    });

    // 타이밍 공격 완화: exists=true/false 응답 시간 차이로 이메일 존재 여부 추론 방지
    const elapsed = Date.now() - startTime;
    if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
    }

    return result.data.exists;
  } catch (error) {
    // 타이밍 공격 완화: 에러 경로에서도 최소 응답 시간 보장
    const elapsed = Date.now() - startTime;
    if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
    }

    // Rate limit 에러는 그대로 전파
    if (error instanceof AuthError && error.code === ERROR_CODES.AUTH_RATE_LIMITED) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '이메일 중복 확인',
      component: 'authService',
      context: { email: maskEmail(email) },
    });
  }
}

/**
 * 닉네임 중복 확인
 *
 * @param nickname 확인할 닉네임
 * @param excludeUid 프로필 설정 시 자기 자신을 제외할 UID (선택)
 * @returns 以묐났 ?щ?
 */
export async function checkNicknameExists(nickname: string, excludeUid?: string): Promise<boolean> {
  try {
    // ※ reCAPTCHA v3 스크립트 로드를 스킵 (Phone Auth Enterprise 스크립트와 충돌 방지)
    let recaptchaToken: string | undefined;
    if (Platform.OS !== 'web') {
      const { getRecaptchaToken } = await import('@/utils/recaptcha');
      const token = await getRecaptchaToken('check_nickname');
      recaptchaToken = token || undefined;
    }
    const checkNickname = httpsCallable<
      { nickname: string; excludeUid?: string; recaptchaToken?: string; platform?: string },
      { exists: boolean }
    >(getFirebaseFunctions(), 'checkNicknameExists');
    const result = await checkNickname({
      nickname: nickname.trim(),
      excludeUid,
      recaptchaToken: recaptchaToken || undefined,
      platform: Platform.OS,
    });
    return result.data.exists;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '닉네임 중복 확인',
      component: 'authService',
      context: { nickname },
    });
  }
}

/**
 * 회원가입 (4단계 완료 시 호출)
 *
 * ?뚮줈??
 * 1. linkWithCredential로 phone-only 계정에 이메일/비밀번호 연결
 * 2. Web SDK 동기화 (네이티브만 → CF 호출에 필요)
 * 3. verifyAndSaveProfile CF 호출 (서버사이드 검증 + Firestore 저장 + Claims 설정)
 * 4. 토큰 갱신 + 프로필 조회
 *
 * 실패 시 phone-only 계정 롤백
 */
export async function signUp(data: SignUpFormData): Promise<AuthResult> {
  try {
    if (data.identityVerificationId) {
      return await signUpWithPortOneIdentity(data);
    }

    logger.info('회원가입 시도', {
      email: maskEmail(data.email),
      platform: Platform.OS,
    });

    if (Platform.OS === 'web') {
      // ===== Web Platform =====
      const currentUser = getFirebaseAuth().currentUser;
      if (!currentUser) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '전화번호 인증이 필요합니다. 다시 시도해주세요.',
        });
      }

      protectAuthFlow(currentUser.uid, 'email_signup');
      let profilePersisted = false;

      try {
        // 1. Email/Password credential ?곌껐 (phone-only ??email+phone)
        const emailCredential = EmailAuthProvider.credential(data.email, data.password);
        await linkWithCredential(currentUser, emailCredential);

        // 2. CF 호출: 서버사이드 검증 + Firestore 저장 + Claims + displayName
        await callVerifyAndSaveProfile(toVerifyPayload(data));
        profilePersisted = true;

        // 3. Custom Claims 갱신
        await currentUser.getIdToken(true);

        // 4. ??λ맂 ?꾨줈??議고쉶
        const profile = await getUserProfile(currentUser.uid);
        if (!profile) {
          throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
            userMessage: '?꾨줈???????議고쉶???ㅽ뙣?덉뒿?덈떎.',
          });
        }

        logger.info('회원가입 성공', { uid: currentUser.uid });
        trackSignupAnalytics(currentUser.uid, 'staff');

        return { user: currentUser, profile };
      } catch (innerError) {
        if (profilePersisted) {
          try {
            await syncSignOut();
          } catch {
            // 세션 정리 실패는 원래 에러보다 중요하지 않음
          }
          throw createPostCommitSessionRestoreError(innerError);
        }

        // email credential이 이미 link된 경우, unlink하여 phone-only로 복원
        try {
          const webUser = getFirebaseAuth().currentUser;
          if (webUser) {
            const hasEmail = webUser.providerData.some((p) => p.providerId === 'password');
            if (hasEmail) {
              await webUnlink(webUser, 'password');
            }
          }
        } catch {
          // unlink 실패는 무시 → rollback에서 전체 삭제
        }
        try {
          await rollbackPhoneOnlyAccount(
            currentUser.uid,
            'web_signup_rollback_failed',
            data.verifiedPhone,
            { email: data.email, password: data.password }
          );
        } catch (rollbackError) {
          // 롤백 실패는 원래 에러보다 덜 심각 → 롤백 에러를 전파
          logger.error('회원가입 실패 후 롤백도 실패', {
            component: 'authService',
            originalError: innerError instanceof Error ? innerError.message : String(innerError),
            uid: currentUser.uid,
          });
          throw rollbackError;
        }
        throw innerError;
      } finally {
        clearProtectedAuthFlow(currentUser.uid);
      }
    }

    // ===== Native Platform =====
    const nativeAuth = requireNativeAuth();
    const nativeUser = nativeAuth.currentUser;
    if (!nativeUser) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '전화번호 인증이 필요합니다. 다시 시도해주세요.',
      });
    }

    protectAuthFlow(nativeUser.uid, 'email_signup');
    let profilePersisted = false;

    try {
      // 1. Email/Password credential ?곌껐 (phone-only ??email+phone)
      const NativeEmail = requireNativeEmailProvider();
      const nativeLink = requireNativeLink();
      const emailCredential = NativeEmail.credential(data.email, data.password);
      await nativeLink(nativeUser, emailCredential);

      // 2. Web SDK 동기화 (CF 호출에 Web SDK 인증 토큰 필요)
      // linkWithCredential 이후 Firebase Auth 전파 지연 대비 1회 재시도
      try {
        await syncToWebAuth(data.email, data.password);
      } catch (syncError) {
        logger.warn('syncToWebAuth 1차 실패 - 1초 후 재시도', {
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          await syncToWebAuth(data.email, data.password);
        } catch (retryError) {
          logger.error('syncToWebAuth ?ъ떆???ㅽ뙣', {
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          throw retryError;
        }
      }

      // 3. Dual SDK UID 불일치 검증 (CF 호출 전 → 불일치면 프로필 조회 방지)
      await ensureWebAuthSession(nativeUser.uid, {
        context: 'signUp:postInitialSync',
        email: data.email,
        password: data.password,
        missingUserMessage: 'Web SDK 동기화 후 인증 정보를 찾을 수 없습니다.',
      });
      await verifyDualSDKConsistency('signUp');

      // 4. CF 호출: 서버사이드 검증 + Firestore 저장 + Claims + displayName
      await callVerifyAndSaveProfile(toVerifyPayload(data));
      profilePersisted = true;

      // 5. Custom Claims 갱신 전에 Web SDK 세션을 다시 확인
      const webUser = await ensureWebAuthSession(nativeUser.uid, {
        context: 'signUp:postVerifyAndSaveProfile',
        email: data.email,
        password: data.password,
        missingUserMessage: 'Web SDK 동기화 후 인증 정보를 찾을 수 없습니다.',
      });
      await webUser.getIdToken(true);

      // 6. ??λ맂 ?꾨줈??議고쉶
      const profile = await getUserProfile(nativeUser.uid);
      if (!profile) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '?꾨줈???????議고쉶???ㅽ뙣?덉뒿?덈떎.',
        });
      }

      logger.info('회원가입 성공', { uid: nativeUser.uid });
      trackSignupAnalytics(nativeUser.uid, 'staff');

      return { user: webUser, profile };
    } catch (innerError) {
      if (profilePersisted) {
        try {
          await syncSignOut();
        } catch {
          // 세션 정리 실패는 원래 에러보다 중요하지 않음
        }
        throw createPostCommitSessionRestoreError(innerError);
      }

      // email credential이 이미 link된 경우, unlink하여 phone-only로 복원
      try {
        if (nativeUnlink) {
          const currentNativeUser = nativeAuth.currentUser;
          if (currentNativeUser) {
            const hasEmail = currentNativeUser.providerData.some(
              (p: { providerId: string }) => p.providerId === 'password'
            );
            if (hasEmail) {
              await nativeUnlink(currentNativeUser, 'password');
            }
          }
        }
      } catch {
        // unlink 실패는 무시 → rollback에서 전체 삭제
      }
      try {
        await rollbackPhoneOnlyAccount(
          nativeUser.uid,
          'native_signup_rollback_failed',
          data.verifiedPhone,
          { email: data.email, password: data.password }
        );
      } catch (rollbackError) {
        // 롤백 실패는 원래 에러보다 덜 심각 → 롤백 에러를 전파
        logger.error('회원가입 실패 후 롤백도 실패', {
          component: 'authService',
          originalError: innerError instanceof Error ? innerError.message : String(innerError),
          uid: nativeUser.uid,
        });
        throw rollbackError;
      }
      throw innerError;
    } finally {
      clearProtectedAuthFlow(nativeUser.uid);
    }
  } catch (error) {
    throw handleServiceError(error, {
      operation: '회원가입',
      component: 'authService',
      context: { email: maskEmail(data.email) },
    });
  }
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
  try {
    logger.info('로그아웃 시도');

    // 모든 Firestore 캐시값 강제 삭제 (메모리 누수 방지)
    const webUid = getFirebaseAuth().currentUser?.uid;
    const nativeUid = getNativeAuth?.()?.currentUser?.uid;
    clearProtectedAuthFlow(webUid);
    if (nativeUid && nativeUid !== webUid) {
      clearProtectedAuthFlow(nativeUid);
    }

    RealtimeManager.unsubscribeAll();

    // ?꾩뿭 罹먯떆 ?뺣━
    clearCounterSyncCache();

    // Native + Web SDK 동시 로그아웃
    await syncSignOut();

    // Analytics 이벤트
    trackLogout();
    setUserId(null);

    logger.info('로그아웃 성공');
  } catch (error) {
    throw handleServiceError(error, {
      operation: '로그아웃',
      component: 'authService',
    });
  }
}

/**
 * 鍮꾨?踰덊샇 ?ъ꽕???대찓???꾩넚
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    logger.info('鍮꾨?踰덊샇 ?ъ꽕???대찓???꾩넚', { email: maskEmail(email) });
    await sendPasswordResetEmail(getFirebaseAuth(), email);
    logger.info('鍮꾨?踰덊샇 ?ъ꽕???대찓???꾩넚 ?깃났', { email: maskEmail(email) });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '비밀번호 재설정',
      component: 'authService',
      context: { email: maskEmail(email) },
    });
  }
}

/**
 * 사용자 프로필 가져오기 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return fetchUserProfile(uid);
}

/**
 * 비밀번호 재인증 (민감한 작업 시 필요)
 */
export async function reauthenticate(password: string): Promise<void> {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user || !user.email) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND);
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    logger.info('재인증 성공', { uid: user.uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '재인증',
      component: 'authService',
    });
  }
}

/**
 * 현재 로그인된 사용자 가져오기 */
export function getCurrentUser(): FirebaseUser | null {
  return getFirebaseAuth().currentUser;
}

/**
 * 현재 로그인된 사용자 가져오기 (필수)
 *
 * @description getCurrentUser()??non-null 踰꾩쟾.
 * ?쒕퉬???덉씠?댁뿉??Firebase auth 吏곸젒 ?묎렐 ????ъ슜.
 * @throws {AuthError} 로그인되지 않은 경우
 */
export function requireCurrentUser(): FirebaseUser {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다.',
    });
  }
  return user;
}

/**
 * 인증 상태 변경 리스너 */
export function onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
  return getFirebaseAuth().onAuthStateChanged(callback);
}

/**
 * 전화번호 중복 확인 (Cloud Function 호출)
 *
 * @param phone 전화번호 (숫자만 또는 E.164 형식)
 * @returns 以묐났 ?щ?
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  try {
    // ※ reCAPTCHA v3 스크립트 로드를 스킵하여 Firebase RecaptchaVerifier와 충돌 방지
    // (v3 스크립트가 window.grecaptcha를 점거하면 Phone Auth 토큰이 무효화됨)
    // 앱에서는 이속 signInWithPhoneNumber의 RecaptchaVerifier가 빈 보호를 담당
    let recaptchaToken: string | undefined;
    if (Platform.OS !== 'web') {
      const { getRecaptchaToken } = await import('@/utils/recaptcha');
      const token = await getRecaptchaToken('check_phone');
      recaptchaToken = token || undefined;
    }

    const checkPhone = httpsCallable<
      { phone: string; recaptchaToken?: string; platform?: string },
      { exists: boolean }
    >(getFirebaseFunctions(), 'checkPhoneExists');
    const result = await checkPhone({
      phone,
      recaptchaToken,
      platform: Platform.OS,
    });
    return result.data.exists;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '전화번호 중복 확인',
      component: 'authService',
      context: { phone: maskValue(phone, 'phone') },
    });
  }
}
