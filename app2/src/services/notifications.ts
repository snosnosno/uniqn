import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';
import { logger } from '../utils/logger';
import { useToast } from '../hooks/useToast';

export interface PushNotificationToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  timestamp: Date;
}

/**
 * 푸시 알림 초기화 및 토큰 관리
 */
export const initializePushNotifications = async (userId: string) => {
  // 네이티브 플랫폼에서만 실행
  if (!Capacitor.isNativePlatform()) {
    logger.info('푸시 알림은 네이티브 플랫폼에서만 지원됩니다');
    return null;
  }

  try {
    // 권한 요청
    const permissionResult = await PushNotifications.requestPermissions();

    if (permissionResult.receive !== 'granted') {
      logger.warn('푸시 알림 권한이 거부되었습니다');
      return null;
    }

    // 알림 등록
    await PushNotifications.register();
    logger.info('푸시 알림 등록 완료');

    // 토큰 수신 리스너
    PushNotifications.addListener('registration', async (token) => {
      logger.info('FCM 토큰 수신', { data: { token: token.value } });

      try {
        // 로컬 스토리지에 토큰 캐싱
        localStorage.setItem('fcm_token', token.value);

        // Firestore에 토큰 저장
        const platform = Capacitor.getPlatform() as 'ios' | 'android';
        await saveFCMToken(userId, token.value, platform);
      } catch (error) {
        logger.error('FCM 토큰 저장 실패:', error as Error);
      }
    });

    // 토큰 등록 실패 리스너
    PushNotifications.addListener('registrationError', (error) => {
      logger.error('푸시 알림 등록 실패:', error as unknown as Error);
    });

    // 푸시 알림 수신 리스너 (앱이 포그라운드에 있을 때)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.info('푸시 알림 수신', { data: notification });

      // Toast로 알림 표시
      const { showInfo } = useToast();
      showInfo(`${notification.title}: ${notification.body}`);
    });

    // 푸시 알림 액션 리스너 (사용자가 알림을 탭했을 때)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      logger.info('푸시 알림 액션 수행', { data: notification });

      // 필요시 특정 페이지로 이동하는 로직 추가
      handleNotificationAction(notification.notification.data);
    });

    return true;
  } catch (error) {
    logger.error('푸시 알림 초기화 실패:', error as Error);
    return null;
  }
};

/**
 * FCM 토큰을 Firestore에 저장
 */
const saveFCMToken = async (userId: string, token: string, platform: 'ios' | 'android') => {
  try {
    const userRef = doc(db, 'users', userId);

    const tokenData: PushNotificationToken = {
      token,
      platform,
      timestamp: new Date()
    };

    await updateDoc(userRef, {
      fcmToken: tokenData,
      [`fcmTokens.${platform}`]: tokenData // 플랫폼별로도 저장
    });

    logger.info(`FCM 토큰이 ${platform} 플랫폼으로 저장되었습니다`);
  } catch (error) {
    logger.error('FCM 토큰 저장 오류:', error as Error);
    throw error;
  }
};

/**
 * 푸시 알림 액션 처리
 */
const handleNotificationAction = (data: any) => {
  logger.info('알림 데이터', { data });

  // 알림 유형에 따른 네비게이션 처리
  if (data.type) {
    switch (data.type) {
      case 'job_application':
        // 구인공고 페이지로 이동
        window.location.href = `/job-postings/${data.eventId}`;
        break;
      case 'staff_approval':
        // 승인 관리 페이지로 이동
        window.location.href = '/admin/approval';
        break;
      case 'schedule_reminder':
        // 스케줄 페이지로 이동
        window.location.href = '/my-schedule';
        break;
      case 'salary_notification':
        // 급여 페이지로 이동
        window.location.href = '/staff';
        break;
      default:
        // 기본값: 홈으로 이동
        window.location.href = '/';
        break;
    }
  }
};

/**
 * 푸시 알림 리스너 정리
 */
export const cleanupPushNotifications = async () => {
  try {
    await PushNotifications.removeAllListeners();
    logger.info('푸시 알림 리스너 정리 완료');
  } catch (error) {
    logger.error('푸시 알림 리스너 정리 실패:', error as Error);
  }
};

/**
 * 현재 등록된 푸시 알림 토큰 가져오기
 */
export const getCurrentPushToken = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // 토큰은 registration 이벤트에서만 받을 수 있으므로
    // 저장된 토큰을 로컬 스토리지에서 가져옴
    const cachedToken = localStorage.getItem('fcm_token');
    return cachedToken;
  } catch (error) {
    logger.error('FCM 토큰 조회 실패:', error as Error);
    return null;
  }
};

/**
 * 푸시 알림 권한 상태 확인
 */
export const checkPushPermission = async () => {
  if (!Capacitor.isNativePlatform()) {
    return 'not-supported';
  }

  try {
    const result = await PushNotifications.checkPermissions();
    return result.receive;
  } catch (error) {
    logger.error('푸시 알림 권한 확인 실패:', error as Error);
    return 'denied';
  }
};