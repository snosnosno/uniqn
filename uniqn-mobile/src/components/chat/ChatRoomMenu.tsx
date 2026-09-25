/**
 * (S4) 채팅방 헤더 `⋯` 메뉴 — 알림 끄기/켜기 · 차단하기/차단 해제 · 채팅방 나가기
 *
 * - 차단은 확인 창을 거친다(문구 확정 초안 A). 해제는 되돌리는 동작이라 확인 없이 바로.
 * - 상대가 막은 방은 차단 항목을 아예 보이지 않는다 — 해제 권한이 없고, 다시 막는 것은 no-op.
 * - 나가기 확인은 부모(ChatRoomScreen)가 한다(나간 뒤 이동까지 거기서 처리).
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { EllipsisHorizontalIcon } from '@/components/icons';
import { ActionSheet, type ActionSheetOption } from '@/components/ui/ActionSheet';
import { confirmAction } from '@/utils/confirmAction';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { ChatBlockState } from '@/domains/chat';

export const CHAT_BLOCK_CONFIRM = {
  title: '대화 차단',
  message: '이 대화를 차단할까요? 서로 메시지를 보낼 수 없어요. 지원·근무에는 영향이 없어요.',
  confirmText: '차단하기',
} as const;

type MenuValue = 'mute' | 'unmute' | 'block' | 'unblock' | 'leave';

export interface ChatRoomMenuProps {
  muted: boolean;
  blockState: ChatBlockState;
  disabled?: boolean;
  onToggleMute: (nextMuted: boolean) => void;
  onBlock: () => void;
  onUnblock: () => void;
  onLeave: () => void;
}

function buildOptions(muted: boolean, blockState: ChatBlockState): ActionSheetOption[] {
  const options: ActionSheetOption[] = [
    muted
      ? { value: 'unmute', label: '이 대화 알림 켜기' }
      : { value: 'mute', label: '이 대화 알림 끄기' },
  ];
  // 상대만 막은 방에서도 내 차단을 건다 — 상대가 자기 것을 풀어도 내 차단이 남게(서버 쪽별 행)
  if (blockState !== 'mine') options.push({ value: 'block', label: '차단하기', destructive: true });
  if (blockState === 'mine') options.push({ value: 'unblock', label: '차단 해제' });
  options.push({ value: 'leave', label: '채팅방 나가기', destructive: true });
  return options;
}

export const ChatRoomMenu = memo(function ChatRoomMenu({
  muted,
  blockState,
  disabled = false,
  onToggleMute,
  onBlock,
  onUnblock,
  onLeave,
}: ChatRoomMenuProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildOptions(muted, blockState), [muted, blockState]);

  const handleSelect = useCallback(
    (value: string) => {
      switch (value as MenuValue) {
        case 'mute':
          return onToggleMute(true);
        case 'unmute':
          return onToggleMute(false);
        case 'block':
          return confirmAction({ ...CHAT_BLOCK_CONFIRM, destructive: true, onConfirm: onBlock });
        case 'unblock':
          return onUnblock();
        case 'leave':
          return onLeave();
      }
    },
    [onToggleMute, onBlock, onUnblock, onLeave]
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="채팅방 메뉴"
        accessibilityState={{ disabled }}
        hitSlop={10}
        testID="chat-room-menu"
        className="rounded-sm p-1.5 active:opacity-70"
      >
        <EllipsisHorizontalIcon size={20} color={SECONDARY_PALETTE[500]} />
      </Pressable>
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        options={options}
        onSelect={handleSelect}
      />
    </>
  );
});
