/**
 * ops 1b/배정2종 — Redraw 미리보기 모달.
 * mode='waitlist_fill': computeWaitlistFill(빈자리채움) → 기존 redrawMut.
 * mode='random_draw'|'chip_draft': randomDraw/chipDraft(전원 재배치) → reseatMut.
 * before→after 미리보기, [다시 계산], [확인] 구조. 풀 0명·좌석 부족 시 확인 비활성.
 * 전원 재배치(파괴적) 모드: 확인 전 확인 다이얼로그(confirmAction).
 */
import { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { confirmAction } from '@/utils/confirmAction';
import { BottomSheet } from '@/components/ui';
import {
  useOpsTables,
  useOpsSeats,
  useOpsParticipants,
  useRedrawWaitlistFill,
  useReseatParticipants,
} from '@/hooks/ops';
import { computeWaitlistFill, randomDraw, chipDraft } from '@/domains/ops';
import type { ReseatInput } from '@/domains/ops';

type RedrawMode = 'waitlist_fill' | 'random_draw' | 'chip_draft';

const MODE_TITLE: Record<RedrawMode, string> = {
  waitlist_fill: 'Redraw — 대기 좌석 배정',
  random_draw: '랜덤 전원 재배치',
  chip_draft: '칩 드래프트 전원 재배치',
};

interface RedrawModalProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
  mode?: RedrawMode;
}

export function RedrawModal({
  tournamentId,
  visible,
  onClose,
  mode = 'waitlist_fill',
}: RedrawModalProps) {
  const { tables, refetch: refetchTables } = useOpsTables(tournamentId);
  const { seats, refetch: refetchSeats } = useOpsSeats(tournamentId);
  const { participants, refetch: refetchParticipants } = useOpsParticipants(tournamentId);
  const redrawMut = useRedrawWaitlistFill(tournamentId);
  const reseatMut = useReseatParticipants(tournamentId);

  /** 적격 테이블 ID 집합(open·unlocked). 보호 테이블 점유자 계산에도 사용. */
  const eligibleTableIds = useMemo(
    () =>
      new Set(tables.filter((t) => t.status === 'open' && t.lockType === 'none').map((t) => t.id)),
    [tables]
  );

  /** 보호 테이블(비-open 또는 잠금/피처) 점유자 PID 집합(재배치 대상 제외). */
  const protectedPids = useMemo(
    () =>
      new Set(
        seats
          .filter((s) => s.participantId && !eligibleTableIds.has(s.tableId))
          .map((s) => s.participantId as string)
      ),
    [seats, eligibleTableIds]
  );

  const { assignments, nameByParticipantId, labelBySeatId, insufficientSeats } = useMemo(() => {
    const nameBy = new Map(participants.map((p) => [p.id, p.name] as const));
    const labelBy = new Map(seats.map((s) => [s.id, `T${s.tableNo}-${s.seatNo}`] as const));

    if (mode === 'waitlist_fill') {
      // 빈자리채움: 미착석(active/checked_in) → 빈 적격 좌석
      const seatedIds = new Set(
        seats.filter((s) => s.participantId).map((s) => s.participantId as string)
      );
      const unseatedParticipantIds = participants
        .filter((p) => (p.status === 'active' || p.status === 'checked_in') && !seatedIds.has(p.id))
        .map((p) => p.id);
      const fillTables = tables.map((t) => ({ id: t.id, status: t.status, lockType: t.lockType }));
      const fillSeats = seats.map((s) => ({
        id: s.id,
        tableId: s.tableId,
        tableNo: s.tableNo,
        seatNo: s.seatNo,
        participantId: s.participantId ?? null,
      }));
      const result = computeWaitlistFill({
        tables: fillTables,
        seats: fillSeats,
        unseatedParticipantIds,
      });
      return {
        assignments: result,
        nameByParticipantId: nameBy,
        labelBySeatId: labelBy,
        insufficientSeats: false,
      };
    }

    // 전원 재배치: active+checked_in 중 보호 테이블 점유자 제외
    const reseatInput: ReseatInput = {
      tables: tables.map((t) => ({ id: t.id, status: t.status, lockType: t.lockType })),
      seats: seats.map((s) => ({
        id: s.id,
        tableId: s.tableId,
        tableNo: s.tableNo,
        seatNo: s.seatNo,
        participantId: s.participantId ?? null,
      })),
      players: participants
        .filter(
          (p) => (p.status === 'active' || p.status === 'checked_in') && !protectedPids.has(p.id)
        )
        .map((p) => ({ id: p.id, chips: p.chips })),
      rng: () => Math.random(),
    };

    // 풀 0명 → 빈 배정(Zod/RPC가 거부하기 전에 UI 선차단)
    if (reseatInput.players.length === 0) {
      return {
        assignments: [],
        nameByParticipantId: nameBy,
        labelBySeatId: labelBy,
        insufficientSeats: false,
      };
    }

    const result = mode === 'random_draw' ? randomDraw(reseatInput) : chipDraft(reseatInput);
    if (!result.ok) {
      return {
        assignments: [],
        nameByParticipantId: nameBy,
        labelBySeatId: labelBy,
        insufficientSeats: true,
      };
    }
    return {
      assignments: result.assignments,
      nameByParticipantId: nameBy,
      labelBySeatId: labelBy,
      insufficientSeats: false,
    };
  }, [tables, seats, participants, mode, protectedPids]);

  const recompute = () => {
    void refetchTables();
    void refetchSeats();
    void refetchParticipants();
  };

  const isPending = mode === 'waitlist_fill' ? redrawMut.isPending : reseatMut.isPending;
  const canConfirm = assignments.length > 0 && !isPending && !insufficientSeats;

  const doConfirm = useCallback(() => {
    if (!canConfirm) return;
    if (mode === 'waitlist_fill') {
      // WaitlistAssignment[] — expected 필드 포함
      redrawMut.mutate(assignments as Parameters<typeof redrawMut.mutate>[0], {
        onSuccess: () => onClose(),
      });
    } else {
      // SeatAssignment[] — participantId·seatId만 필요
      reseatMut.mutate(
        {
          assignments: assignments as { participantId: string; seatId: string }[],
          mode,
        },
        { onSuccess: () => onClose() }
      );
    }
  }, [canConfirm, mode, assignments, redrawMut, reseatMut, onClose]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    // 전원 재배치는 파괴적 → 확인 다이얼로그(impeccable 룰 11/12)
    if (mode === 'random_draw' || mode === 'chip_draft') {
      confirmAction({
        title: '전원 재배치 확인',
        message: `${assignments.length}명을 새 좌석에 전원 재배치합니다. 계속하시겠어요?`,
        confirmText: '확인',
        destructive: true,
        onConfirm: doConfirm,
      });
    } else {
      doConfirm();
    }
  };

  const emptyMessage = insufficientSeats
    ? '적격 빈 좌석이 부족해 전원을 배치할 수 없어요.'
    : assignments.length === 0
      ? mode === 'waitlist_fill'
        ? '배정할 대기 인원 또는 빈 좌석이 없습니다.'
        : '배정할 활성 참가자가 없습니다.'
      : null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={MODE_TITLE[mode]}
      snapPoints={['60%', '90%']}
      scrollable
    >
      <View className="gap-3">
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">
          {mode === 'waitlist_fill'
            ? `빈 좌석에 미착석(active/checked-in) 참가자를 균형 배분합니다. (${assignments.length}명)`
            : `active+checked-in 참가자를 적격 좌석에 전원 재배치합니다. (${assignments.length}명)`}
        </Text>

        {emptyMessage ? (
          <View className="items-center py-8">
            <Text className="text-center text-secondary-500 dark:text-secondary-400">
              {emptyMessage}
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            {(assignments as { participantId: string; seatId: string }[]).map((a, i) => (
              <View
                key={a.seatId}
                className={`flex-row items-center px-3 py-2 ${
                  i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''
                }`}
              >
                <Text numberOfLines={1} className="flex-1 text-content-primary dark:text-off-white">
                  {nameByParticipantId.get(a.participantId) ?? a.participantId}
                </Text>
                <Text className="px-1 text-secondary-500 dark:text-secondary-400">
                  {mode === 'waitlist_fill' ? '대기 →' : '→'}
                </Text>
                <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                  {labelBySeatId.get(a.seatId) ?? a.seatId}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="flex-row gap-2">
          <Pressable
            onPress={recompute}
            accessibilityRole="button"
            className="min-h-[44px] flex-1 items-center justify-center rounded-md bg-gray-100 active:opacity-70 dark:bg-gray-800"
          >
            <Text className="font-sans-semibold text-content-primary dark:text-off-white">
              다시 계산
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${
              canConfirm ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <Text className="font-sans-semibold text-white">{isPending ? '배정 중…' : '확인'}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
