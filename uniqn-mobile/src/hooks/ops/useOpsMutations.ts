/**
 * ops 변이 훅 — mutationFn 은 Service 경유, actor 는 authStore. onSuccess 무효화 + toast.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import {
  opsTournamentService,
  opsParticipantService,
  opsTableService,
  opsSeatService,
} from '@/services/ops';
import { computeWaitlistFill } from '@/domains/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { CreateOpsTournamentInput, RegisterParticipantInput } from '@/repositories/ops';
import type { OpsTournamentStatus, OpsTableStatus, OpsTableLockType } from '@/types/ops';

const toast = {
  success: (m: string) => useToastStore.getState().success(m),
  error: (m: string) => useToastStore.getState().error(m),
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function requireActor(actorId: string | undefined | null): string {
  if (!actorId) throw new Error('로그인이 필요합니다');
  return actorId;
}

export function useCreateOpsTournament() {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (input: CreateOpsTournamentInput) =>
      opsTournamentService.createTournament(input, requireActor(actorId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournaments() });
      toast.success('대회를 만들었습니다');
    },
    onError: (error) => {
      logger.error('ops 대회 생성 실패', toError(error));
      toast.error(extractUserMessage(error) || '대회 생성에 실패했습니다');
    },
  });
}

export function useSetTournamentStatus(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (status: OpsTournamentStatus) =>
      opsTournamentService.setTournamentStatus(tournamentId, requireActor(actorId), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournaments() });
    },
    onError: (error) => {
      logger.error('ops 대회 상태 변경 실패', toError(error));
      toast.error(extractUserMessage(error) || '상태 변경에 실패했습니다');
    },
  });
}

export function useToggleRegistration(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (open: boolean) =>
      opsTournamentService.toggleRegistration(tournamentId, requireActor(actorId), open),
    onSuccess: (_data, open) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
      toast.success(open ? '등록을 열었습니다' : '등록을 마감했습니다');
    },
    onError: (error) => {
      logger.error('ops 등록 토글 실패', toError(error));
      toast.error(extractUserMessage(error) || '등록 설정 변경에 실패했습니다');
    },
  });
}

export function useRegisterParticipant(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (input: Omit<RegisterParticipantInput, 'tournamentId'>) =>
      opsParticipantService.registerParticipant({ ...input, tournamentId }, requireActor(actorId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
      toast.success(`#${result.entryNumber} 등록 완료`);
    },
    onError: (error) => {
      logger.error('ops 참가자 등록 실패', toError(error));
      toast.error(extractUserMessage(error) || '등록에 실패했습니다');
    },
  });
}

export function useAddRebuy(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.addRebuy(participantId, requireActor(actorId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success('리바이 처리됨');
    },
    onError: (error) => {
      logger.error('ops 리바이 실패', toError(error));
      toast.error(extractUserMessage(error) || '리바이에 실패했습니다');
    },
  });
}

export function useAddAddon(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.addAddon(participantId, requireActor(actorId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success('애드온 처리됨');
    },
    onError: (error) => {
      logger.error('ops 애드온 실패', toError(error));
      toast.error(extractUserMessage(error) || '애드온에 실패했습니다');
    },
  });
}

export function useBustParticipant(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.bustParticipant(participantId, requireActor(actorId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
      if (result.winnerFinalized) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
      }
    },
    onError: (error) => {
      logger.error('ops 탈락 처리 실패', toError(error));
      toast.error(extractUserMessage(error) || '탈락 처리에 실패했습니다');
    },
  });
}

export function useReenterParticipant(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.reenterParticipant(participantId, requireActor(actorId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
      toast.success('재진입 처리됨');
    },
    onError: (error) => {
      logger.error('ops 재진입 실패', toError(error));
      toast.error(extractUserMessage(error) || '재진입에 실패했습니다');
    },
  });
}

export function useAddTable(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (input: {
      seatCount: number;
      name?: string;
      lockType: OpsTableLockType;
      priority?: number;
    }) => opsTableService.addTable({ ...input, tournamentId }, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      toast.success('테이블을 추가했습니다');
    },
    onError: (e) => {
      logger.error('ops 테이블 추가 실패', toError(e));
      toast.error(extractUserMessage(e) || '테이블 추가에 실패했습니다');
    },
  });
}

export function useSetTableLock(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { tableId: string; lockType: OpsTableLockType }) =>
      opsTableService.setLock(v.tableId, requireActor(actorId), v.lockType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      toast.success('테이블 잠금을 변경했습니다');
    },
    onError: (e) => {
      logger.error('ops 테이블 잠금 실패', toError(e));
      toast.error(extractUserMessage(e) || '테이블 잠금 변경에 실패했습니다');
    },
  });
}

export function useSetTablePriority(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { tableId: string; priority: number | null }) =>
      opsTableService.setPriority(v.tableId, requireActor(actorId), v.priority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      toast.success('테이블 우선순위를 변경했습니다');
    },
    onError: (e) => {
      logger.error('ops 테이블 우선순위 실패', toError(e));
      toast.error(extractUserMessage(e) || '테이블 우선순위 변경에 실패했습니다');
    },
  });
}

export function useCloseTable(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { tableId: string; status: OpsTableStatus }) =>
      opsTableService.closeTable(v.tableId, requireActor(actorId), v.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      toast.success('테이블을 닫았습니다');
    },
    onError: (e) => {
      logger.error('ops 테이블 닫기 실패', toError(e));
      toast.error(extractUserMessage(e) || '테이블 닫기에 실패했습니다');
    },
  });
}

export function useAssignSeat(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { seatId: string; participantId: string }) =>
      opsSeatService.assignSeat(v.seatId, v.participantId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success('좌석을 배정했습니다');
    },
    onError: (e) => {
      logger.error('ops 좌석 배정 실패', toError(e));
      toast.error(extractUserMessage(e) || '좌석 배정에 실패했습니다');
    },
  });
}

export function useMoveSeat(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { fromSeatId: string; toSeatId: string }) =>
      opsSeatService.moveSeat(v.fromSeatId, v.toSeatId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success('좌석을 이동했습니다');
    },
    onError: (e) => {
      logger.error('ops 좌석 이동 실패', toError(e));
      toast.error(extractUserMessage(e) || '좌석 이동에 실패했습니다');
    },
  });
}

export function useFreeSeat(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (seatId: string) => opsSeatService.freeSeat(seatId, requireActor(actorId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      toast.success('좌석을 비웠습니다');
    },
    onError: (e) => {
      logger.error('ops 좌석 비우기 실패', toError(e));
      toast.error(extractUserMessage(e) || '좌석 비우기에 실패했습니다');
    },
  });
}

export function useRedrawWaitlistFill(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (assignments: ReturnType<typeof computeWaitlistFill>) =>
      opsSeatService.redrawWaitlistFill(tournamentId, requireActor(actorId), assignments),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success(`${r.moved}명 좌석 배정 완료`);
    },
    onError: (e) => {
      logger.error('ops redraw 실패', toError(e));
      toast.error(extractUserMessage(e) || '좌석 배정에 실패했습니다');
    },
  });
}
