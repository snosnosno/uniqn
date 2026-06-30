import type { OpsTableStatus, OpsTableLockType } from '@/types/ops';

export interface ReseatTable {
  id: string;
  status: OpsTableStatus; // 'open' | 'closed' | 'standby'
  lockType: OpsTableLockType; // 'none' | 'locked' | 'feature'
}
export interface ReseatSeat {
  id: string;
  tableId: string;
  tableNo: number;
  seatNo: number;
  participantId: string | null;
}
export interface ReseatPlayer {
  id: string;
  chips: number;
}
export interface ReseatInput {
  tables: ReseatTable[];
  seats: ReseatSeat[];
  players: ReseatPlayer[];
  rng: () => number; // [0,1)
}
export interface SeatAssignment {
  participantId: string;
  seatId: string;
}
export type ReseatResult =
  | { ok: true; assignments: SeatAssignment[] }
  | { ok: false; reason: 'INSUFFICIENT_SEATS'; available: number; required: number };
