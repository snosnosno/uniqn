/**
 * 계정 삭제 Hook
 *
 * @description
 * 계정 삭제 요청, 취소, 상태 조회
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { useState, useCallback, useMemo } from 'react';
import { collection, query, where, type Query, type DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import i18n from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreQuery } from './firestore';
import { requestAccountDeletion, cancelDeletionRequest } from '../services/accountDeletionService';
import { calculateRemainingDays, convertDeletionTimestamp } from '../types/accountDeletion';
import type { DeletionRequest, DeletionRequestInput } from '../types/accountDeletion';

export interface UseAccountDeletionReturn {
  // 데이터
  deletionRequest: DeletionRequest | null;

  // 상태
  loading: boolean;
  error: Error | null;
  isPending: boolean;

  // 계산된 값
  remainingDays: number;
  scheduledDate: Date | null;

  // 액션
  requestDeletion: (input: DeletionRequestInput) => Promise<void>;
  cancelDeletion: (requestId: string) => Promise<void>;
  refreshDeletionStatus: () => Promise<void>;
}

/**
 * 계정 삭제 Hook
 *
 * @example
 * ```tsx
 * const {
 *   isPending,
 *   remainingDays,
 *   requestDeletion,
 *   cancelDeletion
 * } = useAccountDeletion();
 *
 * // 삭제 요청
 * await requestDeletion({
 *   userId,
 *   userEmail,
 *   userName,
 *   currentPassword,
 *   reason: '사용하지 않음'
 * });
 *
 * // 삭제 취소
 * await cancelDeletion(requestId);
 * ```
 */
export const useAccountDeletion = (): UseAccountDeletionReturn => {
  const { currentUser } = useAuth();
  const [error, setError] = useState<Error | null>(null);

  // pending 상태의 삭제 요청 쿼리 생성 (메모이제이션)
  const deletionQuery = useMemo((): Query<DocumentData> | null => {
    if (!currentUser) return null;

    return query(
      collection(db, 'deletionRequests'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // useFirestoreQuery로 실시간 구독
  const {
    data: deletionRequestList,
    loading,
    error: hookError,
  } = useFirestoreQuery<Omit<DeletionRequest, 'id'>>(
    deletionQuery ||
      query(collection(db, 'deletionRequests'), where('__name__', '==', '__non_existent__')),
    {
      enabled: deletionQuery !== null,
      onSuccess: () => {
        logger.debug('삭제 요청 실시간 업데이트', {
          component: 'useAccountDeletion',
          data: { userId: currentUser?.uid, count: deletionRequestList.length },
        });
      },
      onError: (err) => {
        logger.error('삭제 요청 구독 실패', err, {
          component: 'useAccountDeletion',
          data: { userId: currentUser?.uid },
        });
        setError(err);
      },
    }
  );

  // 첫 번째 pending 요청만 사용 (일반적으로 1개만 존재)
  const deletionRequest = useMemo(() => {
    if (!deletionRequestList || deletionRequestList.length === 0) return null;
    return deletionRequestList[0] as unknown as DeletionRequest;
  }, [deletionRequestList]);

  /**
   * 계정 삭제 요청
   */
  const handleRequestDeletion = useCallback(
    async (input: DeletionRequestInput): Promise<void> => {
      if (!currentUser) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        setError(null);

        const request = await requestAccountDeletion(input);

        toast.success(
          `계정 삭제가 요청되었습니다. 30일 후 완전히 삭제됩니다.`,
          '계정 삭제 요청',
          5000
        );

        logger.info('계정 삭제 요청 성공', {
          component: 'useAccountDeletion',
          data: { userId: currentUser.uid, requestId: request.requestId },
        });
      } catch (err) {
        const error = err as Error;
        setError(error);
        logger.error('계정 삭제 요청 실패', error, {
          component: 'useAccountDeletion',
          data: { userId: currentUser.uid },
        });
        toast.error(error.message || i18n.t('toast.account.deletionRequestFailed'));
        throw error;
      }
    },
    [currentUser]
  );

  /**
   * 계정 삭제 취소
   */
  const handleCancelDeletion = useCallback(
    async (requestId: string): Promise<void> => {
      if (!currentUser) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        setError(null);

        await cancelDeletionRequest({ requestId });

        toast.success(i18n.t('toast.account.deletionCancelled'));

        logger.info('계정 삭제 취소 성공', {
          component: 'useAccountDeletion',
          data: { userId: currentUser.uid, requestId },
        });
      } catch (err) {
        const error = err as Error;
        setError(error);
        logger.error('계정 삭제 취소 실패', error, {
          component: 'useAccountDeletion',
          data: { userId: currentUser.uid, requestId },
        });
        toast.error(error.message || i18n.t('toast.account.deletionCancelFailed'));
        throw error;
      }
    },
    [currentUser]
  );

  /**
   * 삭제 요청 상태 새로고침
   * useFirestoreQuery는 실시간 구독이므로 별도 새로고침 불필요
   * 호환성을 위해 빈 함수 제공
   */
  const refreshDeletionStatus = useCallback(async (): Promise<void> => {
    // useFirestoreQuery는 실시간 구독이므로 별도 새로고침 불필요
    logger.info('실시간 구독 중이므로 자동 업데이트됩니다', {
      component: 'useAccountDeletion',
    });
  }, []);

  /**
   * 계산된 값들 (메모이제이션)
   */
  const computedValues = useMemo(() => {
    const isPending = deletionRequest?.status === 'pending';

    let remainingDays = 0;
    let scheduledDate: Date | null = null;

    if (isPending && deletionRequest?.scheduledDeletionAt) {
      scheduledDate = convertDeletionTimestamp(deletionRequest.scheduledDeletionAt);
      remainingDays = calculateRemainingDays(scheduledDate);
    }

    return {
      isPending,
      remainingDays,
      scheduledDate,
    };
  }, [deletionRequest]);

  return {
    deletionRequest,
    loading,
    error: error || hookError,
    ...computedValues,
    requestDeletion: handleRequestDeletion,
    cancelDeletion: handleCancelDeletion,
    refreshDeletionStatus,
  };
};
