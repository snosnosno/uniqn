/**
 * 회원탈퇴 및 개인정보 관리 서비스
 *
 * 법적 요구사항:
 * - 회원탈퇴 기능 제공 (개인정보보호법)
 * - 30일 유예 기간 후 완전 삭제
 * - 개인정보 열람/수정/삭제 권리
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { AuthError, ERROR_CODES, isAppError, toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { userRepository } from '@/repositories';
import type { DeletionReason, DeletionRequest, UserDataExport } from '@/repositories';
import type { FirestoreUserProfile } from '@/types';
import { STATUS } from '@/constants';
import { toDate } from '@/utils/date';
import { requestAppleAuthorization } from './appleAuthService';

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
    const { error } = await supabase.functions.invoke('revoke-apple-token', {
      body: { authorizationCode },
    });
    if (error) throw error;
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
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) return false;

  const { credential: appleCredential } = await requestAppleAuthorization({
    requestedScopes: [],
    operation: 'revocation',
  });

  if (!appleCredential.authorizationCode) return false;

  return tryRevokeAppleToken(appleCredential.authorizationCode, currentUser.id);
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
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '로그인이 필요합니다',
    });
  }

  try {
    logger.info('회원탈퇴 요청 시작', { userId: currentUser.id, reason });

    // 1. 재인증 (Apple 사용자 vs 이메일 사용자 분기)
    const providers = (currentUser.app_metadata?.providers as string[]) ?? [];
    const isAppleUser = providers.includes('apple');
    let appleTokenRevoked = false;

    if (isAppleUser && Platform.OS === 'ios') {
      // Apple 재인증: Apple Sign In 다이얼로그
      const { credential: appleCredential, rawNonce } = await requestAppleAuthorization({
        requestedScopes: [],
        operation: 'reauth',
      });

      if (!appleCredential.identityToken) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: 'Apple 재인증에 실패했습니다.',
        });
      }

      // Supabase로 재인증 (signInWithIdToken)
      const { error: reAuthError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: appleCredential.identityToken,
        nonce: rawNonce,
      });
      if (reAuthError) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: 'Apple 재인증에 실패했습니다.',
          originalError: new Error(reAuthError.message),
        });
      }

      // Apple Token Revocation (App Store 심사 필수 요구사항)
      if (appleCredential.authorizationCode) {
        appleTokenRevoked = await tryRevokeAppleToken(
          appleCredential.authorizationCode,
          currentUser.id
        );
      }
    } else if (isAppleUser) {
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
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password,
      });
      if (reAuthError) {
        throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
          userMessage: '비밀번호가 올바르지 않습니다',
          originalError: new Error(reAuthError.message),
        });
      }
    }

    // 2. 탈퇴 요청 정보 준비
    const now = new Date();
    const scheduledDeletion = new Date(
      Date.now() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    const deletionRequestData: Omit<DeletionRequest, 'userId'> = {
      reason,
      reasonDetail,
      requestedAt: now,
      scheduledDeletionAt: scheduledDeletion,
      status: STATUS.DELETION_REQUEST.PENDING,
    };

    // 3. Repository를 통해 저장
    await userRepository.requestDeletion(currentUser.id, deletionRequestData);

    const deletionRequest: DeletionRequest = {
      userId: currentUser.id,
      ...deletionRequestData,
    };

    logger.info('회원탈퇴 요청 완료', {
      userId: currentUser.id,
      scheduledDeletionAt: toDate(scheduledDeletion)?.toISOString() ?? null,
    });

    // 4. 로그아웃은 호출자에서 처리

    return {
      deletionRequest,
      appleTokenRevoked: isAppleUser ? appleTokenRevoked : true,
    };
  } catch (error) {
    if ((error as { userMessage?: string }).userMessage === '') throw error;

    // 의도적으로 던진 AppError는 그대로 전파
    if (isAppError(error)) throw error;

    logger.error('회원탈퇴 요청 실패', toError(error), {
      userId: currentUser.id,
    });

    throw handleServiceError(error, {
      operation: '회원탈퇴 요청',
      component: 'accountDeletionService',
      context: { userId: currentUser.id, reason },
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
