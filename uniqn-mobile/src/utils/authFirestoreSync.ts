/**
 * UNIQN Mobile - Auth ↔ Firestore 동기화 헬퍼
 *
 * @description Auth 프로필 업데이트 후 Firestore 업데이트를 수행하며,
 *              Firestore 실패 시 Auth 롤백을 자동 처리.
 *
 * 은행 이체 패턴: 출금(Auth 업데이트) 후 입금(Firestore)이 실패하면
 * 출금을 취소(Auth 롤백). 롤백마저 실패하면 수동 조정 필요.
 *
 * @version 1.0.0
 */

import { updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { AppError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface AuthFirestoreSyncOptions {
  /** Firebase Auth User 객체 */
  user: FirebaseUser;
  /** Auth에 적용할 업데이트 (빈 객체면 Auth 업데이트 스킵) */
  authUpdates: { photoURL?: string | null; displayName?: string | null };
  /** Firestore 업데이트를 수행하는 콜백 */
  firestoreUpdate: () => Promise<void>;
  /** 실패 시 사용자에게 표시할 메시지 */
  errorMessage: string;
  /** 로깅용 UID */
  uid: string;
  /** 로깅용 작업명 */
  operationName: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Auth 프로필 업데이트 + Firestore 업데이트를 원자적으로 수행
 *
 * Firestore 실패 시 Auth를 이전 상태로 롤백.
 *
 * @throws firestoreError - Firestore 실패 + Auth 롤백 성공 시 원본 에러 전파
 * @throws AppError(FIREBASE_SYNC_FAILED) - Firestore 실패 + Auth 롤백도 실패 시
 */
export async function withAuthFirestoreSync(options: AuthFirestoreSyncOptions): Promise<void> {
  const { user, authUpdates, firestoreUpdate, errorMessage, uid, operationName } = options;

  const hasAuthUpdates = Object.keys(authUpdates).length > 0;

  // Auth 값 백업 (updateProfile 호출 시 user 객체가 즉시 변경되므로 사전 백업 필수)
  const backup: { photoURL?: string | null; displayName?: string | null } = {};
  if ('photoURL' in authUpdates) backup.photoURL = user.photoURL;
  if ('displayName' in authUpdates) backup.displayName = user.displayName;

  // 1. Auth 업데이트
  if (hasAuthUpdates) {
    await updateProfile(user, authUpdates);
    logger.info(`${operationName} - Firebase Auth 업데이트`, {
      uid,
      fields: Object.keys(authUpdates),
    });
  }

  // 2. Firestore 업데이트 (실패 시 Auth 롤백)
  try {
    await firestoreUpdate();
  } catch (firestoreError) {
    if (hasAuthUpdates) {
      logger.warn(`${operationName} - Firestore 실패, Auth 롤백 시도`, {
        uid,
        error: firestoreError instanceof Error ? firestoreError.message : String(firestoreError),
      });

      try {
        await updateProfile(user, backup);
        logger.info(`${operationName} - Auth 롤백 완료`, { uid });
      } catch (rollbackError) {
        logger.error(`${operationName} - Auth 롤백 실패, 수동 복구 필요`, {
          uid,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });

        throw new AppError({
          code: ERROR_CODES.FIREBASE_SYNC_FAILED,
          category: 'firebase',
          severity: 'high',
          userMessage: errorMessage,
          originalError:
            firestoreError instanceof Error ? firestoreError : new Error(String(firestoreError)),
          metadata: { rollbackFailed: true, uid },
        });
      }
    }
    throw firestoreError;
  }
}
