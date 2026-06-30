/**
 * ops 좌석 서비스 — 배정/이동/비우기/대기채움/전원재배치 위임.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError } from '@/errors';
import { opsSeatRepository } from '@/repositories/ops';
import type { WaitlistAssignment, SeatAssignment } from '@/domains/ops';

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

/** 배정 2종(랜덤/칩 드래프트) 전원 재배치 서비스 위임. */
export async function reseatParticipants(
  tournamentId: string,
  actorId: string,
  assignments: SeatAssignment[],
  mode: 'random_draw' | 'chip_draft'
): Promise<{ moved: number; seated: number; mode: string }> {
  try {
    logger.info('ops 전원 재배치', {
      component: COMPONENT,
      tournamentId,
      count: assignments.length,
      mode,
    });
    return await opsSeatRepository.reseatParticipants(tournamentId, actorId, assignments, mode);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, { operation: '전원 재배치', component: COMPONENT });
  }
}
