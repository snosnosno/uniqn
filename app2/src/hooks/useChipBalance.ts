import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLogger } from './useLogger';
import type { ChipBalance, ChipTransactionView } from '../types/payment/chip';

/**
 * 칩 잔액 Hook
 *
 * 사용자의 칩 잔액과 최근 거래 내역을 제공합니다.
 *
 * 기능:
 * - Firestore 실시간 구독 (칩 잔액)
 * - 최근 거래 내역 조회
 * - 칩 사용 우선순위 로직 (파란칩 → 빨간칩)
 *
 * @returns {object} 칩 잔액, 거래 내역, 로딩 상태, 에러
 */
export const useChipBalance = () => {
  const { currentUser } = useAuth();
  const logger = useLogger();

  const [chipBalance, setChipBalance] = useState<ChipBalance | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<ChipTransactionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 칩 잔액 실시간 구독
   */
  useEffect(() => {
    if (!currentUser) {
      setChipBalance(null);
      setRecentTransactions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const chipBalanceRef = doc(db, 'users', currentUser.uid, 'chipBalance', 'current');

    const unsubscribe = onSnapshot(
      chipBalanceRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const balance: ChipBalance = {
            userId: currentUser.uid,
            redChips: data.redChips || 0,
            blueChips: data.blueChips || 0,
            totalChips: data.totalChips || 0,
            lastUpdated: data.lastUpdated?.toDate() || new Date(),
          };

          setChipBalance(balance);
          logger.info('칩 잔액 업데이트', {
            operation: 'chipBalance',
            additionalData: balance as unknown as Record<string, unknown>,
          });
        } else {
          // 초기값
          const initialBalance: ChipBalance = {
            userId: currentUser.uid,
            redChips: 0,
            blueChips: 0,
            totalChips: 0,
            lastUpdated: new Date(),
          };
          setChipBalance(initialBalance);
        }
        setIsLoading(false);
      },
      (err) => {
        const errorMessage = err.message || '칩 잔액 조회 중 오류가 발생했습니다';
        logger.error('칩 잔액 구독 실패', err, {
          operation: 'chipBalance',
        });
        setError(errorMessage);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser, logger]);

  /**
   * 최근 거래 내역 조회
   */
  const fetchRecentTransactions = useCallback(async (limitCount: number = 10) => {
    if (!currentUser) {
      logger.warn('거래 내역 조회 실패: 로그인되지 않음');
      return;
    }

    try {
      const transactionsRef = collection(db, 'users', currentUser.uid, 'chipTransactions');
      const q = query(
        transactionsRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const transactions: ChipTransactionView[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type,
          chipType: data.chipType,
          amount: data.amount,
          balanceBefore: data.balanceBefore || 0,
          balanceAfter: data.balanceAfter || 0,
          description: data.description || `${data.type} 거래`,
          metadata: {
            packageId: data.packageId,
            transactionId: data.orderId || data.paymentKey,
            postingId: data.postingId,
            refundId: data.refundId,
          },
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        };
      });

      setRecentTransactions(transactions);
      logger.info('거래 내역 조회 완료', {
        operation: 'fetchRecentTransactions',
        additionalData: { count: transactions.length },
      });
    } catch (err) {
      logger.error('거래 내역 조회 실패', err instanceof Error ? err : undefined, {
        operation: 'fetchRecentTransactions',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  /**
   * 초기 거래 내역 로드
   */
  useEffect(() => {
    if (currentUser) {
      fetchRecentTransactions();
    }
  }, [currentUser, fetchRecentTransactions]);

  /**
   * 칩 사용 가능 여부 확인
   */
  const canUseChips = useCallback((requiredChips: number): boolean => {
    if (!chipBalance) return false;
    return chipBalance.totalChips >= requiredChips;
  }, [chipBalance]);

  /**
   * 칩 사용 시뮬레이션 (실제 차감 없이 계산만)
   *
   * 우선순위: 파란칩 → 빨간칩
   */
  const simulateChipUsage = useCallback((amount: number) => {
    if (!chipBalance) {
      return {
        canUse: false,
        blueChipsUsed: 0,
        redChipsUsed: 0,
        remaining: 0,
      };
    }

    let remainingAmount = amount;
    let blueChipsUsed = 0;
    let redChipsUsed = 0;

    // 1. 파란칩 사용
    if (chipBalance.blueChips > 0 && remainingAmount > 0) {
      blueChipsUsed = Math.min(chipBalance.blueChips, remainingAmount);
      remainingAmount -= blueChipsUsed;
    }

    // 2. 빨간칩 사용
    if (chipBalance.redChips > 0 && remainingAmount > 0) {
      redChipsUsed = Math.min(chipBalance.redChips, remainingAmount);
      remainingAmount -= redChipsUsed;
    }

    return {
      canUse: remainingAmount === 0,
      blueChipsUsed,
      redChipsUsed,
      remaining: remainingAmount,
    };
  }, [chipBalance]);

  return {
    chipBalance,
    recentTransactions,
    isLoading,
    error,
    fetchRecentTransactions,
    canUseChips,
    simulateChipUsage,
  };
};
