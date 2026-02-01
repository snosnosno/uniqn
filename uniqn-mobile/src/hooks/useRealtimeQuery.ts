/**
 * UNIQN Mobile - 실시간 Query 통합 훅
 *
 * @description Firestore 실시간 구독을 React Query 캐시와 통합
 * @version 1.0.0
 *
 * 이 유틸리티는 Firestore onSnapshot 구독을 React Query 캐시에
 * 직접 연결하여 단일 데이터 소스를 유지합니다.
 *
 * @example
 * ```tsx
 * // 알림 목록 실시간 구독
 * const { data, isLoading, error } = useRealtimeQuery({
 *   queryKey: queryKeys.notifications.list(),
 *   subscribe: (onData, onError) =>
 *     subscribeToNotifications(userId, onData, onError),
 *   enabled: !!userId,
 * });
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, QueryKey } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

interface UseRealtimeQueryOptions<TData> {
  /**
   * React Query 키
   */
  queryKey: QueryKey;

  /**
   * 초기 데이터를 가져오는 함수 (선택적)
   * 제공하지 않으면 구독에서 첫 데이터를 기다림
   */
  initialFetch?: () => Promise<TData>;

  /**
   * Firestore 구독 함수
   * @param onData 데이터 수신 시 호출
   * @param onError 에러 발생 시 호출
   * @returns 구독 해제 함수
   */
  subscribe: (onData: (data: TData) => void, onError?: (error: Error) => void) => () => void;

  /**
   * 구독 활성화 여부
   */
  enabled?: boolean;

  /**
   * staleTime (기본값: 무제한 - 실시간 업데이트로 관리)
   */
  staleTime?: number;

  /**
   * gcTime (기본값: 10분)
   */
  gcTime?: number;
}

interface UseRealtimeQueryResult<TData> {
  data: TData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSubscribed: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 실시간 구독과 React Query를 통합하는 훅
 *
 * @description
 * 이 훅은 Firestore onSnapshot 구독을 사용하여 데이터를 실시간으로 받아
 * React Query 캐시에 직접 저장합니다. 이를 통해:
 *
 * 1. **단일 데이터 소스**: 모든 컴포넌트가 동일한 캐시 데이터를 참조
 * 2. **실시간 업데이트**: 서버 변경이 즉시 UI에 반영
 * 3. **캐시 관리**: React Query의 캐시 관리 기능 활용
 * 4. **자동 정리**: 컴포넌트 언마운트 시 구독 자동 해제
 */
export function useRealtimeQuery<TData>({
  queryKey,
  initialFetch,
  subscribe,
  enabled = true,
  staleTime = Infinity, // 실시간 데이터는 항상 fresh
  gcTime = 10 * 60 * 1000, // 10분
}: UseRealtimeQueryOptions<TData>): UseRealtimeQueryResult<TData> {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isSubscribedRef = useRef(false);

  // 캐시 업데이트 콜백
  const handleData = useCallback(
    (data: TData) => {
      queryClient.setQueryData(queryKey, data);
    },
    [queryClient, queryKey]
  );

  // 에러 핸들링 콜백
  const handleError = useCallback(
    (error: Error) => {
      logger.error('Realtime subscription error', error, {
        queryKey: JSON.stringify(queryKey),
      });
      queryClient.setQueryData(queryKey, undefined);
    },
    [queryClient, queryKey]
  );

  // 구독 설정
  useEffect(() => {
    if (!enabled) {
      // 비활성화 시 구독 해제
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      isSubscribedRef.current = false;
      return;
    }

    // 구독 시작
    logger.debug('Starting realtime subscription', {
      queryKey: JSON.stringify(queryKey),
    });

    unsubscribeRef.current = subscribe(handleData, handleError);
    isSubscribedRef.current = true;

    // 클린업
    return () => {
      logger.debug('Stopping realtime subscription', {
        queryKey: JSON.stringify(queryKey),
      });
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      isSubscribedRef.current = false;
    };
  }, [enabled, subscribe, handleData, handleError, queryKey]);

  // React Query 사용 (캐시 읽기 + 초기 데이터 로드)
  const query = useQuery({
    queryKey,
    queryFn: initialFetch ?? (() => Promise.resolve(undefined as TData)),
    enabled: enabled && !!initialFetch,
    staleTime,
    gcTime,
    // 실시간 구독이 데이터를 제공하므로 refetch 비활성화
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error ? toError(query.error) : null,
    isSubscribed: isSubscribedRef.current,
  };
}

// ============================================================================
// Collection Query Hook
// ============================================================================

interface UseRealtimeCollectionOptions<TItem> {
  /**
   * React Query 키
   */
  queryKey: QueryKey;

  /**
   * Firestore 컬렉션 구독 함수
   */
  subscribe: (onData: (items: TItem[]) => void, onError?: (error: Error) => void) => () => void;

  /**
   * 구독 활성화 여부
   */
  enabled?: boolean;

  /**
   * 아이템 정렬 함수 (선택적)
   */
  sortFn?: (a: TItem, b: TItem) => number;
}

/**
 * 컬렉션 실시간 구독 훅
 *
 * @description
 * 배열 형태의 컬렉션 데이터를 실시간으로 구독합니다.
 * 정렬 기능을 내장하여 일관된 순서를 보장합니다.
 */
export function useRealtimeCollection<TItem>({
  queryKey,
  subscribe,
  enabled = true,
  sortFn,
}: UseRealtimeCollectionOptions<TItem>) {
  const wrappedSubscribe = useCallback(
    (onData: (data: TItem[]) => void, onError?: (error: Error) => void) => {
      return subscribe((items) => {
        const sortedItems = sortFn ? [...items].sort(sortFn) : items;
        onData(sortedItems);
      }, onError);
    },
    [subscribe, sortFn]
  );

  return useRealtimeQuery<TItem[]>({
    queryKey,
    subscribe: wrappedSubscribe,
    enabled,
  });
}

// ============================================================================
// Document Query Hook
// ============================================================================

interface UseRealtimeDocumentOptions<TDoc> {
  /**
   * React Query 키
   */
  queryKey: QueryKey;

  /**
   * Firestore 문서 구독 함수
   */
  subscribe: (onData: (doc: TDoc | null) => void, onError?: (error: Error) => void) => () => void;

  /**
   * 구독 활성화 여부
   */
  enabled?: boolean;
}

/**
 * 단일 문서 실시간 구독 훅
 *
 * @description
 * 단일 Firestore 문서를 실시간으로 구독합니다.
 * 문서가 삭제되면 null을 반환합니다.
 */
export function useRealtimeDocument<TDoc>({
  queryKey,
  subscribe,
  enabled = true,
}: UseRealtimeDocumentOptions<TDoc>) {
  return useRealtimeQuery<TDoc | null>({
    queryKey,
    subscribe,
    enabled,
  });
}

export default useRealtimeQuery;
