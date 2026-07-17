import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

/**
 * ops S1 퍼널 이벤트(D1/F8) — analytics_events 테이블 화이트리스트와 1:1.
 * ops_limit_reached 는 S2(한도) 대비 선배선 — S1 에서는 발화 지점 없음.
 */
export type OpsFunnelEvent =
  | 'ops_hub_impression'
  | 'ops_hub_entered'
  | 'ops_tournament_created'
  | 'ops_public_view_opened'
  | 'ops_claim_converted'
  | 'ops_limit_reached';

/**
 * 퍼널 이벤트 영속 Repository (S1 D1).
 * fire-and-forget: 계측 실패는 앱 동작에 절대 영향 금지(throw 없음, dev 로깅만).
 * user_id 는 서버 가드 트리거가 auth.uid() 로 캐노니컬라이즈(위조 불가), anon 은 props.tk 필수.
 */
class SupabaseAnalyticsEventRepository {
  async insert(
    event: OpsFunnelEvent,
    props: Record<string, string | number | boolean> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase.from('analytics_events').insert({ event, props });
      if (error && __DEV__) {
        logger.debug('퍼널 이벤트 기록 실패(무시)', { event, code: error.code });
      }
    } catch {
      // 계측은 절대 throw 금지 — 오프라인/rate limit 포함 전부 무시
    }
  }
}

export const analyticsEventRepository = new SupabaseAnalyticsEventRepository();
