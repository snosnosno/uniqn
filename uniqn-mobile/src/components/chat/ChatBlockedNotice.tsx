/**
 * (S4) 차단된 방 — 입력창(사진 버튼 포함) 자리에 안내를 둔다. 막은 쪽에만 "차단 해제" 버튼.
 * 읽기·지원·근무에는 영향이 없다(서버가 보내기만 막는다).
 */
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

interface ChatBlockedNoticeProps {
  /** 내 쪽이 막았을 때만 true */
  canUnblock: boolean;
  onUnblock: () => void;
  isBusy?: boolean;
}

export const ChatBlockedNotice = memo(function ChatBlockedNotice({
  canUnblock,
  onUnblock,
  isBusy = false,
}: ChatBlockedNoticeProps) {
  return (
    <View
      className="flex-row items-center justify-center border-t border-secondary-200 bg-surface-page px-4 py-3 dark:border-surface-overlay dark:bg-surface"
      testID="chat-blocked-notice"
    >
      <Text accessibilityRole="text" className="text-sm text-content-muted dark:text-secondary-400">
        대화할 수 없는 상태예요
      </Text>
      {canUnblock ? (
        <Pressable
          onPress={onUnblock}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="차단 해제"
          accessibilityState={{ disabled: isBusy }}
          hitSlop={8}
          className="ml-3 rounded-full border border-secondary-300 px-3 py-1 dark:border-surface-overlay"
        >
          <Text className="text-xs font-sans-semibold text-content-primary dark:text-secondary-100">
            차단 해제
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});
