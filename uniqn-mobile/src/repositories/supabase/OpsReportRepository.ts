import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { mapOpsRpcError } from './opsRpcError';
import type { OpsReportReason } from '@/types/ops';

/**
 * ops 공개뷰 신고 Repository (S1 B2/D7).
 * anon-executable SECDEF =2 계약 때문에 신규 anon RPC 없이 전용 테이블 직접 INSERT —
 * 검증(토큰 해석·rate limit·캐노니컬라이즈)은 BEFORE INSERT 가드 트리거가 전담.
 * board_reports 의 직접 RLS INSERT 선례를 따른다. 공개 라우트라 authStore 비의존.
 */
export class SupabaseOpsReportRepository {
  async submit(input: {
    tokenKind: 'monitor' | 'player';
    token: string;
    reason: OpsReportReason;
    details?: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabase.from('ops_public_reports').insert({
        token_kind: input.tokenKind,
        token: input.token,
        reason: input.reason,
        details: input.details?.trim() ? input.details.trim() : null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 공개뷰 신고' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 공개뷰 신고' });
    }
  }
}
