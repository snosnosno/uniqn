/**
 * UNIQN Mobile - 회원탈퇴 서비스
 *
 * @description Repository 패턴 기반 회원탈퇴 및 개인정보 관리 서비스
 * @version 2.0.0
 *
 * 법적 요구사항:
 * - 회원탈퇴 기능 제공 (개인정보보호법)
 * - 30일 유예 기간 후 완전 삭제
 * - 개인정보 열람/수정/삭제 권리
 */

import { Timestamp } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider, OAuthProvider } from 'firebase/auth';
import { Platform } from 'react-native';
import { getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { AuthError, toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { userRepository } from '@/repositories';
import type { DeletionReason, DeletionRequest, UserDataExport } from '@/repositories';
import type { FirestoreUserProfile, MyDataEditableFields } from '@/types';
import { STATUS } from '@/constants';

// ============================================================================
// Constants
// ============================================================================

/** 회원탈퇴 유예 기간 (일) */
const DELETION_GRACE_PERIOD_DAYS = 30;

// ============================================================================
// Types (Re-export from Repository)
// ============================================================================

export type { DeletionReason, DeletionRequest, UserDataExport };

/**
 * @deprecated UserData는 FirestoreUserProfile로 대체됨
 * @see FirestoreUserProfile from '@/types/user'
 */
export type UserData = FirestoreUserProfile;

// ============================================================================
// Deletion Reasons (Korean labels)
// ============================================================================

export const DELETION_REASONS: Record<DeletionReason, string> = {
  no_longer_needed: '더 이상 서비스를 이용하지 않아요',
  found_better_service: '다른 서비스를 이용하게 되었어요',
  privacy_concerns: '개인정보가 걱정돼요',
  too_many_notifications: '알림이 너무 많아요',
  difficult_to_use: '사용하기 어려워요',
  other: '기타',
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 회원탈퇴 요청
 *
 * @description Repository 패턴 사용
 *
 * 1. 비밀번호 재인증 (보안) - 서비스에서 처리
 * 2. 계정 비활성화 (즉시) - Repository를 통해 처리
 * 3. 30일 후 완전 삭제 예약
 */
export async function requestAccountDeletion(
  reason: DeletionReason,
  password?: string,
  reasonDetail?: string
): Promise<DeletionRequest> {
  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser || !currentUser.email) {
    throw new AuthError('E2001', {
      userMessage: '로그인이 필요합니다',
    });
  }

  try {
    logger.info('회원탈퇴 요청 시작', { userId: currentUser.uid, reason });

    // 1. 재인증 (Apple 사용자 vs 이메일 사용자 분기)
    const isAppleUser = currentUser.providerData.some(
      (p) => p.providerId === 'apple.com'
    );

    if (isAppleUser && Platform.OS === 'ios') {
      // Apple 재인증: Apple Sign In 다이얼로그 → OAuthProvider credential
      const AppleAuthentication = await import('expo-apple-authentication');
      const { generateNonce, sha256 } = await import('@/utils/appleAuth');

      const rawNonce = generateNonce();
      const hashedNonce = await sha256(rawNonce);

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        throw new AuthError('E2002', {
          userMessage: 'Apple 재인증에 실패했습니다.',
        });
      }

      const oauthCredential = new OAuthProvider('apple.com').credential({
        idToken: appleCredential.identityToken,
        rawNonce,
      });
      await reauthenticateWithCredential(currentUser, oauthCredential);
    } else if (isAppleUser) {
      // Apple 사용자가 비-iOS 플랫폼에서 탈퇴 시도
      throw new AuthError('E2002', {
        userMessage: 'Apple 계정 탈퇴는 iOS 기기에서만 가능합니다.',
      });
    } else {
      // 이메일 사용자: 비밀번호 재인증
      if (!password) {
        throw new AuthError('E2002', {
          userMessage: '비밀번호를 입력해주세요.',
        });
      }
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }

    // 2. 탈퇴 요청 정보 준비
    const now = Timestamp.now();
    const scheduledDeletion = Timestamp.fromDate(
      new Date(Date.now() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    );

    const deletionRequestData: Omit<DeletionRequest, 'userId'> = {
      reason,
      reasonDetail,
      requestedAt: now,
      scheduledDeletionAt: scheduledDeletion,
      status: STATUS.DELETION_REQUEST.PENDING,
    };

    // 3. Repository를 통해 저장
    await userRepository.requestDeletion(currentUser.uid, deletionRequestData);

    const deletionRequest: DeletionRequest = {
      userId: currentUser.uid,
      ...deletionRequestData,
    };

    logger.info('회원탈퇴 요청 완료', {
      userId: currentUser.uid,
      scheduledDeletionAt: scheduledDeletion.toDate().toISOString(),
    });

    // 4. 로그아웃은 호출자에서 처리

    return deletionRequest;
  } catch (error) {
    logger.error('회원탈퇴 요청 실패', toError(error), {
      userId: currentUser.uid,
    });

    // 비밀번호 틀린 경우
    if ((error as { code?: string }).code === 'auth/wrong-password') {
      throw new AuthError('E2002', {
        userMessage: '비밀번호가 올바르지 않습니다',
      });
    }

    throw handleServiceError(error, {
      operation: '회원탈퇴 요청',
      component: 'accountDeletionService',
      context: { userId: currentUser.uid, reason },
    });
  }
}

/**
 * 회원탈퇴 철회 (유예 기간 내)
 *
 * @description Repository 패턴 사용
 */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  try {
    logger.info('회원탈퇴 철회 요청', { userId });

    await userRepository.cancelDeletion(userId);

    logger.info('회원탈퇴 철회 완료', { userId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '회원탈퇴 철회',
      component: 'accountDeletionService',
      context: { userId },
    });
  }
}

/**
 * 내 개인정보 조회
 *
 * @description Repository 패턴 사용
 */
export async function getMyData(userId: string): Promise<FirestoreUserProfile | null> {
  try {
    logger.info('개인정보 조회', { userId });

    const profile = await userRepository.getById(userId);

    return profile;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '개인정보 조회',
      component: 'accountDeletionService',
      context: { userId },
    });
  }
}

/**
 * 개인정보 수정
 *
 * @description Repository 패턴 사용
 * my-data 화면에서 닉네임만 수정 가능
 * name, phone은 본인인증 정보라 수정 불가 (profile.tsx에서도 읽기 전용)
 */
export async function updateMyData(
  userId: string,
  updates: Partial<MyDataEditableFields>
): Promise<void> {
  try {
    logger.info('개인정보 수정', { userId, fields: Object.keys(updates) });

    await userRepository.updateProfile(userId, updates);

    logger.info('개인정보 수정 완료', { userId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '개인정보 수정',
      component: 'accountDeletionService',
      context: { userId, fields: Object.keys(updates) },
    });
  }
}

/**
 * 내 데이터 내보내기 (JSON)
 *
 * @description Repository 패턴 사용
 */
export async function exportMyData(userId: string): Promise<UserDataExport> {
  try {
    logger.info('데이터 내보내기 시작', { userId });

    const exportData = await userRepository.getExportData(userId);

    logger.info('데이터 내보내기 완료', {
      userId,
      applicationsCount: exportData.applications.length,
      workLogsCount: exportData.workLogs.length,
    });

    return exportData;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '데이터 내보내기',
      component: 'accountDeletionService',
      context: { userId },
    });
  }
}

/**
 * 계정 완전 삭제 (Cloud Functions에서 호출)
 * 유예 기간 후 실제 삭제 처리
 *
 * @description Repository 패턴 사용
 * @internal 이 함수는 Cloud Functions에서만 호출해야 합니다
 */
export async function permanentlyDeleteAccount(userId: string): Promise<void> {
  try {
    logger.info('계정 완전 삭제 시작', { userId });

    await userRepository.permanentlyDeleteWithBatch(userId);

    // Note: Firebase Auth 계정 삭제는 Cloud Functions에서 Admin SDK로 처리해야 함

    logger.info('계정 완전 삭제 완료', { userId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '계정 완전 삭제',
      component: 'accountDeletionService',
      context: { userId },
    });
  }
}

/**
 * 탈퇴 상태 확인
 *
 * @description Repository 패턴 사용
 */
export async function getDeletionStatus(userId: string): Promise<DeletionRequest | null> {
  try {
    return await userRepository.getDeletionStatus(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '탈퇴 상태 확인',
      component: 'accountDeletionService',
      context: { userId },
    });
  }
}
