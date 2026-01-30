/**
 * 실시간 구독 관리 모듈
 *
 * @description Phase 12 - 중복 구독 방지 및 구독 상태 관리
 * @version 2.0.0 - Phase 2.2 useRealtimeSubscription 추가
 *
 * @example
 * // 저수준 API (서비스 레이어)
 * import { RealtimeManager } from '@/shared/realtime';
 * const unsubscribe = RealtimeManager.subscribe(
 *   RealtimeManager.Keys.notifications(userId),
 *   () => onSnapshot(query, callback)
 * );
 *
 * // 고수준 Hook (컴포넌트)
 * import { useRealtimeSubscription } from '@/shared/realtime';
 * const { data, isLoading, error } = useRealtimeSubscription({
 *   key: RealtimeManager.Keys.notifications(userId),
 *   queryFn: () => notificationsQuery,
 *   parser: parseNotificationDocuments,
 * });
 */

// 저수준 API
export { RealtimeManager } from './RealtimeManager';

// 고수준 Hook (Phase 2.2)
export {
  useRealtimeSubscription,
  useRealtimeDocument,
  type UseRealtimeSubscriptionOptions,
  type UseRealtimeSubscriptionResult,
  type DocumentParser,
} from './useRealtimeSubscription';
