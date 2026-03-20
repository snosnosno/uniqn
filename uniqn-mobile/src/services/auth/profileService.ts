/**
 * UNIQN Mobile - 프로필 관리 서비스
 *
 * @description 프로필 업데이트, 비밀번호 변경, 구인자 등록, 프로필 사진 관리
 * @version 1.0.0
 */

import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AuthError, PermissionError, ValidationError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isSafeUrl } from '@/utils/security';
import { withAuthFirestoreSync } from '@/utils/authFirestoreSync';
import { setUserProperties } from '@/services/observability/analyticsService';
import type { EditableProfileFields } from '@/types';
import type { UserProfile } from './authTypes';
import { requireCurrentUser } from './authCoreService';

// ============================================================================
// Profile Management
// ============================================================================

/**
 * 마케팅 동의 상태 업데이트
 */
export async function updateMarketingConsent(uid: string, marketingAgreed: boolean): Promise<void> {
  const currentUser = requireCurrentUser();
  if (uid !== currentUser.uid) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '권한이 없습니다',
    });
  }

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
  const currentUser = requireCurrentUser();
  if (uid !== currentUser.uid) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '권한이 없습니다',
    });
  }

  try {
    logger.info('프로필 업데이트', { uid, updates: Object.keys(updates) });

    // Auth 업데이트 대상 구성
    // Note: name(본명)은 본인인증 정보이므로 수정 불가
    const authUpdates: { photoURL?: string; displayName?: string } = {};
    if ('photoURL' in updates) {
      authUpdates.photoURL = updates.photoURL ?? undefined;
    }
    if ('nickname' in updates && updates.nickname) {
      authUpdates.displayName = updates.nickname;
    }

    await withAuthFirestoreSync({
      user: currentUser,
      authUpdates,
      firestoreUpdate: () => userRepository.updateFields(uid, updates),
      errorMessage: '프로필 업데이트에 실패했습니다. 앱을 재시작해주세요.',
      uid,
      operationName: '프로필 업데이트',
    });

    logger.info('프로필 업데이트 성공', { uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 업데이트',
      component: 'authService',
      context: { uid },
    });
  }
}

// ============================================================================
// Password Management
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
  const currentUser = requireCurrentUser();
  if (uid !== currentUser.uid) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '권한이 없습니다',
    });
  }

  // URL 안전성 검증 (javascript:, vbscript:, data: 등 차단)
  if (photoURL && !isSafeUrl(photoURL)) {
    throw new ValidationError(ERROR_CODES.SECURITY_XSS_DETECTED, {
      userMessage: '허용되지 않는 URL 형식입니다',
    });
  }

  try {
    logger.info('프로필 사진 업데이트', { uid });

    await withAuthFirestoreSync({
      user: currentUser,
      authUpdates: { photoURL },
      firestoreUpdate: () => userRepository.updateFields(uid, { photoURL: photoURL ?? null }),
      errorMessage: '프로필 사진 업데이트에 실패했습니다. 앱을 재시작해주세요.',
      uid,
      operationName: '프로필 사진 업데이트',
    });

    logger.info('프로필 사진 업데이트 성공', { uid });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 사진 업데이트',
      component: 'authService',
      context: { uid },
    });
  }
}

// ============================================================================
// Profile Completion (회원가입 후 프로필 완성)
// ============================================================================

/**
 * 프로필 완성 데이터
 */
export interface CompleteProfileData {
  nickname: string;
  region?: string;
  experienceYears?: number;
  career?: string;
  note?: string;
}

/**
 * 프로필 완성 (회원가입 후 첫 진입 시)
 *
 * @description
 * - 닉네임 필수 + 선택 필드 업데이트
 * - profileCompleted = true로 전환
 * - Firebase Auth displayName 업데이트
 */
export async function completeProfile(data: CompleteProfileData): Promise<void> {
  const currentUser = requireCurrentUser();
  const uid = currentUser.uid;

  try {
    logger.info('프로필 완성 시도', { uid, nickname: data.nickname });

    const firestoreUpdates: Record<string, unknown> = {
      nickname: data.nickname,
      profileCompleted: true,
    };
    if (data.region !== undefined) firestoreUpdates.region = data.region;
    if (data.experienceYears !== undefined) firestoreUpdates.experienceYears = data.experienceYears;
    if (data.career !== undefined) firestoreUpdates.career = data.career;
    if (data.note !== undefined) firestoreUpdates.note = data.note;

    await withAuthFirestoreSync({
      user: currentUser,
      authUpdates: { displayName: data.nickname },
      firestoreUpdate: () => userRepository.updateFields(uid, firestoreUpdates),
      errorMessage: '프로필 완성에 실패했습니다. 앱을 재시작해주세요.',
      uid,
      operationName: '프로필 완성',
    });

    logger.info('프로필 완성 성공', { uid, nickname: data.nickname });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 완성',
      component: 'profileService',
      context: { uid },
    });
  }
}
