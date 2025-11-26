import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import type { PaymentTransaction, PaymentStatus } from '../types/payment';

/**
 * 결제 내역 조회 Hook
 *
 * 사용자의 모든 결제 트랜잭션을 실시간으로 구독합니다.
 *
 * 기능:
 * - Firestore 실시간 구독 (onSnapshot)
 * - 상태별 필터링
 * - 날짜 범위 필터링
 * - 정렬 (최신순)
 *
 * @param userId - 사용자 ID
 * @param options - 필터 옵션
 */
export const usePaymentHistory = (
  userId: string | null,
  options?: {
    status?: PaymentStatus;
    startDate?: Date;
    endDate?: Date;
  }
) => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // options를 ref로 저장하여 안정적인 참조 유지
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options?.status, options?.startDate, options?.endDate]);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setIsLoading(false);
      setError(null);
      isInitializedRef.current = false;
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentOptions = optionsRef.current;

      // Firestore 쿼리 구성
      const transactionsRef = collection(db, 'paymentTransactions');
      let q = query(transactionsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));

      // 상태 필터링
      if (currentOptions?.status) {
        q = query(
          transactionsRef,
          where('userId', '==', userId),
          where('status', '==', currentOptions.status),
          orderBy('createdAt', 'desc')
        );
      }

      // 실시간 구독
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => {
            const docData = doc.data();
            return {
              id: doc.id,
              ...docData,
              createdAt: docData.createdAt as Timestamp,
              updatedAt: docData.updatedAt as Timestamp,
              approvedAt: docData.approvedAt as Timestamp | undefined,
              cancelledAt: docData.cancelledAt as Timestamp | undefined,
              refundedAt: docData.refundedAt as Timestamp | undefined,
            } as PaymentTransaction;
          });

          // 날짜 범위 필터링 (클라이언트 사이드)
          let filteredData = data;
          const currentOptions = optionsRef.current;
          if (currentOptions?.startDate) {
            filteredData = filteredData.filter(
              (tx) => tx.createdAt.toDate() >= currentOptions.startDate!
            );
          }
          if (currentOptions?.endDate) {
            const endOfDay = new Date(currentOptions.endDate);
            endOfDay.setHours(23, 59, 59, 999);
            filteredData = filteredData.filter((tx) => tx.createdAt.toDate() <= endOfDay);
          }

          setTransactions(filteredData);
          setIsLoading(false);

          if (!isInitializedRef.current) {
            logger.info('결제 내역 조회 성공', {
              operation: 'usePaymentHistory',
              additionalData: { count: filteredData.length },
            });
            isInitializedRef.current = true;
          }
        },
        (err) => {
          const errorMessage = err.message || '결제 내역 조회 중 오류가 발생했습니다';
          logger.error('결제 내역 조회 실패', err, {
            operation: 'usePaymentHistory',
            additionalData: { userId },
          });
          setError(errorMessage);
          setIsLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '결제 내역 조회 중 오류가 발생했습니다';
      logger.error('결제 내역 조회 초기화 실패', err instanceof Error ? err : undefined, {
        operation: 'usePaymentHistory',
      });
      setError(errorMessage);
      setIsLoading(false);
      return undefined;
    }
  }, [userId, options?.status, options?.startDate, options?.endDate]);

  // 통계 계산
  const statistics = useMemo(() => {
    const completed = transactions.filter((tx) => tx.status === 'completed');
    const totalAmount = completed.reduce((sum, tx) => sum + tx.amount, 0);
    const totalChips = completed.reduce((sum, tx) => sum + (tx.chipAmount || 0), 0);

    return {
      totalTransactions: transactions.length,
      completedCount: completed.length,
      failedCount: transactions.filter((tx) => tx.status === 'failed').length,
      refundedCount: transactions.filter((tx) => tx.status === 'refunded').length,
      totalAmount,
      totalChips,
    };
  }, [transactions]);

  return {
    transactions,
    statistics,
    isLoading,
    error,
  };
};
