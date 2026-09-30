// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/interfaces/IOpsPrizeRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsPrize } from '@/core/types/ops';
import type { PrizeStructureInput } from '@/core/schemas/opsPrize.schema';

/**
 * ops 상금 구조 Repository.
 * list: SELECT 직접 조회(toCamelCase 경유).
 * setStructure: SECDEF RPC(ops_set_prize_structure).
 */
export interface IOpsPrizeRepository {
  /** 대회 상금 목록 (rank asc). */
  list(tournamentId: string): Promise<OpsPrize[]>;
  /** 상금 구조 일괄 교체. 반환: 저장된 행 수. */
  setStructure(
    tournamentId: string,
    actorId: string,
    prizes: PrizeStructureInput
  ): Promise<{ count: number }>;
}
