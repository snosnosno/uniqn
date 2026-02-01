/**
 * UNIQN Mobile - 알림 그룹핑 유틸리티
 *
 * @description 동일 타입 + 동일 컨텍스트 알림을 그룹화
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import {
  NotificationData,
  NotificationType,
  GroupedNotificationData,
  NotificationListItem,
  NotificationGroupingOptions,
  GROUPABLE_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TO_CATEGORY,
  isGroupedNotification,
} from '@/types/notification';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<NotificationGroupingOptions> = {
  enabled: true,
  minGroupSize: 2,
  timeWindowMs: 24 * 60 * 60 * 1000, // 24시간
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Timestamp를 밀리초로 변환
 */
function timestampToMs(ts: Timestamp | Date | undefined): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  return ts.toDate().getTime();
}

/**
 * 알림에서 그룹핑 컨텍스트 키 추출
 *
 * @description 알림 타입에 따라 적절한 컨텍스트 키 반환
 * - 모든 그룹핑 가능 타입 → jobPostingId 사용
 */
function extractContextKey(notification: NotificationData): string | null {
  const { type, data } = notification;

  // 그룹핑 불가능한 타입
  if (!GROUPABLE_NOTIFICATION_TYPES.includes(type)) {
    return null;
  }

  // 모든 알림 타입에서 jobPostingId 사용 (통합)
  return data?.jobPostingId || null;
}

/**
 * 그룹핑 키 생성
 */
function createGroupKey(notification: NotificationData): string | null {
  const contextKey = extractContextKey(notification);
  if (!contextKey) return null;

  return `${notification.type}_${contextKey}`;
}

/**
 * 그룹 제목 생성
 */
function createGroupTitle(type: NotificationType, count: number): string {
  switch (type) {
    case NotificationType.NEW_APPLICATION:
      return `새 지원자 ${count}명`;
    case NotificationType.APPLICATION_CANCELLED:
      return `지원 취소 ${count}건`;
    case NotificationType.STAFF_CHECKED_IN:
      return `출근 ${count}명`;
    case NotificationType.STAFF_CHECKED_OUT:
      return `퇴근 ${count}명`;
    case NotificationType.NO_SHOW_ALERT:
      return `노쇼 알림 ${count}건`;
    default: {
      const baseLabel = NOTIFICATION_TYPE_LABELS[type] || '알림';
      return `${baseLabel} ${count}건`;
    }
  }
}

/**
 * 그룹 본문 생성 (최근 알림들 요약)
 */
function createGroupBody(notifications: NotificationData[], maxPreview: number = 3): string {
  const previewItems = notifications.slice(0, maxPreview);
  const remaining = notifications.length - maxPreview;

  const previewText = previewItems
    .map((n) => {
      // staffName 또는 body에서 이름 추출
      const name = n.data?.staffName || n.body.split(' ')[0] || '';
      return name;
    })
    .filter(Boolean)
    .join(', ');

  if (remaining > 0) {
    return `${previewText} 외 ${remaining}명`;
  }

  return previewText || notifications[0]?.body || '';
}

/**
 * 그룹 내 알림 컨텍스트 추출
 */
function extractGroupContext(
  notifications: NotificationData[]
): GroupedNotificationData['context'] {
  const firstNotification = notifications[0];
  if (!firstNotification) return {};

  return {
    jobPostingId: firstNotification.data?.jobPostingId,
    jobTitle: firstNotification.data?.jobTitle,
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 알림 목록을 그룹화
 *
 * @param notifications - 원본 알림 목록 (최신순 정렬 가정)
 * @param options - 그룹핑 옵션
 * @returns 그룹화된 알림 목록 (최신순)
 *
 * @example
 * const grouped = groupNotifications(notifications);
 * // [GroupedNotificationData, NotificationData, GroupedNotificationData, ...]
 */
export function groupNotifications(
  notifications: NotificationData[],
  options: NotificationGroupingOptions = {}
): NotificationListItem[] {
  const { enabled, minGroupSize, timeWindowMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // 그룹핑 비활성화 시 원본 반환
  if (!enabled) {
    return notifications;
  }

  // 그룹 맵 (groupKey → notifications[])
  const groupMap = new Map<string, NotificationData[]>();
  const ungrouped: NotificationData[] = [];

  // 현재 시간 (시간 윈도우 계산용)
  const now = Date.now();

  for (const notification of notifications) {
    const groupKey = createGroupKey(notification);
    const createdAtMs = timestampToMs(notification.createdAt);

    // 그룹핑 불가 또는 시간 윈도우 초과
    if (!groupKey || now - createdAtMs > timeWindowMs) {
      ungrouped.push(notification);
      continue;
    }

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(notification);
  }

  // 결과 배열 생성
  const result: NotificationListItem[] = [];

  // 그룹화된 알림 처리
  for (const [groupKey, groupNotifications] of groupMap) {
    if (groupNotifications.length >= minGroupSize) {
      // 그룹 크기 충족: GroupedNotificationData 생성
      const sortedNotifications = groupNotifications.sort(
        (a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt)
      );

      const firstNotification = sortedNotifications[0]!;
      const unreadCount = sortedNotifications.filter((n) => !n.isRead).length;

      const grouped: GroupedNotificationData = {
        groupId: groupKey,
        type: firstNotification.type,
        context: extractGroupContext(sortedNotifications),
        notifications: sortedNotifications,
        count: sortedNotifications.length,
        unreadCount,
        latestCreatedAt: firstNotification.createdAt,
        groupTitle: createGroupTitle(firstNotification.type, sortedNotifications.length),
        groupBody: createGroupBody(sortedNotifications),
      };

      result.push(grouped);
    } else {
      // 그룹 크기 미달: 원본 유지
      result.push(...groupNotifications);
    }
  }

  // 그룹화 불가능한 알림 추가
  result.push(...ungrouped);

  // 최신순 정렬
  result.sort((a, b) => {
    const timeA = isGroupedNotification(a)
      ? timestampToMs(a.latestCreatedAt)
      : timestampToMs(a.createdAt);
    const timeB = isGroupedNotification(b)
      ? timestampToMs(b.latestCreatedAt)
      : timestampToMs(b.createdAt);
    return timeB - timeA;
  });

  return result;
}

/**
 * 그룹화된 알림 목록의 총 읽지 않은 수 계산
 */
export function countUnreadInGroupedList(items: NotificationListItem[]): number {
  return items.reduce((count, item) => {
    if (isGroupedNotification(item)) {
      return count + item.unreadCount;
    }
    return count + (item.isRead ? 0 : 1);
  }, 0);
}

/**
 * 카테고리 필터와 함께 그룹핑 적용
 */
export function groupNotificationsWithCategoryFilter(
  notifications: NotificationData[],
  categoryFilter: string | null,
  options: NotificationGroupingOptions = {}
): NotificationListItem[] {
  // 카테고리 필터링 먼저 적용
  let filtered = notifications;
  if (categoryFilter && categoryFilter !== 'all') {
    filtered = notifications.filter(
      (n) => NOTIFICATION_TYPE_TO_CATEGORY[n.type] === categoryFilter
    );
  }

  // 그룹핑 적용
  return groupNotifications(filtered, options);
}

// Re-export 타입 가드
export { isGroupedNotification };
