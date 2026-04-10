/**
 * UNIQN Mobile - 실시간 구독 훅
 *
 * @description Phase 2.2 - 실시간 구독 추상화 훅
 * @version 2.0.0
 *
 * 기능:
 * - RealtimeManager를 활용한 중복 구독 방지
 * - 자동 재연결 (네트워크 복구 시)
 * - 로딩/에러/데이터 상태 관리
 * - 구독 활성화/비활성화 제어
 * - Firebase 비의존 설계 (subscribeFn 패턴)
 *
 * @example
 * const { data, isLoading, error, reconnect } = useRealtimeSubscription({
 *   key: RealtimeManager.Keys.notifications(userId),
 *   subscribeFn: (onData, onError) => {
 *     const q = query(collection(db, 'notifications'), where('userId', '==', userId));
 *     return onSnapshot(
 *       q,
 *       (snapshot) => onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
 *       onError,
 *     );
 *   },
 *   parser: parseNotificationDocuments,
 *   enabled: isAuthenticated,
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeManager } from './RealtimeManager';
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';

// ============================================================================
// Types
// ============================================================================

/**
 * 문서 파서 함수 타입
 */
export type DocumentParser<T> = (docs: { id: string; [key: string]: unknown }[]) => T[];

/**
 * 구독 함수 타입
 *
 * 호출자가 구독 로직(Firebase onSnapshot, Supabase realtime 등)을 직접 제공한다.
 * - onData: 새 문서 배열이 도착할 때 호출
 * - onError: 에러 발생 시 호출
 * - 반환값: 구독 해제 함수, 또는 구독이 불가능한 경우 null
 */
export type SubscribeFn<T> = (
  onData: (docs: { id: string; [key: string]: unknown }[]) => void,
  onError: (error: Error) => void
) => (() => void) | null;

/**
 * useRealtimeSubscription 옵션
 */
export interface UseRealtimeSubscriptionOptions<T> {
  /**
   * 구독 식별 키 (RealtimeManager.Keys 사용 권장)
   */
  key: string;

  /**
   * 구독 로직을 포함하는 함수
   * - onData / onError 콜백을 받아 내부에서 구독을 설정하고 unsubscribe 함수를 반환한다.
   * - null 반환 시 구독하지 않음
   */
  subscribeFn: SubscribeFn<T>;

  /**
   * 문서 배열을 파싱하는 함수
   */
  parser: DocumentParser<T>;

  /**
   * 구독 활성화 여부 (기본: true)
   * - false면 구독하지 않고 빈 배열 반환
   */
  enabled?: boolean;

  /**
   * 네트워크 복구 시 자동 재연결 (기본: true)
   */
  autoReconnect?: boolean;

  /**
   * 에러 발생 시 콜백
   */
  onError?: (error: Error) => void;

  /**
   * 데이터 수신 시 콜백
   */
  onData?: (data: T[]) => void;

  /**
   * 초기 데이터 (로딩 전 표시)
   */
  initialData?: T[];
}

/**
 * useRealtimeSubscription 반환 타입
 */
export interface UseRealtimeSubscriptionResult<T> {
  /** 구독된 데이터 */
  data: T[];

  /** 첫 데이터 로딩 중 */
  isLoading: boolean;

  /** 에러 객체 */
  error: Error | null;

  /** 수동 재연결 함수 */
  reconnect: () => void;

  /** 구독 활성 상태 */
  isSubscribed: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 실시간 구독 훅
 *
 * @description subscribeFn 패턴으로 구독 로직을 추상화한 React 훅.
 * Firebase, Supabase 등 어떤 실시간 백엔드도 subscribeFn에 주입하여 사용할 수 있다.
 *
 * @example
 * ```tsx
 * // 알림 실시간 구독 (Firebase 예시)
 * const { data: notifications, isLoading, error } = useRealtimeSubscription({
 *   key: RealtimeManager.Keys.notifications(userId),
 *   subscribeFn: (onData, onError) => {
 *     if (!userId) return null;
 *     const q = query(
 *       collection(db, 'notifications'),
 *       where('userId', '==', userId),
 *       orderBy('createdAt', 'desc'),
 *       limit(50),
 *     );
 *     return onSnapshot(
 *       q,
 *       (snapshot) => onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
 *       onError,
 *     );
 *   },
 *   parser: parseNotificationDocuments,
 *   enabled: !!userId,
 * });
 * ```
 */
export function useRealtimeSubscription<T>(
  options: UseRealtimeSubscriptionOptions<T>
): UseRealtimeSubscriptionResult<T> {
  const {
    key,
    subscribeFn,
    parser,
    enabled = true,
    autoReconnect = true,
    onError,
    onData,
    initialData = [],
  } = options;

  // 상태
  const [data, setData] = useState<T[]>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 구독 시작
   */
  const subscribe = useCallback(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      // RealtimeManager를 통해 구독 (중복 방지)
      unsubscribeRef.current = RealtimeManager.subscribe(key, () => {
        logger.debug('useRealtimeSubscription: 구독 시작', { key });

        const handleData = (docs: { id: string; [key: string]: unknown }[]) => {
          const parsed = parser(docs);

          setData(parsed);
          setIsLoading(false);
          setError(null);
          setIsSubscribed(true);

          onData?.(parsed);
        };

        const handleError = (err: Error) => {
          const appError = handleServiceError(err, {
            operation: '실시간 구독',
            component: 'useRealtimeSubscription',
            context: { key },
          }) as Error;

          setError(appError);
          setIsLoading(false);
          setIsSubscribed(false);

          onError?.(appError);

          // 자동 재연결 시도
          if (autoReconnect) {
            scheduleReconnect();
          }
        };

        const unsub = subscribeFn(handleData, handleError);

        if (!unsub) {
          setIsLoading(false);
          // subscribeFn이 null을 반환하면 구독 불가 → no-op unsubscribe
          return () => {};
        }

        return unsub;
      });

      setIsSubscribed(true);
    } catch (err) {
      const appError = handleServiceError(err, {
        operation: '구독 시작',
        component: 'useRealtimeSubscription',
        context: { key },
      }) as Error;

      setError(appError);
      setIsLoading(false);

      onError?.(appError);
    }
    // NOTE: scheduleReconnect는 의도적으로 제외 (순환 의존성 방지)
    // subscribe → scheduleReconnect → subscribe 순환을 피하기 위함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, subscribeFn, parser, enabled, autoReconnect, onError, onData]);

  /**
   * 구독 해제
   */
  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setIsSubscribed(false);
    }

    // 재연결 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * 자동 재연결 스케줄링 (exponential backoff)
   */
  const reconnectAttemptRef = useRef(0);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
    reconnectAttemptRef.current++;

    logger.debug('useRealtimeSubscription: 재연결 스케줄링', {
      key,
      attempt: reconnectAttemptRef.current,
      delay,
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      unsubscribe();
      subscribe();
    }, delay);
  }, [key, subscribe, unsubscribe]);

  /**
   * 수동 재연결
   */
  const reconnect = useCallback(() => {
    logger.info('useRealtimeSubscription: 수동 재연결', { key });
    reconnectAttemptRef.current = 0;
    unsubscribe();
    setIsLoading(true);
    setError(null);
    subscribe();
  }, [key, subscribe, unsubscribe]);

  // 구독 시작/해제
  useEffect(() => {
    subscribe();
    return unsubscribe;
  }, [subscribe, unsubscribe]);

  // enabled 변경 시 재구독
  useEffect(() => {
    if (!enabled) {
      unsubscribe();
      setData(initialData);
      setIsLoading(false);
    }
  }, [enabled, unsubscribe, initialData]);

  return {
    data,
    isLoading,
    error,
    reconnect,
    isSubscribed,
  };
}
