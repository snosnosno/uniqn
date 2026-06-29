/**
 * ops 상금 훅 — 조회(useOpsPrizes) + 구조 저장(useSetPrizeStructure).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsPrizeService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { PrizeStructureInput } from '@/schemas/opsPrize.schema';

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

export function useOpsPrizes(tournamentId: string) {
  const query = useQuery({
    queryKey: queryKeys.ops.prizes(tournamentId),
    queryFn: () => opsPrizeService.listPrizes(tournamentId),
    enabled: !!tournamentId,
  });
  return { prizes: query.data ?? [], isLoading: query.isLoading };
}

export function useSetPrizeStructure(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (prizes: PrizeStructureInput) =>
      opsPrizeService.setPrizeStructure(tournamentId, requireActor(actorId), prizes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.prizes(tournamentId) });
      toast.success('상금 구조 저장됨');
    },
    onError: (error) => {
      logger.error('ops 상금 구조 저장 실패', toError(error));
      toast.error(extractUserMessage(error) || '상금 구조 저장에 실패했습니다');
    },
  });
}
