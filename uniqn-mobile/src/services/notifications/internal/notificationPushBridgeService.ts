import { Platform } from 'react-native';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { notificationRepository } from '@/repositories';
import type { NotificationPermissionStatus } from '../pushNotificationService';
import * as pushNotificationService from '../pushNotificationService';
import { createNotificationFromFCM } from './notificationMessageNormalizer';

const COMPONENT = 'notificationService';

export { createNotificationFromFCM };

export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  return pushNotificationService.checkPermission();
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }

  return pushNotificationService.requestPermission();
}

export async function registerFCMToken(
  userId: string,
  token: string,
  metadata: { type: 'expo' | 'fcm'; platform: 'ios' | 'android' }
): Promise<void> {
  try {
    await notificationRepository.registerFCMToken(userId, token, metadata);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'FCM 토큰 등록',
      component: COMPONENT,
      context: { userId, platform: metadata.platform },
    });
  }
}

export async function unregisterFCMToken(userId: string, token: string): Promise<void> {
  try {
    await notificationRepository.unregisterFCMToken(userId, token);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'FCM 토큰 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}

export async function unregisterAllFCMTokens(userId: string): Promise<void> {
  try {
    await notificationRepository.unregisterAllFCMTokens(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '모든 FCM 토큰 삭제',
      component: COMPONENT,
      context: { userId },
    });
  }
}
