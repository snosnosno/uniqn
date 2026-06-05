/**
 * UNIQN Mobile - Push Permission Service
 *
 * @description 푸시 알림 권한 확인/요청
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import type { NotificationPermissionStatus } from './pushNotificationTypes';
import { getNotifications } from './pushNotificationState';

// 모듈 싱글톤으로 공유되므로 동결하여 호출자 변이로 인한 aliasing 오염 방지
const UNSUPPORTED_PERMISSION_STATUS: NotificationPermissionStatus = Object.freeze({
  granted: false,
  canAskAgain: false,
  status: 'denied',
});

const UNDETERMINED_PERMISSION_STATUS: NotificationPermissionStatus = Object.freeze({
  granted: false,
  canAskAgain: true,
  status: 'undetermined',
});

function toPermissionStatus(result: {
  status: string;
  canAskAgain?: boolean;
  ios?: {
    allowsAlert?: boolean | null;
    allowsBadge?: boolean | null;
    allowsSound?: boolean | null;
  } | null;
}): NotificationPermissionStatus {
  return {
    granted: result.status === 'granted',
    canAskAgain: result.canAskAgain ?? false,
    status: result.status as NotificationPermissionStatus['status'],
    ios: result.ios
      ? {
          allowsAlert: result.ios.allowsAlert ?? false,
          allowsBadge: result.ios.allowsBadge ?? false,
          allowsSound: result.ios.allowsSound ?? false,
        }
      : undefined,
  };
}

/**
 * 푸시 알림 권한 확인
 */
export async function checkPermission(): Promise<NotificationPermissionStatus> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) {
    return UNSUPPORTED_PERMISSION_STATUS;
  }

  try {
    return toPermissionStatus(await Notifications.getPermissionsAsync());
  } catch (error) {
    logger.error('알림 권한 확인 실패', toError(error));
    return UNDETERMINED_PERMISSION_STATUS;
  }
}

/**
 * 푸시 알림 권한 요청
 */
export async function requestPermission(): Promise<NotificationPermissionStatus> {
  const Notifications = getNotifications();
  if (Platform.OS === 'web' || !Notifications) {
    return UNSUPPORTED_PERMISSION_STATUS;
  }

  try {
    logger.info('푸시 알림 권한 요청');

    const result = toPermissionStatus(
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      })
    );

    logger.info('푸시 알림 권한 요청 결과', { status: result.status, granted: result.granted });
    return result;
  } catch (error) {
    logger.error('알림 권한 요청 실패', toError(error));
    return UNDETERMINED_PERMISSION_STATUS;
  }
}
