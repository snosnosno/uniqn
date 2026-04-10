/**
 * UNIQN Mobile - 프로필 관리 서비스
 *
 * @description 프로필 업데이트, 비밀번호 변경, 구인자 등록, 프로필 사진 관리
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { invalidateQueries } from '@/lib/queryClient';
import { userRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AuthError, PermissionError, ValidationError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isSafeUrl } from '@/utils/security';
import { setUserProperties } from '@/services/observability/analyticsService';
import type { EditableProfileFields } from '@/types';
import type { UserProfile } from './authTypes';
import { requireCurrentUser } from './authCoreService';
import type { EmployerRegistrationInput } from '@/repositories/interfaces/IUserRepository';

// ============================================================================
// Profile Management
// ============================================================================

/**
 * 마케팅 동의 상태 업데이트
 */
export async function updateMarketingConsent(uid: string, marketingAgreed: boolean): Promise<void> {
  const currentUser = await requireCurrentUser();
  if (uid !== currentUser.id) {
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
  const currentUser = await requireCurrentUser();
  if (uid !== currentUser.id) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '권한이 없습니다',
    });
  }

  try {
    logger.info('프로필 업데이트', { uid, updates: Object.keys(updates) });

    // Supabase user_metadata 업데이트 (닉네임, 프로필 사진)
    const metadataUpdates: Record<string, string | undefined> = {};
    if ('nickname' in updates && updates.nickname) {
      metadataUpdates.name = updates.nickname;
    }
    if ('photoURL' in updates) {
      metadataUpdates.avatar_url = updates.photoURL ?? undefined;
    }

    if (Object.keys(metadataUpdates).length > 0) {
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: metadataUpdates,
      });
      if (authUpdateError) {
        logger.warn('Supabase Auth 프로필 업데이트 실패', {
          component: 'profileService',
          uid,
          error: authUpdateError.message,
        });
      }
    }

    await userRepository.updateFields(uid, updates);

    void invalidateQueries.user();
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '로그인이 필요합니다',
      });
    }

    logger.info('비밀번호 변경 시도', { uid: user.id });

    // 1. 현재 비밀번호로 재인증
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reAuthError) {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage: '현재 비밀번호가 올바르지 않습니다.',
        originalError: new Error(reAuthError.message),
      });
    }

    // 2. 새 비밀번호로 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) throw updateError;

    logger.info('비밀번호 변경 성공', { uid: user.id });
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
export async function registerAsEmployer(input: EmployerRegistrationInput): Promise<UserProfile> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '로그인이 필요합니다',
      });
    }

    logger.info('구인자 등록 시도', { uid: user.id });

    // Repository를 통한 Transaction 처리
    const updatedProfile = await userRepository.registerAsEmployer(user.id, input);

    logger.info('구인자 등록 성공', { uid: user.id });

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
  const currentUser = await requireCurrentUser();
  if (uid !== currentUser.id) {
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

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: { avatar_url: photoURL },
    });
    if (authUpdateError) {
      logger.warn('Supabase Auth 프로필 사진 업데이트 실패', {
        component: 'profileService',
        uid,
        error: authUpdateError.message,
      });
    }

    await userRepository.updateFields(uid, { photoURL: photoURL ?? null });

    void invalidateQueries.user();
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
  const currentUser = await requireCurrentUser();
  const uid = currentUser.id;

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

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: { name: data.nickname },
    });
    if (authUpdateError) {
      logger.warn('Supabase Auth displayName 업데이트 실패', {
        component: 'profileService',
        uid,
        error: authUpdateError.message,
      });
    }

    await userRepository.updateFields(uid, firestoreUpdates);

    logger.info('프로필 완성 성공', { uid, nickname: data.nickname });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '프로필 완성',
      component: 'profileService',
      context: { uid },
    });
  }
}
