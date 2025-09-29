import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

import { logger } from '../utils/logger';

export interface NotificationData {
  id: number;
  title: string;
  body: string;
  data?: any;
  schedule?: {
    at: Date;
  };
}

/**
 * 로컬 알림 초기화
 */
export const initializeLocalNotifications = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    logger.info('로컬 알림은 네이티브 플랫폼에서만 지원됩니다');
    return false;
  }

  try {
    // 권한 요청
    const permissions = await LocalNotifications.requestPermissions();

    if (permissions.display !== 'granted') {
      logger.warn('로컬 알림 권한이 거부되었습니다');
      return false;
    }

    // 알림 액션 리스너 등록
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      logger.info('로컬 알림 액션 수행', { data: notification });
      handleNotificationAction(notification.notification.extra);
    });

    // 알림 수신 리스너 등록 (앱이 포그라운드에 있을 때)
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      logger.info('로컬 알림 수신', { data: notification });
    });

    logger.info('로컬 알림 초기화 완료');
    return true;
  } catch (error) {
    logger.error('로컬 알림 초기화 실패:', error as Error);
    return false;
  }
};

/**
 * 즉시 알림 표시
 */
export const showNotification = async (notification: NotificationData): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    // 웹에서는 브라우저 알림 사용
    showWebNotification(notification);
    return;
  }

  try {
    const notificationOptions = {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      extra: notification.data,
      ...(notification.schedule && { schedule: notification.schedule })
    };

    const options: ScheduleOptions = {
      notifications: [notificationOptions]
    };

    await LocalNotifications.schedule(options);
    logger.info(`로컬 알림 예약 완료: ${notification.title}`);
  } catch (error) {
    logger.error('로컬 알림 예약 실패:', error as Error);
  }
};

/**
 * 웹 브라우저 알림 표시
 */
const showWebNotification = (notification: NotificationData) => {
  if (!('Notification' in window)) {
    logger.warn('브라우저가 알림을 지원하지 않습니다');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.body,
      icon: '/favicon.ico',
      tag: `tholdem-${notification.id}`
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/favicon.ico',
          tag: `tholdem-${notification.id}`
        });
      }
    });
  }
};

/**
 * 예약 알림 설정
 */
export const scheduleNotification = async (
  notification: NotificationData,
  scheduleAt: Date
): Promise<void> => {
  const scheduledNotification: NotificationData = {
    ...notification,
    schedule: { at: scheduleAt }
  };

  await showNotification(scheduledNotification);
};

/**
 * 승인 요청 알림
 */
export const notifyApprovalRequest = async (
  applicantName: string,
  jobTitle: string,
  applicationId: string
): Promise<void> => {
  const notification: NotificationData = {
    id: Date.now(),
    title: '새로운 지원서가 도착했습니다',
    body: `${applicantName}님이 '${jobTitle}' 포지션에 지원했습니다.`,
    data: {
      type: 'approval_request',
      applicationId,
      applicantName,
      jobTitle
    }
  };

  await showNotification(notification);
};

/**
 * 스케줄 리마인더 알림
 */
export const notifyScheduleReminder = async (
  eventTitle: string,
  eventDate: Date,
  location: string
): Promise<void> => {
  // 이벤트 30분 전에 알림
  const reminderTime = new Date(eventDate.getTime() - 30 * 60 * 1000);

  const notification: NotificationData = {
    id: Date.now(),
    title: '일정 알림',
    body: `30분 후 '${eventTitle}' 일정이 시작됩니다. (${location})`,
    data: {
      type: 'schedule_reminder',
      eventTitle,
      eventDate: eventDate.toISOString(),
      location
    }
  };

  await scheduleNotification(notification, reminderTime);
};

/**
 * 급여 지급 알림
 */
export const notifySalaryPayment = async (
  amount: number,
  period: string
): Promise<void> => {
  const notification: NotificationData = {
    id: Date.now(),
    title: '급여 지급 완료',
    body: `${period} 급여 ${amount.toLocaleString()}원이 지급되었습니다.`,
    data: {
      type: 'salary_payment',
      amount,
      period
    }
  };

  await showNotification(notification);
};

/**
 * 출석 체크 리마인더
 */
export const notifyAttendanceReminder = async (
  eventTitle: string,
  eventDate: Date
): Promise<void> => {
  // 이벤트 시작 시간에 알림
  const notification: NotificationData = {
    id: Date.now(),
    title: '출석 체크 안내',
    body: `'${eventTitle}' 이벤트가 시작되었습니다. 출석 체크를 해주세요.`,
    data: {
      type: 'attendance_reminder',
      eventTitle,
      eventDate: eventDate.toISOString()
    }
  };

  await scheduleNotification(notification, eventDate);
};

/**
 * 알림 액션 처리
 */
const handleNotificationAction = (data: any) => {
  logger.info('알림 액션 데이터', { data });

  if (!data.type) {
    return;
  }

  // 알림 유형에 따른 네비게이션
  switch (data.type) {
    case 'approval_request':
      window.location.href = '/admin/approval';
      break;
    case 'schedule_reminder':
      window.location.href = '/my-schedule';
      break;
    case 'salary_payment':
      window.location.href = '/staff';
      break;
    case 'attendance_reminder':
      window.location.href = '/attendance';
      break;
    default:
      window.location.href = '/';
      break;
  }
};

/**
 * 모든 예약된 알림 취소
 */
export const cancelAllNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await LocalNotifications.cancel({ notifications: [] });
    logger.info('모든 예약된 알림 취소 완료');
  } catch (error) {
    logger.error('알림 취소 실패:', error as Error);
  }
};

/**
 * 특정 알림 취소
 */
export const cancelNotification = async (id: number): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [{ id }]
    });
    logger.info('알림 취소 완료', { data: { id } });
  } catch (error) {
    logger.error(`알림 취소 실패 (${id}):`, error as Error);
  }
};

/**
 * 예약된 알림 목록 조회
 */
export const getPendingNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const result = await LocalNotifications.getPending();
    return result.notifications;
  } catch (error) {
    logger.error('예약된 알림 조회 실패:', error as Error);
    return [];
  }
};

/**
 * 로컬 알림 권한 상태 확인
 */
export const checkLocalNotificationPermission = async (): Promise<string> => {
  if (!Capacitor.isNativePlatform()) {
    return Notification.permission;
  }

  try {
    const permissions = await LocalNotifications.checkPermissions();
    return permissions.display;
  } catch (error) {
    logger.error('로컬 알림 권한 확인 실패:', error as Error);
    return 'denied';
  }
};