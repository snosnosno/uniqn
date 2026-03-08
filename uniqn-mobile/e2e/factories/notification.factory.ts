/**
 * Notification 테스트 데이터 팩토리
 */

type NotificationType =
  | 'application_received'
  | 'application_accepted'
  | 'application_rejected'
  | 'work_reminder'
  | 'review_request'
  | 'announcement'
  | 'system';

interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

let notificationCounter = 0;

/**
 * 알림 테스트 데이터 생성
 */
export function createNotification(
  options: Partial<NotificationData> = {}
): NotificationData {
  notificationCounter++;
  return {
    id: options.id ?? `notification-${notificationCounter}`,
    type: options.type ?? 'system',
    title: options.title ?? `알림 제목 ${notificationCounter}`,
    body: options.body ?? `알림 내용 ${notificationCounter}`,
    isRead: options.isRead ?? false,
    createdAt:
      options.createdAt ?? new Date().toISOString(),
    data: options.data,
  };
}

/**
 * 읽지 않은 알림 목록 생성
 */
export function createUnreadNotifications(count: number): NotificationData[] {
  return Array.from({ length: count }, (_, i) =>
    createNotification({
      title: `미읽 알림 ${i + 1}`,
      body: `알림 내용 ${i + 1}`,
      isRead: false,
      type: i % 2 === 0 ? 'application_received' : 'announcement',
    })
  );
}

/**
 * 공지사항 알림 데이터 생성
 */
export function createAnnouncementNotification(
  options: Partial<NotificationData> = {}
): NotificationData {
  return createNotification({
    type: 'announcement',
    title: '새 공지사항',
    body: '새로운 공지사항이 등록되었습니다',
    ...options,
  });
}
