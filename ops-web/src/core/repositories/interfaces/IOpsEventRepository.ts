// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/interfaces/IOpsEventRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsEvent } from '@/core/types/ops';

/**
 * ops 이벤트(감사 로그) Repository (1c HISTORY).
 * append-only ops_events 를 created_at desc 로 읽는다(읽기는 RLS is_ops_member, 쓰기는 RPC 트리거만).
 */
export interface IOpsEventRepository {
  /** 대회 이벤트 목록 (created_at desc, 최대 limit). */
  listByTournament(tournamentId: string, limit?: number): Promise<OpsEvent[]>;
}
