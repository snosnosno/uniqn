/**
 * UNIQN Mobile - 소셜 로그인 서비스
 *
 * @description Apple/Google/카카오 소셜 로그인 및 프로필 완성
 * @version 1.0.0
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
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  OAuthProvider,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';
import { syncSignOut } from '@/lib/authBridge';
import { getNativeAuth, nativeSignInWithCustomToken } from '@/lib/nativeAuth';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AuthError, BusinessError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { sanitizeInput } from '@/utils/security';
import { trackLogin, trackSignup, setUserId, setUserProperties } from '@/services/observability';
import {
  type UserProfile,
  type AuthResult,
  type SocialProfileData,
  callVerifyAndSaveProfile,
} from './authTypes';
import { getUserProfile } from './authCoreService';

// ============================================================================
// Internal Helpers
// ============================================================================

/** 개발 모드 여부 확인 */
const IS_DEV_MODE = __DEV__;

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

// ============================================================================
// Social Login
// ============================================================================

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

    // 2. Apple 네이티브 인증 다이얼로그 (30초 타임아웃)
    const { withTimeout } = await import('@/utils/timeout');
    const APPLE_SIGN_IN_TIMEOUT_MS = 30_000;
    const appleCredential = await withTimeout(
      AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      }),
      APPLE_SIGN_IN_TIMEOUT_MS,
      'Apple 로그인 응답 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도해주세요.'
    );

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

    // XSS 방어: Apple 이름 sanitization (CF 최종 검증 전 임시 보호)
    appleName = sanitizeInput(appleName).slice(0, 20);

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
    const nativeSyncSuccess = await syncNativeWithCustomToken(user.uid, '신규 사용자');
    if (!nativeSyncSuccess) {
      logger.warn('Apple 로그인: Native SDK 동기화 최종 실패 — Web SDK fallback으로 진행', {
        component: 'authService',
        uid: user.uid,
        impact: 'PhoneVerification link 모드에서 Web SDK fallback 사용, 오프라인 기능 제한',
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
    const errorCode = (error as { code?: string }).code;

    if (errorCode === 'ERR_REQUEST_CANCELED' || errorCode === 'ERR_CANCELED') {
      logger.info('Apple 로그인 취소', { component: 'authService' });
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '', // 빈 메시지 → login.tsx에서 toast 미표시
      });
    }

    // Apple 인증 실패 (다이얼로그 표시 전 거부)
    if (errorCode === 'ERR_REQUEST_UNKNOWN') {
      logger.warn('Apple 인증 거부 (ERR_REQUEST_UNKNOWN)', {
        component: 'authService',
        platform: Platform.OS,
        hint: 'Apple ID 설정 문제 또는 네트워크 오류 가능',
      });
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage:
          'Apple 로그인에 실패했습니다. 다음을 확인해주세요:\n' +
          '• 설정 > Apple ID에 로그인되어 있는지\n' +
          '• 이중 인증(2FA)이 활성화되어 있는지\n' +
          '• 네트워크 연결이 정상인지\n\n' +
          '문제가 계속되면 잠시 후 다시 시도해주세요.',
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
export async function completeSocialProfile(
  uid: string,
  data: SocialProfileData
): Promise<AuthResult> {
  try {
    logger.info('소셜 프로필 완성 시도', { uid });

    // 공통 CF 호출: 서버사이드 phone 검증 + Firestore 저장 + Claims 설정
    await callVerifyAndSaveProfile({
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

  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: '카카오 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
}
