import type { OpsTable, OpsTableStatus, OpsTableLockType } from '@/types/ops';

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
