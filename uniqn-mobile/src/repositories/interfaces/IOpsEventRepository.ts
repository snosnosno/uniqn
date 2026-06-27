import type { OpsEvent } from '@/types/ops';

/**
 * ops 이벤트(감사 로그) Repository (1c HISTORY).
 * append-only ops_events 를 created_at desc 로 읽는다(읽기는 RLS is_ops_member, 쓰기는 RPC 트리거만).
 */
export interface IOpsEventRepository {
  /** 대회 이벤트 목록 (created_at desc, 최대 limit). */
  listByTournament(tournamentId: string, limit?: number): Promise<OpsEvent[]>;
}
