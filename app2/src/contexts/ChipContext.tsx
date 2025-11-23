import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { useLogger } from '../hooks/useLogger';
import type { ChipBalance } from '../types/payment/chip';

/**
 * 칩 컨텍스트 타입
 */
interface ChipContextType {
  chipBalance: ChipBalance | null;
  isLoading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
}

const ChipContext = createContext<ChipContextType | undefined>(undefined);

/**
 * 칩 컨텍스트 Provider
 *
 * 사용자의 칩 잔액을 Firestore에서 실시간으로 구독하여 제공합니다.
 *
 * 기능:
 * - Firestore 실시간 구독 (onSnapshot)
 * - 로그인 상태에 따른 자동 구독/해제
 * - 에러 처리 및 로깅
 */
export const ChipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const logger = useLogger();

  const [chipBalance, setChipBalance] = useState<ChipBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 칩 잔액 새로고침
   */
  const refreshBalance = useCallback(async () => {
    if (!currentUser) {
      logger.warn('칩 잔액 새로고침 실패: 로그인되지 않음');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Firestore에서 재조회 (실시간 구독이 자동으로 처리하지만 수동 새로고침 옵션)
      logger.info('칩 잔액 수동 새로고침', { operation: 'refreshBalance' });

      // onSnapshot이 자동으로 업데이트를 감지하므로 별도 로직 불필요
      // 필요시 강제 재조회 로직 추가 가능

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      logger.error('칩 잔액 새로고침 실패', err instanceof Error ? err : undefined, {
        operation: 'refreshBalance',
      });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, logger]);

  /**
   * Firestore 실시간 구독
   */
  useEffect(() => {
    if (!currentUser) {
      setChipBalance(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const chipBalanceRef = doc(db, 'chipBalance', currentUser.uid);

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
          // 칩 잔액 문서가 없으면 초기값 설정
          const initialBalance: ChipBalance = {
            userId: currentUser.uid,
            redChips: 0,
            blueChips: 0,
            totalChips: 0,
            lastUpdated: new Date(),
          };
          setChipBalance(initialBalance);
          logger.info('칩 잔액 초기화', {
            operation: 'chipBalance',
            additionalData: initialBalance as unknown as Record<string, unknown>,
          });
        }
        setIsLoading(false);
      },
      (err) => {
        const errorMessage = err.message || '칩 잔액 조회 중 오류가 발생했습니다';
        logger.error('칩 잔액 구독 실패', err, {
          operation: 'chipBalance',
          additionalData: { userId: currentUser.uid },
        });
        setError(errorMessage);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      logger.debug('칩 잔액 구독 해제', {
        operation: 'chipBalance',
        additionalData: { userId: currentUser.uid },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const value: ChipContextType = {
    chipBalance,
    isLoading,
    error,
    refreshBalance,
  };

  return <ChipContext.Provider value={value}>{children}</ChipContext.Provider>;
};

/**
 * 칩 컨텍스트 Hook
 *
 * ChipProvider 내부에서만 사용 가능합니다.
 *
 * @returns ChipContextType
 * @throws ChipProvider 외부에서 사용 시 에러
 */
export const useChip = (): ChipContextType => {
  const context = useContext(ChipContext);
  if (!context) {
    throw new Error('useChip must be used within a ChipProvider');
  }
  return context;
};
