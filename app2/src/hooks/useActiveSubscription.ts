/**
 * 활성 구독 조회 Hook
 *
 * 사용자의 현재 활성화된 구독 정보를 실시간으로 구독합니다.
 *
 * @param userId - 사용자 ID
 * @returns 활성 구독 정보 및 상태
 */

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import type { UserSubscription } from '../types/payment/subscription';

export const useActiveSubscription = (userId: string | null) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setIsLoading(false);
      setError(null);
      isInitializedRef.current = false;
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Firestore 쿼리: 활성 구독 조회
      const subscriptionsRef = collection(db, 'userSubscriptions');
      const q = query(
        subscriptionsRef,
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('startDate', 'desc'),
        limit(1)
      );

      // 실시간 구독
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            setSubscription(null);
            setIsLoading(false);
            if (!isInitializedRef.current) {
              logger.info('활성 구독 없음', {
                operation: 'useActiveSubscription',
                additionalData: { userId },
              });
              isInitializedRef.current = true;
            }
            return;
          }

          const doc = snapshot.docs[0];
          if (!doc) {
            setSubscription(null);
            setIsLoading(false);
            return;
          }

          const data = {
            id: doc.id,
            ...doc.data(),
          } as UserSubscription;

          setSubscription(data);
          setIsLoading(false);

          if (!isInitializedRef.current) {
            logger.info('활성 구독 조회 성공', {
              operation: 'useActiveSubscription',
              additionalData: { userId, subscriptionId: data.id },
            });
            isInitializedRef.current = true;
          }
        },
        (err) => {
          const errorMessage = err.message || '구독 정보 조회 중 오류가 발생했습니다';
          logger.error('구독 정보 조회 실패', err, {
            operation: 'useActiveSubscription',
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
        err instanceof Error ? err.message : '구독 정보 조회 중 오류가 발생했습니다';
      logger.error('구독 정보 조회 초기화 실패', err instanceof Error ? err : undefined, {
        operation: 'useActiveSubscription',
      });
      setError(errorMessage);
      setIsLoading(false);
      return undefined;
    }
  }, [userId]);

  return {
    subscription,
    isLoading,
    error,
  };
};
