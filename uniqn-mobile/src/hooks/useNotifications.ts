/**
 * UNIQN Mobile - Notification Hooks
 *
 * @description 알림 관련 커스텀 훅
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  subscribeToNotifications,
  subscribeToUnreadCount,
  getNotificationSettings,
  saveNotificationSettings,
  checkNotificationPermission,
  requestNotificationPermission,
} from '@/services/notificationService';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { QUERY_KEYS } from '@/constants';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
} from '@/types/notification';

// ============================================================================
// Query Keys
// ============================================================================

const notificationKeys = {
  all: [QUERY_KEYS.NOTIFICATIONS] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: NotificationFilter) => [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
  settings: () => [...notificationKeys.all, 'settings'] as const,
  permission: () => [...notificationKeys.all, 'permission'] as const,
};

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
  isError: boolean;
  error: Error | null;
  hasMore: boolean;
  fetchNextPage: () => Promise<void>;
  isFetchingNextPage: boolean;
  refetch: () => Promise<void>;
}

/**
 * 알림 목록 조회 훅
 */
export function useNotificationList(
  options: UseNotificationListOptions = {}
): UseNotificationListResult {
  const { filter, enabled = true } = options;
  const user = useAuthStore((state) => state.user);
  const { setNotifications, addNotifications, setLoading, setHasMore } = useNotificationStore();
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const query = useQuery({
    queryKey: notificationKeys.list(filter ?? {}),
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
    enabled: enabled && !!user?.uid,
    staleTime: 1000 * 60 * 2, // 2분
  });

  // 스토어 동기화
  useEffect(() => {
    if (query.data) {
      setNotifications(query.data);
    }
  }, [query.data, setNotifications]);

  // 로딩 상태 동기화
  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  // 다음 페이지 가져오기
  const fetchNextPage = useCallback(async () => {
    if (!user?.uid || !lastDoc || isFetchingNextPage) return;

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
      logger.error('다음 페이지 로드 실패', error as Error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [user?.uid, lastDoc, filter, isFetchingNextPage, addNotifications, setHasMore]);

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    hasMore: useNotificationStore((state) => state.hasMore),
    fetchNextPage,
    isFetchingNextPage,
    refetch: async () => {
      setLastDoc(null);
      await query.refetch();
    },
  };
}

// ============================================================================
// useNotificationRealtime
// ============================================================================

/**
 * 알림 실시간 구독 훅
 */
export function useNotificationRealtime() {
  const user = useAuthStore((state) => state.user);
  const { setNotifications, setLoading } = useNotificationStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    setLoading(true);

    unsubscribeRef.current = subscribeToNotifications(
      user.uid,
      (notifications) => {
        setNotifications(notifications);
        setLoading(false);
      },
      (error) => {
        logger.error('알림 구독 에러', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [user?.uid, setNotifications, setLoading]);
}

// ============================================================================
// useUnreadCount
// ============================================================================

/**
 * 읽지 않은 알림 수 훅 (실시간)
 */
export function useUnreadCountRealtime() {
  const user = useAuthStore((state) => state.user);
  const [count, setCount] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setCount(0);
      return;
    }

    unsubscribeRef.current = subscribeToUnreadCount(
      user.uid,
      setCount,
      (error) => {
        logger.error('읽지 않은 알림 수 구독 에러', error);
      }
    );

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [user?.uid]);

  return count;
}

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
 * 알림 삭제 훅
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { removeNotification } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await deleteNotificationService(notificationId);
      return notificationId;
    },
    onSuccess: (notificationId) => {
      removeNotification(notificationId);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      addToast({
        type: 'success',
        message: '알림이 삭제되었습니다.',
      });
    },
    onError: (error: Error) => {
      logger.error('알림 삭제 실패', error);
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
// useNotificationSettings
// ============================================================================

/**
 * 알림 설정 훅
 */
export function useNotificationSettingsQuery() {
  const user = useAuthStore((state) => state.user);
  const { setSettings } = useNotificationStore();

  const query = useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: async () => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');
      return getNotificationSettings(user.uid);
    },
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 30, // 30분
  });

  // 스토어 동기화
  useEffect(() => {
    if (query.data) {
      setSettings(query.data);
    }
  }, [query.data, setSettings]);

  return query;
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
      await saveNotificationSettings(user.uid, settings);
      return settings;
    },
    onSuccess: (settings) => {
      setSettings(settings);
      queryClient.invalidateQueries({ queryKey: notificationKeys.settings() });
      addToast({
        type: 'success',
        message: '알림 설정이 저장되었습니다.',
      });
    },
    onError: (error: Error) => {
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
export function useNotificationPermission() {
  const [permission, setPermission] = useState<{
    granted: boolean;
    canAskAgain: boolean;
    status: 'granted' | 'denied' | 'undetermined';
  }>({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  });
  const [isRequesting, setIsRequesting] = useState(false);

  // 권한 확인
  useEffect(() => {
    const check = async () => {
      const result = await checkNotificationPermission();
      setPermission(result);
    };
    check();
  }, []);

  // 권한 요청
  const requestPermission = useCallback(async () => {
    setIsRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      return result;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  return {
    ...permission,
    isRequesting,
    requestPermission,
  };
}

// ============================================================================
// Export All
// ============================================================================

export default {
  useNotificationList,
  useNotificationRealtime,
  useUnreadCountRealtime,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationSettingsQuery,
  useSaveNotificationSettings,
  useNotificationPermission,
};
