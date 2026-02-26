/**
 * UNIQN Mobile - 인증 서비스
 *
 * @description Firebase Auth 기반 인증 서비스
 * @version 2.0.0
 *
 * ============================================================================
 * 소셜 로그인 구현 상태
 * ============================================================================
 * ✅ Apple: 실제 구현 완료 (expo-apple-authentication, iOS 전용)
 * 🔲 Google: Mock 구현 (개발 모드에서만 동작)
 * 🔲 카카오: Mock 구현 (개발 모드에서만 동작)
 *
 * TODO [P1]: Google 소셜 로그인 구현 (@react-native-google-signin/google-signin)
 * TODO [P2]: 카카오 소셜 로그인 구현 (@react-native-seoul/kakao-login + Cloud Functions)
 * ============================================================================
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  updateProfile,
  EmailAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  linkWithCredential,
  deleteUser as webDeleteUser,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';
import { syncToWebAuth, syncSignOut } from '@/lib/authBridge';

import {
  getNativeAuth,
  nativeSignInWithEmailAndPassword,
  nativeLinkWithCredential,
  nativeUpdateProfile,
  nativeDeleteUser,
  NativeEmailAuthProvider,
  nativeSignInWithCustomToken,
} from '@/lib/nativeAuth';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';
import { AuthError, BusinessError, ERROR_CODES } from '@/errors';
import { handleServiceError, maskValue } from '@/errors/serviceErrorHandler';
import { checkLoginAttempts, incrementLoginAttempts, resetLoginAttempts } from './sessionService';
import {
  trackLogin,
  trackSignup,
  trackLogout,
  setUserId,
  setUserProperties,
} from './analyticsService';
import type { FirestoreUserProfile, EditableProfileFields } from '@/types';
import type { SignUpFormData, LoginFormData } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * UserProfile 타입 (하위 호환성을 위해 re-export)
 * @see FirestoreUserProfile from '@/types/user'
 */
export type UserProfile = FirestoreUserProfile;

export interface AuthResult {
  user: FirebaseUser;
  profile: UserProfile;
}

// ============================================================================
// Helpers
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
 * [H5] Phone-only 고아 계정 롤백 (Web/Native 공통)
 *
 * 회원가입 실패 시 phone-only 계정을 삭제하고, 실패 시 고아 계정으로 마킹.
 */
async function rollbackPhoneOnlyAccount(
  uid: string,
  reason: string,
  phone?: string
): Promise<void> {
  logger.warn('phone-only 계정 롤백 시도', { uid, reason, component: 'authService' });

  try {
    if (Platform.OS === 'web') {
      const webUser = getFirebaseAuth().currentUser;
      if (webUser && webUser.uid === uid) {
        await webDeleteUser(webUser);
      }
    } else {
      const nativeAuth = getNativeAuth?.();
      const nativeUser = nativeAuth?.currentUser;
      if (nativeUser && nativeUser.uid === uid && nativeDeleteUser) {
        await nativeDeleteUser(nativeUser);
      }
    }
    logger.info('phone-only 고아 계정 삭제 완료', { uid });
  } catch (deleteError) {
    logger.error('phone-only 고아 계정 삭제 실패 - 고아 마킹', {
      uid,
      error: deleteError,
    });
    await markOrphanAccount(uid, reason, phone);
  }

  // Web SDK 세션 정리 (Platform 무관)
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  } catch {
    // Web SDK 정리 실패는 무시
  }
}

/**
 * [H6] Native SDK Custom Token 동기화 (재시도 포함)
 *
 * Apple 소셜 로그인에서 Web SDK 인증 후 Native SDK 동기화용.
 * @returns 성공 여부
 */
async function syncNativeWithCustomToken(_uid: string, context: string): Promise<boolean> {
  if (!nativeSignInWithCustomToken || !getNativeAuth) {
    return false;
  }

  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 1000;
  const createCustomTokenFn = httpsCallable<void, { customToken: string }>(
    getFirebaseFunctions(),
    'createCustomToken'
  );

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const tokenResult = await createCustomTokenFn();
      await nativeSignInWithCustomToken(getNativeAuth(), tokenResult.data.customToken);
      logger.info(`Apple 로그인: Native SDK 동기화 완료 (${context})`, {
        component: 'authService',
        attempt,
      });
      return true;
    } catch (syncError) {
      logger.warn(
        `Apple 로그인: Native SDK 동기화 실패 (${context}, 시도 ${attempt}/${MAX_ATTEMPTS})`,
        {
          component: 'authService',
          error: syncError instanceof Error ? syncError.message : String(syncError),
        }
      );
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  return false;
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

/** signUp용 UserProfile 객체 생성 (Web/Native 공통) */
function buildUserProfile(uid: string, data: SignUpFormData): UserProfile {
  return {
    uid,
    email: data.email,
    name: data.name,
    nickname: data.nickname,
    phone: data.verifiedPhone,
    phoneVerified: true,
    birthDate: data.birthDate,
    gender: data.gender,
    role: 'staff',
    // Optional profile fields from Step 3
    ...(data.region && { region: data.region }),
    ...(data.experienceYears !== undefined && { experienceYears: data.experienceYears }),
    ...(data.career && { career: data.career }),
    ...(data.note && { note: data.note }),
    termsAgreed: data.termsAgreed,
    privacyAgreed: data.privacyAgreed,
    marketingAgreed: data.marketingAgreed,
    isActive: true,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
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
// Auth Service
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

    const functions = getFirebaseFunctions();
    const checkEmail = httpsCallable<{ email: string }, { exists: boolean }>(
      functions,
      'checkEmailExists'
    );

    const result = await checkEmail({ email: email.trim().toLowerCase() });

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
 * 회원가입 (4단계 완료 후 호출)
 */
export async function signUp(data: SignUpFormData): Promise<AuthResult> {
  try {
    logger.info('회원가입 시도', {
      email: maskEmail(data.email),
      role: data.role,
      platform: Platform.OS,
    });

    // 서버사이드 role 검증: 모든 가입은 staff로만 허용 (역할 탈취 방지)
    if (data.role !== 'staff') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '잘못된 역할입니다. 다시 시도해주세요.',
      });
    }

    if (Platform.OS === 'web') {
      // ===== Web Platform =====
      // Phone Auth 계정은 Step 2에서 web SDK로 이미 생성됨
      const currentUser = getFirebaseAuth().currentUser;
      if (!currentUser) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '전화번호 인증이 필요합니다. 다시 시도해주세요.',
        });
      }

      try {
        // Email/Password credential 연결 (phone-only → email+phone)
        const emailCredential = EmailAuthProvider.credential(data.email, data.password);
        await linkWithCredential(currentUser, emailCredential);

        // displayName 설정
        await updateProfile(currentUser, { displayName: data.nickname });

        // Firestore에 사용자 프로필 저장
        const profile = buildUserProfile(currentUser.uid, data);
        await userRepository.createOrMerge(currentUser.uid, { ...profile });

        logger.info('회원가입 성공', { uid: currentUser.uid, role: data.role });
        trackSignupAnalytics(currentUser.uid, data.role);

        return { user: currentUser, profile };
      } catch (innerError) {
        // [H5] 공통 롤백 함수로 phone-only 계정 정리
        await rollbackPhoneOnlyAccount(
          currentUser.uid,
          'web_signup_rollback_failed',
          data.verifiedPhone
        );
        throw innerError;
      }
    }

    // ===== Native Platform =====
    // 1. Phone Auth 계정은 Step 2에서 이미 생성됨 (nativeAuth)
    const nativeAuth = requireNativeAuth();
    const nativeUser = nativeAuth.currentUser;
    if (!nativeUser) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '전화번호 인증이 필요합니다. 다시 시도해주세요.',
      });
    }

    // 2~5: 실패 시 phone-only 고아 계정 롤백을 위해 try-catch
    try {
      // 2. Email/Password credential 연결 (phone-only → email+phone)
      const NativeEmail = requireNativeEmailProvider();
      const nativeLink = requireNativeLink();
      const emailCredential = NativeEmail.credential(data.email, data.password);
      await nativeLink(nativeUser, emailCredential);

      // 3. displayName 설정
      if (nativeUpdateProfile) {
        await nativeUpdateProfile(nativeUser, { displayName: data.nickname });
      }

      // 4. Web SDK 동기화 (Firestore Security Rules용)
      // [H4 FIX] non-fatal: 실패해도 가입 진행 — login()에서 양쪽 동시 로그인하므로 복구됨
      try {
        await syncToWebAuth(data.email, data.password);
      } catch (syncError) {
        logger.warn('Web SDK 동기화 실패 - 로그인 시 자동 동기화됨', {
          component: 'authService',
          uid: nativeUser.uid,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
      }
      const webUser = getFirebaseAuth().currentUser;

      // 5. Firestore에 사용자 프로필 저장
      const profile = buildUserProfile(nativeUser.uid, data);
      await userRepository.createOrMerge(nativeUser.uid, { ...profile });

      logger.info('회원가입 성공', { uid: nativeUser.uid, role: data.role });
      trackSignupAnalytics(nativeUser.uid, data.role);

      return { user: webUser ?? (nativeUser as unknown as FirebaseUser), profile };
    } catch (innerError) {
      // [H5] 공통 롤백 함수로 phone-only 계정 정리
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
      context: { email: maskEmail(data.email), role: data.role },
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
 * 마케팅 동의 상태 업데이트
 */
export async function updateMarketingConsent(uid: string, marketingAgreed: boolean): Promise<void> {
  try {
    logger.info('마케팅 동의 업데이트', { uid, marketingAgreed });

    await userRepository.updateFields(uid, { marketingAgreed });

    logger.info('마케팅 동의 업데이트 성공', { uid, marketingAgreed });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '마케팅 동의 업데이트',
      component: 'authService',
      context: { uid, marketingAgreed },
    });
  }
}

/**
 * 사용자 프로필 업데이트
 * Firestore와 Firebase Auth를 동시에 업데이트
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<EditableProfileFields>
): Promise<void> {
  try {
    logger.info('프로필 업데이트', { uid, updates: Object.keys(updates) });

    // 1. Firestore 업데이트
    await userRepository.updateFields(uid, updates);

    // 2. Firebase Auth 업데이트 (photoURL 또는 nickname 변경 시)
    // Note: name(본명)은 본인인증 정보이므로 수정 불가
    const currentUser = getFirebaseAuth().currentUser;
    if (currentUser && currentUser.uid === uid) {
      if ('photoURL' in updates || 'nickname' in updates) {
        const authUpdates: { photoURL?: string; displayName?: string } = {};
        if ('photoURL' in updates) {
          authUpdates.photoURL = updates.photoURL ?? undefined;
        }
        if ('nickname' in updates && updates.nickname) {
          authUpdates.displayName = updates.nickname;
        }
        if (Object.keys(authUpdates).length > 0) {
          await updateProfile(currentUser, authUpdates);
          logger.info('Firebase Auth 프로필 업데이트', {
            uid,
            fields: Object.keys(authUpdates),
          });
        }
      }
    }

    logger.info('프로필 업데이트 성공', { uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 업데이트',
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

// ============================================================================
// Social Login
// ============================================================================

/**
 * 개발 모드 여부 확인
 */
const IS_DEV_MODE = __DEV__ || process.env.NODE_ENV === 'development';

/**
 * Mock 소셜 로그인 결과 생성
 *
 * @description 개발 환경에서 소셜 로그인 테스트용 Mock 데이터 생성
 * @warning 프로덕션에서는 실제 SDK 연동 필요 (파일 상단 구현 가이드 참조)
 */
async function createMockSocialLoginResult(
  provider: 'apple' | 'google' | 'kakao',
  mockEmail: string,
  mockName: string
): Promise<AuthResult> {
  logger.warn(`[MOCK] ${provider} 소셜 로그인 - 개발 모드`, { provider });

  // Mock 이메일로 실제 Firebase 계정 생성/로그인 시도
  const mockPassword = `MockSocial_${provider}_12345!`;

  try {
    // 기존 계정으로 로그인 시도
    const userCredential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      mockEmail,
      mockPassword
    );

    const profile = await getUserProfile(userCredential.user.uid);

    if (profile) {
      logger.info(`[MOCK] ${provider} 기존 계정 로그인 성공`, {
        uid: userCredential.user.uid,
      });
      return { user: userCredential.user, profile };
    }

    // 프로필이 없으면 생성
    const newProfile = await createMockProfile(
      userCredential.user.uid,
      mockEmail,
      mockName,
      provider
    );
    return { user: userCredential.user, profile: newProfile };
  } catch (error) {
    // Firebase Auth 에러 코드 확인
    const firebaseError = error as { code?: string; message?: string };
    const errorCode = firebaseError.code ?? '';

    // 계정이 없는 경우: 신규 생성
    if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
      logger.info(`[MOCK] ${provider} 신규 계정 생성`, { email: mockEmail, errorCode });

      const userCredential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        mockEmail,
        mockPassword
      );

      await updateProfile(userCredential.user, { displayName: mockName });

      const newProfile = await createMockProfile(
        userCredential.user.uid,
        mockEmail,
        mockName,
        provider
      );

      return { user: userCredential.user, profile: newProfile };
    }

    // 비밀번호 오류 (이미 계정이 있지만 비밀번호가 다른 경우 - 기존 Mock 비밀번호 변경됨)
    if (errorCode === 'auth/wrong-password') {
      logger.warn(`[MOCK] ${provider} 비밀번호 불일치 - 비밀번호 재설정 필요`, {
        email: mockEmail,
        errorCode,
      });
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage:
          'Mock 계정 비밀번호가 변경되었습니다. Firebase Console에서 비밀번호를 재설정하거나 계정을 삭제해주세요.',
      });
    }

    // 이메일 중복 (계정 생성 시)
    if (errorCode === 'auth/email-already-in-use') {
      logger.warn(`[MOCK] ${provider} 이메일 중복`, { email: mockEmail, errorCode });
      throw new AuthError(ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS, {
        userMessage: '이미 등록된 이메일입니다. 다른 로그인 방법을 시도해주세요.',
      });
    }

    // 기타 에러: 상세 로깅 후 재throw
    logger.error(
      `[MOCK] ${provider} 소셜 로그인 실패`,
      error instanceof Error ? error : new Error(String(error)),
      {
        email: mockEmail,
        errorCode,
        errorMessage: firebaseError.message,
      }
    );
    throw error;
  }
}

/**
 * Mock 프로필 생성
 */
async function createMockProfile(
  uid: string,
  email: string,
  name: string,
  provider: 'apple' | 'google' | 'kakao'
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    email,
    name,
    nickname: name,
    role: 'staff',
    phoneVerified: false, // Mock이므로 전화번호 인증 미완료
    termsAgreed: true,
    privacyAgreed: true,
    marketingAgreed: false,
    isActive: true,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await userRepository.createOrMerge(uid, {
    ...profile,
    socialProvider: provider, // 소셜 로그인 제공자 기록
  });

  logger.info(`[MOCK] 프로필 생성 완료`, { uid, provider });

  return profile;
}

/**
 * Apple 소셜 로그인 (iOS 전용)
 *
 * @description
 * - 개발 모드: Mock 데이터로 테스트
 * - 프로덕션: expo-apple-authentication + Web SDK 인증
 *
 * 핵심: Web SDK로만 인증 (Apple credential 1회용 특성상 Native SDK 동기화 생략)
 * Firestore Security Rules는 Web SDK 토큰으로 동작하므로 문제 없음
 *
 * @returns AuthResult (신규 사용자: phoneVerified=false, 기존 사용자: phoneVerified=true)
 */
export async function signInWithApple(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult('apple', 'mock-apple@uniqn.dev', 'Apple 테스트 사용자');
  }

  try {
    logger.info('Apple 로그인 시도', { platform: Platform.OS });

    // iOS에서만 지원
    if (Platform.OS !== 'ios') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: 'Apple 로그인은 iOS에서만 사용할 수 있습니다.',
      });
    }

    // 동적 import (iOS 전용 모듈)
    const AppleAuthentication = await import('expo-apple-authentication');
    const { generateNonce, sha256 } = await import('@/utils/appleAuth');

    // Apple Sign In 가용성 확인 (Apple ID 미로그인, 2FA 미설정 등)
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage:
          'Apple 로그인을 사용할 수 없습니다. 기기 설정에서 Apple ID에 로그인되어 있는지 확인해주세요.',
      });
    }

    // 1. Nonce 생성 (replay attack 방지)
    const rawNonce = generateNonce();
    const hashedNonce = await sha256(rawNonce);

    // 2. Apple 네이티브 인증 다이얼로그
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const { identityToken } = appleCredential;
    if (!identityToken) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: 'Apple 인증 정보를 받지 못했습니다. 다시 시도해주세요.',
      });
    }

    // Apple이 제공하는 이름 (최초 로그인 시에만 제공)
    // MMKV에 즉시 캐시하여 이름 유실 방지 (Firestore 쓰기 실패 시에도 복구 가능)
    // Apple User ID로 사용자별 캐시 키 생성 (공유 기기 대응)
    const appleNameCacheKey = `apple_name_cache_${appleCredential.user}`;
    const { getMMKVInstance } = await import('@/lib/mmkvStorage');
    const mmkv = getMMKVInstance();

    let appleName: string;
    if (appleCredential.fullName) {
      const nameFromApple = [
        appleCredential.fullName.familyName,
        appleCredential.fullName.givenName,
      ]
        .filter(Boolean)
        .join('');
      if (nameFromApple) {
        appleName = nameFromApple;
        mmkv.set(appleNameCacheKey, appleName);
        logger.debug('Apple 이름 MMKV 캐시 저장', { component: 'authService' });
      } else {
        // fullName 객체는 있지만 값이 비어있음 (이름 공유 거부) → 캐시 복구 시도
        appleName = mmkv.getString(appleNameCacheKey) ?? '';
      }
    } else {
      // fullName이 null (재로그인 시) → 캐시에서 복구
      const cachedName = mmkv.getString(appleNameCacheKey);
      appleName = cachedName ?? '';
      if (cachedName) {
        logger.debug('Apple 이름 MMKV 캐시에서 복구', { component: 'authService' });
      }
    }

    // 3. Web SDK 인증 (Firestore Security Rules용 — 반드시 먼저 실행)
    // Apple credential은 1회용이므로 Web SDK를 우선 인증
    const webOAuthCredential = new OAuthProvider('apple.com').credential({
      idToken: identityToken,
      rawNonce,
    });

    const webResult = await signInWithCredential(getFirebaseAuth(), webOAuthCredential);
    logger.info('Apple 로그인: Web SDK 인증 성공', { component: 'authService' });

    // 4. Native SDK 동기화 (Cloud Function Custom Token 방식)
    // Apple credential은 1회용이라 Web SDK가 소비 후 Native SDK에 재사용 불가
    // Custom Token을 발급받아 Native SDK에 별도 인증
    const user = webResult.user;

    // 4-A. Firestore 프로필 확인 (Native SDK 동기화보다 먼저 — 기존 사용자는 동기화 불필요)
    const existingProfile = await getUserProfile(user.uid);

    if (existingProfile && existingProfile.phoneVerified) {
      // [H6] 기존 사용자 (프로필 완성됨) → Native SDK 동기화
      await syncNativeWithCustomToken(user.uid, '기존 사용자');

      await user.getIdToken(true);

      // 비활성화된 계정 체크 (명시적으로 false인 경우만)
      if (existingProfile.isActive === false) {
        throw new AuthError(ERROR_CODES.AUTH_ACCOUNT_DISABLED, {
          userMessage: '비활성화된 계정입니다. 고객센터에 문의해주세요',
        });
      }

      logger.info('Apple 로그인 성공 (기존 사용자)', { uid: user.uid });
      trackLogin('apple');
      setUserId(user.uid);
      setUserProperties({
        user_role: existingProfile.role,
        has_verified_phone: true,
      });
      return { user, profile: existingProfile };
    }

    // [H6] 4-B. 신규/미완성 사용자: Native SDK 동기화 시도 (best-effort)
    // 실패해도 Web SDK fallback으로 전화번호 link 가능
    const nativeSyncSuccess = await syncNativeWithCustomToken(user.uid, '신규 사용자');
    if (!nativeSyncSuccess) {
      logger.warn('Apple 로그인: Native SDK 동기화 최종 실패 - Web SDK fallback으로 진행', {
        component: 'authService',
        uid: user.uid,
      });
    }

    // 6. 신규/미완성 사용자 → 최소 프로필 생성
    if (!existingProfile) {
      const now = Timestamp.now();

      // Firestore에 저장할 데이터 (serverTimestamp 사용)
      await userRepository.createOrMerge(user.uid, {
        uid: user.uid,
        email: user.email || '',
        name: appleName,
        role: 'staff',
        socialProvider: 'apple',
        phoneVerified: false,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 프로필 생성 후 best-effort 토큰 갱신 (onUserRoleChange 트리거가 Claims 설정)
      // 신규 사용자는 phoneVerified=false → signup 플로우이므로 claims 즉시 불필요
      try {
        await user.getIdToken(true);
      } catch {
        // Claims 미설정이어도 signup 플로우 진행 가능
      }

      // 클라이언트 반환용 프로필 (Timestamp.now() — serverTimestamp는 FieldValue이므로 직접 사용 불가)
      const minimalProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: appleName,
        role: 'staff',
        socialProvider: 'apple',
        phoneVerified: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      logger.info('Apple 신규 사용자 최소 프로필 생성', { uid: user.uid });
      return { user, profile: minimalProfile };
    }

    // 기존 프로필 있지만 phoneVerified=false (이전에 중단된 가입)
    await user.getIdToken(true);
    logger.info('Apple 로그인 성공 (미완성 프로필)', { uid: user.uid });
    return { user, profile: existingProfile };
  } catch (error) {
    // 사용자 취소 처리
    // expo-apple-authentication은 취소 시 code='ERR_REQUEST_CANCELED'인 CodedError를 throw
    const errorCode = (error as { code?: string }).code;

    if (errorCode === 'ERR_REQUEST_CANCELED' || errorCode === 'ERR_CANCELED') {
      logger.info('Apple 로그인 취소', { component: 'authService' });
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '', // 빈 메시지 → login.tsx에서 toast 미표시
      });
    }

    // Apple 인증 실패 (다이얼로그 표시 전 거부)
    // 원인: 기기 과열(thermal throttling), Apple ID 미설정, 2FA 미활성화 등
    if (errorCode === 'ERR_REQUEST_UNKNOWN') {
      logger.warn('Apple 인증 거부 (ERR_REQUEST_UNKNOWN)', {
        component: 'authService',
        platform: Platform.OS,
        hint: 'thermal_state/memory 부족 또는 Apple ID 설정 문제 가능',
      });
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage:
          'Apple 로그인에 실패했습니다. 기기가 과열 상태이거나 Apple ID 설정에 문제가 있을 수 있습니다. 잠시 후 다시 시도해주세요.',
        metadata: { errorCode, provider: 'apple' },
      });
    }

    // Firebase 에러 상세 로깅 (진단용)
    const errorMessage = (error as { message?: string }).message ?? '';
    const firebaseCode = errorCode;
    const firebaseMsg = errorMessage;
    logger.error(
      'Apple 로그인 실패 상세',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'authService',
        firebaseCode,
        firebaseMessage: firebaseMsg,
        platform: Platform.OS,
      }
    );

    // 부분 인증 상태 정리
    try {
      await syncSignOut();
    } catch {
      // 정리 실패 무시
    }

    // Firebase 인증 에러는 소셜 로그인 맥락에 맞는 메시지로 변환
    if (firebaseCode?.startsWith('auth/')) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: 'Apple 로그인에 실패했습니다. 다시 시도해주세요.',
        metadata: { firebaseCode, provider: 'apple' },
      });
    }

    throw handleServiceError(error, {
      operation: 'Apple 로그인',
      component: 'authService',
    });
  }
}

/**
 * 소셜 로그인 프로필 완성
 *
 * @description Apple 로그인 후 기존 회원가입 Step 2→3→4 데이터로 프로필 업데이트
 *
 * @param uid - Firebase Auth UID
 * @param data - Step 2(본인인증) + Step 3(프로필) + Step 4(약관) 데이터
 * @returns 업데이트된 AuthResult
 */
export interface SocialProfileData {
  // Step 2: 본인인증
  name: string;
  birthDate: string;
  gender: 'male' | 'female';
  /** 전화번호 (E.164 형식: +821012345678) */
  phone: string;
  // Step 3: 프로필
  nickname: string;
  region?: string;
  experienceYears?: number;
  career?: string;
  note?: string;
  // Step 4: 약관
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed?: boolean;
}

export async function completeSocialProfile(
  uid: string,
  data: SocialProfileData
): Promise<AuthResult> {
  try {
    logger.info('소셜 프로필 완성 시도', { uid });

    // [W7] verifyAndSaveProfile CF 호출 (서버사이드 phone 검증 + Firestore 저장)
    // CF가 전화번호 대조, 중복 검사, XSS 검증, Batch Write, Claims 설정을 모두 처리
    const verifyAndSave = httpsCallable<
      {
        verifiedPhone: string;
        name: string;
        birthDate: string;
        gender: 'male' | 'female';
        nickname: string;
        region?: string;
        experienceYears?: number;
        career?: string;
        note?: string;
        termsAgreed: boolean;
        privacyAgreed: boolean;
        marketingAgreed: boolean;
        mode: 'signup' | 'social';
      },
      { success: boolean; uid: string }
    >(getFirebaseFunctions(), 'verifyAndSaveProfile');

    await verifyAndSave({
      verifiedPhone: data.phone,
      name: data.name,
      birthDate: data.birthDate,
      gender: data.gender,
      nickname: data.nickname,
      region: data.region,
      experienceYears: data.experienceYears,
      career: data.career,
      note: data.note,
      termsAgreed: data.termsAgreed,
      privacyAgreed: data.privacyAgreed,
      marketingAgreed: data.marketingAgreed ?? false,
      mode: 'social',
    });

    // Custom Claims 갱신 (CF가 setCustomUserClaims 호출 후, 클라이언트 토큰 새로고침)
    try {
      const claimsUser = getFirebaseAuth().currentUser;
      if (claimsUser) {
        await claimsUser.getIdToken(true);
        logger.info('소셜 프로필 완성 후 Custom Claims 갱신 완료', { uid });
      }
    } catch (claimsError) {
      logger.warn('소셜 프로필 완성 후 Claims 갱신 실패 (무시)', {
        uid,
        error: claimsError instanceof Error ? claimsError.message : String(claimsError),
      });
    }

    // 업데이트된 프로필 조회
    const updatedProfile = await getUserProfile(uid);
    if (!updatedProfile) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '프로필 업데이트 후 조회에 실패했습니다.',
      });
    }

    logger.info('소셜 프로필 완성 성공', { uid });

    // 반환 시점에 user 확인
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '인증 정보가 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    // Analytics — Firestore에서 socialProvider 조회하여 정확한 provider 기록
    const provider = updatedProfile.socialProvider;
    if (provider === 'apple' || provider === 'google' || provider === 'kakao') {
      trackSignup(provider);
    }
    setUserId(uid);
    setUserProperties({
      user_role: 'staff',
      account_created_date: new Date().toISOString().split('T')[0],
      has_verified_phone: true,
    });

    return { user: currentUser, profile: updatedProfile };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '소셜 프로필 완성',
      component: 'authService',
      context: { uid },
    });
  }
}

/**
 * Google 소셜 로그인
 *
 * @description
 * - 개발 모드: Mock 데이터로 테스트
 * - 프로덕션: @react-native-google-signin/google-signin 필요
 *
 * 구현 가이드:
 * 1. @react-native-google-signin/google-signin 설치
 * 2. google-services.json (Android) / GoogleService-Info.plist (iOS) 추가
 * 3. EAS Build 실행
 * 4. Firebase Console에서 Google 로그인 활성화
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult('google', 'mock-google@uniqn.dev', 'Google 테스트 사용자');
  }

  // 구현 예정:
  // import { GoogleSignin } from '@react-native-google-signin/google-signin';
  // await GoogleSignin.hasPlayServices();
  // const { idToken } = await GoogleSignin.signIn();
  // const googleCredential = GoogleAuthProvider.credential(idToken);
  // const userCredential = await signInWithCredential(getFirebaseAuth(), googleCredential);

  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: 'Google 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}

/**
 * 카카오 소셜 로그인
 *
 * @description
 * - 개발 모드: Mock 데이터로 테스트
 * - 프로덕션: @react-native-seoul/kakao-login + Cloud Functions 필요
 *
 * 구현 가이드:
 * 1. @react-native-seoul/kakao-login 설치
 * 2. Kakao Developers에서 앱 등록 및 네이티브 키 발급
 * 3. Cloud Functions에서 Custom Token 발급 엔드포인트 구현
 * 4. EAS Build 실행
 */
export async function signInWithKakao(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult('kakao', 'mock-kakao@uniqn.dev', '카카오 테스트 사용자');
  }

  // 구현 예정:
  // import { login as kakaoLogin } from '@react-native-seoul/kakao-login';
  // const token = await kakaoLogin();
  // Firebase Custom Token 방식 또는 Functions 연동 필요

  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: '카카오 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}

// ============================================================================
// Password & Profile Photo Management
// ============================================================================

/**
 * 비밀번호 변경
 *
 * @param currentPassword 현재 비밀번호
 * @param newPassword 새 비밀번호
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user || !user.email) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '로그인이 필요합니다',
      });
    }

    logger.info('비밀번호 변경 시도', { uid: user.uid });

    // 1. 현재 비밀번호로 재인증
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // 2. 새 비밀번호로 변경
    await updatePassword(user, newPassword);

    logger.info('비밀번호 변경 성공', { uid: user.uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '비밀번호 변경',
      component: 'authService',
    });
  }
}

// ============================================================================
// Employer Registration
// ============================================================================

/**
 * 구인자로 등록 (staff → employer 역할 변경)
 *
 * @description
 * - 본인인증이 완료된 staff만 구인자로 등록 가능
 * - 이용약관 및 서약서 동의 필수
 * - 즉시 승인 (관리자 승인 불필요)
 * - Transaction으로 Race Condition 방지
 *
 * @returns 업데이트된 프로필 (Timestamp 타입)
 */
export async function registerAsEmployer(): Promise<UserProfile> {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '로그인이 필요합니다',
      });
    }

    logger.info('구인자 등록 시도', { uid: user.uid });

    // Repository를 통한 Transaction 처리
    const updatedProfile = await userRepository.registerAsEmployer(user.uid);

    logger.info('구인자 등록 성공', { uid: user.uid });

    // Analytics 이벤트
    setUserProperties({
      user_role: 'employer',
    });

    return updatedProfile as UserProfile;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '구인자 등록',
      component: 'authService',
    });
  }
}

/**
 * 프로필 사진 URL 업데이트
 *
 * @param uid 사용자 ID
 * @param photoURL 새 프로필 사진 URL (null이면 삭제)
 */
export async function updateProfilePhotoURL(uid: string, photoURL: string | null): Promise<void> {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '로그인이 필요합니다',
      });
    }

    logger.info('프로필 사진 업데이트', { uid });

    // 1. Firebase Auth 프로필 업데이트
    await updateProfile(user, { photoURL });

    // 2. Firestore 사용자 문서 업데이트
    await userRepository.updateFields(uid, { photoURL: photoURL ?? null });

    logger.info('프로필 사진 업데이트 성공', { uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 사진 업데이트',
      component: 'authService',
      context: { uid },
    });
  }
}

/**
 * 전화번호 중복 확인 (Cloud Function 호출)
 *
 * @param phone 전화번호 (숫자만 또는 E.164 형식)
 * @returns 중복 여부
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  try {
    const { getRecaptchaToken } = await import('@/utils/recaptcha');
    const recaptchaToken = await getRecaptchaToken('check_phone');

    const checkPhone = httpsCallable<
      { phone: string; recaptchaToken?: string; platform?: string },
      { exists: boolean }
    >(getFirebaseFunctions(), 'checkPhoneExists');
    const result = await checkPhone({
      phone,
      recaptchaToken: recaptchaToken || undefined,
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
