/**
 * UNIQN Mobile - 인증 서비스
 *
 * @description Firebase Auth 기반 인증 서비스
 * @version 1.0.0
 *
 * ============================================================================
 * 소셜 로그인 구현 상태
 * ============================================================================
 * 현재: Mock 구현 (개발 모드에서만 동작)
 *
 * TODO [P1]: Apple 소셜 로그인 구현 (expo-apple-authentication)
 * TODO [P1]: Google 소셜 로그인 구현 (@react-native-google-signin/google-signin)
 * TODO [P2]: 카카오 소셜 로그인 구현 (@react-native-seoul/kakao-login + Cloud Functions)
 *
 * 필요 작업:
 * 1. 각 SDK 설치 및 네이티브 설정 (EAS Build 필요)
 * 2. Firebase Console에서 제공자 활성화
 * 3. Apple/Google: Developer Console에서 앱 등록
 * 4. 카카오: Kakao Developers에서 앱 등록 + Cloud Functions 연동
 * ============================================================================
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  User as FirebaseUser,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import {
  doc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';
import { AuthError, BusinessError, ERROR_CODES } from '@/errors';
import { handleServiceError, maskValue } from '@/errors/serviceErrorHandler';
import {
  trackLogin,
  trackSignup,
  trackLogout,
  setUserId,
  setUserProperties,
} from './analyticsService';
import type { FirestoreUserProfile, EditableProfileFields } from '@/types';
import { linkIdentityVerification } from './identityVerificationService';
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
 * 생년월일(YYYYMMDD)에서 출생년도 추출
 */
function extractBirthYear(birthDate?: string): number | undefined {
  if (!birthDate || birthDate.length < 4) return undefined;
  return parseInt(birthDate.substring(0, 4), 10);
}

// ============================================================================
// Auth Service
// ============================================================================

/**
 * 이메일/비밀번호 로그인
 */
export async function login(data: LoginFormData): Promise<AuthResult> {
  try {
    logger.info('로그인 시도', { email: maskEmail(data.email) });

    const userCredential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      data.email,
      data.password
    );

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

    // Analytics 이벤트
    trackLogin('email');
    setUserId(userCredential.user.uid);
    setUserProperties({
      user_role: profile.role,
      has_verified_phone: !!profile.verifiedPhone,
    });

    return {
      user: userCredential.user,
      profile,
    };
  } catch (error) {
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
 * @param email 확인할 이메일
 * @returns 이메일이 이미 존재하면 true, 없으면 false
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    logger.info('이메일 중복 확인', { email: maskEmail(email) });

    const methods = await fetchSignInMethodsForEmail(getFirebaseAuth(), email);
    const exists = methods.length > 0;

    logger.info('이메일 중복 확인 완료', { email: maskEmail(email), exists });

    return exists;
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
    logger.info('회원가입 시도', { email: maskEmail(data.email), role: data.role });

    // 1. Firebase Auth 사용자 생성
    const userCredential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      data.email,
      data.password
    );

    const { user } = userCredential;

    // 2. 프로필 업데이트
    await updateProfile(user, {
      displayName: data.nickname,
    });

    // 3. Firestore에 사용자 프로필 저장
    const profile: UserProfile = {
      uid: user.uid,
      email: data.email,
      name: data.verifiedName || data.nickname,
      nickname: data.nickname,
      phone: data.verifiedPhone,
      role: data.role,
      // 본인인증 정보
      identityVerified: data.identityVerified,
      identityProvider: data.identityProvider,
      verifiedName: data.verifiedName,
      verifiedPhone: data.verifiedPhone,
      verifiedBirthDate: data.verifiedBirthDate,
      verifiedGender: data.verifiedGender,
      // 파생 정보 (본인인증 데이터에서 추출)
      birthYear: extractBirthYear(data.verifiedBirthDate),
      gender: data.verifiedGender,
      // CI/DI는 linkIdentityVerification CF에서 서버 전용 저장 (클라이언트 미포함)
      // 동의 정보
      termsAgreed: data.termsAgreed,
      privacyAgreed: data.privacyAgreed,
      marketingAgreed: data.marketingAgreed,
      // 메타데이터
      isActive: true,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    // merge: true로 Cloud Function이 먼저 생성한 문서를 덮어씀
    await userRepository.createOrMerge(user.uid, { ...profile });

    // CI/DI 서버 전용 연결 (pendingVerifications → users/{uid})
    // 최대 2회 재시도 (네트워크 일시 오류 대응)
    if (data.identityVerificationId) {
      const MAX_LINK_RETRIES = 2;
      let linkSuccess = false;

      for (let attempt = 1; attempt <= MAX_LINK_RETRIES; attempt++) {
        try {
          await linkIdentityVerification(data.identityVerificationId);
          logger.info('본인인증 CI/DI 연결 완료', { uid: user.uid, attempt });
          linkSuccess = true;
          break;
        } catch (linkError) {
          logger.warn(`본인인증 CI/DI 연결 실패 (시도 ${attempt}/${MAX_LINK_RETRIES})`, {
            uid: user.uid,
            identityVerificationId: data.identityVerificationId,
            error: linkError,
          });
          // 마지막 시도가 아니면 500ms 대기 후 재시도
          if (attempt < MAX_LINK_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      if (!linkSuccess) {
        logger.error('본인인증 CI/DI 연결 최종 실패 (가입은 완료됨, 재인증 필요)', {
          uid: user.uid,
          identityVerificationId: data.identityVerificationId,
        });
      }
    }

    logger.info('회원가입 성공', { uid: user.uid, role: data.role });

    // Analytics 이벤트
    trackSignup('email');
    setUserId(user.uid);
    setUserProperties({
      user_role: data.role,
      account_created_date: new Date().toISOString().split('T')[0],
      has_verified_phone: data.identityVerified,
    });

    return {
      user,
      profile,
    };
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

    await firebaseSignOut(getFirebaseAuth());

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

    // 2. Firebase Auth 업데이트 (photoURL 변경 시)
    // Note: name(본명)은 본인인증 정보이므로 수정 불가
    const currentUser = getFirebaseAuth().currentUser;
    if (currentUser && currentUser.uid === uid) {
      // photoURL이 변경되면 Firebase Auth도 업데이트
      if ('photoURL' in updates) {
        const authUpdates: { photoURL?: string } = {
          photoURL: updates.photoURL ?? undefined,
        };
        await updateProfile(currentUser, authUpdates);
        logger.info('Firebase Auth 프로필 업데이트', { uid, fields: ['photoURL'] });
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
    identityVerified: false, // Mock이므로 본인인증 미완료
    identityProvider: undefined,
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
 * Apple 소셜 로그인
 *
 * @description
 * - 개발 모드: Mock 데이터로 테스트
 * - 프로덕션: expo-apple-authentication 필요
 *
 * 구현 가이드:
 * 1. expo-apple-authentication 설치
 * 2. app.config.ts에 usesAppleSignIn: true 설정
 * 3. EAS Build 실행
 * 4. Apple Developer Console에서 Sign in with Apple 활성화
 */
export async function signInWithApple(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult('apple', 'mock-apple@uniqn.dev', 'Apple 테스트 사용자');
  }

  // 구현 예정:
  // import * as AppleAuthentication from 'expo-apple-authentication';
  // const credential = await AppleAuthentication.signInAsync({...});
  // const oAuthCredential = OAuthProvider.credential('apple.com', credential.identityToken);
  // const userCredential = await signInWithCredential(getFirebaseAuth(), oAuthCredential);

  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage: 'Apple 로그인은 아직 준비 중입니다. 다른 로그인 방식을 이용해주세요',
  });
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

    const db = getFirebaseDb();
    const userRef = doc(db, 'users', user.uid);

    // Transaction으로 원자적 처리 (Race Condition 방지)
    const updatedProfile = await runTransaction(db, async (transaction) => {
      // 1. 현재 프로필 조회 (Transaction 내에서)
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '사용자 정보를 찾을 수 없습니다',
        });
      }

      const profile = userDoc.data() as UserProfile;

      // 2. 이미 구인자인 경우
      if (profile.role === 'employer' || profile.role === 'admin') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 구인자로 등록되어 있습니다',
        });
      }

      // 3. 본인인증 확인
      if (!profile.identityVerified) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '본인인증을 먼저 완료해주세요',
        });
      }

      // 4. Firestore 업데이트
      const now = serverTimestamp();
      const updateData = {
        role: 'employer' as const,
        employerAgreements: {
          termsAgreedAt: now,
          liabilityWaiverAgreedAt: now,
        },
        employerRegisteredAt: now,
        updatedAt: now,
      };

      transaction.update(userRef, updateData);

      // 5. 업데이트된 프로필 반환 (serverTimestamp는 실제 값으로 대체)
      const timestamp = Timestamp.now();
      return {
        ...profile,
        role: 'employer' as const,
        employerAgreements: {
          termsAgreedAt: timestamp,
          liabilityWaiverAgreedAt: timestamp,
        },
        employerRegisteredAt: timestamp,
        updatedAt: timestamp,
      } as UserProfile;
    });

    logger.info('구인자 등록 성공', { uid: user.uid });

    // 6. Analytics 이벤트
    setUserProperties({
      user_role: 'employer',
    });

    return updatedProfile;
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
