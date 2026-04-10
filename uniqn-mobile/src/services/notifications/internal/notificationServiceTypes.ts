import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { NotificationData, NotificationFilter } from '@/types/notification';

export type NotificationPageCursor = QueryDocumentSnapshot;

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
