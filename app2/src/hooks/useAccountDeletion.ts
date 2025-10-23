/**
 * 계정 삭제 Hook
 *
 * @description
 * 계정 삭제 요청, 취소, 상태 조회
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import {
  requestAccountDeletion,
  getDeletionRequest,
  cancelDeletionRequest,
  isPendingDeletion,
} from '../services/accountDeletionService';
import {
  calculateRemainingDays,
  convertDeletionTimestamp,
} from '../types/accountDeletion';
import type {
  DeletionRequest,
  DeletionRequestInput,
} from '../types/accountDeletion';

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
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Firestore 실시간 구독 (삭제 요청 상태)
   */
  useEffect(() => {
    if (!currentUser) {
      setDeletionRequest(null);
      setLoading(false);
      return;
    }

    // pending 상태의 삭제 요청 조회
    const fetchDeletionRequest = async () => {
      try {
        const request = await getDeletionRequest(currentUser.uid);
        setDeletionRequest(request);
        setLoading(false);
      } catch (err) {
        logger.error('삭제 요청 조회 실패', err as Error, {
          component: 'useAccountDeletion',
          data: { userId: currentUser.uid },
        });
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchDeletionRequest();

    // 1분마다 상태 갱신 (실시간 구독 대신)
    const interval = setInterval(fetchDeletionRequest, 60000);

    return () => clearInterval(interval);
  }, [currentUser?.uid]);

  /**
   * 계정 삭제 요청
   */
  const handleRequestDeletion = useCallback(
    async (input: DeletionRequestInput): Promise<void> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        setLoading(true);
        setError(null);

        const request = await requestAccountDeletion(input);
        setDeletionRequest(request);

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
        toast.error(error.message || '계정 삭제 요청에 실패했습니다.');
        throw error;
      } finally {
        setLoading(false);
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
        throw new Error('로그인이 필요합니다.');
      }

      try {
        setLoading(true);
        setError(null);

        await cancelDeletionRequest({ requestId });
        setDeletionRequest(null);

        toast.success('계정 삭제가 취소되었습니다.', '삭제 취소');

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
        toast.error(error.message || '계정 삭제 취소에 실패했습니다.');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  /**
   * 삭제 요청 상태 새로고침
   */
  const refreshDeletionStatus = useCallback(async (): Promise<void> => {
    if (!currentUser) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const request = await getDeletionRequest(currentUser.uid);
      setDeletionRequest(request);
    } catch (err) {
      const error = err as Error;
      setError(error);
      logger.error('삭제 요청 상태 새로고침 실패', error, {
        component: 'useAccountDeletion',
        data: { userId: currentUser.uid },
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

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
    error,
    ...computedValues,
    requestDeletion: handleRequestDeletion,
    cancelDeletion: handleCancelDeletion,
    refreshDeletionStatus,
  };
};
