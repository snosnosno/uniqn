/**
 * 퍼널 계측 — 모바일 `trackOpsFunnel` 과 **같은 이벤트명·같은 테이블**(analytics_events)에 쓴다(설계 §8).
 * 🔑 이벤트명은 DB CHECK·모바일 PersistedAnalyticsEvent·CORE_FUNNEL_EVENTS 와 1:1 이다 — 새 이름을 만들지 않는다.
 * 계측은 절대 throw 하지 않는다(오프라인·rate limit 포함 전부 무시).
 */
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type OpsFunnelEvent = 'ops_hub_entered' | 'ops_tournament_created';

export function trackOpsFunnel(
  event: OpsFunnelEvent,
  props: Record<string, string | number | boolean> = {}
): void {
  void (async () => {
    try {
      const { error } = await supabase.from('analytics_events').insert({ event, props });
      if (error) logger.debug('퍼널 이벤트 기록 실패(무시)', { event, code: error.code });
    } catch {
      // 무시
    }
  })();
}
