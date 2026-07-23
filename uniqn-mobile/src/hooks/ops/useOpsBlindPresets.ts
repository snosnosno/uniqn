/**
 * 블라인드 프리셋 훅 (계획 B) — 조회는 Repository 직접(RLS owner 스코프 자동 필터),
 * 저장/삭제 변이는 Service 경유. 변이 성공 시 ['ops','blindPresets'] 무효화 + toast.
 * (변이 문형은 useOpsClockMutations/useOpsMutations 패턴 미러 — actor 는 authStore uid.)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { opsBlindPresetRepository } from '@/repositories/ops';
import { opsBlindPresetService } from '@/services/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import { queryKeys } from '@/lib/queryClient';
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

/** 내 블라인드 프리셋 목록. per-user 데이터 → uid 스코프 키(기기 계정 전환 시 캐시 격리). */
export function useOpsBlindPresets() {
  const uid = useAuthStore((s) => s.user?.uid);
  const query = useQuery({
    queryKey: queryKeys.ops.blindPresets(uid ?? ''),
    queryFn: () => opsBlindPresetRepository.listMine(),
    enabled: !!uid,
  });
  return { presets: query.data ?? [], isLoading: query.isLoading };
}

/** 프리셋 저장(신규) — { name, levels } 입력. */
export function useSaveBlindPreset() {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (input: { name: string; levels: readonly OpsBlindLevelInput[] }) =>
      opsBlindPresetService.save(requireActor(actorId), input.name, input.levels),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.blindPresets(requireActor(actorId)) });
      toast.success('프리셋을 저장했습니다');
    },
    onError: (e) => {
      logger.error('ops 블라인드 프리셋 저장 실패', toError(e));
      toast.error(extractUserMessage(e) || '프리셋 저장에 실패했습니다');
    },
  });
}

/** 프리셋 삭제. */
export function useDeleteBlindPreset() {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (presetId: string) => opsBlindPresetService.remove(requireActor(actorId), presetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.blindPresets(requireActor(actorId)) });
      toast.success('프리셋을 삭제했습니다');
    },
    onError: (e) => {
      logger.error('ops 블라인드 프리셋 삭제 실패', toError(e));
      toast.error(extractUserMessage(e) || '프리셋 삭제에 실패했습니다');
    },
  });
}
