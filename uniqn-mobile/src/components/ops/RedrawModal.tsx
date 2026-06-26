/**
 * ops 1b — Redraw 미리보기 모달.
 * computeWaitlistFill 로 미착석(active/checked_in) 참가자 → 빈 좌석 배정안을 미리 계산해
 * before→after 로 보여주고, [확인] 시 redraw 변이를 실행한다.
 * SEAT_VERSION_CONFLICT 등 충돌은 변이 onError 가 toast 하며, [다시 계산]으로 최신 데이터 재계산한다.
 */
import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheet } from '@/components/ui';
import { useOpsTables, useOpsSeats, useOpsParticipants, useRedrawWaitlistFill } from '@/hooks/ops';
import { computeWaitlistFill } from '@/domains/ops';
import type { OpsParticipantStatus } from '@/types/ops';

const SEATABLE_STATUSES: readonly OpsParticipantStatus[] = ['active', 'checked_in'];

interface RedrawModalProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
}

export function RedrawModal({ tournamentId, visible, onClose }: RedrawModalProps) {
  const { tables, refetch: refetchTables } = useOpsTables(tournamentId);
  const { seats, refetch: refetchSeats } = useOpsSeats(tournamentId);
  const { participants, refetch: refetchParticipants } = useOpsParticipants(tournamentId);
  const redrawMut = useRedrawWaitlistFill(tournamentId);

  const { assignments, nameByParticipantId, labelBySeatId } = useMemo(() => {
    const nameBy = new Map(participants.map((p) => [p.id, p.name] as const));
    const labelBy = new Map(seats.map((s) => [s.id, `T${s.tableNo}-${s.seatNo}`] as const));
    const seatedIds = new Set(
      seats.filter((s) => s.participantId).map((s) => s.participantId as string)
    );
    const unseatedParticipantIds = participants
      .filter((p) => SEATABLE_STATUSES.includes(p.status) && !seatedIds.has(p.id))
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
    return { assignments: result, nameByParticipantId: nameBy, labelBySeatId: labelBy };
  }, [tables, seats, participants]);

  const recompute = () => {
    void refetchTables();
    void refetchSeats();
    void refetchParticipants();
  };

  const confirm = () => {
    if (assignments.length === 0 || redrawMut.isPending) return;
    redrawMut.mutate(assignments, { onSuccess: () => onClose() });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Redraw — 대기 좌석 배정"
      snapPoints={['60%', '90%']}
      scrollable
    >
      <View className="gap-3">
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">
          빈 좌석에 미착석(active/checked-in) 참가자를 균형 배분합니다. ({assignments.length}명)
        </Text>

        {assignments.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-center text-secondary-500 dark:text-secondary-400">
              배정할 대기 인원 또는 빈 좌석이 없습니다.
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            {assignments.map((a, i) => (
              <View
                key={a.seatId}
                className={`flex-row items-center px-3 py-2 ${
                  i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''
                }`}
              >
                <Text numberOfLines={1} className="flex-1 text-content-primary dark:text-off-white">
                  {nameByParticipantId.get(a.participantId) ?? a.participantId}
                </Text>
                <Text className="px-1 text-secondary-500 dark:text-secondary-400">대기 →</Text>
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
            className="flex-1 items-center rounded-md bg-gray-100 py-2.5 active:opacity-70 dark:bg-gray-800"
          >
            <Text className="font-sans-semibold text-content-primary dark:text-off-white">
              다시 계산
            </Text>
          </Pressable>
          <Pressable
            onPress={confirm}
            disabled={assignments.length === 0 || redrawMut.isPending}
            accessibilityRole="button"
            className={`flex-1 items-center rounded-md py-2.5 ${
              assignments.length > 0 && !redrawMut.isPending
                ? 'bg-primary-600 active:opacity-70'
                : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <Text className="font-sans-semibold text-white">
              {redrawMut.isPending ? '배정 중…' : '확인'}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

export default RedrawModal;
