/**
 * ops 1f — 상금 정정 시트(SheetModal): 현재 금액 → 새 금액 + 사유(선택).
 * [저장] correctPrize(amount) · [회수] correctPrize(amount=null)(확인 다이얼로그 재확인).
 * completed 이후에도 동작(D3 — 상태 게이트 없음).
 */
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { confirmAction } from '@/utils/confirmAction';
import { SheetModal } from '@/components/ui/SheetModal';
import { useCorrectPrize } from '@/hooks/ops';
import { fmtKrw, parseAmount } from './payoutRows';

interface Props {
  visible: boolean;
  onClose: () => void;
  participant: { id: string; name: string; prizeAmount: number | null } | null;
  tournamentId: string;
}

export function PrizeCorrectSheet({ visible, onClose, participant, tournamentId }: Props) {
  const correctMut = useCorrectPrize(tournamentId);
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');

  // 시트가 열리거나 대상이 바뀌면 현재 지급액으로 입력 시드.
  useEffect(() => {
    if (visible && participant) {
      setAmountInput(participant.prizeAmount !== null ? String(participant.prizeAmount) : '');
      setReason('');
    }
  }, [visible, participant]);

  if (!participant) return null;

  const trimmedReason = () => reason.trim() || undefined;

  const onSave = () => {
    correctMut.mutate(
      { participantId: participant.id, amount: parseAmount(amountInput), reason: trimmedReason() },
      { onSuccess: onClose }
    );
  };

  const onRecall = () => {
    confirmAction({
      title: '상금 회수',
      message: `${participant.name} 님의 상금을 회수(0/미지급)할까요?`,
      confirmText: '회수',
      destructive: true,
      onConfirm: () =>
        correctMut.mutate(
          { participantId: participant.id, amount: null, reason: trimmedReason() },
          { onSuccess: onClose }
        ),
    });
  };

  const footer = (
    <View className="flex-row gap-3">
      <Pressable
        onPress={onRecall}
        disabled={correctMut.isPending}
        accessibilityRole="button"
        className="min-h-[44px] flex-1 items-center justify-center rounded-md bg-error-600 active:opacity-70"
      >
        <Text className="font-sans-semibold text-white">회수</Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={correctMut.isPending}
        accessibilityRole="button"
        className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${correctMut.isPending ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600 active:opacity-70'}`}
      >
        <Text className="font-sans-semibold text-white">저장</Text>
      </Pressable>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={`${participant.name} 상금 정정`}
      isLoading={correctMut.isPending}
      footer={footer}
    >
      <View className="gap-4 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">현재 지급액</Text>
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            {participant.prizeAmount !== null ? `${fmtKrw(participant.prizeAmount)}원` : '미지급'}
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">새 금액</Text>
          <TextInput
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            className="min-h-[44px] rounded-md border border-gray-200 px-3 text-right text-primary-400 dark:border-gray-700 dark:text-primary-300"
          />
        </View>

        <View className="gap-1">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">사유 (선택)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            maxLength={200}
            placeholder="정정 사유"
            placeholderTextColor="#9CA3AF"
            className="min-h-[44px] rounded-md border border-gray-200 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
          />
        </View>
      </View>
    </SheetModal>
  );
}

export default PrizeCorrectSheet;
