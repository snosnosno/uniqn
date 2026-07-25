/**
 * UNIQN Mobile - Notification Hooks
 *
 * @description 알림 관련 커스텀 훅
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotificationPageCursor } from '@/services/notifications/notificationService';
import {
  fetchNotifications,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  deleteAllNotifications as deleteAllNotificationsService,
  subscribeToNotifications,
  getNotificationSettings,
  saveNotificationSettings,
  checkNotificationPermission,
  requestNotificationPermission,
} from '@/services/notifications/notificationService';
import {
  syncMissedNotifications,
  shouldSync,
} from '@/services/notifications/notificationSyncService';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import {
  requireOnlineForMutation,
  shouldApplyOptimisticUpdate,
} from '@/services/offline/remoteMutationGuard';
import {
  groupNotificationsWithCategoryFilter,
  countUnreadInGroupedList,
} from '@/utils/notificationGrouping';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
  NotificationCategory,
  NotificationListItem,
  GroupedNotificationData,
  NotificationGroupingOptions,
} from '@/types/notification';

// ============================================================================
// Query Keys (중앙 관리 - @/lib/queryClient.ts의 queryKeys.notifications 사용)
// ============================================================================

// P2 아키텍처: 로컬 notificationKeys 제거, queryKeys.notifications 사용
const notificationKeys = queryKeys.notifications;

// ============================================================================
// useNotificationList
// ============================================================================

interface UseNotificationListOptions {
  filter?: NotificationFilter;
  enabled?: boolean;
}

interface UseNotificationListResult {
  notifications: NotificationData[];
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  error: Error | null;
  hasMore: boolean;
  fetchNextPage: () => Promise<void>;
  isFetchingNextPage: boolean;
  refetch: () => Promise<void>;
}

/**
 * 알림 목록 조회 훅 (오프라인 지원)
 */
export function useNotificationList(
  options: UseNotificationListOptions = {}
): UseNotificationListResult {
  const { filter, enabled = true } = options;
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const {
    notifications: cachedNotifications,
    setNotifications,
    addNotifications,
    setHasMore,
    lastFetchedAt,
  } = useNotificationStore();
  const { addToast } = useToastStore();
  const { isOnline, isOffline } = useNetworkStatus();
  const [lastDoc, setLastDoc] = useState<NotificationPageCursor | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const hasSyncedRef = useRef(false);
  const queryKey = notificationKeys.list(filter ?? {});
  const hasServerSideFilters = Boolean(
    filter?.isRead !== undefined ||
    (filter?.types && filter.types.length > 0) ||
    filter?.startDate ||
    filter?.endDate ||
    filter?.category
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');

      const result = await fetchNotifications({
        userId: user.uid,
        filter,
      });

      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      return result.notifications;
    },
    // 오프라인 시 쿼리 비활성화
    enabled: enabled && !!user?.uid && isOnline,
    staleTime: cachingPolicies.nearRealtime, // 2분
  });

  useEffect(() => {
    if (!enabled || !user?.uid || !isOnline || hasServerSideFilters) {
      return;
    }

    return subscribeToNotifications(
      user.uid,
      () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }).catch((error) => {
          logger.warn('실시간 알림 목록 무효화 실패', {
            error: toError(error).message,
          });
        });
      },
      (error) => {
        logger.warn('실시간 알림 목록 구독 실패', {
          error: error.message,
        });
      }
    );
  }, [enabled, hasServerSideFilters, isOnline, queryClient, user?.uid]);

  // 스토어 동기화 (오프라인 캐시용)
  useEffect(() => {
    if (query.data) {
      setNotifications(query.data);
    }
  }, [query.data, setNotifications]);

  // 온라인 복귀 시 놓친 알림 동기화
  useEffect(() => {
    if (!isOnline || !user?.uid) return;
    if (hasSyncedRef.current) return;
    if (!shouldSync(lastFetchedAt)) return;

    hasSyncedRef.current = true;

    const sync = async () => {
      try {
        const result = await syncMissedNotifications(
          user.uid,
          lastFetchedAt,
          cachedNotifications.map((n) => n.id)
        );

        if (result.success && result.syncedCount > 0) {
          addNotifications(result.notifications);
          addToast({
            type: 'info',
            message: `새 알림 ${result.syncedCount}개가 도착했습니다`,
            duration: 4000,
          });
          logger.info('놓친 알림 동기화 완료', { count: result.syncedCount });
        }
      } catch (error) {
        logger.error('놓친 알림 동기화 실패', toError(error));
      }
    };

    sync();

    // 다음 온라인 복귀 시 다시 동기화 허용
    return () => {
      hasSyncedRef.current = false;
    };
  }, [isOnline, user?.uid, lastFetchedAt, cachedNotifications, addNotifications, addToast]);

  // 다음 페이지 가져오기
  const fetchNextPage = useCallback(async () => {
    if (!user?.uid || !lastDoc || isFetchingNextPage || isOffline) return;

    setIsFetchingNextPage(true);
    try {
      const result = await fetchNotifications({
        userId: user.uid,
        filter,
        lastDoc,
      });

      addNotifications(result.notifications);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      logger.error('다음 페이지 로드 실패', toError(error));
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [user?.uid, lastDoc, filter, isFetchingNextPage, isOffline, addNotifications, setHasMore]);

  // 오프라인 시 캐시된 데이터 반환
  const effectiveNotifications = useMemo(() => {
    if (isOffline && cachedNotifications.length > 0) {
      return cachedNotifications;
    }
    return query.data ?? cachedNotifications;
  }, [isOffline, cachedNotifications, query.data]);

  return {
    notifications: effectiveNotifications,
    isLoading: isOnline ? query.isLoading : false,
    isRefreshing: query.isRefetching,
    isError: query.isError,
    error: query.error ? toError(query.error) : null,
    hasMore: useNotificationStore((state) => state.hasMore),
    fetchNextPage,
    isFetchingNextPage,
    refetch: async () => {
      if (isOffline) return;
      setLastDoc(null);
      await query.refetch();
    },
  };
}

// ============================================================================
// useUnreadCount
// ============================================================================

// useMarkAsRead
// ============================================================================

/**
 * 알림 읽음 처리 훅
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { markAsRead: markAsReadLocal } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async (notificationId: string) => {
      requireOnlineForMutation('useNotifications.markAsRead');
      await markAsReadService(notificationId);
      return notificationId;
    },
    onSuccess: (notificationId) => {
      markAsReadLocal(notificationId);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error: Error) => {
      logger.error('알림 읽음 처리 실패', error);
      addToast({
        type: 'error',
        message: '알림 읽음 처리에 실패했습니다.',
      });
    },
  });

  return {
    markAsRead: mutation.mutate,
    isMarking: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// useMarkAllAsRead
// ============================================================================

/**
 * 모든 알림 읽음 처리 훅
 */
export function useMarkAllAsRead() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { markAllAsRead: markAllAsReadLocal } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');
      requireOnlineForMutation('useNotifications.markAllAsRead');
      await markAllAsReadService(user.uid);
    },
    onSuccess: () => {
      markAllAsReadLocal();
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      addToast({
        type: 'success',
        message: '모든 알림을 읽음 처리했습니다.',
      });
    },
    onError: (error: Error) => {
      logger.error('모든 알림 읽음 처리 실패', error);
      addToast({
        type: 'error',
        message: '알림 읽음 처리에 실패했습니다.',
      });
    },
  });

  return {
    markAllAsRead: mutation.mutate,
    isMarking: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// useDeleteNotification
// ============================================================================

/**
 * 알림 삭제 훅 (Optimistic Update 적용)
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { removeNotification, notifications, setNotifications } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async (notificationId: string) => {
      requireOnlineForMutation('useNotifications.deleteNotification');
      await deleteNotificationService(notificationId);
      return notificationId;
    },
    // Optimistic Update: 서버 응답 전에 UI 즉시 업데이트
    onMutate: async (notificationId: string) => {
      if (!shouldApplyOptimisticUpdate()) {
        return { previousNotifications: undefined };
      }
      // 이전 상태 스냅샷 저장 (롤백용)
      const previousNotifications = [...notifications];

      // 즉시 UI에서 제거 (낙관적 업데이트)
      removeNotification(notificationId);

      return { previousNotifications };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      addToast({
        type: 'success',
        message: '알림이 삭제되었습니다.',
      });
    },
    onError: (error: Error, _, context) => {
      logger.error('알림 삭제 실패', error);

      // 롤백: 이전 상태로 복원
      if (context?.previousNotifications) {
        setNotifications(context.previousNotifications);
      }

      addToast({
        type: 'error',
        message: '알림 삭제에 실패했습니다.',
      });
    },
  });

  return {
    deleteNotification: mutation.mutate,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// useDeleteAllNotifications
// ============================================================================

/**
 * 모든 알림 삭제 훅 (Optimistic Update 적용)
 */
export function useDeleteAllNotifications() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { notifications, setNotifications, clearNotifications } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');
      requireOnlineForMutation('useNotifications.deleteAllNotifications');
      return await deleteAllNotificationsService(user.uid);
    },
    // Optimistic Update: 서버 응답 전에 목록·카운터 즉시 초기화
    onMutate: async () => {
      if (!shouldApplyOptimisticUpdate()) {
        return { previousNotifications: undefined };
      }
      const previousNotifications = [...notifications];
      clearNotifications();
      return { previousNotifications };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      addToast({
        type: 'success',
        message: '알림을 모두 삭제했습니다.',
      });
    },
    onError: (error: Error, _, context) => {
      logger.error('모든 알림 삭제 실패', error);

      // 롤백: 이전 목록 복원 (카운터는 setNotifications가 재계산)
      if (context?.previousNotifications) {
        setNotifications(context.previousNotifications);
      }

      addToast({
        type: 'error',
        message: '알림 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.',
      });
    },
  });

  return {
    deleteAllNotifications: mutation.mutate,
    isDeletingAll: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// useNotificationSettings
// ============================================================================

/**
 * 알림 설정 훅
 */
export function useNotificationSettingsQuery() {
  const user = useAuthStore((state) => state.user);
  const { setSettings, settings } = useNotificationStore();
  const { isOnline } = useNetworkStatus();

  const query = useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: async () => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');
      return getNotificationSettings(user.uid);
    },
    enabled: !!user?.uid && isOnline,
    staleTime: cachingPolicies.stable, // 60분
  });

  // 스토어 동기화
  useEffect(() => {
    if (query.data) {
      setSettings(query.data);
    }
  }, [query.data, setSettings]);

  return {
    ...query,
    data: query.data ?? settings,
    error: isOnline ? query.error : null,
  };
}

/**
 * 알림 설정 저장 훅
 */
export function useSaveNotificationSettings() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { setSettings } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');
      requireOnlineForMutation('useNotifications.saveSettings');
      await saveNotificationSettings(user.uid, settings);
      return settings;
    },
    // 낙관적 업데이트: 토글 탭 즉시 반영 (컨트롤드 Switch가 서버 왕복 동안 옛 값으로
    // 되돌아가 "안 눌린다"로 보이던 문제 해소). 쿼리 캐시 + 스토어 동시 패치 후 실패 시 롤백.
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.settings() });
      const previous = queryClient.getQueryData<NotificationSettings>(notificationKeys.settings());
      queryClient.setQueryData(notificationKeys.settings(), settings);
      setSettings(settings);
      return { previous };
    },
    onSuccess: (settings) => {
      setSettings(settings);
      queryClient.invalidateQueries({ queryKey: notificationKeys.settings() });
      addToast({
        type: 'success',
        message: '알림 설정이 저장되었습니다.',
      });
    },
    onError: (error: Error, _settings, context) => {
      // 롤백: 낙관적으로 반영한 값을 이전 상태로 복원 후 서버 기준으로 재동기화
      if (context?.previous !== undefined) {
        queryClient.setQueryData(notificationKeys.settings(), context.previous);
        setSettings(context.previous);
      }
      queryClient.invalidateQueries({ queryKey: notificationKeys.settings() });
      logger.error('알림 설정 저장 실패', error);
      addToast({
        type: 'error',
        message: '알림 설정 저장에 실패했습니다.',
      });
    },
  });

  return {
    saveSettings: mutation.mutate,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// useNotificationPermission
// ============================================================================

/**
 * 푸시 알림 권한 훅
 */
type NotificationPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
};

function isSameNotificationPermissionState(
  current: NotificationPermissionState,
  next: NotificationPermissionState
) {
  return (
    current.granted === next.granted &&
    current.canAskAgain === next.canAskAgain &&
    current.status === next.status
  );
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  });
  const [isRequesting, setIsRequesting] = useState(false);
  const isMountedRef = useRef(true);

  // 권한 확인
  useEffect(() => {
    isMountedRef.current = true;

    const check = async () => {
      const result = await checkNotificationPermission();
      if (!isMountedRef.current) {
        return;
      }

      setPermission((current) =>
        isSameNotificationPermissionState(current, result) ? current : result
      );
    };

    void check();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 권한 요청
  const requestPermission = useCallback(async () => {
    if (isMountedRef.current) {
      setIsRequesting(true);
    }

    try {
      const result = await requestNotificationPermission();
      if (isMountedRef.current) {
        setPermission((current) =>
          isSameNotificationPermissionState(current, result) ? current : result
        );
      }
      return result;
    } finally {
      if (isMountedRef.current) {
        setIsRequesting(false);
      }
    }
  }, []);

  return {
    ...permission,
    isRequesting,
    requestPermission,
  };
}

// ============================================================================
// useGroupedNotifications
// ============================================================================

interface UseGroupedNotificationsOptions {
  /** 카테고리 필터 */
  categoryFilter?: NotificationCategory | 'all';
  /** 그룹핑 옵션 */
  groupingOptions?: NotificationGroupingOptions;
  /** 쿼리 활성화 */
  enabled?: boolean;
}

interface UseGroupedNotificationsResult {
  /** 그룹화된 알림 목록 */
  groupedNotifications: NotificationListItem[];
  /** 원본 알림 목록 */
  rawNotifications: NotificationData[];
  /** 그룹 포함 읽지 않은 수 */
  unreadCount: number;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 새로고침 중 여부 */
  isRefreshing: boolean;
  /** 에러 */
  error: Error | null;
  /** 추가 데이터 존재 */
  hasMore: boolean;
  /** 다음 페이지 로드 */
  fetchNextPage: () => Promise<void>;
  /** 다음 페이지 로딩 중 */
  isFetchingNextPage: boolean;
  /** 새로고침 */
  refetch: () => Promise<void>;
  /** 그룹 내 모든 알림 읽음 처리 */
  markGroupAsRead: (group: GroupedNotificationData) => void;
}

/**
 * 그룹화된 알림 목록 훅
 *
 * @description 알림을 그룹화하고 카테고리 필터를 적용한 목록 제공
 * @note 사용자 설정(notificationStore.settings.grouping)이 우선 적용됨
 */
export function useGroupedNotifications(
  options: UseGroupedNotificationsOptions = {}
): UseGroupedNotificationsResult {
  const { categoryFilter = 'all', groupingOptions, enabled = true } = options;

  // 사용자 설정에서 그룹핑 옵션 가져오기
  const userGroupingSettings = useNotificationStore((state) => state.settings.grouping);

  // 사용자 설정 우선 적용 (효과적인 옵션 계산)
  const effectiveGroupingOptions: NotificationGroupingOptions = useMemo(
    () => ({
      enabled: userGroupingSettings?.enabled ?? groupingOptions?.enabled ?? true,
      minGroupSize: userGroupingSettings?.minGroupSize ?? groupingOptions?.minGroupSize ?? 2,
      timeWindowMs:
        userGroupingSettings?.timeWindowHours !== undefined
          ? userGroupingSettings.timeWindowHours * 60 * 60 * 1000
          : groupingOptions?.timeWindowMs,
    }),
    [userGroupingSettings, groupingOptions]
  );

  // 기존 알림 목록 훅
  const {
    notifications: rawNotifications,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useNotificationList({ enabled });

  // 읽음 처리 훅
  const { markAsRead } = useMarkAsRead();

  // 그룹핑 적용 (메모이제이션) - 사용자 설정 반영
  const groupedNotifications = useMemo(() => {
    return groupNotificationsWithCategoryFilter(
      rawNotifications,
      categoryFilter === 'all' ? null : categoryFilter,
      effectiveGroupingOptions
    );
  }, [rawNotifications, categoryFilter, effectiveGroupingOptions]);

  // 읽지 않은 수 계산 (그룹 포함)
  const unreadCount = useMemo(() => {
    return countUnreadInGroupedList(groupedNotifications);
  }, [groupedNotifications]);

  // 그룹 내 모든 알림 읽음 처리
  const markGroupAsRead = useCallback(
    (group: GroupedNotificationData) => {
      const unreadIds = group.notifications.filter((n) => !n.isRead).map((n) => n.id);

      // 병렬로 읽음 처리
      unreadIds.forEach((id) => markAsRead(id));
    },
    [markAsRead]
  );

  return {
    groupedNotifications,
    rawNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
    markGroupAsRead,
  };
}

// ============================================================================
// Export All
// ============================================================================

export default {
  useNotificationList,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
  useNotificationPermission,
  useGroupedNotifications,
};
