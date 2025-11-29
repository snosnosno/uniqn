/**
 * 구독 플랜 조회 Hook
 *
 * Firestore에서 구독 플랜 정보를 실시간으로 구독합니다.
 *
 * @returns 구독 플랜 목록 및 상태
 */

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import type { SubscriptionPlan } from '../types/payment/subscription';

export const useSubscriptionPlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    try {
      // Firestore 쿼리: 활성화된 플랜만 조회
      const plansRef = collection(db, 'subscriptionPlans');
      const q = query(plansRef, where('isActive', '==', true), orderBy('price', 'asc'));

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

          if (!isInitializedRef.current) {
            logger.info('구독 플랜 조회 성공', {
              operation: 'useSubscriptionPlans',
              additionalData: { count: data.length },
            });
            isInitializedRef.current = true;
          }
        },
        (err) => {
          const error =
            err instanceof Error ? err : new Error('구독 플랜 조회 중 오류가 발생했습니다');
          logger.error('구독 플랜 조회 실패', error, {
            operation: 'useSubscriptionPlans',
          });
          setError(error);
          setIsLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('구독 플랜 조회 중 오류가 발생했습니다');
      logger.error('구독 플랜 조회 초기화 실패', error, {
        operation: 'useSubscriptionPlans',
      });
      setError(error);
      setIsLoading(false);
      return undefined;
    }
  }, []);

  return {
    plans,
    isLoading,
    error,
  };
};
