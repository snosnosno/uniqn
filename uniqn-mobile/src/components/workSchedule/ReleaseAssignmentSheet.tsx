import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { SECONDARY_PALETTE } from '@/constants/colors';

interface ReleaseAssignmentSheetProps {
  visible: boolean;
  staffName?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function ReleaseAssignmentSheet({
  visible,
  staffName,
  isSubmitting,
  onClose,
  onConfirm,
}: ReleaseAssignmentSheetProps) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 2 && !isSubmitting;

  return (
    <SheetModal visible={visible} onClose={onClose} title="근무 배치 해제">
      <View className="px-4 pb-4">
        <Text className="mb-3 text-sm font-sans text-content-secondary dark:text-secondary-300">
          {staffName ?? '이 인원'}의 확정 배치를 해제하면 부족 인원이 다시 계산됩니다. 출근 이후에는
          근태 정정을 사용해주세요.
        </Text>
        <Text className="mb-2 text-sm font-sans-medium text-content-primary dark:text-content-primary">
          해제 사유 (필수)
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          multiline
          textAlignVertical="top"
          placeholder="예: 스태프와 협의해 배치를 변경합니다"
          placeholderTextColor={SECONDARY_PALETTE[400]}
          accessibilityLabel="근무 배치 해제 사유"
          className="mb-4 min-h-[72px] rounded-lg border border-divider bg-surface-card p-3 text-content-primary dark:bg-surface-elevated dark:text-off-white"
        />
        <Button
          variant="danger"
          disabled={!canSubmit}
          loading={isSubmitting}
          onPress={() => canSubmit && onConfirm(trimmed)}
          accessibilityLabel="사유를 기록하고 근무 배치 해제"
        >
          배치 해제
        </Button>
      </View>
    </SheetModal>
  );
}
