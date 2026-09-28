/** W7 — 전광판 링크 발급·TV 구성 저장(운영자). 모바일 useRotateMonitorToken·useSetMonitorConfig 대응. */
import * as opsMonitorService from '@/core/services/ops/opsMonitorService';
import * as opsTournamentService from '@/core/services/ops/opsTournamentService';
import type { MonitorPreset, MonitorSlots } from '@/core/domains/ops';
import { opsKeys } from './keys';
import { useOpsMutation } from './opsMutation';

/** 멱등 발급(force=false) 또는 강제 재발급(force=true, 유출 대응). 성공 안내는 화면이 한다. */
export function useRotateMonitorToken(id: string) {
  return useOpsMutation({
    op: 'ops.rotateMonitorToken',
    run: (force: boolean, actor) => opsMonitorService.rotateToken(id, actor, force),
    invalidate: [opsKeys.tournamentDetail(id)],
    success: () => null,
  });
}

export function useSetMonitorConfig(id: string) {
  return useOpsMutation({
    op: 'ops.setMonitorConfig',
    run: (config: { v: 1; preset: MonitorPreset; slots: MonitorSlots } | null, actor) =>
      opsTournamentService.setMonitorConfig(id, actor, config),
    invalidate: [opsKeys.tournamentDetail(id), opsKeys.events(id)],
    success: () => '저장했어요. TV에 곧 반영돼요',
  });
}
