import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

import { useAuth } from '../../contexts/AuthContext';
import { initializePushNotifications } from '../../services/notifications';
import { initializeLocalNotifications } from '../../services/localNotifications';
import { initializeStatusBar } from '../../services/statusBar';
import { initializeKeyboard } from '../../services/keyboard';
import { logger } from '../../utils/logger';

/**
 * Capacitor 네이티브 기능 초기화 컴포넌트
 * 사용자가 로그인한 후 네이티브 서비스를 초기화합니다.
 */
const CapacitorInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    // 사용자가 로그인하고 로딩이 완료된 후 초기화
    if (!loading && currentUser) {
      initializeCapacitorServices(currentUser.uid);
    }
  }, [currentUser, loading]);

  return <>{children}</>;
};

/**
 * Capacitor 서비스 초기화
 */
const initializeCapacitorServices = async (userId: string) => {
  // 웹 환경에서는 초기화하지 않음
  if (!Capacitor.isNativePlatform()) {
    logger.info('웹 환경에서는 Capacitor 서비스를 초기화하지 않습니다');
    return;
  }

  logger.info('Capacitor 네이티브 서비스 초기화 시작');

  try {
    // 상태바 초기화 (UI 요소이므로 가장 먼저)
    await initializeStatusBar();

    // 키보드 초기화
    const keyboardInitialized = await initializeKeyboard();
    if (keyboardInitialized) {
      logger.info('키보드 서비스 초기화 성공');
    }

    // 로컬 알림 초기화
    const localNotificationsInitialized = await initializeLocalNotifications();

    if (localNotificationsInitialized) {
      logger.info('로컬 알림 초기화 성공');
    } else {
      logger.warn('로컬 알림 초기화 실패 또는 권한 거부');
    }

    // 푸시 알림 초기화 (Firebase 토큰 필요)
    const pushNotificationsResult = await initializePushNotifications(userId);

    if (pushNotificationsResult) {
      logger.info('푸시 알림 초기화 성공');
    } else {
      logger.warn('푸시 알림 초기화 실패 또는 권한 거부');
    }

    // 추가 네이티브 기능 초기화 가능
    // 예: 백그라운드 태스크, 딥링크 처리 등

    logger.info('Capacitor 네이티브 서비스 초기화 완료');
  } catch (error) {
    logger.error('Capacitor 서비스 초기화 중 오류 발생:', error as Error);
  }
};

export default CapacitorInitializer;