/**
 * UNIQN Mobile - ?몄쬆 肄붿뼱 ?쒕퉬?? *
 * @description 濡쒓렇?? ?뚯썝媛?? ?몄뀡 愿由? ?꾪솕踰덊샇/?대찓???됰꽕??以묐났 ?뺤씤
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

/** ?대찓??留덉뒪??(濡쒓퉭?? - maskValue ?섑띁 */
const maskEmail = (email: string) => maskValue(email, 'email');

/** Email Enumeration ?꾪솕: 遺꾨떦 5???쒗븳 (?대씪?댁뼵?몄륫) */
const emailCheckLimiter = createClientRateLimiter(5, 60_000);
/** Email 議댁옱 ?뺤씤 理쒖냼 ?묐떟 ?쒓컙 (??대컢 怨듦꺽 ?꾪솕) */
const EMAIL_CHECK_MIN_RESPONSE_MS = 300;

/**
 * [H3] Native Auth ?덉쟾 媛?? *
 * getNativeAuth!() 媛뺤젣 ?몃옒??????ъ슜. Native SDK 誘몄큹湲고솕 ??紐낇솗???먮윭.
 */
function requireNativeAuth() {
  if (!getNativeAuth) {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '?ㅼ씠?곕툕 ?몄쬆???ъ슜?????놁뒿?덈떎. ?깆쓣 ?ㅼ떆 ?쒖옉?댁＜?몄슂.',
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
      userMessage: '?ㅼ씠?곕툕 ?몄쬆???ъ슜?????놁뒿?덈떎.',
    });
  }
  return nativeLinkWithCredential;
}

function requireNativeEmailProvider() {
  if (!NativeEmailAuthProvider) {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '?ㅼ씠?곕툕 ?몄쬆???ъ슜?????놁뒿?덈떎.',
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
        options.missingUserMessage ??
        '?몄쬆 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎. ?ㅼ떆 濡쒓렇?명빐二쇱꽭??',
    });
  }

  return webUser;
}

/**
 * Dual SDK UID 遺덉씪移?寃利?(?ㅼ씠?곕툕 ?꾩슜)
 *
 * 濡쒓렇???뚯썝媛???깃났 ??Native SDK? Web SDK??currentUser UID媛 ?쇱튂?섎뒗吏 寃利?
 * 遺덉씪移???syncSignOut?쇰줈 ?묒そ 紐⑤몢 濡쒓렇?꾩썐?섏뿬 ?곗씠???뺥빀??蹂댄샇.
 */
async function verifyDualSDKConsistency(context: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const nativeUid = getNativeAuth?.()?.currentUser?.uid;
  const webUid = getFirebaseAuth().currentUser?.uid;

  if (nativeUid && webUid && nativeUid !== webUid) {
    logger.error('Dual SDK UID 遺덉씪移?媛먯? ???묒そ 濡쒓렇?꾩썐', {
      component: 'authService',
      context,
      nativeUid,
      webUid,
    });
    await syncSignOut();
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      userMessage: '?몄쬆 ?곹깭媛 ?쇱튂?섏? ?딆뒿?덈떎. ?ㅼ떆 濡쒓렇?명빐二쇱꽭??',
    });
  }
}

/** SignUpFormData ??VerifyAndSavePayload 蹂??(?꾨줈???꾨뱶 ?쒖쇅 ??媛????蹂꾨룄 ?낅젰) */
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

/** ?뚯썝媛??Analytics ?대깽??(Web/Native 怨듯넻) */
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
 * [H5] Phone-only 怨좎븘 怨꾩젙 濡ㅻ갚 (Web/Native 怨듯넻)
 *
 * ?뚯썝媛???ㅽ뙣 ??phone-only 怨꾩젙????젣?섍퀬, ?ㅽ뙣 ??怨좎븘 怨꾩젙?쇰줈 留덊궧.
 */
/* export async function rollbackPhoneOnlyAccount(
  uid: string,
  reason: string,
  phone?: string,
  options: RollbackPhoneOnlyAccountOptions = {}
): Promise<void> {
  logger.warn('phone-only 怨꾩젙 濡ㅻ갚 ?쒕룄', { uid, reason, component: 'authService' });

  let deleted = false;

  try {

  // 1李??쒕룄: ?꾩옱 ?뚮옯??SDK濡???젣
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
    logger.warn('phone-only 怨꾩젙 1李???젣 ?ㅽ뙣 ??cross-platform fallback ?쒕룄', {
      uid,
      platform: Platform.OS,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    // 2李??쒕룄: 諛섎?履?SDK濡???젣 (Native ?ㅽ뙣 ??Web, Web ?ㅽ뙣 ??Native)
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
      logger.error('phone-only 怨꾩젙 cross-platform ??젣???ㅽ뙣 ??怨좎븘 留덊궧', {
        uid,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }

  let orphanMarkingFailed: Error | null = null;

  if (deleted) {
    logger.info('phone-only 怨좎븘 怨꾩젙 ??젣 ?꾨즺', { uid });
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

      // CRITICAL: ??젣???ㅽ뙣, 留덊궧???ㅽ뙣 ???섎룞 媛쒖엯 ?꾩닔
      logger.error(
        'CRITICAL: 怨좎븘 怨꾩젙 ??젣+留덊궧 紐⑤몢 ?ㅽ뙣 ???섎룞 ?뺣━ ?꾩슂',
        orphanMarkingFailed,
        {
          uid,
          reason,
          phone: phone ? maskValue(phone, 'phone') : undefined,
          component: 'authService',
          orphanFailure: true,
        }
      );

      // Sentry??紐낆떆?곸쑝濡??꾩넚
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

  // SDK ?몄뀡 ?뺣━ (?묒そ 紐⑤몢 ??syncSignOut??Native+Web ?숈떆 泥섎━)
  clearProtectedAuthFlow(uid);
  try {
    await syncSignOut();
  } catch {
    // ?몄뀡 ?뺣━ ?ㅽ뙣??臾댁떆
  }

  // ??젣??留덊궧???ㅽ뙣??寃쎌슦 ?몄텧?먯뿉寃??꾪뙆
  if (orphanMarkingFailed) {
    throw new AuthError(ERROR_CODES.UNKNOWN, {
      userMessage: '怨꾩젙 ?뺣━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. 怨좉컼?쇳꽣??臾몄쓽?댁＜?몄슂.',
      originalError: orphanMarkingFailed,
      metadata: { orphanFailure: true, uid, reason },
    });
  }
}
*/

/**
 * ?꾩옱 ?ъ슜?먯뿉寃??ㅼ젙???꾪솕踰덊샇 諛섑솚
 *
 * admin.auth().updateUser濡??ㅼ젙??phoneNumber???ы븿
 */
export function getLinkedPhoneNumber(): string | null {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  // phoneNumber??providerData? Auth ?덉퐫???묒そ??議댁옱?????덉쓬
  const phoneProvider = user.providerData.find((p) => p.providerId === 'phone');
  return phoneProvider?.phoneNumber ?? user.phoneNumber ?? null;
}

/**
 * 怨좎븘 怨꾩젙 留덊궧 (??젣 ?ㅽ뙣 ??Firestore??湲곕줉)
 *
 * Cloud Function Scheduler媛 二쇨린?곸쑝濡??뺣━?⑸땲??
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
 * ?대찓??鍮꾨?踰덊샇 濡쒓렇?? */
export async function login(data: LoginFormData): Promise<AuthResult> {
  try {
    // Rate Limiting 泥댄겕 (?좉툑 ?곹깭硫?AuthError throw)
    await checkLoginAttempts(data.email);

    logger.info('濡쒓렇???쒕룄', { email: maskEmail(data.email), platform: Platform.OS });

    let userCredential;

    if (Platform.OS === 'web') {
      // ?? web SDK留??ъ슜
      userCredential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        data.email,
        data.password
      );
    } else {
      // ?ㅼ씠?곕툕: Native SDK + Web SDK ?숈떆 濡쒓렇??(Dual SDK)
      const nativeAuth = requireNativeAuth();
      if (!nativeSignInWithEmailAndPassword) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: '?ㅼ씠?곕툕 ?몄쬆???ъ슜?????놁뒿?덈떎. ?깆쓣 ?ㅼ떆 ?쒖옉?댁＜?몄슂.',
        });
      }
      const [, webCredential] = await Promise.all([
        nativeSignInWithEmailAndPassword(nativeAuth, data.email, data.password),
        signInWithEmailAndPassword(getFirebaseAuth(), data.email, data.password),
      ]);
      userCredential = webCredential;
    }

    // Web login 吏곹썑?먮뒗 媛뺤젣 ?좏겙 ?덈줈怨좎묠??媛꾪뿉?곸쑝濡?abort?????덈떎.
    // ?꾩옱 ?몄쬆 ?몄뀡? ?좎??섍퀬, ?꾩슂?섎㈃ 遺?몄뒪?몃옪 ?ъ“??寃쎈줈?먯꽌 claims瑜??ㅼ떆 留욎텣??
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
      // ?ㅼ씠?곕툕??freshly-assigned custom claims瑜?諛붾줈 諛섏쁺?댁빞 ?쒕떎.
      await userCredential.user.getIdToken(true);
    }

    // Dual SDK UID 遺덉씪移?寃利?(?ㅼ씠?곕툕) ??Firestore 荑쇰━ ?꾩뿉 SDK ?뺥빀???뺤씤
    await verifyDualSDKConsistency('login');
    await waitForWebAuthSession(userCredential.user.uid);

    // 사용자 프로필 조회
    const profile = await getUserProfile(userCredential.user.uid);

    if (!profile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '?ъ슜???뺣낫瑜?李얠쓣 ???놁뒿?덈떎',
      });
    }

    // 鍮꾪솢?깊솕??怨꾩젙 泥댄겕 (紐낆떆?곸쑝濡?false??寃쎌슦留?
    if (profile.isActive === false) {
      throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
        userMessage: '鍮꾪솢?깊솕??怨꾩젙?낅땲?? 怨좉컼?쇳꽣??臾몄쓽?댁＜?몄슂',
      });
    }

    logger.info('濡쒓렇???깃났', { uid: userCredential.user.uid });

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
    // 濡쒓렇???ㅽ뙣 ???쒕룄 ?잛닔 利앷?
    // Rate Limiting ?먮윭? ?꾨줈??誘몄〈???먮윭???쒖쇅 (?뺤긽 ?먭꺽 利앸챸?몃뜲 ?곗씠??遺덉씪移섏씤 寃쎌슦 ?좉? 諛⑹?)
    const skipIncrement =
      error instanceof AuthError &&
      (error.code === ERROR_CODES.AUTH_RATE_LIMITED ||
        error.code === ERROR_CODES.AUTH_USER_NOT_FOUND);
    if (!skipIncrement) {
      try {
        await incrementLoginAttempts(data.email);
      } catch {
        // Rate limiting ?낅뜲?댄듃 ?ㅽ뙣??臾댁떆 (?먮옒 ?먮윭媛 ?곗꽑)
      }
    }

    // 遺遺?濡쒓렇???곹깭 ?뺣━ (?쒖そ留??깃났??寃쎌슦)
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
 * ?대찓??以묐났 ?뺤씤
 *
 * @description Step 1?먯꽌 ?ㅼ쓬 ?④퀎濡??섏뼱媛湲??꾩뿉 ?대찓??以묐났 ?щ? ?뺤씤
 * Cloud Function???듯빐 ?쒕쾭 痢≪뿉??Firebase Auth瑜?吏곸젒 議고쉶?⑸땲??
 * (?대씪?댁뼵?몄쓽 fetchSignInMethodsForEmail? Email Enumeration Protection?쇰줈 臾대젰?붾맖)
 *
 * @param email ?뺤씤???대찓?? * @returns ?대찓?쇱씠 ?대? 議댁옱?섎㈃ true, ?놁쑝硫?false
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  // ?대씪?댁뼵?몄륫 Rate Limit (?먮룞??怨듦꺽 ?쒖씠??利앷?)
  if (!emailCheckLimiter.tryAcquire()) {
    throw new AuthError(ERROR_CODES.AUTH_RATE_LIMITED, {
      userMessage: '?붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.',
      metadata: { waitMs: emailCheckLimiter.getWaitTime() },
    });
  }

  const startTime = Date.now();

  try {
    logger.info('?대찓??以묐났 ?뺤씤', { email: maskEmail(email) });

    // ?? reCAPTCHA v3 ?ㅽ겕由쏀듃 濡쒕뱶瑜??ㅽ궢?섏뿬 Firebase RecaptchaVerifier(Enterprise)???異⑸룎 諛⑹?
    // (v3 api.js媛 window.grecaptcha瑜??좎젏?섎㈃ ?꾩냽 Phone Auth Enterprise ?좏겙??臾댄슚?붾맖)
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

    logger.info('?대찓??以묐났 ?뺤씤 ?꾨즺', {
      email: maskEmail(email),
      exists: result.data.exists,
    });

    // ??대컢 怨듦꺽 ?꾪솕: exists=true/false ?묐떟 ?쒓컙 李⑥씠濡??대찓??議댁옱 ?щ? 異붾줎 諛⑹?
    const elapsed = Date.now() - startTime;
    if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
    }

    return result.data.exists;
  } catch (error) {
    // ??대컢 怨듦꺽 ?꾪솕: ?먮윭 寃쎈줈?먯꽌??理쒖냼 ?묐떟 ?쒓컙 蹂댁옣
    const elapsed = Date.now() - startTime;
    if (elapsed < EMAIL_CHECK_MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, EMAIL_CHECK_MIN_RESPONSE_MS - elapsed));
    }

    // Rate limit ?먮윭??洹몃?濡??꾪뙆
    if (error instanceof AuthError && error.code === ERROR_CODES.AUTH_RATE_LIMITED) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '?대찓??以묐났 ?뺤씤',
      component: 'authService',
      context: { email: maskEmail(email) },
    });
  }
}

/**
 * ?됰꽕??以묐났 ?뺤씤
 *
 * @param nickname ?뺤씤???됰꽕?? * @param excludeUid ?꾨줈???섏젙 ???먭린 ?먯떊???쒖쇅??UID (?좏깮)
 * @returns 以묐났 ?щ?
 */
export async function checkNicknameExists(nickname: string, excludeUid?: string): Promise<boolean> {
  try {
    // ?? reCAPTCHA v3 ?ㅽ겕由쏀듃 濡쒕뱶瑜??ㅽ궢 (Phone Auth Enterprise ?ㅽ겕由쏀듃???異⑸룎 諛⑹?)
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
      operation: '?됰꽕??以묐났 ?뺤씤',
      component: 'authService',
      context: { nickname },
    });
  }
}

/**
 * ?뚯썝媛??(4?④퀎 ?꾨즺 ???몄텧)
 *
 * ?뚮줈??
 * 1. linkWithCredential濡?phone-only 怨꾩젙???대찓??鍮꾨?踰덊샇 ?곌껐
 * 2. Web SDK ?숆린??(?ㅼ씠?곕툕留???CF ?몄텧???꾩슂)
 * 3. verifyAndSaveProfile CF ?몄텧 (?쒕쾭?ъ씠??寃利?+ Firestore ???+ Claims ?ㅼ젙)
 * 4. ?좏겙 媛깆떊 + ?꾨줈??議고쉶
 *
 * ?ㅽ뙣 ??phone-only 怨꾩젙 濡ㅻ갚
 */
export async function signUp(data: SignUpFormData): Promise<AuthResult> {
  try {
    if (data.identityVerificationId) {
      return await signUpWithPortOneIdentity(data);
    }

    logger.info('?뚯썝媛???쒕룄', {
      email: maskEmail(data.email),
      platform: Platform.OS,
    });

    if (Platform.OS === 'web') {
      // ===== Web Platform =====
      const currentUser = getFirebaseAuth().currentUser;
      if (!currentUser) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '?꾪솕踰덊샇 ?몄쬆???꾩슂?⑸땲?? ?ㅼ떆 ?쒕룄?댁＜?몄슂.',
        });
      }

      protectAuthFlow(currentUser.uid, 'email_signup');
      let profilePersisted = false;

      try {
        // 1. Email/Password credential ?곌껐 (phone-only ??email+phone)
        const emailCredential = EmailAuthProvider.credential(data.email, data.password);
        await linkWithCredential(currentUser, emailCredential);

        // 2. CF ?몄텧: ?쒕쾭?ъ씠??寃利?+ Firestore ???+ Claims + displayName
        await callVerifyAndSaveProfile(toVerifyPayload(data));
        profilePersisted = true;

        // 3. Custom Claims 媛깆떊
        await currentUser.getIdToken(true);

        // 4. ??λ맂 ?꾨줈??議고쉶
        const profile = await getUserProfile(currentUser.uid);
        if (!profile) {
          throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
            userMessage: '?꾨줈???????議고쉶???ㅽ뙣?덉뒿?덈떎.',
          });
        }

        logger.info('?뚯썝媛???깃났', { uid: currentUser.uid });
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

        // email credential???대? link??寃쎌슦, unlink?섏뿬 phone-only濡?蹂듭썝
        try {
          const webUser = getFirebaseAuth().currentUser;
          if (webUser) {
            const hasEmail = webUser.providerData.some((p) => p.providerId === 'password');
            if (hasEmail) {
              await webUnlink(webUser, 'password');
            }
          }
        } catch {
          // unlink ?ㅽ뙣 ??臾댁떆 ??rollback?먯꽌 ?꾩껜 ??젣
        }
        try {
          await rollbackPhoneOnlyAccount(
            currentUser.uid,
            'web_signup_rollback_failed',
            data.verifiedPhone,
            { email: data.email, password: data.password }
          );
        } catch (rollbackError) {
          // 濡ㅻ갚 ?ㅽ뙣???먮옒 ?먮윭蹂대떎 ?ш컖 ??濡ㅻ갚 ?먮윭瑜??꾪뙆
          logger.error('?뚯썝媛???ㅽ뙣 ??濡ㅻ갚???ㅽ뙣', {
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
        userMessage: '?꾪솕踰덊샇 ?몄쬆???꾩슂?⑸땲?? ?ㅼ떆 ?쒕룄?댁＜?몄슂.',
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

      // 3. Dual SDK UID 遺덉씪移?寃利?(CF ?몄텧 ????遺덉씪移????꾨줈?????諛⑹?)
      await ensureWebAuthSession(nativeUser.uid, {
        context: 'signUp:postInitialSync',
        email: data.email,
        password: data.password,
        missingUserMessage: 'Web SDK ?숆린?????몄쬆 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.',
      });
      await verifyDualSDKConsistency('signUp');

      // 4. CF ?몄텧: ?쒕쾭?ъ씠??寃利?+ Firestore ???+ Claims + displayName
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

      logger.info('?뚯썝媛???깃났', { uid: nativeUser.uid });
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

      // email credential???대? link??寃쎌슦, unlink?섏뿬 phone-only濡?蹂듭썝
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
        // unlink ?ㅽ뙣 ??臾댁떆 ??rollback?먯꽌 ?꾩껜 ??젣
      }
      try {
        await rollbackPhoneOnlyAccount(
          nativeUser.uid,
          'native_signup_rollback_failed',
          data.verifiedPhone,
          { email: data.email, password: data.password }
        );
      } catch (rollbackError) {
        // 濡ㅻ갚 ?ㅽ뙣???먮옒 ?먮윭蹂대떎 ?ш컖 ??濡ㅻ갚 ?먮윭瑜??꾪뙆
        logger.error('?뚯썝媛???ㅽ뙣 ??濡ㅻ갚???ㅽ뙣', {
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
 * 濡쒓렇?꾩썐
 */
export async function signOut(): Promise<void> {
  try {
    logger.info('濡쒓렇?꾩썐 ?쒕룄');

    // 紐⑤뱺 Firestore ?ㅼ떆媛?援щ룆 ?댁젣 (硫붾え由??꾩닔 諛⑹?)
    const webUid = getFirebaseAuth().currentUser?.uid;
    const nativeUid = getNativeAuth?.()?.currentUser?.uid;
    clearProtectedAuthFlow(webUid);
    if (nativeUid && nativeUid !== webUid) {
      clearProtectedAuthFlow(nativeUid);
    }

    RealtimeManager.unsubscribeAll();

    // ?꾩뿭 罹먯떆 ?뺣━
    clearCounterSyncCache();

    // Native + Web SDK ?숈떆 濡쒓렇?꾩썐
    await syncSignOut();

    // Analytics 이벤트
    trackLogout();
    setUserId(null);

    logger.info('濡쒓렇?꾩썐 ?깃났');
  } catch (error) {
    throw handleServiceError(error, {
      operation: '濡쒓렇?꾩썐',
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
 * ?ъ슜???꾨줈??媛?몄삤湲? */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return fetchUserProfile(uid);
}

/**
 * 鍮꾨?踰덊샇 ?ъ씤利?(誘쇨컧???묒뾽 ???꾩슂)
 */
export async function reauthenticate(password: string): Promise<void> {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user || !user.email) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND);
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    logger.info('?ъ씤利??깃났', { uid: user.uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '재인증',
      component: 'authService',
    });
  }
}

/**
 * ?꾩옱 濡쒓렇?몃맂 ?ъ슜??媛?몄삤湲? */
export function getCurrentUser(): FirebaseUser | null {
  return getFirebaseAuth().currentUser;
}

/**
 * ?꾩옱 濡쒓렇?몃맂 ?ъ슜??媛?몄삤湲?(?꾩닔)
 *
 * @description getCurrentUser()??non-null 踰꾩쟾.
 * ?쒕퉬???덉씠?댁뿉??Firebase auth 吏곸젒 ?묎렐 ????ъ슜.
 * @throws {AuthError} 濡쒓렇?몃릺吏 ?딆? 寃쎌슦
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
 * ?몄쬆 ?곹깭 蹂寃?由ъ뒪?? */
export function onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
  return getFirebaseAuth().onAuthStateChanged(callback);
}

/**
 * ?꾪솕踰덊샇 以묐났 ?뺤씤 (Cloud Function ?몄텧)
 *
 * @param phone ?꾪솕踰덊샇 (?レ옄留??먮뒗 E.164 ?뺤떇)
 * @returns 以묐났 ?щ?
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  try {
    // ?? reCAPTCHA v3 ?ㅽ겕由쏀듃 濡쒕뱶瑜??ㅽ궢?섏뿬 Firebase RecaptchaVerifier???異⑸룎 諛⑹?
    // (v3 ?ㅽ겕由쏀듃媛 window.grecaptcha瑜??좎젏?섎㈃ Phone Auth ?좏겙??臾댄슚?붾맖)
    // ?뱀뿉?쒕뒗 ?꾩냽 signInWithPhoneNumber??RecaptchaVerifier媛 遊?蹂댄샇瑜??대떦
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
      operation: '?꾪솕踰덊샇 以묐났 ?뺤씤',
      component: 'authService',
      context: { phone: maskValue(phone, 'phone') },
    });
  }
}
