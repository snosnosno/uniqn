/**
 * UNIQN Mobile - 인증 서비스
 *
 * @description Firebase Auth 기반 인증 서비스
 * @version 1.0.0
 *
 * TODO [출시 전]: Apple 소셜 로그인 구현
 * TODO [출시 전]: Google 소셜 로그인 구현
 * TODO [출시 전]: 카카오 소셜 로그인 구현
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
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  AuthError,
  BusinessError,
  ERROR_CODES,
  mapFirebaseError,
  toError,
} from '@/errors';
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
// Auth Service
// ============================================================================

/**
 * 이메일/비밀번호 로그인
 */
export async function login(data: LoginFormData): Promise<AuthResult> {
  try {
    logger.info('로그인 시도', { email: data.email });

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
    logger.error('로그인 실패', toError(error), { email: data.email });
    throw mapFirebaseError(error);
  }
}

/**
 * 회원가입 (4단계 완료 후 호출)
 */
export async function signUp(data: SignUpFormData): Promise<AuthResult> {
  try {
    logger.info('회원가입 시도', { email: data.email, role: data.role });

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
      // 동의 정보
      termsAgreed: data.termsAgreed,
      privacyAgreed: data.privacyAgreed,
      marketingAgreed: data.marketingAgreed,
      // 메타데이터
      isActive: true,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(doc(getFirebaseDb(), 'users', user.uid), profile);

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
    logger.error('회원가입 실패', toError(error), { email: data.email });
    throw mapFirebaseError(error);
  }
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
  try {
    logger.info('로그아웃 시도');
    await firebaseSignOut(getFirebaseAuth());

    // Analytics 이벤트
    trackLogout();
    setUserId(null);

    logger.info('로그아웃 성공');
  } catch (error) {
    logger.error('로그아웃 실패', toError(error));
    throw mapFirebaseError(error);
  }
}

/**
 * 비밀번호 재설정 이메일 전송
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    logger.info('비밀번호 재설정 이메일 전송', { email });
    await sendPasswordResetEmail(getFirebaseAuth(), email);
    logger.info('비밀번호 재설정 이메일 전송 성공', { email });
  } catch (error) {
    logger.error('비밀번호 재설정 실패', toError(error), { email });
    throw mapFirebaseError(error);
  }
}

/**
 * 사용자 프로필 가져오기
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(getFirebaseDb(), 'users', uid));

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as UserProfile;
  } catch (error) {
    logger.error('프로필 조회 실패', toError(error), { uid });
    throw mapFirebaseError(error);
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
    await updateDoc(doc(getFirebaseDb(), 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // 2. Firebase Auth 업데이트 (name, photoURL 변경 시)
    const currentUser = getFirebaseAuth().currentUser;
    if (currentUser && currentUser.uid === uid) {
      const authUpdates: { displayName?: string; photoURL?: string } = {};

      // name(본명)이 변경되면 displayName 업데이트
      if (updates.name) {
        authUpdates.displayName = updates.name;
      }

      // photoURL이 변경되면 Firebase Auth도 업데이트
      if ('photoURL' in updates) {
        authUpdates.photoURL = updates.photoURL ?? undefined;
      }

      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(currentUser, authUpdates);
        logger.info('Firebase Auth 프로필 업데이트', { uid, fields: Object.keys(authUpdates) });
      }
    }

    logger.info('프로필 업데이트 성공', { uid });
  } catch (error) {
    logger.error('프로필 업데이트 실패', toError(error), { uid });
    throw mapFirebaseError(error);
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
    logger.error('재인증 실패', toError(error));
    throw mapFirebaseError(error);
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
export function onAuthStateChanged(
  callback: (user: FirebaseUser | null) => void
): () => void {
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
 * TODO [출시 전]: 실제 소셜 로그인으로 교체 필수
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
  } catch {
    // 계정이 없으면 새로 생성
    logger.info(`[MOCK] ${provider} 신규 계정 생성`, { email: mockEmail });

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

  await setDoc(doc(getFirebaseDb(), 'users', uid), {
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
 * - 프로덕션: 실제 Apple 인증 필요 (TODO)
 *
 * TODO [출시 전]: expo-apple-authentication 사용 구현
 */
export async function signInWithApple(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult(
      'apple',
      'mock-apple@uniqn.dev',
      'Apple 테스트 사용자'
    );
  }

  // TODO [출시 전]: 실제 Apple 로그인 구현
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
 * - 프로덕션: 실제 Google 인증 필요 (TODO)
 *
 * TODO [P1]: @react-native-google-signin/google-signin 사용 구현
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult(
      'google',
      'mock-google@uniqn.dev',
      'Google 테스트 사용자'
    );
  }

  // TODO [P1]: 실제 Google 로그인 구현
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
 * - 프로덕션: 실제 카카오 인증 필요 (TODO)
 *
 * TODO [P1]: @react-native-seoul/kakao-login 사용 구현
 */
export async function signInWithKakao(): Promise<AuthResult> {
  if (IS_DEV_MODE) {
    return createMockSocialLoginResult(
      'kakao',
      'mock-kakao@uniqn.dev',
      '카카오 테스트 사용자'
    );
  }

  // TODO [P1]: 실제 카카오 로그인 구현
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
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
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
    logger.error('비밀번호 변경 실패', toError(error));
    throw mapFirebaseError(error);
  }
}

/**
 * 프로필 사진 URL 업데이트
 *
 * @param uid 사용자 ID
 * @param photoURL 새 프로필 사진 URL (null이면 삭제)
 */
export async function updateProfilePhotoURL(
  uid: string,
  photoURL: string | null
): Promise<void> {
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
    await updateDoc(doc(getFirebaseDb(), 'users', uid), {
      photoURL: photoURL ?? null,
      updatedAt: serverTimestamp(),
    });

    logger.info('프로필 사진 업데이트 성공', { uid });
  } catch (error) {
    logger.error('프로필 사진 업데이트 실패', toError(error), { uid });
    throw mapFirebaseError(error);
  }
}
