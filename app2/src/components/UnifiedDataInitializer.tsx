/**
 * UnifiedDataInitializer
 *
 * Zustand Store 기반 Firebase 실시간 구독 초기화 컴포넌트
 * UnifiedDataProvider를 대체하는 경량 초기화 컴포넌트
 *
 * @version 1.0.0
 * @created 2025-11-15
 * @feature 001-zustand-migration
 */

import { useEffect } from 'react';
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

export const UnifiedDataInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, role } = useAuth();
  const { subscribeAll, unsubscribeAll } = useUnifiedDataStore();

  // Firebase 실시간 구독 초기화 (전역)
  useEffect(() => {
    if (!currentUser) {
      logger.info('[UnifiedDataInitializer] 사용자 미인증 - 구독 스킵');
      return;
    }

    logger.info('[UnifiedDataInitializer] 🚀 Zustand Store Firebase 구독 시작', {
      userId: currentUser.uid,
    });

    // Zustand Store에서 Firebase 구독 시작
    subscribeAll(currentUser.uid, role || 'staff');

    // Cleanup: 로그아웃 시 구독 정리
    return () => {
      logger.info('[UnifiedDataInitializer] 🧹 Firebase 구독 정리');
      unsubscribeAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, role]);

  return <>{children}</>;
};
