/**
 * 실시간 구독 관리 모듈
 *
 * @description Phase 12 - 중복 구독 방지 및 구독 상태 관리
 *
 * @example
 * import { RealtimeManager } from '@/shared/realtime';
 *
 * // 구독 시작
 * const unsubscribe = RealtimeManager.subscribe(
 *   RealtimeManager.Keys.notifications(userId),
 *   () => onSnapshot(query, callback)
 * );
 */

export { RealtimeManager } from './RealtimeManager';
