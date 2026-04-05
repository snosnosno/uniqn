import { handleServiceError } from '@/errors/serviceErrorHandler';
import { notificationRepository } from '@/repositories';
import type { NotificationSettings } from '@/types/notification';

const COMPONENT = 'notificationService';

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    return await notificationRepository.getSettings(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 설정 조회',
      component: COMPONENT,
      context: { userId },
    });
  }
}

export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  try {
    await notificationRepository.saveSettings(userId, settings);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '알림 설정 저장',
      component: COMPONENT,
      context: { userId },
    });
  }
}
