/**
 * (S4) 채팅 메시지 신고 시트 — 사유 5종 라디오 + 선택 설명(최대 500자)
 *
 * - 사유를 고르기 전에는 제출할 수 없다. 설명 검증(500자·XSS)은 서비스의 zod 스키마가 한다.
 * - 성공하면 닫고(접수 toast 는 훅), 실패하면 연 채로 둔다 — 고친 뒤 다시 누르면 된다.
 * - 증거(본문·직전 10개)는 서버가 DB 에서 채운다. 이 시트는 본문을 보내지 않는다.
 * - 부모는 대상이 있을 때만 마운트한다 — 다시 열면 입력이 비워진 새 시트다.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useReportChatMessage } from '@/hooks/chat';
import {
  CHAT_REPORT_DETAIL_MAX_LENGTH,
  CHAT_REPORT_REASON_LABELS,
  CHAT_REPORT_REASONS,
  type ChatReportReason,
} from '@/constants/chat';
import { SECONDARY_PALETTE } from '@/constants/colors';

interface ChatReportSheetProps {
  /** 신고할 메시지 id. null 이면 닫힘 */
  messageId: string | null;
  onClose: () => void;
}

function ReasonRadio({
  reason,
  selected,
  onSelect,
}: {
  reason: ChatReportReason;
  selected: boolean;
  onSelect: (reason: ChatReportReason) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(reason)}
      accessibilityRole="radio"
      accessibilityLabel={CHAT_REPORT_REASON_LABELS[reason]}
      accessibilityState={{ checked: selected }}
      className="flex-row items-center py-3"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected
            ? 'border-primary-500 dark:border-primary-400'
            : 'border-secondary-300 dark:border-surface-overlay'
        }`}
      >
        {selected ? (
          <View className="h-2.5 w-2.5 rounded-full bg-primary-500 dark:bg-primary-400" />
        ) : null}
      </View>
      <Text className="ml-3 text-base text-content-primary dark:text-secondary-100">
        {CHAT_REPORT_REASON_LABELS[reason]}
      </Text>
    </Pressable>
  );
}

export function ChatReportSheet({ messageId, onClose }: ChatReportSheetProps) {
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const { report, isReporting } = useReportChatMessage();

  if (!messageId) return null;

  const canSubmit = !!reason && !isReporting;
  const handleSubmit = async () => {
    if (!reason || isReporting) return;
    const trimmed = detail.trim();
    const ok = await report({ messageId, reason, detail: trimmed ? trimmed : null });
    if (ok) onClose();
  };

  return (
    <Modal
      visible
      onClose={onClose}
      title="메시지 신고"
      position="bottom"
      footer={
        <Button
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={isReporting}
          accessibilityLabel="신고 제출"
          fullWidth
        >
          신고하기
        </Button>
      }
    >
      <Text className="mb-1 text-sm text-content-secondary dark:text-secondary-300">
        신고 사유를 골라 주세요
      </Text>
      <View accessibilityRole="radiogroup">
        {CHAT_REPORT_REASONS.map((r) => (
          <ReasonRadio key={r} reason={r} selected={reason === r} onSelect={setReason} />
        ))}
      </View>
      <TextInput
        value={detail}
        onChangeText={setDetail}
        maxLength={CHAT_REPORT_DETAIL_MAX_LENGTH}
        multiline
        placeholder="자세한 상황을 적어 주세요 (선택)"
        placeholderTextColor={SECONDARY_PALETTE[400]}
        accessibilityLabel="신고 설명 (선택)"
        testID="chat-report-detail"
        className="mt-2 min-h-[88px] rounded-lg bg-secondary-100 p-3 text-sm text-content-primary dark:bg-surface-elevated dark:text-secondary-100"
        style={{ textAlignVertical: 'top' }}
      />
      <Text className="mt-1 self-end text-[11px] text-content-muted dark:text-secondary-400">
        {detail.length}/{CHAT_REPORT_DETAIL_MAX_LENGTH}
      </Text>
      <Text className="mt-2 text-xs text-content-muted dark:text-secondary-400">
        신고한 메시지와 그 앞의 대화 일부가 운영팀에 전달돼요.
      </Text>
    </Modal>
  );
}
