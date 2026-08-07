/**
 * 결함① — 칩 카운트 입력 시트(SheetModal): 현재 칩 → 새 칩(절대값).
 * 서버(ops_set_participant_chips)가 active/checked_in 만 허용하고 1~20억 범위를 재검증한다.
 * 마지막 쓰기 승리(낙관적 잠금 없음) — 교차 변경 추적은 HISTORY 의 player_chips_set 원장.
 * 자릿수 오타가 현장 최빈 오류라 저장 전 증감 델타를 보여준다(표시만, 차단하지 않음).
 */
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { useSetParticipantChips } from '@/hooks/ops';
import { formatNumber } from '@/utils/formatters/currency';
import { parseAmount } from './payoutRows';

interface Props {
  visible: boolean;
  onClose: () => void;
  participant: { id: string; name: string; entryNumber: number | null; chips: number } | null;
  tournamentId: string;
}

/** 현재 → 새 값 증감 안내. 0(=미입력/동일)이면 null 로 숨긴다. */
function buildDeltaLabel(before: number, after: number): string | null {
  if (!after || after === before) return null;
  const diff = after - before;
  const sign = diff > 0 ? '+' : '−';
  const pct = before > 0 ? ` (${sign}${Math.round((Math.abs(diff) / before) * 100)}%)` : '';
  return `${formatNumber(before)} → ${formatNumber(after)} · ${sign}${formatNumber(Math.abs(diff))}${pct}`;
}

export function ChipCountSheet({ visible, onClose, participant, tournamentId }: Props) {
  const setChipsMut = useSetParticipantChips(tournamentId);
  const [chipsInput, setChipsInput] = useState('');
  const participantId = participant?.id ?? null;

  // 열릴 때 · 대상이 바뀔 때만 현재 칩으로 시드한다. `participant` 객체 자체를 의존성에 두면
  // 상위 액션시트가 매 렌더 새 객체를 만드는 순간 재발화한다 — ops_participants realtime
  // invalidate → refetch 로 상위가 재렌더될 때마다 입력 중이던 값이 스냅샷 칩으로 되돌아가고,
  // 되돌아간 값은 zod 도 서버도 유효해서 조용히 오입력/no-op 으로 저장된다.
  // (같은 함정을 이미 겪은 선례: WorkLogEditSheet.tsx:243-255)
  useEffect(() => {
    if (visible && participantId !== null) setChipsInput(String(participant?.chips ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열림·대상 전환에만 반응한다(위 주석)
  }, [visible, participantId]);

  if (!participant) return null;

  const nextChips = parseAmount(chipsInput);
  const deltaLabel = buildDeltaLabel(participant.chips, nextChips);

  const onSave = () => {
    setChipsMut.mutate({ participantId: participant.id, chips: nextChips }, { onSuccess: onClose });
  };

  const footer = (
    <Pressable
      onPress={onSave}
      disabled={setChipsMut.isPending}
      accessibilityRole="button"
      className={`min-h-[44px] items-center justify-center rounded-md ${
        setChipsMut.isPending ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600 active:opacity-70'
      }`}
    >
      <Text className="font-sans-semibold text-white">칩 수량 저장</Text>
    </Pressable>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={`#${participant.entryNumber ?? ''} ${participant.name} 칩 카운트`}
      isLoading={setChipsMut.isPending}
      footer={footer}
    >
      <View className="gap-4 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">현재 칩</Text>
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            {formatNumber(participant.chips)}
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">새 칩 수량</Text>
          <TextInput
            value={chipsInput}
            onChangeText={setChipsInput}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="새 칩 수량"
            className="min-h-[44px] rounded-md border border-gray-200 px-3 text-right text-primary-400 dark:border-gray-700 dark:text-primary-300"
          />
          {deltaLabel !== null && (
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">{deltaLabel}</Text>
          )}
        </View>

        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          칩이 0이 된 참가자는 탈락 처리를 사용해주세요.
        </Text>
      </View>
    </SheetModal>
  );
}

export default ChipCountSheet;
