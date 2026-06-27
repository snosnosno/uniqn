/**
 * ops 클럭/블라인드 변이 훅 (1c) — mutationFn 은 Service 경유, actor 는 authStore.
 * onSuccess: 클럭/통계/블라인드 일괄 무효화 + toast. (useOpsMutations 패턴 미러)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsClockService, opsBlindLevelService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

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

/** 클럭 변이는 live_stats(avg_stack_bb)·블라인드까지 영향 → 3종 일괄 무효화. */
function invalidateClockQueries(qc: ReturnType<typeof useQueryClient>, tournamentId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.ops.clock(tournamentId) });
  qc.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
  qc.invalidateQueries({ queryKey: queryKeys.ops.blindLevels(tournamentId) });
}

export function useSetBlindLevels(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (levels: readonly OpsBlindLevelInput[]) =>
      opsBlindLevelService.setLevels(tournamentId, requireActor(actorId), levels),
    onSuccess: () => {
      invalidateClockQueries(qc, tournamentId);
      toast.success('블라인드 구조를 저장했습니다');
    },
    onError: (e) => {
      logger.error('ops 블라인드 설정 실패', toError(e));
      toast.error(extractUserMessage(e) || '블라인드 저장에 실패했습니다');
    },
  });
}

export function useStartClock(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: () => opsClockService.start(tournamentId, requireActor(actorId)),
    onSuccess: () => {
      invalidateClockQueries(qc, tournamentId);
      toast.success('클럭을 시작했습니다');
    },
    onError: (e) => {
      logger.error('ops 클럭 시작 실패', toError(e));
      toast.error(extractUserMessage(e) || '클럭 시작에 실패했습니다');
    },
  });
}

export function usePauseClock(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: () => opsClockService.pause(tournamentId, requireActor(actorId)),
    onSuccess: () => {
      invalidateClockQueries(qc, tournamentId);
      toast.success('클럭을 일시정지했습니다');
    },
    onError: (e) => {
      logger.error('ops 클럭 일시정지 실패', toError(e));
      toast.error(extractUserMessage(e) || '클럭 일시정지에 실패했습니다');
    },
  });
}

export function useSetLevel(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (sort: number) =>
      opsClockService.setLevel(tournamentId, requireActor(actorId), sort),
    onSuccess: () => {
      invalidateClockQueries(qc, tournamentId);
      toast.success('레벨을 변경했습니다');
    },
    onError: (e) => {
      logger.error('ops 클럭 레벨 이동 실패', toError(e));
      toast.error(extractUserMessage(e) || '레벨 변경에 실패했습니다');
    },
  });
}

export function useAdjustClock(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (deltaSec: number) =>
      opsClockService.adjust(tournamentId, requireActor(actorId), deltaSec),
    onSuccess: (_data, deltaSec) => {
      invalidateClockQueries(qc, tournamentId);
      toast.success(deltaSec >= 0 ? '시간을 추가했습니다' : '시간을 단축했습니다');
    },
    onError: (e) => {
      logger.error('ops 클럭 보정 실패', toError(e));
      toast.error(extractUserMessage(e) || '시간 보정에 실패했습니다');
    },
  });
}
