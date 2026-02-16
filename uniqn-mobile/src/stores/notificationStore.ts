/**
 * UNIQN Mobile - Notification Store
 *
 * @description 알림 상태 관리 (Zustand + MMKV)
 * @version 1.2.0
 *
 * @changelog
 * - 1.2.0: React Query와 중복되는 isLoading 상태 제거
 *          (서버 데이터 로딩은 React Query가 담당, 스토어는 UI/오프라인 상태만 관리)
 *
 * 아키텍처 분리:
 * - React Query: 서버 데이터 캐싱, 로딩 상태, 에러 상태
 * - Zustand: 오프라인 캐시, 설정, 필터, 실시간 카운터
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
  NOTIFICATION_TYPE_TO_CATEGORY,
  createDefaultNotificationSettings,
} from '@/types/notification';
import { logger } from '@/utils/logger';

type NotificationCategoryType = (typeof NotificationCategory)[keyof typeof NotificationCategory];

// ============================================================================
// Types
// ============================================================================

/**
 * MMKV에 영속화되는 상태 (partialize 반환 타입)
 */
interface NotificationPersistState {
  settings: NotificationSettings;
  lastFetchedAt: number | null;
  unreadCount: number;
  cachedNotifications: NotificationData[];
}

interface NotificationState {
  // 오프라인 캐시 (React Query 데이터와 별도로 MMKV에 저장)
  notifications: NotificationData[];

  // 실시간 카운터 (Firestore 리스너에서 직접 업데이트)
  unreadCount: number;

  // 페이지네이션 상태 (무한 스크롤용)
  hasMore: boolean;
  lastFetchedAt: number | null;

  // UI 상태 (순수 클라이언트 상태)
  settings: NotificationSettings;
  filter: NotificationFilter;

  // 계산된 값
  unreadByCategory: Record<NotificationCategoryType, number>;

  // 로컬 카운터 변경 타임스탬프 (Race Condition 방지, 비영구)
  lastCounterLocalUpdate: number;

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
  setHasMore: (hasMore: boolean) => void;
  setLastFetchedAt: (timestamp: number) => void;
  setUnreadCount: (count: number) => void;
  /** 미읽음 카운터 감소 (음수 방지) */
  decrementUnreadCount: (delta?: number) => void;

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
  hasMore: true,
  lastFetchedAt: null as number | null,
  settings: createDefaultNotificationSettings(),
  filter: {} as NotificationFilter,
  unreadByCategory: createEmptyUnreadByCategory(),
  lastCounterLocalUpdate: 0,
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
      const category = (NOTIFICATION_TYPE_TO_CATEGORY[notification.type] ||
        'system') as NotificationCategoryType;
      if (category in counts) {
        counts[category]++;
      }
    }
  });

  return counts;
}

/**
 * 알림에서 카테고리 추출
 *
 * @description 타입 안전하게 카테고리 추출, 유효하지 않으면 'system' 반환
 */
function getNotificationCategory(notification: NotificationData): NotificationCategoryType {
  return (NOTIFICATION_TYPE_TO_CATEGORY[notification.type] || 'system') as NotificationCategoryType;
}

/**
 * 증분 계산: 읽지 않은 알림 추가 시 카운트 증가 (O(1))
 *
 * @description 전체 재계산 대신 단일 알림 추가 시 사용
 */
function incrementUnreadCounts(
  currentCount: number,
  currentByCategory: Record<NotificationCategoryType, number>,
  notification: NotificationData
): { unreadCount: number; unreadByCategory: Record<NotificationCategoryType, number> } {
  // 이미 읽은 알림이면 카운트 변화 없음
  if (notification.isRead) {
    return { unreadCount: currentCount, unreadByCategory: currentByCategory };
  }

  const category = getNotificationCategory(notification);
  const newByCategory = { ...currentByCategory };

  if (category in newByCategory) {
    newByCategory[category]++;
  }

  return {
    unreadCount: currentCount + 1,
    unreadByCategory: newByCategory,
  };
}

/**
 * 증분 계산: 읽지 않은 알림 제거/읽음 처리 시 카운트 감소 (O(1))
 *
 * @description 전체 재계산 대신 단일 알림 제거/읽음 처리 시 사용
 */
function decrementUnreadCounts(
  currentCount: number,
  currentByCategory: Record<NotificationCategoryType, number>,
  notification: NotificationData
): { unreadCount: number; unreadByCategory: Record<NotificationCategoryType, number> } {
  // 이미 읽은 알림이면 카운트 변화 없음
  if (notification.isRead) {
    return { unreadCount: currentCount, unreadByCategory: currentByCategory };
  }

  const category = getNotificationCategory(notification);
  const newByCategory = { ...currentByCategory };

  if (category in newByCategory && newByCategory[category] > 0) {
    newByCategory[category]--;
  }

  return {
    unreadCount: Math.max(0, currentCount - 1),
    unreadByCategory: newByCategory,
  };
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
          // 증분 계산: O(1) - 전체 재계산 O(n) 대신
          const counts = incrementUnreadCounts(
            state.unreadCount,
            state.unreadByCategory,
            notification
          );

          return {
            notifications: newNotifications,
            ...counts,
            // Race Condition 방지: 로컬 변경 시점 기록
            lastCounterLocalUpdate: notification.isRead ? state.lastCounterLocalUpdate : Date.now(),
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
          const notification = state.notifications.find((n) => n.id === id);
          if (!notification) return state;

          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          );

          // isRead 변경 여부에 따라 증분 계산 적용
          let { unreadCount, unreadByCategory } = state;

          if ('isRead' in updates && updates.isRead !== notification.isRead) {
            if (updates.isRead) {
              // 읽음으로 변경: 카운트 감소
              const counts = decrementUnreadCounts(unreadCount, unreadByCategory, notification);
              unreadCount = counts.unreadCount;
              unreadByCategory = counts.unreadByCategory;
            } else {
              // 읽지 않음으로 변경: 카운트 증가
              const counts = incrementUnreadCounts(unreadCount, unreadByCategory, {
                ...notification,
                isRead: false,
              });
              unreadCount = counts.unreadCount;
              unreadByCategory = counts.unreadByCategory;
            }
          }

          return {
            notifications,
            unreadCount,
            unreadByCategory,
          };
        });
      },

      removeNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (!notification) return state;

          const notifications = state.notifications.filter((n) => n.id !== id);
          // 증분 계산: O(1) - 전체 재계산 O(n) 대신
          const counts = decrementUnreadCounts(
            state.unreadCount,
            state.unreadByCategory,
            notification
          );

          return {
            notifications,
            ...counts,
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
          const notification = state.notifications.find((n) => n.id === notificationId);
          // 알림이 없거나 이미 읽은 경우 변경 없음
          if (!notification || notification.isRead) return state;

          const notifications = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          );
          // 증분 계산: O(1) - 전체 재계산 O(n) 대신
          const counts = decrementUnreadCounts(
            state.unreadCount,
            state.unreadByCategory,
            notification
          );

          return {
            notifications,
            ...counts,
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
            const notificationCategory = NOTIFICATION_TYPE_TO_CATEGORY[n.type];
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

      setHasMore: (hasMore) => {
        set({ hasMore });
      },

      setLastFetchedAt: (timestamp) => {
        set({ lastFetchedAt: timestamp });
      },

      setUnreadCount: (count) => {
        set({ unreadCount: count });
      },

      decrementUnreadCount: (delta = 1) => {
        set((state) => ({
          unreadCount: Math.max(0, state.unreadCount - delta),
          // Race Condition 방지: 로컬 변경 시점 기록
          lastCounterLocalUpdate: Date.now(),
        }));
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
      // 캐싱할 데이터 선택
      partialize: (state): NotificationPersistState => ({
        settings: state.settings,
        lastFetchedAt: state.lastFetchedAt,
        // 앱 재시작 시 배지 카운트 즉시 표시를 위해 persist
        unreadCount: state.unreadCount,
        // 오프라인 지원: 최신 50개 알림 캐시
        cachedNotifications: state.notifications.slice(0, 50),
      }),
      // 상태 복원 시 캐시된 알림 복원
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            logger.warn('[NotificationStore] 복원 실패', { error });
            return;
          }
          if (!state) return;

          // persist된 데이터에서 cachedNotifications 추출
          const persisted = state as unknown as NotificationPersistState & NotificationState;

          // persist된 unreadCount 보존 (setNotifications가 재계산으로 덮어쓰지 않도록)
          const persistedUnreadCount = persisted.unreadCount ?? 0;

          // cachedNotifications가 있고 현재 notifications가 비어있으면 복원
          if (
            persisted.cachedNotifications?.length > 0 &&
            (!state.notifications || state.notifications.length === 0)
          ) {
            // 캐시된 알림으로 초기화
            state.setNotifications(persisted.cachedNotifications);

            // setNotifications가 cachedNotifications(최대 50개) 기반으로 재계산한 값 대신
            // persist된 원본 unreadCount 복원 (50개 초과 시 정확도 유지)
            if (persistedUnreadCount > 0) {
              state.setUnreadCount(persistedUnreadCount);
            }
          }
        };
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
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
 * 카테고리별 읽지 않은 알림 수
 */
export const useUnreadByCategory = () => useNotificationStore(selectUnreadByCategory);

// ============================================================================
// Action Selectors (불필요한 리렌더링 방지)
// ============================================================================

export const selectSetNotifications = (state: NotificationState) => state.setNotifications;
export const selectAddNotification = (state: NotificationState) => state.addNotification;
export const selectAddNotifications = (state: NotificationState) => state.addNotifications;
export const selectRemoveNotification = (state: NotificationState) => state.removeNotification;
export const selectSetHasMore = (state: NotificationState) => state.setHasMore;
export const selectMarkAsRead = (state: NotificationState) => state.markAsRead;
export const selectMarkAllAsRead = (state: NotificationState) => state.markAllAsRead;

/**
 * 알림 목록 관리 액션 훅
 *
 * @description 전체 store 구독 대신 액션만 구독하여 리렌더링 최소화
 * @note isLoading은 React Query가 관리 (useNotificationList 훅에서 query.isLoading 사용)
 */
export const useNotificationListActions = () => ({
  setNotifications: useNotificationStore(selectSetNotifications),
  addNotifications: useNotificationStore(selectAddNotifications),
  setHasMore: useNotificationStore(selectSetHasMore),
});

/**
 * 알림 읽음 처리 액션 훅
 */
export const useNotificationReadActions = () => ({
  markAsRead: useNotificationStore(selectMarkAsRead),
  markAllAsRead: useNotificationStore(selectMarkAllAsRead),
});

export default useNotificationStore;
