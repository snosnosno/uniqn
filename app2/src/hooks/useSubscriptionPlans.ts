/**
 * 구독 플랜 조회 Hook
 *
 * Firestore에서 구독 플랜 정보를 실시간으로 구독합니다.
 *
 * @returns 구독 플랜 목록 및 상태
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useLogger } from './useLogger';
import type { SubscriptionPlan } from '../types/payment/subscription';

export const useSubscriptionPlans = () => {
  const logger = useLogger();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    try {
      // Firestore 쿼리: 활성화된 플랜만 조회
      const plansRef = collection(db, 'subscriptionPlans');
      const q = query(
        plansRef,
        where('isActive', '==', true),
        orderBy('price', 'asc')
      );

      // 실시간 구독
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => {
            const docData = doc.data();
            return {
              id: doc.id,
              type: docData.type,
              name: docData.name,
              nameEn: docData.nameEn,
              description: docData.description,
              price: docData.price,
              monthlyChips: docData.monthlyChips,
              features: docData.features,
              accessRights: docData.accessRights || {
                mySchedule: true,
                tournamentManagement: false,
              },
            } as SubscriptionPlan;
          });

          setPlans(data);
          setIsLoading(false);

          logger.info('구독 플랜 조회 성공', {
            operation: 'useSubscriptionPlans',
            additionalData: { count: data.length },
          });
        },
        (err) => {
          const errorMessage = err.message || '구독 플랜 조회 중 오류가 발생했습니다';
          logger.error('구독 플랜 조회 실패', err, {
            operation: 'useSubscriptionPlans',
          });
          setError(errorMessage);
          setIsLoading(false);
        }
      );

      return () => {
        unsubscribe();
        logger.debug('구독 플랜 구독 해제', {
          operation: 'useSubscriptionPlans',
        });
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '구독 플랜 조회 중 오류가 발생했습니다';
      logger.error('구독 플랜 조회 초기화 실패', err instanceof Error ? err : undefined, {
        operation: 'useSubscriptionPlans',
      });
      setError(errorMessage);
      setIsLoading(false);
      return undefined;
    }
  }, [logger]);

  return {
    plans,
    isLoading,
    error,
  };
};
