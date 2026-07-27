/**
 * UNIQN Mobile - 지급 완료 취소 모달 (SETTLE-3)
 *
 * @description 오지급을 정정할 수 있는 유일한 진입점. 금전 상태를 역행시키는 조작이라
 *   사유 입력을 강제하고(서버도 동일하게 강제한다 — SettlementRepository), 되돌리면
 *   무엇이 바뀌는지를 미리 문구로 고지한다.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { AlertCircleIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { formatNumber } from '@/utils/formatters';

/** 서버 zod 한도(수정 사유)와 동일 — 초과 입력 자체를 막는다. */
const REASON_MAX_LENGTH = 200;

export interface SettlementRevertModalProps {
  visible: boolean;
  onClose: () => void;
  /** 되돌릴 대상의 표시 정보 */
  staffName?: string;
  payrollAmount?: number | null;
  /** 사유와 함께 되돌리기 실행. 실패해도 모달은 호출부가 닫기 전까지 유지된다. */
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

export function SettlementRevertModal({
  visible,
  onClose,
  staffName,
  payrollAmount,
  onConfirm,
  isSubmitting = false,
}: SettlementRevertModalProps) {
  const [reason, setReason] = useState('');

  // 재열림 시 이전 입력이 남지 않게 초기화한다.
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length > 0 && !isSubmitting;

  const handleConfirm = useCallback(() => {
    if (!canSubmit) return;
    onConfirm(trimmedReason);
  }, [canSubmit, onConfirm, trimmedReason]);

  return (
    <SheetModal visible={visible} onClose={onClose} title="지급 완료 취소">
      <View className="px-4 pb-4">
        <Text className="text-base font-sans text-content-primary dark:text-content-primary mb-1">
          {staffName ? `${staffName} 님의 ` : ''}지급 완료 표시를 취소합니다.
        </Text>
        {typeof payrollAmount === 'number' && (
          <Text className="text-sm font-sans text-content-secondary mb-3">
            확정됐던 금액 ₩{formatNumber(payrollAmount)}
          </Text>
        )}

        <View className="flex-row items-start p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg mb-4">
          <AlertCircleIcon size={16} color="#B8962E" />
          <Text className="ml-2 text-sm text-primary-700 dark:text-primary-300 flex-1 font-sans">
            취소하면 이 근무가 다시 정산 대기로 돌아가 금액·시간을 수정할 수 있어요. 지급일 기록은
            지워지고, 취소 사유는 정산 이력에 남습니다. 실제 이체를 되돌리지는 않아요.
          </Text>
        </View>

        <Text className="text-sm font-sans-medium text-content-secondary mb-2">
          취소 사유 (필수)
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="예: 금액을 잘못 산정해 다시 계산합니다"
          placeholderTextColor={SECONDARY_PALETTE[400]}
          multiline
          numberOfLines={2}
          maxLength={REASON_MAX_LENGTH}
          textAlignVertical="top"
          accessibilityLabel="지급 완료 취소 사유"
          className="p-3 border border-divider rounded-lg bg-surface-card text-content-primary dark:text-off-white min-h-[60px]"
        />
        <Text className="mt-1 mb-4 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {trimmedReason.length === 0
            ? '사유를 입력하면 취소할 수 있어요'
            : `${reason.length}/${REASON_MAX_LENGTH}자`}
        </Text>

        <Button
          onPress={handleConfirm}
          disabled={!canSubmit}
          loading={isSubmitting}
          variant="danger"
          accessibilityLabel="지급 완료 취소하기"
        >
          지급 완료 취소
        </Button>
      </View>
    </SheetModal>
  );
}

export default SettlementRevertModal;
