/**
 * UNIQN Mobile - Notification Store
 *
 * @description 알림 상태 관리 (Zustand + MMKV)
 * @version 1.3.0
 *
 * @changelog
 * - 1.3.0: 이중 소스 경계 명문화 — 이 스토어는 목록의 주인이 아니다(아래 참조)
 * - 1.2.0: React Query와 중복되는 isLoading 상태 제거
 *          (서버 데이터 로딩은 React Query가 담당, 스토어는 UI/오프라인 상태만 관리)
 *
 * ## 이중 소스 경계 — 역할 절단 (반드시 지킬 것)
 *
 * 알림 데이터는 React Query 캐시와 이 스토어 두 곳에 산다. 역할이 절단돼 있다:
 *
 * 1. **목록 축 = React Query 캐시 단독.**
 *    화면(`useNotificationList`)이 온라인에서 그리는 것은 `query.data` 다.
 *    ⚠️ 삭제·전체 삭제·페이지네이션을 이 스토어에만 반영하면 **화면은 한 픽셀도 안 바뀐다.**
 *    실제로 그 배선 누락 때문에 "삭제가 안 먹어 다시 누름" · "무한스크롤이 태어날 때부터 무효"가
 *    장기간 살아 있었다. 목록 변경은 반드시 `setQueryData` 로 렌더 소스를 패치할 것.
 * 2. **오프라인 스냅샷 · 미읽음 배지 축 = 이 스토어 단독.**
 *    쿼리 캐시는 persist 가 없어 앱 재시작 후 배지·오프라인 목록을 원리적으로 복원할 수 없다.
 *    `notifications`/`unreadCount`/`unreadByCategory` 는 그 목적의 상태다.
 * 3. **흐름은 한 방향(쿼리 → 스토어)만.**
 *    쿼리 결과를 이 스토어에 미러링하는 것은 OK. 반대로 이 스토어를 목록의 진실원 삼아
 *    쿼리 캐시로 되쓰는 것은 금지(두 축이 서로 덮어써서 되살아나는 항목이 생긴다).
 *
 * 아키텍처 분리:
 * - React Query: 서버 데이터 캐싱, 목록 축, 로딩 상태, 에러 상태
 * - Zustand: 오프라인 스냅샷, 미읽음 배지, 설정, 필터
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
} from '@/types/notification';
import { toDate } from '@/utils/date';
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
  // 오프라인 스냅샷 (React Query 데이터와 별도로 MMKV에 저장)
  // ⚠️ 화면 목록의 진실원이 아니다 — 파일 상단 "이중 소스 경계" 참조.
  //    여기만 바꾸면 온라인 화면은 안 바뀐다. 목록 변경은 쿼리 캐시(setQueryData) 가 먼저다.
  notifications: NotificationData[];

  // 실시간 카운터 (Firestore 리스너에서 직접 업데이트)
  unreadCount: number;

  // 페이지네이션 상태는 여기 없다 — 페이지 소유권은 `useNotificationList` 의
  // useInfiniteQuery 에 있다(`hasNextPage`). 스토어에 사본을 두면 반드시 갈린다.
  lastFetchedAt: number | null;

  // UI 상태 (순수 클라이언트 상태)
  settings: NotificationSettings;
  filter: NotificationFilter;

  // 계산된 값
  unreadByCategory: Record<NotificationCategoryType, number>;

  // 로컬 카운터 변경 타임스탬프 (Race Condition 방지, 비영구)
  lastCounterLocalUpdate: number;

  // 오프라인 → 온라인 정합성 플래그 (비영구)
  needsServerSync: boolean;

  // 기본 액션
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  addNotifications: (notifications: NotificationData[]) => void;
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
  setLastFetchedAt: (timestamp: number) => void;
  setUnreadCount: (count: number) => void;
  /** 미읽음 카운터 감소 (음수 방지) */
  decrementUnreadCount: (delta?: number) => void;

  // 유틸리티
  getFilteredNotifications: () => NotificationData[];
  setNeedsServerSync: (value: boolean) => void;
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
  lastFetchedAt: null as number | null,
  settings: createDefaultNotificationSettings(),
  filter: {} as NotificationFilter,
  unreadByCategory: createEmptyUnreadByCategory(),
  lastCounterLocalUpdate: 0,
  needsServerSync: false,
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

    // 날짜 필터 (MMKV 역직렬화 후 plain object 대응)
    if (filter.startDate) {
      const createdAt = toDate(notification.createdAt) ?? undefined;
      if (!createdAt || createdAt < filter.startDate) {
        return false;
      }
    }

    if (filter.endDate) {
      const createdAt = toDate(notification.createdAt) ?? undefined;
      if (!createdAt || createdAt > filter.endDate) {
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
          // Race Condition 방지: 서버 DELETE 진행 중 realtime 중간값이 낙관적 0을 덮지 않게
          lastCounterLocalUpdate: Date.now(),
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
            // Race Condition 방지: 로컬 변경 시점 기록
            lastCounterLocalUpdate: Date.now(),
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
            // Race Condition 방지: 로컬 변경 시점 기록
            lastCounterLocalUpdate: Date.now(),
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

      setNeedsServerSync: (value: boolean) => {
        set({ needsServerSync: value });
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

            // 캐시된 알림의 미읽음 수와 persist된 카운터 비교
            const cachedUnread = persisted.cachedNotifications.filter((n) => !n.isRead).length;
            if (
              persistedUnreadCount > cachedUnread + 5 ||
              persistedUnreadCount < cachedUnread - 5
            ) {
              // 5개 이상 차이 시 서버 동기화 필요 표시
              state.setNeedsServerSync(true);
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

// 알림 목록·필터·카테고리 셀렉터는 소비처가 0 이라 제거했다. 목록의 주인은
// React Query(useNotifications 훅)이고, 스토어는 배지 카운트·오프라인 캐시·설정만
// 담당한다. 스토어 상태가 필요하면 useNotificationStore 로 직접 구독할 것.
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectSettings = (state: NotificationState) => state.settings;

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * 읽지 않은 알림 수
 */
export const useUnreadCount = () => useNotificationStore(selectUnreadCount);

export default useNotificationStore;
