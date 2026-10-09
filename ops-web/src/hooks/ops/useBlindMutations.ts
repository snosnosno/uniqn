/**
 * 블라인드 구조·프리셋 — 모바일 useOpsClockMutations(useSetBlindLevels)·useOpsBlindPresets 대응.
 * 프리셋은 사용자 단위 데이터(대회 무관) — 계정 전환 시 AuthProvider 가 캐시를 비운다.
 */
import { useQuery } from '@tanstack/react-query';
import { opsBlindPresetRepository } from '@/core/repositories/ops';
import type {
  OpsBlindLevelInput,
  OpsBlindLevelSaveInput,
} from '@/core/schemas/opsBlindLevel.schema';
import * as opsBlindLevelService from '@/core/services/ops/opsBlindLevelService';
import * as opsBlindPresetService from '@/core/services/ops/opsBlindPresetService';
import { opsKeys } from './keys';
import { useOpsMutation } from './opsMutation';

export function useSetBlindLevels(id: string) {
  return useOpsMutation({
    op: 'ops.setBlindLevels',
    run: (levels: readonly OpsBlindLevelSaveInput[], actor) =>
      opsBlindLevelService.setLevels(id, actor, levels),
    // 대회 행까지 — 구조가 바뀌면 서버가 레이트 등록 자동 마감 기준을 옮기거나 지운다.
    invalidate: [
      opsKeys.clock(id),
      opsKeys.liveStats(id),
      opsKeys.blindLevels(id),
      opsKeys.tournamentDetail(id),
    ],
    // 기준이던 레벨이 없어져 자동 마감이 꺼졌으면 말해 준다 — 안 알리면 운영자는 걸어 둔 줄 안다.
    success: (r) =>
      r.cutoffCleared
        ? '블라인드 구조를 저장했습니다. 기준 레벨이 없어져 등록 자동 마감은 해제됐어요'
        : '블라인드 구조를 저장했습니다',
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
