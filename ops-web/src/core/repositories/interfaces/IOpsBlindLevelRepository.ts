// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/interfaces/IOpsBlindLevelRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsBlindLevel } from '@/core/types/ops';
import type { OpsBlindLevelInput } from '@/core/schemas/opsBlindLevel.schema';

/**
 * ops 블라인드 레벨 Repository (1c).
 * 읽기는 RLS 필터(is_ops_member), 쓰기(전체교체)는 ops_set_blind_levels SECDEF RPC.
 */
export interface IOpsBlindLevelRepository {
  /** 대회 블라인드 구조 목록 (sort asc). */
  listByTournament(tournamentId: string): Promise<OpsBlindLevel[]>;
  /** 블라인드 구조 전체 교체. camelCase 입력을 snake_case jsonb 로 변환해 RPC 호출. */
  setLevels(
    tournamentId: string,
    actorId: string,
    levels: readonly OpsBlindLevelInput[]
  ): Promise<{ count: number; reanchored: boolean }>;
}
