/**
 * ops 변이 훅 — mutationFn 은 Service 경유, actor 는 authStore. onSuccess 무효화 + toast.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsTournamentService, opsParticipantService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { CreateOpsTournamentInput, RegisterParticipantInput } from '@/repositories/ops';
import type { OpsTournamentStatus } from '@/types/ops';

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
