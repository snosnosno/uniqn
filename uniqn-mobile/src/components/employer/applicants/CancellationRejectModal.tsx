/**
 * 취소 요청 거절 사유 모달
 *
 * 검토 화면(`CancellationRequestCard`)과 [근무] 사람 줄(`StaffManagementTab`)이 함께 쓴다.
 * 두 벌로 두면 CANCEL-14(성공에서만 닫기)·EF-CAN-2(중복 제출 차단) 규칙이 한쪽에서만 지켜진다.
 */
import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { ModalFooterButtons } from '@/components/ui/ModalFooterButtons';
import { useSubmitGate } from '@/hooks/useSubmitGate';

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 200;

export interface CancellationRejectModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * ⚠️ **Promise 를 돌려줘야 한다** — 결과를 보고 성공에서만 닫는다.
   * 실패하면 모달과 입력한 사유가 그대로 남는다(CANCEL-14).
   */
  onSubmit: (reason: string) => Promise<void>;
  /** 바깥에서 같은 요청을 처리 중인지 — 제출을 막는다(EF-CAN-2). */
  isProcessing?: boolean;
  /** 로그 컨텍스트 */
  applicationId?: string;
}

export function CancellationRejectModal({
  visible,
  onClose,
  onSubmit,
  isProcessing = false,
  applicationId,
}: CancellationRejectModalProps) {
  const [reason, setReason] = useState('');

  const handleClose = useCallback(() => {
    setReason('');
    onClose();
  }, [onClose]);

  const gate = useSubmitGate<[string]>({
    action: (trimmed) => onSubmit(trimmed),
    onSuccess: handleClose,
    errorMessage: '취소 요청 거절 실패',
    context: applicationId ? { applicationId } : undefined,
  });

  const trimmedLength = reason.trim().length;
  const isBusy = isProcessing || gate.isSubmitting;

  const handleSubmit = useCallback(() => {
    if (isProcessing || reason.trim().length < MIN_REASON_LENGTH) return;
    void gate.submit(reason.trim());
  }, [isProcessing, reason, gate]);

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="취소 요청 거절"
      size="sm"
      position="center"
      // 액션은 footer prop 으로 — 200자 사유 입력 + 키보드가 겹치면 children 끝의
      // 버튼이 스크롤 아래로 밀린다. size='sm' 이라 여유가 특히 좁다(2026-07-25).
      footer={
        <ModalFooterButtons
          onCancel={handleClose}
          onSubmit={handleSubmit}
          submitText="거절하기"
          isLoading={isBusy}
          submitDisabled={trimmedLength < MIN_REASON_LENGTH || isBusy}
        />
      }
    >
      <View className="-mt-2">
        <Text className="text-sm text-secondary-500 dark:text-secondary-400 mb-4 font-sans">
          거절 사유를 입력해주세요.
        </Text>

        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="최소 3자 이상 입력해주세요"
          placeholderTextColor={SECONDARY_PALETTE[400]}
          multiline
          numberOfLines={3}
          maxLength={MAX_REASON_LENGTH}
          className="bg-surface-page dark:bg-surface rounded-lg p-3 text-content-primary dark:text-off-white text-base font-sans min-h-[80px] mb-4"
          textAlignVertical="top"
        />
        <Text className="text-xs text-content-placeholder text-right font-sans">
          {reason.length}/{MAX_REASON_LENGTH}
        </Text>
      </View>
    </Modal>
  );
}
