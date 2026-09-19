/**
 * UNIQN Mobile - Notification Hooks
 *
 * @description 알림 관련 커스텀 훅
 * @version 1.1.0
 *
 * ## 이중 소스 경계 — 역할 절단 (반드시 지킬 것)
 *
 * 알림 데이터는 React Query 캐시와 Zustand 스토어(`notificationStore`) 두 곳에 산다.
 * 스토어를 폐기하는 게 답이 아니라 **역할을 절단**하는 게 답이다:
 *
 * 1. **목록 축 = React Query 캐시 단독.**
 *    화면이 실제로 그리는 것은 `query.data` 다(온라인일 때). 그러므로 삭제·전체 삭제·
 *    페이지네이션은 반드시 `setQueryData` 로 **렌더 소스를 패치**해야 한다. 스토어만 고치면
 *    온라인에서 화면이 한 픽셀도 바뀌지 않는다.
 *    (실사고: 삭제를 눌러도 안 사라져 사용자가 다시 누름 / 무한스크롤이 스토어에만 append 돼
 *     태어날 때부터 21번째 알림 이후 접근 불가)
 * 2. **오프라인 스냅샷 · 미읽음 배지 축 = 스토어 단독.**
 *    쿼리 캐시는 persist 가 없어 앱 재시작 후 배지·오프라인 목록을 원리적으로 복원할 수 없다.
 * 3. **흐름은 한 방향(쿼리 → 스토어)만.**
 *    쿼리 결과를 스토어 스냅샷에 기록하는 것은 OK, 스토어를 목록의 진실원 삼아 캐시로 되쓰는 것은 금지.
 *
 * ## 목록은 반드시 `useInfiniteQuery` 여야 한다 (평범한 `useQuery` 로 되돌리지 말 것)
 *
 * 예전에는 평범한 `useQuery` + `fetchNextPage` 가 캐시에 직접 append 하는 구조였다.
 * 그 구조에서는 **`invalidateQueries` 한 방이면 목록이 1페이지로 붕괴**한다 —
 * queryFn 이 커서 없이 재실행돼 20건만 돌려주기 때문이다. 대회 D-7 처럼 알림이 수십 건
 * 쌓인 상황에서 3페이지를 스크롤한 뒤 그룹 읽음 처리 한 번, 혹은 realtime 새 알림 1건이면
 * 그때까지 스크롤한 것이 통째로 날아갔다.
 *
 * 무효화 발원지를 줄이는 것으로는 못 고친다. `invalidate` 는 이 훅 밖에도 있고
 * (`useNotificationSyncOnForeground` · `usePushNotificationSetup` · `reconnectSyncService`
 *  · `invalidationStrategy` 매핑), realtime 콜백은 페이로드 없이 신호만 받아 서버 조회가
 * 원리적으로 필요하며, staleTime(2분) 경과 후 재마운트 refetch 만으로도 같은 붕괴가 난다.
 *
 * `useInfiniteQuery` 는 invalidate 시 **로드된 전 페이지를 순차 재조회**하므로
 * (query-core 5.101.4 `infiniteQueryBehavior`), 붕괴 클래스 자체가 사라진다.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
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
import { UNDO_DELAY_MS } from '@/constants/undo';
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
import { saveFailed } from '@/constants/messages';

// ============================================================================
// Query Keys (중앙 관리 - @/lib/queryClient.ts의 queryKeys.notifications 사용)
// ============================================================================

// P2 아키텍처: 로컬 notificationKeys 제거, queryKeys.notifications 사용
const notificationKeys = queryKeys.notifications;

// ============================================================================
// 목록 캐시 헬퍼 (목록 축 = React Query 캐시 단독 — 파일 상단 "이중 소스 경계" 참조)
// ============================================================================

/** 목록 쿼리의 한 페이지 = 서비스가 돌려주는 조회 결과 그대로 */
type NotificationListPage = Awaited<ReturnType<typeof fetchNotifications>>;
/** 목록 캐시의 실제 모양 (useInfiniteQuery) */
type NotificationListData = InfiniteData<NotificationListPage, NotificationPageCursor | null>;

/**
 * Undo 복원용 스냅샷 — 어느 목록 쿼리의 몇 페이지 몇 번째 자리에 있었는지.
 *
 * 평면 인덱스가 아니라 (페이지, 페이지 내 인덱스)인 이유: 캐시가 페이지 배열이라
 * 평면 인덱스로는 어느 페이지에 끼워 넣을지 알 수 없다.
 */
interface NotificationCacheSnapshot {
  queryKey: QueryKey;
  pageIndex: number;
  indexInPage: number;
}

/**
 * 목록 캐시인지 판별한다.
 *
 * `notificationKeys.all` 아래에는 settings 처럼 목록이 아닌 캐시도 매달려 있다.
 * 예전엔 `Array.isArray` 로 걸렀는데, 이제 목록 캐시는 배열이 아니라
 * `{pages, pageParams}` 객체다 — 판별을 `pages` 유무로 옮긴다.
 */
function isNotificationListData(value: unknown): value is NotificationListData {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as NotificationListData).pages) &&
    Array.isArray((value as NotificationListData).pageParams)
  );
}

/**
 * 알림 목록 캐시(필터 변형 전부)를 수집한다.
 *
 * 삭제 훅은 화면이 어떤 필터로 목록을 열었는지 모르므로
 * 특정 키 하나만 패치하면 필터 탭에서 조용히 안 먹는다.
 */
function getNotificationListCaches(queryClient: QueryClient): [QueryKey, NotificationListData][] {
  return queryClient
    .getQueriesData<NotificationListData>({ queryKey: notificationKeys.all })
    .filter((entry): entry is [QueryKey, NotificationListData] => isNotificationListData(entry[1]));
}

/** 페이지들을 평탄화하고 id 중복을 접는다 (렌더·스토어 미러링이 쓰는 형태). */
function flattenNotificationPages(data: NotificationListData): NotificationData[] {
  const seen = new Set<string>();
  const flat: NotificationData[] = [];
  data.pages.forEach((page) => {
    page.notifications.forEach((n) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      flat.push(n);
    });
  });
  return flat;
}

/**
 * 알림 1건을 모든 목록 캐시에서 제거하고, 원래 위치를 스냅샷으로 돌려준다.
 *
 * @returns snapshots - 복원용 (쿼리키 + 페이지 + 페이지 내 인덱스), removed - 제거된 알림 원본
 */
function removeNotificationFromCaches(
  queryClient: QueryClient,
  notificationId: string
): { snapshots: NotificationCacheSnapshot[]; removed: NotificationData | undefined } {
  const snapshots: NotificationCacheSnapshot[] = [];
  let removed: NotificationData | undefined;

  getNotificationListCaches(queryClient).forEach(([queryKey, data]) => {
    let hit = false;

    const nextPages = data.pages.map((page, pageIndex) => {
      const indexInPage = page.notifications.findIndex((n) => n.id === notificationId);
      if (indexInPage < 0) return page;

      hit = true;
      removed = removed ?? page.notifications[indexInPage];
      snapshots.push({ queryKey, pageIndex, indexInPage });
      return {
        ...page,
        notifications: page.notifications.filter((n) => n.id !== notificationId),
      };
    });

    if (!hit) return;
    queryClient.setQueryData<NotificationListData>(queryKey, { ...data, pages: nextPages });
  });

  return { snapshots, removed };
}

/**
 * 삭제한 알림을 원래 페이지·인덱스에 splice 재삽입해 복원한다.
 *
 * ⚠️ 전체 스냅샷 덮어쓰기 금지 — 연속 삭제 중 다른 대기 항목이 되살아나는 경쟁을 막기 위해
 *    "지금의 캐시"에 한 건만 끼워 넣는다.
 *
 * @returns 첫 스냅샷 키의 복원 결과 목록(평탄화). 없으면 undefined.
 */
function restoreNotificationToCaches(
  queryClient: QueryClient,
  notification: NotificationData,
  snapshots: NotificationCacheSnapshot[]
): NotificationData[] | undefined {
  let primaryList: NotificationData[] | undefined;

  snapshots.forEach(({ queryKey, pageIndex, indexInPage }, order) => {
    const latest = queryClient.getQueryData<NotificationListData>(queryKey);
    if (!isNotificationListData(latest)) return;

    // 이미 있으면(중복 복원·refetch 선반영) 그대로 둔다
    if (latest.pages.some((page) => page.notifications.some((n) => n.id === notification.id))) {
      if (order === 0) primaryList = flattenNotificationPages(latest);
      return;
    }

    // 그 사이 refetch 로 페이지 수가 줄었을 수 있다 — 마지막 페이지로 클램프한다.
    const targetPage = Math.min(pageIndex, latest.pages.length - 1);
    if (targetPage < 0) return;

    const nextPages = latest.pages.map((page, i) => {
      if (i !== targetPage) return page;
      const notifications = [...page.notifications];
      notifications.splice(Math.min(indexInPage, notifications.length), 0, notification);
      return { ...page, notifications };
    });

    const next: NotificationListData = { ...latest, pages: nextPages };
    queryClient.setQueryData<NotificationListData>(queryKey, next);
    if (order === 0) primaryList = flattenNotificationPages(next);
  });

  return primaryList;
}

/** '모두 삭제' 낙관 갱신용 — 페이지 0장이면 getNextPageParam 이 흔들리므로 빈 페이지 1장을 남긴다. */
function emptyNotificationListData(): NotificationListData {
  return {
    pages: [{ notifications: [], lastDoc: null, hasMore: false }],
    pageParams: [null],
  };
}

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
  // 스토어의 hasMore/setHasMore 는 더 이상 목록 축이 쓰지 않는다 —
  // 페이지 소유권이 infinite query 로 넘어갔고, 두 곳에 두면 반드시 갈린다.
  const {
    notifications: cachedNotifications,
    setNotifications,
    addNotifications,
    lastFetchedAt,
  } = useNotificationStore();
  const { addToast } = useToastStore();
  const { isOnline, isOffline } = useNetworkStatus();
  const hasSyncedRef = useRef(false);
  // 메모이제이션 필수: 매 렌더 새 배열을 만들면 쿼리 신원이 흔들려 재조회가 반복된다.
  const queryKey = useMemo(() => notificationKeys.list(filter ?? {}), [filter]);
  const hasServerSideFilters = Boolean(
    filter?.isRead !== undefined ||
    (filter?.types && filter.types.length > 0) ||
    filter?.startDate ||
    filter?.endDate ||
    filter?.category
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');

      return fetchNotifications({
        userId: user.uid,
        filter,
        // 1페이지는 커서 없이 — keyset 커서(created_at)라 null 이면 처음부터다.
        // (`initialPageParam` 은 null, TanStack 의 미로드 상태는 undefined 라 둘 다 본다)
        ...(pageParam === null || pageParam === undefined ? {} : { lastDoc: pageParam }),
      });
    },
    initialPageParam: null as NotificationPageCursor | null,
    getNextPageParam: (lastPage) =>
      // lastDoc 이 없으면 멈춘다 — keyset 커서라 null 을 넘기면 1페이지를 다시 받는다.
      lastPage.hasMore && lastPage.lastDoc !== null && lastPage.lastDoc !== undefined
        ? lastPage.lastDoc
        : undefined,
    // select 로 평탄화해 `query.data` 를 예전과 같은 `NotificationData[]` 로 유지한다.
    // 덕분에 스토어 미러링·렌더 소스 선택·소비처 계약이 전부 무변경이다.
    // ⚠️ id dedupe 는 필수다 — 예전에는 fetchNextPage 의 Set 이 담당했는데 그 코드가
    //    여기로 옮겨왔다. 빼면 refetch 중 새 알림이 유입될 때 페이지 경계에서 같은 알림이
    //    두 번 나와 FlashList keyExtractor 가 중복 키를 만든다.
    select: flattenNotificationPages,
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

  // 쿼리 → 스토어 한 방향 미러링 (오프라인 스냅샷·미읽음 배지 축).
  // 삭제·페이지네이션이 `setQueryData` 로 캐시를 패치하면 여기서 스냅샷도 함께 따라온다.
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
          // 이 경로는 의도적으로 스토어(오프라인 스냅샷 축)에만 쓴다 — 목록 축은 건드리지 않는다.
          // 온라인 복귀 시 React Query 가 reconnect refetch 로 목록을 서버에서 다시 받아오므로
          // 놓친 알림은 그쪽으로 화면에 올라온다. 여기서 캐시까지 손대면 두 축이 서로 덮어쓴다.
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

  // 다음 페이지 가져오기 — infinite query 에 위임한다.
  //
  // 예전에는 스토어에만 append 해서 온라인 무한스크롤이 태어날 때부터 무효였고(화면은
  // query.data 를 그리므로 21번째 알림부터 접근 불가), 그 다음엔 캐시에 직접 append 했지만
  // invalidate 한 방에 1페이지로 붕괴했다. 이제 페이지는 쿼리가 소유한다.
  //
  // 오프라인 부수 효과는 그대로다 — 페이지가 늘면 select 평탄화 결과가 커지고,
  // 아래 `query.data → setNotifications` 미러링이 확장된 목록을 스토어에 되비춘다.
  const { fetchNextPage: fetchNextPageInternal, hasNextPage, isFetchingNextPage } = query;
  const fetchNextPage = useCallback(async () => {
    // 오프라인 가드 유지: 쿼리가 disabled 여도 fetchNextPage 는 요청을 시도한다.
    if (isOffline || !hasNextPage || isFetchingNextPage) return;

    try {
      await fetchNextPageInternal();
    } catch (error) {
      logger.error('다음 페이지 로드 실패', toError(error));
    }
  }, [fetchNextPageInternal, hasNextPage, isFetchingNextPage, isOffline]);

  // 렌더 소스 선택: 온라인이면 목록 축(쿼리 캐시), 오프라인이면 스냅샷 축(스토어).
  // 온라인에서 화면을 바꾸려면 반드시 쿼리 캐시를 패치해야 한다는 사실이 여기서 나온다.
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
    // 진실원은 쿼리다 — 스토어 hasMore 는 오프라인 스냅샷 축의 잔재라 목록 축이 읽지 않는다.
    hasMore: hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch: async () => {
      if (isOffline) return;
      // 커서 리셋 없이 refetch — infinite query 는 로드된 전 페이지를 순차 재조회하므로
      // 당겨서 새로고침해도 스크롤한 만큼이 유지된다(1페이지 붕괴 없음).
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
 * 알림 삭제 훅 (낙관 갱신 + 되돌리기)
 *
 * 알림 삭제는 확인 다이얼로그도 없는 하드 DELETE 라 되돌릴 수단이 있어야 한다.
 * `useTemplateManager` 의 지연 커밋 패턴을 그대로 따른다:
 *   1. 목록 캐시(= 렌더 소스)에서 즉시 제거 — 스토어만 고치면 온라인에서 화면이 안 바뀐다
 *   2. UNDO_DELAY_MS 동안 "되돌리기" 토스트 노출
 *   3. 유예가 끝나면 실제 DELETE 뮤테이션 실행 (언마운트 시엔 즉시 flush)
 *   4. "되돌리기" 탭 시 타이머 취소 + 원래 인덱스로 splice 복원
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { removeNotification, setNotifications, addNotification } = useNotificationStore();
  const addToast = useToastStore((state) => state.addToast);

  // 진행 중인 삭제(Undo 대기) — 타이머 + 즉시 커밋 함수를 함께 보관해 언마운트 시 flush 한다.
  const pendingDeletesRef = useRef<
    Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void }>
  >(new Map());
  // 커밋이 실패했을 때 되살릴 복원 함수 (뮤테이션 onError 가 소비)
  const restoresRef = useRef<Map<string, () => void>>(new Map());

  // 언마운트 시 남아 있는 삭제를 즉시 커밋한다(타이머 누수 방지).
  // 사용자는 이미 목록에서 사라진 상태로 화면을 떠났으므로 삭제 의도로 간주.
  useEffect(() => {
    const pending = pendingDeletesRef.current;
    return () => {
      pending.forEach(({ timer, commit }) => {
        clearTimeout(timer);
        commit();
      });
      pending.clear();
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (notificationId: string) => {
      requireOnlineForMutation('useNotifications.deleteNotification');
      await deleteNotificationService(notificationId);
      return notificationId;
    },
    onSuccess: (notificationId: string) => {
      restoresRef.current.delete(notificationId);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      // 성공 토스트 없음 — 이미 삭제 시점에 "되돌리기" 토스트로 알렸다(토스트 2연발 방지).
    },
    onError: (error: Error, notificationId: string) => {
      logger.error('알림 삭제 실패', error);

      // 서버에는 그대로 남아 있으므로 화면에도 되돌려 놓는다
      // (지웠다고 믿는 알림이 새로고침 후 되살아나는 착시 방지)
      restoresRef.current.get(notificationId)?.();
      restoresRef.current.delete(notificationId);

      addToast({
        type: 'error',
        message: '알림 삭제에 실패했습니다.',
      });
    },
  });

  const { mutate } = mutation;

  const deleteNotification = useCallback(
    (notificationId: string) => {
      // 낙관 갱신 게이트(유지): 오프라인이면 선반영·Undo 없이 곧장 뮤테이션에 맡긴다.
      // TanStack 은 onMutate 가 mutationFn 보다 먼저 실행되므로 오프라인 뮤테이션도 이 지점을
      // 지난다 — 어차피 requireOnlineForMutation 이 막을 요청을 선반영하면 "지웠다 되살아나는"
      // 깜빡임만 남는다. 살아있는 분기이니 지우지 말 것.
      if (!shouldApplyOptimisticUpdate()) {
        mutate(notificationId);
        return;
      }

      // 같은 알림을 연속으로 누른 경우: 이미 유예 중이면 무시(이중 커밋·중복 토스트 방지)
      if (pendingDeletesRef.current.has(notificationId)) {
        return;
      }

      const { snapshots, removed } = removeNotificationFromCaches(queryClient, notificationId);
      if (!removed) {
        // 목록 캐시에 없으면 낙관적으로 지울 대상도, 되돌릴 대상도 없다 — 서버 삭제만 시도
        mutate(notificationId);
        return;
      }
      // 클로저에서 쓰기 위해 좁혀진 타입으로 못 박는다
      const deleted: NotificationData = removed;

      // 스냅샷 축(스토어)도 함께 맞춘다 — 미읽음 배지는 removeNotification 이 증분 갱신한다.
      removeNotification(notificationId);

      const restore = () => {
        const restoredList = restoreNotificationToCaches(queryClient, deleted, snapshots);
        // 복원된 목록을 스토어 스냅샷에 되비춘다(쿼리 → 스토어 한 방향).
        // 캐시를 못 찾으면 최소한 배지·오프라인 목록이라도 되살린다.
        if (restoredList) {
          setNotifications(restoredList);
        } else {
          addNotification(deleted);
        }
      };
      restoresRef.current.set(notificationId, restore);

      // 실제 DELETE 커밋 (타이머 만료 또는 언마운트 시 1회만 실행)
      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        pendingDeletesRef.current.delete(notificationId);
        mutate(notificationId);
      };

      const timer = setTimeout(commit, UNDO_DELAY_MS);
      pendingDeletesRef.current.set(notificationId, { timer, commit });

      addToast({
        type: 'success',
        message: `'${deleted.title}' 알림을 삭제했습니다.`,
        duration: UNDO_DELAY_MS,
        action: {
          label: '되돌리기',
          onPress: () => {
            // 토스트는 앱 루트에 단일 마운트라 화면을 떠나도 살아 있다(app/_layout.tsx).
            // 이미 커밋됐다면(유예 만료 또는 언마운트 flush) 하드 DELETE 가 이미 나간 뒤다 —
            // 여기서 캐시를 되살리면 "복원했습니다"라고 알린 직후 refetch 로 다시 사라진다.
            if (committed) {
              addToast({
                type: 'info',
                message: `'${deleted.title}' 알림은 이미 삭제되어 되돌릴 수 없습니다.`,
              });
              return;
            }

            const pending = pendingDeletesRef.current.get(notificationId);
            if (pending) {
              clearTimeout(pending.timer);
              pendingDeletesRef.current.delete(notificationId);
            }
            restoresRef.current.delete(notificationId);
            restore();
            addToast({
              type: 'info',
              message: `'${deleted.title}' 알림을 복원했습니다.`,
            });
          },
        },
      });
    },
    [addNotification, addToast, mutate, queryClient, removeNotification, setNotifications]
  );

  return {
    deleteNotification,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// useDeleteAllNotifications
// ============================================================================

/**
 * 모든 알림 삭제 훅 (낙관 갱신 — Undo 없음)
 *
 * '모두 삭제'는 이미 확인 다이얼로그를 거친 명시적 파괴 액션이라 Undo 가 아니라 **즉시 반영**이 맞다.
 * 다만 반영 대상은 개별 삭제(`useDeleteNotification`)와 **반드시 같은 축**이어야 한다 —
 * 예전에는 스토어만 비워서 "배지는 0인데 목록은 20개 그대로"가 남았다.
 * 이름 닮은 두 훅의 동작이 갈리지 않도록 목록 캐시 → 스토어 순서를 맞춰 둔다.
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
    // Optimistic Update: 서버 응답 전에 목록(쿼리 캐시) · 스냅샷/카운터(스토어) 즉시 초기화
    onMutate: async () => {
      // ⚠️ 진행 중인 조회를 반드시 먼저 취소한다.
      // 취소하지 않으면 in-flight refetch 가 낙관적으로 비운 목록을 되채우고,
      // 뒤이어 onError 롤백이 그 stale 스냅샷을 다시 덮어써 목록이 두 번 요동친다.
      // (saveSettings onMutate 는 처음부터 이걸 했는데 여기만 빠져 있었다.)
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // 낙관 갱신 게이트(유지): 오프라인이면 선반영하지 않는다.
      // 어차피 requireOnlineForMutation 이 막을 요청이라 롤백 깜빡임만 남는다.
      if (!shouldApplyOptimisticUpdate()) {
        return { previousLists: undefined, previousNotifications: undefined };
      }

      // 1. 렌더 소스인 목록 캐시를 비운다 (필터 변형 전부)
      const previousLists = getNotificationListCaches(queryClient);
      previousLists.forEach(([queryKey]) => {
        queryClient.setQueryData<NotificationListData>(queryKey, emptyNotificationListData());
      });

      // 2. 스냅샷 축(스토어)도 비운다 — 배지·오프라인 캐시
      const previousNotifications = [...notifications];
      clearNotifications();

      return { previousLists, previousNotifications };
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

      // 롤백도 같은 순서로: 목록 캐시(렌더 소스) → 스토어(스냅샷·카운터)
      context?.previousLists?.forEach(([queryKey, data]) => {
        queryClient.setQueryData<NotificationListData>(queryKey, data);
      });
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
        message: saveFailed('알림 설정'),
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
