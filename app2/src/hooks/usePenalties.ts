/**
 * usePenalties 훅
 *
 * 사용자 패널티 데이터 관리 훅
 * - 실시간 구독 (onSnapshot)
 * - 패널티 추가/취소 액션
 *
 * @version 1.0
 * @since 2025-01-01
 */
import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import type { Penalty, PenaltyCreateInput } from '../types/penalty';
import {
  createPenalty,
  cancelPenalty as cancelPenaltyService,
  getPenaltiesQuery,
  isPenaltyExpired,
} from '../services/penaltyService';

interface UsePenaltiesReturn {
  /** 패널티 목록 */
  penalties: Penalty[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 */
  error: Error | null;
  /** 패널티 추가 중 */
  isAdding: boolean;
  /** 패널티 취소 중 */
  isCancelling: boolean;
  /** 새 패널티 추가 */
  addPenalty: (input: Omit<PenaltyCreateInput, 'userId'>) => Promise<void>;
  /** 패널티 취소 */
  cancelPenalty: (penaltyId: string, reason: string) => Promise<void>;
  /** 활성 패널티 여부 */
  hasActivePenalty: boolean;
}

/**
 * 패널티 관리 훅
 * @param userId 대상 사용자 ID
 * @returns 패널티 데이터 및 액션
 */
export function usePenalties(userId: string | null): UsePenaltiesReturn {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { currentUser } = useAuth();

  // 실시간 구독
  useEffect(() => {
    if (!userId) {
      setPenalties([]);
      return;
    }

    setLoading(true);
    setError(null);

    const q = getPenaltiesQuery(userId);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const penaltyList: Penalty[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          const penalty: Penalty = {
            id: doc.id,
            userId: data.userId,
            type: data.type || 'warning', // 기존 데이터 호환성
            reason: data.reason,
            details: data.details,
            duration: data.duration,
            startDate: data.startDate,
            endDate: data.endDate,
            status: data.status,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            cancelReason: data.cancelReason,
            cancelledBy: data.cancelledBy,
            cancelledAt: data.cancelledAt,
          };

          // 만료 상태 동적 체크
          if (penalty.status === 'active' && isPenaltyExpired(penalty)) {
            return { ...penalty, status: 'expired' as const };
          }

          return penalty;
        });

        setPenalties(penaltyList);
        setLoading(false);
      },
      (err) => {
        logger.error('패널티 목록 조회 실패', err, {
          component: 'usePenalties',
          userId,
        });
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // 패널티 추가
  const addPenalty = useCallback(
    async (input: Omit<PenaltyCreateInput, 'userId'>) => {
      if (!userId || !currentUser?.uid) {
        throw new Error('사용자 정보가 없습니다');
      }

      setIsAdding(true);
      setError(null);

      try {
        await createPenalty(
          {
            ...input,
            userId,
          },
          currentUser.uid
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsAdding(false);
      }
    },
    [userId, currentUser?.uid]
  );

  // 패널티 취소
  const cancelPenalty = useCallback(
    async (penaltyId: string, reason: string) => {
      if (!userId || !currentUser?.uid) {
        throw new Error('사용자 정보가 없습니다');
      }

      setIsCancelling(true);
      setError(null);

      try {
        await cancelPenaltyService(userId, penaltyId, reason, currentUser.uid);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsCancelling(false);
      }
    },
    [userId, currentUser?.uid]
  );

  // 활성 패널티 여부
  const hasActivePenalty = penalties.some((p) => p.status === 'active');

  return {
    penalties,
    loading,
    error,
    isAdding,
    isCancelling,
    addPenalty,
    cancelPenalty,
    hasActivePenalty,
  };
}
