import type { PaginationCursor } from '@/types/common';
import type { NotificationData, NotificationFilter } from '@/types/notification';

export type NotificationPageCursor = PaginationCursor;

export interface FetchNotificationsOptions {
  userId: string;
  filter?: NotificationFilter;
  pageSize?: number;
  lastDoc?: NotificationPageCursor;
}

export interface FetchNotificationsResult {
  notifications: NotificationData[];
  lastDoc: NotificationPageCursor | null;
  hasMore: boolean;
}
