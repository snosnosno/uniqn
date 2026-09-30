// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/interfaces/IOpsTableRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsTable, OpsTableStatus, OpsTableLockType } from '@/core/types/ops';

export interface AddTableInput {
  tournamentId: string;
  seatCount: number;
  name?: string;
  lockType: OpsTableLockType;
  priority?: number;
}

export interface IOpsTableRepository {
  listByTournament(tournamentId: string): Promise<OpsTable[]>;
  addTable(input: AddTableInput, actorId: string): Promise<{ tableId: string; tableNo: number }>;
  setLock(tableId: string, actorId: string, lockType: OpsTableLockType): Promise<void>;
  setPriority(tableId: string, actorId: string, priority: number | null): Promise<void>;
  closeTable(tableId: string, actorId: string, status: OpsTableStatus): Promise<void>;
}
