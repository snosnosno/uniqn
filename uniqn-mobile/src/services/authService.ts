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
import { AuthError, ERROR_CODES, mapFirebaseError } from '@/errors';
import type { UserRole } from '@/types';
import type { SignUpFormData, LoginFormData } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: UserRole;
  photoURL?: string;
  // 본인인증 정보
  identityVerified: boolean;
  identityProvider?: 'pass' | 'kakao';
  verifiedName?: string;
  verifiedPhone?: string;
  // 동의 정보
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed: boolean;
  // 메타데이터
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

    return {
      user: userCredential.user,
      profile,
    };
  } catch (error) {
    logger.error('로그인 실패', error as Error, { email: data.email });
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

    return {
      user,
      profile,
    };
  } catch (error) {
    logger.error('회원가입 실패', error as Error, { email: data.email });
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
    logger.info('로그아웃 성공');
  } catch (error) {
    logger.error('로그아웃 실패', error as Error);
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
    logger.error('비밀번호 재설정 실패', error as Error, { email });
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
    logger.error('프로필 조회 실패', error as Error, { uid });
    throw mapFirebaseError(error);
  }
}

/**
 * 사용자 프로필 업데이트
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'nickname' | 'phone' | 'photoURL' | 'marketingAgreed'>>
): Promise<void> {
  try {
    logger.info('프로필 업데이트', { uid, updates: Object.keys(updates) });

    await updateDoc(doc(getFirebaseDb(), 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    logger.info('프로필 업데이트 성공', { uid });
  } catch (error) {
    logger.error('프로필 업데이트 실패', error as Error, { uid });
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
    logger.error('재인증 실패', error as Error);
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
// Social Login (TODO: Phase 2 P1)
// ============================================================================

/**
 * Apple 소셜 로그인
 * TODO [출시 전]: expo-apple-authentication 사용 구현
 */
export async function signInWithApple(): Promise<AuthResult> {
  throw new Error('Apple 로그인은 아직 구현되지 않았습니다');
}

/**
 * Google 소셜 로그인
 * TODO [P1]: @react-native-google-signin/google-signin 사용 구현
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  throw new Error('Google 로그인은 아직 구현되지 않았습니다');
}

/**
 * 카카오 소셜 로그인
 * TODO [P1]: @react-native-seoul/kakao-login 사용 구현
 */
export async function signInWithKakao(): Promise<AuthResult> {
  throw new Error('카카오 로그인은 아직 구현되지 않았습니다');
}
