import type { OpsSeat } from '@/types/ops';
import type { WaitlistAssignment, SeatAssignment } from '@/domains/ops';

export interface IOpsSeatRepository {
  listByTournament(tournamentId: string): Promise<OpsSeat[]>;
  assignSeat(seatId: string, participantId: string, actorId: string): Promise<void>;
  moveSeat(fromSeatId: string, toSeatId: string, actorId: string): Promise<void>;
  freeSeat(seatId: string, actorId: string): Promise<void>;
  redrawWaitlistFill(
    tournamentId: string,
    actorId: string,
    assignments: readonly WaitlistAssignment[]
  ): Promise<{ moved: number }>;
  /** 배정 2종(랜덤/칩 드래프트) 전원 재배치 RPC 호출. */
  reseatParticipants(
    tournamentId: string,
    actorId: string,
    assignments: SeatAssignment[],
    mode: 'random_draw' | 'chip_draft'
  ): Promise<{ moved: number; seated: number; mode: string }>;
}
