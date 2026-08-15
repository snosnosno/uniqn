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
  | 'ops_limit_reached'
  // 롤아웃 계기판(testgap-01) — 세션당 1회, 이 실행본의 앱버전·OTA 번들을 기록한다.
  // 서버 CHECK 화이트리스트와 1:1 이므로 값을 늘릴 때는 마이그레이션이 함께 가야 한다.
  | 'app_session_start'
  // 공유 출처 퍼널(S3-5, 마이그 20260813130000) — 이 둘은 **짝이다**.
  // created 만 있으면 "공유했다"까지만 알고, opened 만 있으면 분모가 없다.
  // 전환율 = opened / created (props.src 로 그룹핑).
  | 'job_share_created'
  | 'job_share_opened';

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
