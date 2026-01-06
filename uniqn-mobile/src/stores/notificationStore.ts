/**
 * UNIQN Mobile - Notification Store
 *
 * @description 알림 상태 관리 (Zustand + MMKV)
 * @version 1.1.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
} from '@/types/notification';
import {
  NotificationCategory,
  createDefaultNotificationSettings,
} from '@/types/notification';

type NotificationCategoryType = (typeof NotificationCategory)[keyof typeof NotificationCategory];

// ============================================================================
// Types
// ============================================================================

interface NotificationState {
  // 상태
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  lastFetchedAt: number | null;
  settings: NotificationSettings;
  filter: NotificationFilter;

  // 계산된 값
  unreadByCategory: Record<NotificationCategoryType, number>;

  // 기본 액션
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  addNotifications: (notifications: NotificationData[]) => void;
  updateNotification: (id: string, updates: Partial<NotificationData>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // 읽음 처리
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  markCategoryAsRead: (category: NotificationCategoryType) => void;

  // 설정
  setSettings: (settings: NotificationSettings) => void;
  updateCategorySetting: (
    category: NotificationCategoryType,
    updates: { enabled?: boolean; pushEnabled?: boolean }
  ) => void;
  toggleNotifications: (enabled: boolean) => void;

  // 필터
  setFilter: (filter: NotificationFilter) => void;
  clearFilter: () => void;

  // 상태 관리
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setLastFetchedAt: (timestamp: number) => void;

  // 유틸리티
  getFilteredNotifications: () => NotificationData[];
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * 카테고리별 읽지 않은 알림 수 초기값
 */
function createEmptyUnreadByCategory(): Record<NotificationCategoryType, number> {
  return Object.values(NotificationCategory).reduce(
    (acc, category) => ({ ...acc, [category]: 0 }),
    {} as Record<NotificationCategoryType, number>
  );
}

const initialState = {
  notifications: [] as NotificationData[],
  unreadCount: 0,
  isLoading: false,
  hasMore: true,
  lastFetchedAt: null as number | null,
  settings: createDefaultNotificationSettings(),
  filter: {} as NotificationFilter,
  unreadByCategory: createEmptyUnreadByCategory(),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 읽지 않은 알림 수 계산
 */
function calculateUnreadCount(notifications: NotificationData[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

/**
 * 카테고리별 읽지 않은 알림 수 계산
 */
function calculateUnreadByCategory(
  notifications: NotificationData[]
): Record<NotificationCategoryType, number> {
  // 모든 카테고리를 0으로 초기화
  const counts = createEmptyUnreadByCategory();

  notifications.forEach((notification) => {
    if (!notification.isRead) {
      const category = notification.type.split('_')[0] || 'system';
      if (category in counts) {
        counts[category as NotificationCategoryType]++;
      }
    }
  });

  return counts;
}

/**
 * 알림 필터 적용
 */
function applyFilter(
  notifications: NotificationData[],
  filter: NotificationFilter
): NotificationData[] {
  return notifications.filter((notification) => {
    // 읽음 여부 필터
    if (filter.isRead !== undefined && notification.isRead !== filter.isRead) {
      return false;
    }

    // 타입 필터
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(notification.type)) {
        return false;
      }
    }

    // 날짜 필터
    if (filter.startDate) {
      const createdAt = notification.createdAt.toDate?.() || notification.createdAt;
      if (createdAt < filter.startDate) {
        return false;
      }
    }

    if (filter.endDate) {
      const createdAt = notification.createdAt.toDate?.() || notification.createdAt;
      if (createdAt > filter.endDate) {
        return false;
      }
    }

    return true;
  });
}

// ============================================================================
// Store
// ============================================================================

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================================================
      // 기본 액션
      // ========================================================================

      setNotifications: (notifications) => {
        set({
          notifications,
          unreadCount: calculateUnreadCount(notifications),
          unreadByCategory: calculateUnreadByCategory(notifications),
          lastFetchedAt: Date.now(),
        });
      },

      addNotification: (notification) => {
        set((state) => {
          const exists = state.notifications.some((n) => n.id === notification.id);
          if (exists) return state;

          const newNotifications = [notification, ...state.notifications];
          return {
            notifications: newNotifications,
            unreadCount: calculateUnreadCount(newNotifications),
            unreadByCategory: calculateUnreadByCategory(newNotifications),
          };
        });
      },

      addNotifications: (notifications) => {
        set((state) => {
          const existingIds = new Set(state.notifications.map((n) => n.id));
          const newNotifications = notifications.filter((n) => !existingIds.has(n.id));
          const allNotifications = [...state.notifications, ...newNotifications];

          return {
            notifications: allNotifications,
            unreadCount: calculateUnreadCount(allNotifications),
            unreadByCategory: calculateUnreadByCategory(allNotifications),
          };
        });
      },

      updateNotification: (id, updates) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          );
          return {
            notifications,
            unreadCount: calculateUnreadCount(notifications),
            unreadByCategory: calculateUnreadByCategory(notifications),
          };
        });
      },

      removeNotification: (id) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          return {
            notifications,
            unreadCount: calculateUnreadCount(notifications),
            unreadByCategory: calculateUnreadByCategory(notifications),
          };
        });
      },

      clearNotifications: () => {
        set({
          notifications: [],
          unreadCount: 0,
          unreadByCategory: createEmptyUnreadByCategory(),
        });
      },

      // ========================================================================
      // 읽음 처리
      // ========================================================================

      markAsRead: (notificationId) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          );
          return {
            notifications,
            unreadCount: calculateUnreadCount(notifications),
            unreadByCategory: calculateUnreadByCategory(notifications),
          };
        });
      },

      markAllAsRead: () => {
        set((state) => {
          const notifications = state.notifications.map((n) => ({
            ...n,
            isRead: true,
          }));
          return {
            notifications,
            unreadCount: 0,
            unreadByCategory: createEmptyUnreadByCategory(),
          };
        });
      },

      markCategoryAsRead: (category) => {
        set((state) => {
          const notifications = state.notifications.map((n) => {
            const notificationCategory = n.type.split('_')[0];
            if (notificationCategory === category) {
              return { ...n, isRead: true };
            }
            return n;
          });
          return {
            notifications,
            unreadCount: calculateUnreadCount(notifications),
            unreadByCategory: calculateUnreadByCategory(notifications),
          };
        });
      },

      // ========================================================================
      // 설정
      // ========================================================================

      setSettings: (settings) => {
        set({ settings });
      },

      updateCategorySetting: (category, updates) => {
        set((state) => ({
          settings: {
            ...state.settings,
            categories: {
              ...state.settings.categories,
              [category]: {
                ...state.settings.categories[category],
                ...updates,
              },
            },
          },
        }));
      },

      toggleNotifications: (enabled) => {
        set((state) => ({
          settings: {
            ...state.settings,
            enabled,
          },
        }));
      },

      // ========================================================================
      // 필터
      // ========================================================================

      setFilter: (filter) => {
        set({ filter });
      },

      clearFilter: () => {
        set({ filter: {} });
      },

      // ========================================================================
      // 상태 관리
      // ========================================================================

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setHasMore: (hasMore) => {
        set({ hasMore });
      },

      setLastFetchedAt: (timestamp) => {
        set({ lastFetchedAt: timestamp });
      },

      // ========================================================================
      // 유틸리티
      // ========================================================================

      getFilteredNotifications: () => {
        const state = get();
        return applyFilter(state.notifications, state.filter);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => mmkvStorage),
      // 캐싱할 데이터 선택 (알림 목록은 제외, 설정만 저장)
      partialize: (state) => ({
        settings: state.settings,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectIsLoading = (state: NotificationState) => state.isLoading;
export const selectHasMore = (state: NotificationState) => state.hasMore;
export const selectSettings = (state: NotificationState) => state.settings;
export const selectFilter = (state: NotificationState) => state.filter;
export const selectUnreadByCategory = (state: NotificationState) => state.unreadByCategory;

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * 읽지 않은 알림 수
 */
export const useUnreadCount = () => useNotificationStore(selectUnreadCount);

/**
 * 알림 목록
 */
export const useNotifications = () => useNotificationStore(selectNotifications);

/**
 * 알림 설정
 */
export const useNotificationSettings = () => useNotificationStore(selectSettings);

/**
 * 알림 로딩 상태
 */
export const useNotificationLoading = () => useNotificationStore(selectIsLoading);

/**
 * 카테고리별 읽지 않은 알림 수
 */
export const useUnreadByCategory = () => useNotificationStore(selectUnreadByCategory);

export default useNotificationStore;
