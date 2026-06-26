import type { OpsSeat } from '@/types/ops';
import type { WaitlistAssignment } from '@/domains/ops';

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
}
