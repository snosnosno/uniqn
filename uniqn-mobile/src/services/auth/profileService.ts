/**
 * UNIQN Mobile - 프로필 관리 서비스
 *
 * @description 프로필 업데이트, 비밀번호 변경, 구인자 등록, 프로필 사진 관리
 * @version 1.0.0
 */

import { supabase } from '@/lib/supabase';
import { invalidateQueries } from '@/lib/queryClient';
import { userRepository, employerApplicationRepository } from '@/repositories';
import type { RegisterAsEmployerResult } from '@/repositories';
import { logger } from '@/utils/logger';
import { AuthError, PermissionError, ValidationError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isSafeUrl } from '@/utils/security';
import type { EditableProfileFields } from '@/types';
import { requireCurrentUser } from './authCoreService';

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

    // 2026-05-16: Set once — gender 는 본인인증 또는 최초 보완 입력 이후 변경 불가.
    // DB 에 이미 값이 있으면 클라가 보낸 gender 를 drop 한다 (UI 도 read-only 지만 다중 방어).
    const safeUpdates: Partial<EditableProfileFields> = { ...updates };
    if (safeUpdates.gender !== undefined) {
      const existing = await userRepository.getById(uid);
      if (existing?.gender) {
        delete safeUpdates.gender;
        logger.info('updateUserProfile: gender 기존 값 보존 (set-once)', {
          uid,
          existingGender: existing.gender,
        });
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      logger.info('updateUserProfile: 적용할 변경 없음', { uid });
      void invalidateQueries.user();
      return;
    }

    await userRepository.updateFields(uid, safeUpdates);

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
 * 구인자 등록 신청 (staff → pending 신청 생성)
 *
 * @description
 * - 기존: 즉시 role='employer' 변경
 * - 변경: employer_applications 테이블에 pending 신청 생성 → 관리자 승인 대기
 * - 본인인증 완료된 staff만 신청 가능 (RPC 내부 검증)
 * - 이미 pending 신청 있으면 EmployerAppPendingExistsError 발생
 *
 * @param agreementsSnapshot 약관/서약 동의 스냅샷 (신청 당시 버전 고정)
 * @param intro 구인자 소개글 (주로 구인하는 지역/매장/대회, 10~300자)
 * @returns 신청 결과 (applicationId, status='pending', submittedAt)
 */
export async function registerAsEmployer(
  agreementsSnapshot: Record<string, unknown>,
  intro: string
): Promise<RegisterAsEmployerResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '로그인이 필요합니다',
      });
    }

    logger.info('구인자 등록 신청', { uid: user.id });

    const result = await employerApplicationRepository.register(agreementsSnapshot, intro);

    void invalidateQueries.user();
    void invalidateQueries.employerApplications();

    logger.info('구인자 등록 신청 완료 — 관리자 승인 대기', {
      uid: user.id,
      applicationId: result.applicationId,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '구인자 등록 신청',
      component: 'profileService',
    });
  }
}

/**
 * 프로필 사진 URL 업데이트
 *
 * @param uid 사용자 ID
 * @param photoURL 새 프로필 사진 URL (null이면 삭제)
 * @param photoURLBlurhash impeccable v2 §18 — blurhash placeholder 해시 (선택)
 */
export async function updateProfilePhotoURL(
  uid: string,
  photoURL: string | null,
  photoURLBlurhash: string | null = null
): Promise<void> {
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

    await userRepository.updateFields(uid, {
      photoURL: photoURL ?? null,
      photoURLBlurhash: photoURL ? photoURLBlurhash : null,
    });

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
  /**
   * 2026-05-16: PortOne 본인인증에서 gender 가 누락된 사용자의 보완 입력.
   * 이미 본인인증으로 값이 들어와 있으면 화면이 필드를 노출하지 않으므로 caller 가 undefined 전달.
   * 서비스 레이어가 기존 값 덮어쓰기를 차단 (Set once 정책).
   */
  gender?: 'male' | 'female';
}

/**
 * 닉네임 설정 완료 (회원가입 후 첫 진입 시 1회).
 *
 * @description
 * 본인인증과 무관하게 "서비스 닉네임"을 처음 입력했을 때 호출된다.
 * 이름과 의미가 달리 보일 수 있으나 `profileCompleted` 의 실질적 의미는
 * "닉네임 입력 완료"이다. region/career/note 등은 미입력이어도 `true` 가 된다.
 *
 * - 닉네임 필수 + 선택 필드 업데이트
 * - profileCompleted = true 로 전환 (DB 컬럼: profile_completed)
 * - Supabase Auth displayName 업데이트
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
    // 2026-05-16: Set once — DB 에 이미 gender 가 있으면 클라가 보내도 무시.
    // 본인인증으로 들어온 신뢰값을 사용자 수동 입력이 덮어쓰지 못하게 보호.
    if (data.gender !== undefined) {
      const existing = await userRepository.getById(uid);
      if (!existing?.gender) {
        firestoreUpdates.gender = data.gender;
      } else {
        logger.info('completeProfile: gender 기존 값 보존 (set-once)', {
          uid,
          existingGender: existing.gender,
        });
      }
    }

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
