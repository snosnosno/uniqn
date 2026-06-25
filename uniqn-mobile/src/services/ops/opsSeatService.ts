/**
 * ops 좌석 서비스 — 배정/이동/비우기/대기채움 위임.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsSeatRepository } from '@/repositories/ops';
import type { WaitlistAssignment } from '@/domains/ops';

const COMPONENT = 'opsSeatService';

export async function assignSeat(
  seatId: string,
  participantId: string,
  actorId: string
): Promise<void> {
  try {
    await opsSeatRepository.assignSeat(seatId, participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '좌석 배정', component: COMPONENT });
  }
}

export async function moveSeat(
  fromSeatId: string,
  toSeatId: string,
  actorId: string
): Promise<void> {
  try {
    await opsSeatRepository.moveSeat(fromSeatId, toSeatId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '좌석 이동', component: COMPONENT });
  }
}

export async function freeSeat(seatId: string, actorId: string): Promise<void> {
  try {
    await opsSeatRepository.freeSeat(seatId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '좌석 비우기', component: COMPONENT });
  }
}

export async function redrawWaitlistFill(
  tournamentId: string,
  actorId: string,
  assignments: readonly WaitlistAssignment[]
): Promise<{ moved: number }> {
  try {
    logger.info('ops 대기채움 redraw', {
      component: COMPONENT,
      tournamentId,
      count: assignments.length,
    });
    return await opsSeatRepository.redrawWaitlistFill(tournamentId, actorId, assignments);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '대기채움 redraw', component: COMPONENT });
  }
}
