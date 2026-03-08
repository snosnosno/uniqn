/**
 * UNIQN Mobile - 인증 코어 서비스
 *
 * @description 로그인, 회원가입, 세션 관리, 전화번호/이메일/닉네임 중복 확인
 * @version 1.0.0
 */

import {
  signInWithEmailAndPassword,
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
import { AuthError, ERROR_CODES } from '@/errors';
import { handleServiceError, maskValue } from '@/errors/serviceErrorHandler';
import {
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  trackLogin,
  trackSignup,
  trackLogout,
  setUserId,
  setUserProperties,
} from '@/services/observability';
import type { SignUpFormData, LoginFormData } from '@/schemas';
import {
  type UserProfile,
  type AuthResult,
  type VerifyAndSavePayload,
  callVerifyAndSaveProfile,
} from './authTypes';

// ============================================================================
// Internal Helpers
// ============================================================================

/** 이메일 마스킹 (로깅용) - maskValue 래퍼 */
const maskEmail = (email: string) => maskValue(email, 'email');

/**
 * [H3] Native Auth 안전 가드
 *
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

/**
 * Dual SDK UID 불일치 검증 (네이티브 전용)
 *
 * 로그인/회원가입 성공 후 Native SDK와 Web SDK의 currentUser UID가 일치하는지 검증.
 * 불일치 시 syncSignOut으로 양쪽 모두 로그아웃하여 데이터 정합성 보호.
 */
async function verifyDualSDKConsistency(context: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const nativeUid = getNativeAuth?.()?.currentUser?.uid;
  const webUid = getFirebaseAuth().currentUser?.uid;

  if (nativeUid && webUid && nativeUid !== webUid) {
    logger.error('Dual SDK UID 불일치 감지 — 양쪽 로그아웃', {
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

/** SignUpFormData → VerifyAndSavePayload 변환 (프로필 필드 제외 — 가입 후 별도 입력) */
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

/** 회원가입 Analytics 이벤트 (Web/Native 공통) */
function trackSignupAnalytics(uid: string, role: 'staff' | 'employer' | 'admin'): void {
  trackSignup('email');
  setUserId(uid);
  setUserProperties({
    user_role: role,
    account_created_date: new Date().toISOString().split('T')[0],
    has_verified_phone: true,
  });
}

// ============================================================================
// Phone-only Account Management
// ============================================================================

/**
 * [H5] Phone-only 고아 계정 롤백 (Web/Native 공통)
 *
 * 회원가입 실패 시 phone-only 계정을 삭제하고, 실패 시 고아 계정으로 마킹.
 */
export async function rollbackPhoneOnlyAccount(
  uid: string,
  reason: string,
  phone?: string
): Promise<void> {
  logger.warn('phone-only 계정 롤백 시도', { uid, reason, component: 'authService' });

  let deleted = false;

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
    logger.warn('phone-only 계정 1차 삭제 실패 — cross-platform fallback 시도', {
      uid,
      platform: Platform.OS,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    // 2차 시도: 반대쪽 SDK로 삭제 (Native 실패 → Web, Web 실패 → Native)
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
      logger.error('phone-only 계정 cross-platform 삭제도 실패 — 고아 마킹', {
        uid,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }

  if (deleted) {
    logger.info('phone-only 고아 계정 삭제 완료', { uid });
  } else {
    await markOrphanAccount(uid, reason, phone);
  }

  // SDK 세션 정리 (양쪽 모두 — syncSignOut이 Native+Web 동시 처리)
  try {
    await syncSignOut();
  } catch {
    // 세션 정리 실패는 무시
  }
}

/**
 * 현재 로그인된 사용자의 UID 반환 (Web/Native 공통)
 */
export function getCurrentUserUid(): string | null {
  if (Platform.OS === 'web') {
    return getFirebaseAuth().currentUser?.uid ?? null;
  }
  return getNativeAuth?.()?.currentUser?.uid ?? null;
}

/**
 * 현재 사용자에게 설정된 전화번호 반환
 *
 * admin.auth().updateUser로 설정된 phoneNumber도 포함
 */
export function getLinkedPhoneNumber(): string | null {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  // phoneNumber는 providerData와 Auth 레코드 양쪽에 존재할 수 있음
  const phoneProvider = user.providerData.find((p) => p.providerId === 'phone');
  return phoneProvider?.phoneNumber ?? user.phoneNumber ?? null;
}

/**
 * 현재 사용자의 phone provider 연결 해제
 *
 * 소셜 모드에서 "다시 인증하기" 시 호출하여
 * 이전 전화번호 link를 제거한 후 새 번호로 재인증할 수 있도록 합니다.
 */
export async function unlinkPhoneProvider(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
          userMessage: '인증 세션이 만료되었습니다. 다시 로그인해주세요.',
        });
      }
      const hasPhone = user.providerData.some((p) => p.providerId === 'phone');
      if (hasPhone) {
        await webUnlink(user, 'phone');
      }
    } else {
      const nativeAuth = getNativeAuth?.();
      const nativeUser = nativeAuth?.currentUser;
      if (!nativeUser) {
        throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
          userMessage: '인증 세션이 만료되었습니다. 다시 로그인해주세요.',
        });
      }
      if (nativeUnlink) {
        const hasPhone = nativeUser.providerData.some(
          (p: { providerId: string }) => p.providerId === 'phone'
        );
        if (hasPhone) {
          await nativeUnlink(nativeUser, 'phone');
        }
      }
    }
  } catch (error) {
    // auth/no-such-provider는 이미 unlink된 상태 → 무시
    const code = (error as { code?: string })?.code;
    if (code !== 'auth/no-such-provider') {
      throw error;
    }
  }
}

/**
 * 고아 계정 마킹 (삭제 실패 시 Firestore에 기록)
 *
 * Cloud Function Scheduler가 주기적으로 정리합니다.
 */
export async function markOrphanAccount(
  uid: string,
  reason: string,
  phone?: string
): Promise<void> {
  await userRepository.markAsOrphan(uid, reason, phone, Platform.OS);
}

// ============================================================================
// Auth Service - Login / SignUp / Session
// ============================================================================

/**
 * 이메일/비밀번호 로그인
 */
export async function login(data: LoginFormData): Promise<AuthResult> {
  try {
    // Rate Limiting 체크 (잠금 상태면 AuthError throw)
    await checkLoginAttempts(data.email);

    logger.info('로그인 시도', { email: maskEmail(data.email), platform: Platform.OS });

    let userCredential;

    if (Platform.OS === 'web') {
      // 웹: web SDK만 사용
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

    // Custom Claims 갱신을 위해 토큰 강제 새로고침
    // 웹앱에서 가입한 계정도 모바일앱에서 최신 권한 정보를 가져옴
    await userCredential.user.getIdToken(true);

    // 사용자 프로필 가져오기
    const profile = await getUserProfile(userCredential.user.uid);

    if (!profile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '사용자 정보를 찾을 수 없습니다',
      });
    }

    // 비활성화된 계정 체크 (명시적으로 false인 경우만)
    if (profile.isActive === false) {
      throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
        userMessage: '비활성화된 계정입니다. 고객센터에 문의해주세요',
      });
    }

    // Dual SDK UID 불일치 검증 (네이티브)
    await verifyDualSDKConsistency('login');

    logger.info('로그인 성공', { uid: userCredential.user.uid });

    // 로그인 성공 시 시도 횟수 초기화
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
    // Rate Limiting 에러와 프로필 미존재 에러는 제외 (정상 자격 증명인데 데이터 불일치인 경우 잠김 방지)
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

    // 부분 로그인 상태 정리 (한쪽만 성공한 경우)
    try {
      await syncSignOut();
    } catch {
      // 정리 실패는 무시 (이미 에러 상태)
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
 * Cloud Function을 통해 서버 측에서 Firebase Auth를 직접 조회합니다.
 * (클라이언트의 fetchSignInMethodsForEmail은 Email Enumeration Protection으로 무력화됨)
 *
 * @param email 확인할 이메일
 * @returns 이메일이 이미 존재하면 true, 없으면 false
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    logger.info('이메일 중복 확인', { email: maskEmail(email) });

    // 웹: reCAPTCHA v3 스크립트 로드를 스킵하여 Firebase RecaptchaVerifier(Enterprise)와의 충돌 방지
    // (v3 api.js가 window.grecaptcha를 선점하면 후속 Phone Auth Enterprise 토큰이 무효화됨)
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

    const result = await checkEmail({
      email: email.trim().toLowerCase(),
      recaptchaToken: recaptchaToken || undefined,
      platform: Platform.OS,
    });

    logger.info('이메일 중복 확인 완료', { email: maskEmail(email), exists: result.data.exists });

    return result.data.exists;
  } catch (error) {
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
 * @param excludeUid 프로필 수정 시 자기 자신을 제외할 UID (선택)
 * @returns 중복 여부
 */
export async function checkNicknameExists(nickname: string, excludeUid?: string): Promise<boolean> {
  try {
    // 웹: reCAPTCHA v3 스크립트 로드를 스킵 (Phone Auth Enterprise 스크립트와의 충돌 방지)
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
 * 회원가입 (4단계 완료 후 호출)
 *
 * 플로우:
 * 1. linkWithCredential로 phone-only 계정에 이메일/비밀번호 연결
 * 2. Web SDK 동기화 (네이티브만 — CF 호출에 필요)
 * 3. verifyAndSaveProfile CF 호출 (서버사이드 검증 + Firestore 저장 + Claims 설정)
 * 4. 토큰 갱신 + 프로필 조회
 *
 * 실패 시 phone-only 계정 롤백
 */
export async function signUp(data: SignUpFormData): Promise<AuthResult> {
  try {
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

      try {
        // 1. Email/Password credential 연결 (phone-only → email+phone)
        const emailCredential = EmailAuthProvider.credential(data.email, data.password);
        await linkWithCredential(currentUser, emailCredential);

        // 2. CF 호출: 서버사이드 검증 + Firestore 저장 + Claims + displayName
        await callVerifyAndSaveProfile(toVerifyPayload(data));

        // 3. Custom Claims 갱신
        await currentUser.getIdToken(true);

        // 4. 저장된 프로필 조회
        const profile = await getUserProfile(currentUser.uid);
        if (!profile) {
          throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
            userMessage: '프로필 저장 후 조회에 실패했습니다.',
          });
        }

        logger.info('회원가입 성공', { uid: currentUser.uid });
        trackSignupAnalytics(currentUser.uid, 'staff');

        return { user: currentUser, profile };
      } catch (innerError) {
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
          // unlink 실패 시 무시 — rollback에서 전체 삭제
        }
        await rollbackPhoneOnlyAccount(
          currentUser.uid,
          'web_signup_rollback_failed',
          data.verifiedPhone
        );
        throw innerError;
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

    try {
      // 1. Email/Password credential 연결 (phone-only → email+phone)
      const NativeEmail = requireNativeEmailProvider();
      const nativeLink = requireNativeLink();
      const emailCredential = NativeEmail.credential(data.email, data.password);
      await nativeLink(nativeUser, emailCredential);

      // 2. Web SDK 동기화 (CF 호출에 Web SDK 인증 토큰 필요)
      // linkWithCredential 후 Firebase Auth 전파 지연 대비 1회 재시도
      try {
        await syncToWebAuth(data.email, data.password);
      } catch (syncError) {
        logger.warn('syncToWebAuth 1차 실패 — 1초 후 재시도', {
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          await syncToWebAuth(data.email, data.password);
        } catch (retryError) {
          logger.error('syncToWebAuth 재시도 실패', {
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          throw retryError;
        }
      }

      // 3. CF 호출: 서버사이드 검증 + Firestore 저장 + Claims + displayName
      await callVerifyAndSaveProfile(toVerifyPayload(data));

      // 4. Custom Claims 갱신 (syncToWebAuth 성공 후 webUser는 반드시 존재)
      const webUser = getFirebaseAuth().currentUser;
      if (!webUser) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: 'Web SDK 동기화 후 인증 정보를 찾을 수 없습니다.',
        });
      }
      await webUser.getIdToken(true);

      // 5. 저장된 프로필 조회
      const profile = await getUserProfile(nativeUser.uid);
      if (!profile) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '프로필 저장 후 조회에 실패했습니다.',
        });
      }

      // Dual SDK UID 불일치 검증 (네이티브)
      await verifyDualSDKConsistency('signUp');

      logger.info('회원가입 성공', { uid: nativeUser.uid });
      trackSignupAnalytics(nativeUser.uid, 'staff');

      return { user: webUser, profile };
    } catch (innerError) {
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
        // unlink 실패 시 무시 — rollback에서 전체 삭제
      }
      await rollbackPhoneOnlyAccount(
        nativeUser.uid,
        'native_signup_rollback_failed',
        data.verifiedPhone
      );
      throw innerError;
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

    // 전역 캐시 정리 (메모리 누수 방지)
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
 * 비밀번호 재설정 이메일 전송
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    logger.info('비밀번호 재설정 이메일 전송', { email: maskEmail(email) });
    await sendPasswordResetEmail(getFirebaseAuth(), email);
    logger.info('비밀번호 재설정 이메일 전송 성공', { email: maskEmail(email) });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '비밀번호 재설정',
      component: 'authService',
      context: { email: maskEmail(email) },
    });
  }
}

/**
 * 사용자 프로필 가져오기
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    return await userRepository.getById(uid);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 조회',
      component: 'authService',
      context: { uid },
    });
  }
}

/**
 * 비밀번호 재인증 (민감한 작업 전 필요)
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
 * 현재 로그인된 사용자 가져오기
 */
export function getCurrentUser(): FirebaseUser | null {
  return getFirebaseAuth().currentUser;
}

/**
 * 현재 로그인된 사용자 가져오기 (필수)
 *
 * @description getCurrentUser()의 non-null 버전.
 * 서비스 레이어에서 Firebase auth 직접 접근 대신 사용.
 * @throws {AuthError} 로그인되지 않은 경우
 */
export function requireCurrentUser(): FirebaseUser {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }
  return user;
}

/**
 * 인증 상태 변경 리스너
 */
export function onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
  return getFirebaseAuth().onAuthStateChanged(callback);
}

/**
 * 전화번호 중복 확인 (Cloud Function 호출)
 *
 * @param phone 전화번호 (숫자만 또는 E.164 형식)
 * @returns 중복 여부
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  try {
    // 웹: reCAPTCHA v3 스크립트 로드를 스킵하여 Firebase RecaptchaVerifier와의 충돌 방지
    // (v3 스크립트가 window.grecaptcha를 선점하면 Phone Auth 토큰이 무효화됨)
    // 웹에서는 후속 signInWithPhoneNumber의 RecaptchaVerifier가 봇 보호를 담당
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
