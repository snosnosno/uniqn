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
  opsStaffService,
} from '@/services/ops';
import { computeWaitlistFill } from '@/domains/ops';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { extractUserMessage } from '@/errors';
import type { CreateOpsTournamentInput, RegisterParticipantInput } from '@/repositories/ops';
import type { OpsTournamentStatus, OpsTableStatus, OpsTableLockType } from '@/types/ops';
import type { PrizeCorrectionInput } from '@/schemas/opsPrize.schema';
import type { StaffRole } from '@/types/role';

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
    mutationFn: (vars: { participantId: string; eliminatorId?: string | null }) =>
      opsParticipantService.bustParticipant(
        vars.participantId,
        requireActor(actorId),
        vars.eliminatorId
      ),
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

export function useUndoBust(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (participantId: string) =>
      opsParticipantService.undoBust(participantId, requireActor(actorId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
      toast.success(`탈락 취소됨 · 칩 ${result.restoredChips.toLocaleString()} 복원`);
    },
    onError: (error) => {
      logger.error('ops 탈락 취소 실패', toError(error));
      toast.error(extractUserMessage(error) || '탈락 취소에 실패했습니다');
    },
  });
}

export function useCorrectPrize(tournamentId: string) {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (input: PrizeCorrectionInput) =>
      opsParticipantService.correctPrize(input, requireActor(actorId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      toast.success('상금 정정됨');
    },
    onError: (error) => {
      logger.error('ops 상금 정정 실패', toError(error));
      toast.error(extractUserMessage(error) || '상금 정정에 실패했습니다');
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

/** 배정 2종(랜덤/칩 드래프트) 전원 재배치 훅. onSuccess: seats/participants/liveStats 무효화 + toast. */
export function useReseatParticipants(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: {
      assignments: { participantId: string; seatId: string }[];
      mode: 'random_draw' | 'chip_draft';
    }) =>
      opsSeatService.reseatParticipants(tournamentId, requireActor(actorId), v.assignments, v.mode),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.seats(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.participants(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
      toast.success(`${res.moved}명 재배치 완료`);
    },
    onError: (e) => {
      logger.error('ops 전원 재배치 실패', toError(e));
      toast.error(extractUserMessage(e) || '재배치에 실패했습니다');
    },
  });
}

/** 1e — 대회↔공고 연결 변경 훅. jobPostingId=null 이면 연결 해제. */
export function useSetTournamentPosting(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (jobPostingId: string | null) =>
      opsStaffService.setTournamentPosting(tournamentId, requireActor(actorId), jobPostingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.staff(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.tournamentDetail(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.tournaments() });
      toast.success('공고 연결을 변경했습니다');
    },
    onError: (e) => {
      logger.error('ops 대회-공고 연결 실패', toError(e));
      toast.error(extractUserMessage(e) || '공고 연결 변경에 실패했습니다');
    },
  });
}

/** 1e — 연결된 공고의 확정 스태프 스냅샷 import 훅. date=null 이면 전체 날짜. */
export function useImportOpsStaff(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (date: string | null) =>
      opsStaffService.importFromPosting(tournamentId, requireActor(actorId), date),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.staff(tournamentId) });
      // 스펙 §4.2 문구 고정 — StaffTab import CTA 확인 다이얼로그와 짝을 이루는 결과 안내.
      toast.success(`${result.imported}명 추가 · ${result.skipped}명 건너뜀`);
    },
    onError: (e) => {
      logger.error('ops 스태프 임포트 실패', toError(e));
      toast.error(extractUserMessage(e) || '스태프 임포트에 실패했습니다');
    },
  });
}

/** 1e — 가입자 검색 결과 기반 로스터 수동 추가 훅. */
export function useAddOpsStaff(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { staffId: string; role: StaffRole; customRole?: string | null }) =>
      opsStaffService.addStaff(
        tournamentId,
        requireActor(actorId),
        v.staffId,
        v.role,
        v.customRole
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.staff(tournamentId) });
      toast.success('스태프를 추가했습니다');
    },
    onError: (e) => {
      logger.error('ops 스태프 추가 실패', toError(e));
      toast.error(extractUserMessage(e) || '스태프 추가에 실패했습니다');
    },
  });
}

/** 1e — 로스터 제거 훅. cascade-clear(배정 테이블 선해제)로 ops.tables 도 함께 invalidate. */
export function useRemoveOpsStaff(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (opsStaffId: string) =>
      opsStaffService.removeStaff(tournamentId, requireActor(actorId), opsStaffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.staff(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      toast.success('스태프를 제거했습니다');
    },
    onError: (e) => {
      logger.error('ops 스태프 제거 실패', toError(e));
      toast.error(extractUserMessage(e) || '스태프 제거에 실패했습니다');
    },
  });
}

/** 1e — 딜러 테이블 배정 훅. staffId=null 이면 해제(멱등), move 시맨틱은 RPC 내부 처리. */
export function useAssignTableStaff(tournamentId: string) {
  const qc = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  return useMutation({
    mutationFn: (v: { tableId: string; staffId: string | null }) =>
      opsStaffService.assignTableStaff(tournamentId, requireActor(actorId), v.tableId, v.staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ops.tables(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.ops.staff(tournamentId) });
      toast.success('딜러를 배정했습니다');
    },
    onError: (e) => {
      logger.error('ops 딜러 배정 실패', toError(e));
      toast.error(extractUserMessage(e) || '딜러 배정에 실패했습니다');
    },
  });
}
