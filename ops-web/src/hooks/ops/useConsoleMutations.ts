/**
 * 콘솔 변이(W4) — 대회 상태·등록 토글·참가자 액션·플레이어 자격·클럭.
 * 무효화 범위·토스트 문구는 모바일 useOpsMutations·useOpsClockMutations·useOpsClaimToken 과 같다.
 */
import type { BulkRegisterRow, RegisterParticipantInput } from '@/core/repositories/ops';
import type {
  ChipCountInput,
  NoShowInput,
  ParticipantUpdateInput,
} from '@/core/schemas/opsParticipant.schema';
import * as opsClockService from '@/core/services/ops/opsClockService';
import * as participantService from '@/core/services/ops/opsParticipantService';
import * as opsPlayerService from '@/core/services/ops/opsPlayerService';
import * as opsTournamentService from '@/core/services/ops/opsTournamentService';
import type { OpsParticipant, OpsTournament, OpsTournamentStatus } from '@/core/types/ops';
import { opsKeys } from './keys';
import { useOpsMutation } from './opsMutation';

type Participants = OpsParticipant[];

const patchParticipant = (
  list: Participants | undefined,
  id: string,
  patch: (p: OpsParticipant) => Partial<OpsParticipant>
) => list?.map((p) => (p.id === id ? { ...p, ...patch(p) } : p));

export function useSetTournamentStatus(id: string) {
  return useOpsMutation<OpsTournamentStatus, void, OpsTournament | null>({
    op: 'ops.setTournamentStatus',
    run: (status, actor) => opsTournamentService.setTournamentStatus(id, actor, status),
    invalidate: [opsKeys.tournamentDetail(id), opsKeys.tournaments()],
    optimistic: {
      key: opsKeys.tournamentDetail(id),
      update: (t, status) => (t ? { ...t, status } : t),
    },
  });
}

export function useToggleRegistration(id: string) {
  return useOpsMutation<boolean, void, OpsTournament | null>({
    op: 'ops.toggleRegistration',
    run: (open, actor) => opsTournamentService.toggleRegistration(id, actor, open),
    invalidate: [opsKeys.tournamentDetail(id)],
    success: (_r, open) => (open ? '등록을 열었습니다' : '등록을 마감했습니다'),
    optimistic: {
      key: opsKeys.tournamentDetail(id),
      // 수동으로 열면 서버가 자동 마감 설정을 지운다 — 화면도 같이 지워 "다시 닫힐 것처럼" 보이지 않게.
      update: (t, open) =>
        t
          ? {
              ...t,
              registrationOpen: open,
              registrationCloseAfterSort: open ? null : t.registrationCloseAfterSort,
            }
          : t,
    },
  });
}

/** 레이트 등록 자동 마감 기준(레벨 sort) 설정, null = 해제. */
export function useSetRegistrationCutoff(id: string) {
  return useOpsMutation<number | null, void, OpsTournament | null>({
    op: 'ops.setRegistrationCutoff',
    run: (afterSort, actor) => opsTournamentService.setRegistrationCutoff(id, actor, afterSort),
    invalidate: [opsKeys.tournamentDetail(id), opsKeys.events(id)],
    success: (_r, afterSort) =>
      afterSort === null ? '자동 마감을 해제했습니다' : '자동 마감을 설정했습니다',
    optimistic: {
      key: opsKeys.tournamentDetail(id),
      update: (t, afterSort) => (t ? { ...t, registrationCloseAfterSort: afterSort } : t),
    },
  });
}

/** 명단 일괄 등록 — 전부 성공하거나 전부 취소된다(서버 원자성). */
export function useRegisterParticipantsBulk(id: string) {
  return useOpsMutation({
    op: 'ops.registerParticipantsBulk',
    run: (input: { rows: BulkRegisterRow[]; buyInAmount?: number }, actor) =>
      participantService.registerParticipantsBulk({ ...input, tournamentId: id }, actor),
    invalidate: [
      opsKeys.participants(id),
      opsKeys.tournamentDetail(id),
      opsKeys.seats(id),
      opsKeys.liveStats(id),
      opsKeys.events(id),
    ],
    success: (r) => `${r.length}명 등록 완료`,
  });
}

export function useRegisterParticipant(id: string) {
  return useOpsMutation({
    op: 'ops.registerParticipant',
    run: (input: Omit<RegisterParticipantInput, 'tournamentId'>, actor) =>
      participantService.registerParticipant({ ...input, tournamentId: id }, actor),
    invalidate: [
      opsKeys.participants(id),
      opsKeys.tournamentDetail(id),
      opsKeys.seats(id),
      opsKeys.liveStats(id),
    ],
    success: (r) => `#${r.entryNumber} 등록 완료`,
  });
}

export function useAddRebuy(id: string, rebuyChips: number) {
  return useOpsMutation<string, void, Participants>({
    op: 'ops.addRebuy',
    run: (pid, actor) => participantService.addRebuy(pid, actor),
    invalidate: [opsKeys.participants(id), opsKeys.liveStats(id)],
    success: () => '리바이 처리됨',
    optimistic: {
      key: opsKeys.participants(id),
      update: (list, pid) =>
        patchParticipant(list, pid, (p) => ({ rebuys: p.rebuys + 1, chips: p.chips + rebuyChips })),
    },
  });
}

export function useAddAddon(id: string, addonChips: number) {
  return useOpsMutation<string, void, Participants>({
    op: 'ops.addAddon',
    run: (pid, actor) => participantService.addAddon(pid, actor),
    invalidate: [opsKeys.participants(id), opsKeys.liveStats(id)],
    success: () => '애드온 처리됨',
    optimistic: {
      key: opsKeys.participants(id),
      update: (list, pid) =>
        patchParticipant(list, pid, (p) => ({ addOns: p.addOns + 1, chips: p.chips + addonChips })),
    },
  });
}

/** 탈락 — 결과 안내(우승/ITM/일반)와 되돌리기 토스트는 화면이 한다(success: null). */
export function useBustParticipant(id: string) {
  return useOpsMutation({
    op: 'ops.bustParticipant',
    run: (vars: { participantId: string; eliminatorId?: string | null }, actor) =>
      participantService.bustParticipant(vars.participantId, actor, vars.eliminatorId),
    invalidate: [
      opsKeys.participants(id),
      opsKeys.seats(id),
      opsKeys.liveStats(id),
      opsKeys.tournamentDetail(id),
      opsKeys.events(id),
    ],
    success: () => null,
  });
}

export function useUndoBust(id: string) {
  return useOpsMutation({
    op: 'ops.undoBust',
    run: (pid: string, actor) => participantService.undoBust(pid, actor),
    invalidate: [
      opsKeys.participants(id),
      opsKeys.seats(id),
      opsKeys.liveStats(id),
      opsKeys.events(id),
    ],
    success: (r) => `탈락 취소됨 · 칩 ${r.restoredChips.toLocaleString('ko-KR')} 복원`,
  });
}

export function useReenterParticipant(id: string) {
  return useOpsMutation({
    op: 'ops.reenterParticipant',
    run: (pid: string, actor) => participantService.reenterParticipant(pid, actor),
    invalidate: [opsKeys.participants(id), opsKeys.seats(id), opsKeys.liveStats(id)],
    success: () => '재진입 처리됨',
  });
}

export function useSetParticipantNoShow(id: string) {
  return useOpsMutation({
    op: 'ops.setParticipantNoShow',
    run: (input: NoShowInput, actor) => participantService.setParticipantNoShow(input, actor),
    invalidate: [opsKeys.participants(id), opsKeys.events(id)],
    success: (r) =>
      r.status === r.statusBefore
        ? r.status === 'no_show'
          ? '이미 노쇼예요'
          : '이미 대기 상태예요'
        : r.status === 'no_show'
          ? '노쇼로 표시했어요'
          : '노쇼를 취소했어요',
  });
}

export function useSetParticipantChips(id: string) {
  return useOpsMutation({
    op: 'ops.setParticipantChips',
    run: (input: ChipCountInput, actor) => participantService.setParticipantChips(input, actor),
    invalidate: [opsKeys.participants(id), opsKeys.liveStats(id), opsKeys.events(id)],
    success: (r) =>
      r.chips === r.chipsBefore
        ? '칩 수량이 그대로예요'
        : `칩 ${r.chips.toLocaleString('ko-KR')}으로 수정됨`,
  });
}

export function useUpdateParticipant(id: string) {
  return useOpsMutation({
    op: 'ops.updateParticipant',
    run: (input: ParticipantUpdateInput, actor) =>
      participantService.updateParticipant(input, actor),
    invalidate: [opsKeys.participants(id), opsKeys.seats(id), opsKeys.events(id)],
    success: (r) => (r.changed ? '참가자 정보를 수정했어요' : '변경된 내용이 없어요'),
  });
}

export function useDeleteParticipant(id: string) {
  return useOpsMutation({
    op: 'ops.deleteParticipant',
    run: (pid: string, actor) => participantService.deleteParticipant(pid, actor),
    invalidate: [
      opsKeys.participants(id),
      opsKeys.seats(id),
      opsKeys.liveStats(id),
      opsKeys.events(id),
    ],
    success: (r) => `#${r.entryNumber ?? '-'} ${r.name} 등록을 취소했어요 (상금 풀에서 제외)`,
  });
}

export function useUnclaimParticipant(id: string) {
  return useOpsMutation({
    op: 'ops.unclaimParticipant',
    run: (pid: string, actor) => participantService.unclaimParticipant(pid, actor),
    invalidate: [opsKeys.participants(id)],
    success: () => '플레이어 연결을 해제했어요',
  });
}

/** 플레이어 링크·PIN 발급/재발급. PIN 은 결과로 한 번만 돌아온다 — 화면이 보여 준다. */
export function useIssuePlayerCredentials(id: string) {
  return useOpsMutation({
    op: 'ops.issuePlayerCredentials',
    run: (pid: string, actor) => opsPlayerService.issuePlayerCredentials(pid, actor),
    invalidate: [opsKeys.participants(id)],
    success: () => null,
  });
}

const clockKeys = (id: string) => [
  opsKeys.clock(id),
  opsKeys.liveStats(id),
  opsKeys.blindLevels(id),
];

export function useStartClock(id: string) {
  return useOpsMutation({
    op: 'ops.clockStart',
    run: (_: void, actor) => opsClockService.start(id, actor),
    invalidate: clockKeys(id),
    success: () => '클럭을 시작했습니다',
  });
}

export function usePauseClock(id: string) {
  return useOpsMutation({
    op: 'ops.clockPause',
    run: (_: void, actor) => opsClockService.pause(id, actor),
    invalidate: clockKeys(id),
    success: () => '클럭을 일시정지했습니다',
  });
}

export function useSetLevel(id: string) {
  return useOpsMutation({
    op: 'ops.clockSetLevel',
    run: (sort: number, actor) => opsClockService.setLevel(id, actor, sort),
    invalidate: clockKeys(id),
    success: () => '레벨을 변경했습니다',
  });
}

export function useAdjustClock(id: string) {
  return useOpsMutation({
    op: 'ops.clockAdjust',
    run: (deltaSec: number, actor) => opsClockService.adjust(id, actor, deltaSec),
    invalidate: clockKeys(id),
    success: (_r, d) => (d >= 0 ? '시간을 추가했습니다' : '시간을 단축했습니다'),
  });
}
