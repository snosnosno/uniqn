/**
 * 회원탈퇴 및 개인정보 관리 서비스
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
import { AuthError, toError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { userRepository } from '@/repositories';
import type { DeletionReason, DeletionRequest, UserDataExport } from '@/repositories';
import type { FirestoreUserProfile } from '@/types';
import { STATUS } from '@/constants';
import { toDate } from '@/utils/date';

/** 회원탈퇴 유예 기간 (일) */
export const DELETION_GRACE_PERIOD_DAYS = 30;

export type { DeletionReason, DeletionRequest, UserDataExport };

export const DELETION_REASONS: Record<DeletionReason, string> = {
  no_longer_needed: '더 이상 서비스를 이용하지 않아요',
  found_better_service: '다른 서비스를 이용하게 되었어요',
  privacy_concerns: '개인정보가 걱정돼요',
  too_many_notifications: '알림이 너무 많아요',
  difficult_to_use: '사용하기 어려워요',
  other: '기타',
};

/** 회원탈퇴 결과 (Apple 토큰 파기 상태 포함) */
export interface DeletionResult {
  deletionRequest: DeletionRequest;
  /**
   * Apple 토큰 파기 성공 여부.
   * - `false`: 파기 실패. 호출자(UI)에서 `retryAppleTokenRevocation()` 재시도 안내 필요.
   * - `true`: 파기 성공 또는 비-Apple 사용자 (파기 불필요).
   */
  appleTokenRevoked: boolean;
}

/**
 * Apple 토큰 파기 시도
 *
 * @returns 파기 성공 여부
 */
async function tryRevokeAppleToken(authorizationCode: string, userId: string): Promise<boolean> {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { getFirebaseFunctions } = await import('@/lib/firebase');
    const revokeAppleTokenFn = httpsCallable<{ authorizationCode: string }, { success: boolean }>(
      getFirebaseFunctions(),
      'revokeAppleToken'
    );
    await revokeAppleTokenFn({ authorizationCode });
    logger.info('Apple 토큰 파기 완료', { userId });
    return true;
  } catch (revokeError) {
    logger.warn('Apple 토큰 파기 실패', {
      userId,
      error: revokeError instanceof Error ? revokeError.message : String(revokeError),
    });
    return false;
  }
}

/**
 * Apple 토큰 파기 재시도 (회원탈퇴 후 사용자 요청 시)
 *
 * Apple 재인증 다이얼로그를 다시 표시하고 토큰 파기를 재시도한다.
 *
 * @returns 파기 성공 여부
 */
export async function retryAppleTokenRevocation(): Promise<boolean> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) return false;

  const AppleAuthentication = await import('expo-apple-authentication');
  const { generateNonce, sha256 } = await import('@/utils/appleAuth');
  const rawNonce = generateNonce();
  const hashedNonce = await sha256(rawNonce);

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [],
    nonce: hashedNonce,
  });

  if (!appleCredential.authorizationCode) return false;

  return tryRevokeAppleToken(appleCredential.authorizationCode, currentUser.uid);
}

/**
 * 회원탈퇴 요청
 *
 * 1. 재인증 (Apple: 네이티브 다이얼로그 / 이메일: 비밀번호)
 * 2. 계정 비활성화 (즉시) - Repository를 통해 처리
 * 3. 30일 후 완전 삭제 예약
 */
export async function requestAccountDeletion(
  reason: DeletionReason,
  password?: string,
  reasonDetail?: string
): Promise<DeletionResult> {
  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '로그인이 필요합니다',
    });
  }

  try {
    logger.info('회원탈퇴 요청 시작', { userId: currentUser.uid, reason });

    // 1. 재인증 (Apple 사용자 vs 이메일 사용자 분기)
    const isAppleUser =
      currentUser.providerData?.some((p) => p.providerId === 'apple.com') ?? false;
    let appleTokenRevoked = false;

    if (isAppleUser && Platform.OS === 'ios') {
      // Apple 재인증: Apple Sign In 다이얼로그 → OAuthProvider credential
      const AppleAuthentication = await import('expo-apple-authentication');
      const { generateNonce, sha256 } = await import('@/utils/appleAuth');

      const rawNonce = generateNonce();
      const hashedNonce = await sha256(rawNonce);

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: 'Apple 재인증에 실패했습니다.',
        });
      }

      const oauthCredential = new OAuthProvider('apple.com').credential({
        idToken: appleCredential.identityToken,
        rawNonce,
      });
      await reauthenticateWithCredential(currentUser, oauthCredential);

      // Apple Token Revocation (App Store 심사 필수 요구사항)
      if (appleCredential.authorizationCode) {
        appleTokenRevoked = await tryRevokeAppleToken(
          appleCredential.authorizationCode,
          currentUser.uid
        );
      }
    } else if (isAppleUser) {
      // Apple 사용자가 비-iOS 플랫폼에서 탈퇴 시도
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
        userMessage:
          'Apple 계정 탈퇴는 iOS 기기에서만 가능합니다.\n\n' +
          'uniqnkorea@gmail.com으로 [계정 삭제 요청] 메일을 보내주시면 ' +
          '본인 확인 후 7일 이내에 처리해드립니다.',
      });
    } else {
      // 이메일 사용자: 비밀번호 재인증
      if (!password) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: '비밀번호를 입력해주세요.',
        });
      }
      if (!currentUser.email) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: '이메일 정보가 없습니다. 고객센터에 문의해주세요.',
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
      scheduledDeletionAt: toDate(scheduledDeletion)?.toISOString() ?? null,
    });

    // 4. 로그아웃은 호출자에서 처리

    return {
      deletionRequest,
      appleTokenRevoked: isAppleUser ? appleTokenRevoked : true,
    };
  } catch (error) {
    // 의도적으로 던진 AuthError는 그대로 전파
    if (error instanceof AuthError) throw error;

    logger.error('회원탈퇴 요청 실패', toError(error), {
      userId: currentUser.uid,
    });

    // 비밀번호 틀린 경우
    if ((error as { code?: string }).code === 'auth/wrong-password') {
      throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
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

/** 회원탈퇴 철회 (유예 기간 내) */
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

/** 내 개인정보 조회 */
export async function getMyData(userId: string): Promise<FirestoreUserProfile | null> {
  try {
    logger.info('개인정보 조회', { userId });

    return await userRepository.getById(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '개인정보 조회',
      component: 'accountDeletionService',
      context: { userId },
    });
  }
}

/** 내 데이터 내보내기 (JSON) */
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

/** 탈퇴 상태 확인 */
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
