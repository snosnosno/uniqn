import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import type { ChipBalance } from '../types/payment/chip';

/**
 * 칩 컨텍스트 타입
 */
interface ChipContextType {
  chipBalance: ChipBalance | null;
  isLoading: boolean;
  error: Error | null;
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
  const isInitializedRef = useRef(false);

  const [chipBalance, setChipBalance] = useState<ChipBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 칩 잔액 새로고침
   */
  const refreshBalance = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // onSnapshot이 자동으로 업데이트를 감지하므로 별도 로직 불필요
      // 필요시 강제 재조회 로직 추가 가능
    } catch (err) {
      const error = err instanceof Error ? err : new Error('알 수 없는 오류');
      logger.error('칩 잔액 새로고침 실패', error, {
        operation: 'refreshBalance',
      });
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  /**
   * Firestore 실시간 구독
   */
  useEffect(() => {
    if (!currentUser) {
      setChipBalance(null);
      setIsLoading(false);
      setError(null);
      isInitializedRef.current = false;
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

          // 초기 로드 시에만 로그 출력
          if (!isInitializedRef.current) {
            logger.info('칩 잔액 로드 완료 (Context)', {
              operation: 'chipBalance',
              additionalData: { userId: currentUser.uid, totalChips: balance.totalChips },
            });
            isInitializedRef.current = true;
          }
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

          if (!isInitializedRef.current) {
            logger.info('칩 잔액 초기화 (Context, 문서 없음)', {
              operation: 'chipBalance',
              additionalData: { userId: currentUser.uid },
            });
            isInitializedRef.current = true;
          }
        }
        setIsLoading(false);
      },
      (err) => {
        const error = err instanceof Error ? err : new Error('칩 잔액 조회 중 오류가 발생했습니다');
        logger.error('칩 잔액 구독 실패', error, {
          operation: 'chipBalance',
          additionalData: { userId: currentUser.uid },
        });
        setError(error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
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
