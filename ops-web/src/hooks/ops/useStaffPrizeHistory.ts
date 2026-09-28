/**
 * W6 — 스태프·상금·이력 훅. 모바일 useOpsStaff·useOpsStaffWorkLogs·useOpsEvents·useOpsPrizes·
 * useOpsMutations(스태프 5종·상금 지급/정정) 대응. 무효화 범위·토스트 문구는 모바일과 같다.
 */
import { useQuery } from '@tanstack/react-query';
import { opsEventRepository, opsStaffRepository } from '@/core/repositories/ops';
import type { PrizeCorrectionInput, PrizeStructureInput } from '@/core/schemas/opsPrize.schema';
import * as participantService from '@/core/services/ops/opsParticipantService';
import * as opsPrizeService from '@/core/services/ops/opsPrizeService';
import * as opsStaffService from '@/core/services/ops/opsStaffService';
import type { StaffRole } from '@/core/types/role';
import { searchUsersByNickname } from '@/repositories/userSearchRepository';
import { useActorId } from '../useActorId';
import { opsKeys } from './keys';
import { useOpsMutation } from './opsMutation';
import { useRealtimeInvalidate } from './useConsoleQueries';

export function useOpsStaff(id: string) {
  const key = opsKeys.staff(id);
  useRealtimeInvalidate('ops_staff', `tournament_id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsStaffRepository.listByTournament(id) });
}

/** 근태 해석(ops_resolve_staff_work_logs) — 구독 없음(모바일과 같음), 변이 후 무효화. */
export function useOpsStaffWorkLogs(id: string) {
  const actorId = useActorId();
  return useQuery({
    queryKey: opsKeys.staffWorkLogs(id),
    queryFn: () => opsStaffService.resolveWorkLogs(id, actorId),
  });
}

/** 이력 — ops_events 는 realtime publication 밖이라 구독 없이 30s + 변이 후 무효화(모바일과 같음). */
export function useOpsEvents(id: string, limit = 100) {
  return useQuery({
    queryKey: opsKeys.events(id),
    queryFn: () => opsEventRepository.listByTournament(id, limit),
    staleTime: 30_000,
  });
}

export function useImportOpsStaff(id: string) {
  return useOpsMutation({
    op: 'ops.importStaff',
    run: (date: string | null, actor) => opsStaffService.importFromPosting(id, actor, date),
    invalidate: [opsKeys.staff(id), opsKeys.staffWorkLogs(id), opsKeys.events(id)],
    success: (r) => `${r.imported}명 추가 · ${r.skipped}명 건너뜀`,
  });
}

export function useAddOpsStaff(id: string) {
  return useOpsMutation({
    op: 'ops.addStaff',
    run: (v: { staffId: string; role: StaffRole; customRole?: string | null }, actor) =>
      opsStaffService.addStaff(id, actor, v.staffId, v.role, v.customRole),
    invalidate: [opsKeys.staff(id), opsKeys.staffWorkLogs(id), opsKeys.events(id)],
    success: () => '스태프를 추가했습니다',
  });
}

export function useRemoveOpsStaff(id: string) {
  return useOpsMutation({
    op: 'ops.removeStaff',
    run: (opsStaffId: string, actor) => opsStaffService.removeStaff(id, actor, opsStaffId),
    invalidate: [
      opsKeys.staff(id),
      opsKeys.tables(id),
      opsKeys.staffWorkLogs(id),
      opsKeys.events(id),
    ],
    success: () => '스태프를 제거했습니다',
  });
}

export function useAssignTableStaff(id: string) {
  return useOpsMutation({
    op: 'ops.assignTableStaff',
    run: (v: { tableId: string; staffId: string | null }, actor) =>
      opsStaffService.assignTableStaff(id, actor, v.tableId, v.staffId),
    invalidate: [opsKeys.tables(id), opsKeys.staff(id), opsKeys.events(id)],
    success: () => '딜러를 배정했습니다',
  });
}

export function useRecordOpsAttendance(id: string) {
  return useOpsMutation({
    op: 'ops.recordAttendance',
    run: (v: { workLogId: string; checkIn?: Date | null; checkOut?: Date | null }, actor) => {
      const { workLogId, ...patch } = v;
      return opsStaffService.recordAttendance(workLogId, actor, patch);
    },
    invalidate: [opsKeys.staffWorkLogs(id)],
    success: (_r, v) =>
      v.checkIn === null || v.checkOut === null
        ? '근태 기록을 취소했습니다'
        : '근태를 기록했습니다',
  });
}

export function useSetPrizeStructure(id: string) {
  return useOpsMutation({
    op: 'ops.setPrizeStructure',
    run: (prizes: PrizeStructureInput, actor) =>
      opsPrizeService.setPrizeStructure(id, actor, prizes),
    invalidate: [opsKeys.prizes(id), opsKeys.events(id)],
    success: () => '상금 구조 저장됨',
  });
}

export function useSetPrizePaid(id: string) {
  return useOpsMutation({
    op: 'ops.setPrizePaid',
    run: (v: { participantId: string; paid: boolean }, actor) =>
      participantService.setPrizePaid(v.participantId, actor, v.paid),
    invalidate: [opsKeys.participants(id), opsKeys.events(id)],
    success: (_r, v) => (v.paid ? '지급 완료로 표시했어요' : '지급 표시를 취소했어요'),
  });
}

export function useCorrectPrize(id: string) {
  return useOpsMutation({
    op: 'ops.correctPrize',
    run: (input: PrizeCorrectionInput, actor) => participantService.correctPrize(input, actor),
    invalidate: [opsKeys.participants(id), opsKeys.liveStats(id), opsKeys.events(id)],
    success: () => '상금 정정됨',
  });
}

/** 닉네임 검색(스태프 수동 추가) — 2~15자만 RPC 로 보낸다(모바일 searchStaffByNickname 경계). */
export function useNicknameSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['ops', 'nicknameSearch', q],
    queryFn: () => searchUsersByNickname(q),
    enabled: q.length >= 2 && q.length <= 15,
    staleTime: 30_000,
  });
}
