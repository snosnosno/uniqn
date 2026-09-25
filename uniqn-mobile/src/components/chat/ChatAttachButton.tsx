/**
 * 컴포저 왼쪽 `+` — 사진 1장 첨부
 *
 * 웹은 카메라 촬영이 사실상 파일 선택과 같아 바로 앨범(파일 선택)을 연다.
 * 네이티브는 눌렀을 때 입력창 위에 "앨범 / 카메라" 두 칸을 띄운다(자주 쓰지 않는 메뉴라 움직임 없음).
 */
import React, { memo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { CameraIcon, ImageIcon, PlusIcon, XMarkIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { ChatImageSource } from '@/services/chat';

interface ChatAttachButtonProps {
  onPick: (source: ChatImageSource) => void;
  disabled?: boolean;
}

export const ChatAttachButton = memo(function ChatAttachButton({
  onPick,
  disabled = false,
}: ChatAttachButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const choose = (source: ChatImageSource) => {
    setMenuOpen(false);
    onPick(source);
  };

  const handlePress = () => {
    if (Platform.OS === 'web') {
      choose('library');
      return;
    }
    setMenuOpen((open) => !open);
  };

  return (
    <View>
      {menuOpen ? (
        <View
          testID="chat-attach-menu"
          className="absolute bottom-12 left-0 z-10 flex-row rounded-2xl border border-secondary-200 bg-surface-page p-1 dark:border-surface-overlay dark:bg-surface-elevated"
        >
          <MenuItem label="앨범" icon="library" onPress={() => choose('library')} />
          <MenuItem label="카메라" icon="camera" onPress={() => choose('camera')} />
        </View>
      ) : null}
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={menuOpen ? '사진 첨부 닫기' : '사진 첨부'}
        accessibilityState={{ disabled, expanded: menuOpen }}
        testID="chat-attach-button"
        hitSlop={6}
        className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-secondary-100 dark:bg-surface-elevated"
      >
        {menuOpen ? (
          <XMarkIcon size={18} color={SECONDARY_PALETTE[500]} />
        ) : (
          <PlusIcon size={20} color={disabled ? SECONDARY_PALETTE[300] : SECONDARY_PALETTE[500]} />
        )}
      </Pressable>
    </View>
  );
});

function MenuItem({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ChatImageSource;
  onPress: () => void;
}) {
  const Icon = icon === 'camera' ? CameraIcon : ImageIcon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}에서 사진 고르기`}
      className="mx-0.5 items-center rounded-xl px-4 py-2 active:bg-secondary-100 dark:active:bg-surface-overlay"
    >
      <Icon size={20} color={SECONDARY_PALETTE[500]} />
      <Text className="mt-0.5 text-xs text-content-secondary dark:text-secondary-300">{label}</Text>
    </Pressable>
  );
}
