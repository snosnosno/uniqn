/**
 * 블라인드 구조·프리셋 — 모바일 useOpsClockMutations(useSetBlindLevels)·useOpsBlindPresets 대응.
 * 프리셋은 사용자 단위 데이터(대회 무관) — 계정 전환 시 AuthProvider 가 캐시를 비운다.
 */
import { useQuery } from '@tanstack/react-query';
import { opsBlindPresetRepository } from '@/core/repositories/ops';
import type { OpsBlindLevelInput } from '@/core/schemas/opsBlindLevel.schema';
import * as opsBlindLevelService from '@/core/services/ops/opsBlindLevelService';
import * as opsBlindPresetService from '@/core/services/ops/opsBlindPresetService';
import { opsKeys } from './keys';
import { useOpsMutation } from './opsMutation';

export function useSetBlindLevels(id: string) {
  return useOpsMutation({
    op: 'ops.setBlindLevels',
    run: (levels: readonly OpsBlindLevelInput[], actor) =>
      opsBlindLevelService.setLevels(id, actor, levels),
    invalidate: [opsKeys.clock(id), opsKeys.liveStats(id), opsKeys.blindLevels(id)],
    success: () => '블라인드 구조를 저장했습니다',
  });
}

export function useOpsBlindPresets() {
  return useQuery({
    queryKey: opsKeys.blindPresets(),
    queryFn: () => opsBlindPresetRepository.listMine(),
  });
}

export function useSaveBlindPreset() {
  return useOpsMutation({
    op: 'ops.saveBlindPreset',
    run: (input: { name: string; levels: readonly OpsBlindLevelInput[] }, actor) =>
      opsBlindPresetService.save(actor, input.name, input.levels),
    invalidate: [opsKeys.blindPresets()],
    success: () => '프리셋을 저장했습니다',
  });
}

export function useDeleteBlindPreset() {
  return useOpsMutation({
    op: 'ops.deleteBlindPreset',
    run: (presetId: string, actor) => opsBlindPresetService.remove(actor, presetId),
    invalidate: [opsKeys.blindPresets()],
    success: () => '프리셋을 삭제했습니다',
  });
}
