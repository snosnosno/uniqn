/**
 * UNIQN Mobile - Notification Components
 *
 * @description 알림 관련 컴포넌트 배럴 export
 * @version 1.0.0
 */

// Badge
export { NotificationBadge, NotificationBadgeInline } from './NotificationBadge';
export type { NotificationBadgeProps } from './NotificationBadge';

// Icon
export { NotificationIcon } from './NotificationIcon';
export type { NotificationIconProps } from './NotificationIcon';

// Item
export { NotificationItem, NotificationItemSkeleton } from './NotificationItem';
export type { NotificationItemProps } from './NotificationItem';

// Group Item
export { NotificationGroupItem } from './NotificationGroupItem';
export type { NotificationGroupItemProps } from './NotificationGroupItem';

// List
export { NotificationList, SimpleNotificationList } from './NotificationList';
export type { NotificationListProps, SimpleNotificationListProps } from './NotificationList';

// Settings
// NOTE: NotificationSettings(상세 알림설정 화면)는 현재 어느 라우트에도 연결되지 않은
// 미사용 컴포넌트다. 사용자 대면 단일 진실원천은 설정 화면의 '푸시 알림' 토글이며,
// 카테고리/방해금지/그룹화 상세 설정을 노출하려면 settings/notifications 라우트로 연결해야 한다.
// 잘못된 부분 사용·"설정이 두 개"로 보이는 혼란을 막기 위해 공개 배럴에서 제외한다(de-export).
// export { NotificationSettings } from './NotificationSettings';
// export type { NotificationSettingsProps } from './NotificationSettings';

// Category Tabs
export { NotificationCategoryTabs } from './NotificationCategoryTabs';
export type {
  NotificationCategoryTabsProps,
  NotificationCategoryFilter,
} from './NotificationCategoryTabs';
