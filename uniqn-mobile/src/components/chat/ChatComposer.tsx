/**
 * 채팅 입력창 — 여러 줄 입력 · 1000자 카운터 · 개인정보 경고(비차단) · 오프라인 비활성
 *
 * - 개인정보(연락처·계좌) 감지는 **경고만** 한다. 전송 버튼은 그대로 살아 있다(설계 §7).
 * - 전송 버튼은 눌림에 scale 0.97 피드백. 동작 줄이기 켜짐이면 scale 대신 불투명도만.
 * - 키보드 따라 올라가기는 부모(ChatRoomView)의 KeyboardStickyView 가 맡는다 — 여기선 애니메이션 없음.
 * - 웹(데스크톱): Enter 전송 · Alt+Enter(·Shift+Enter) 줄바꿈 · 한글 조합 중 Enter 무시(composerKeyAction).
 *   네이티브와 터치 기기 웹은 키보드의 줄바꿈 키가 그대로 줄바꿈이고 전송은 버튼으로만 한다.
 *   Alt+Enter 줄바꿈은 값을 직접 바꾸므로 브라우저 되돌리기(Ctrl+Z) 기록에는 남지 않는다(알려진 제약).
 */
import React, { memo, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { PaperPlaneOutlineIcon } from '@/components/icons';
import {
  composerKeyAction,
  detectPrivacyRisk,
  insertNewlineAt,
  PRIVACY_WARNING_MESSAGES,
} from '@/domains/chat';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/constants/chat';
import { SECONDARY_PALETTE, TEXT_COLORS } from '@/constants/colors';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { ChatImageSource } from '@/services/chat';
import { ChatAttachButton } from './ChatAttachButton';

/** 카운터는 한도 근처에서만 보인다 */
const COUNTER_THRESHOLD = CHAT_MESSAGE_MAX_LENGTH - 100;

/** react-native-web 의 onKeyPress 는 React 키보드 이벤트를 그대로 넘긴다(웹 전용 필드) */
interface WebKeyPressEvent {
  key: string;
  altKey?: boolean;
  shiftKey?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean };
  target?: {
    value?: string;
    selectionStart?: number | null;
    selectionEnd?: number | null;
    setSelectionRange?: (start: number, end: number) => void;
  };
  preventDefault: () => void;
}

/** 웹 터치 기기(가상 키보드) 판정 — matchMedia 가 없으면 데스크톱으로 본다 */
function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

interface ChatComposerProps {
  onSend: (body: string) => void;
  /** 오프라인·상대 탈퇴 등 — 입력 자체를 막는다 */
  disabled?: boolean;
  disabledReason?: string;
  /** (S2b) 사진 첨부 — 없으면 `+` 버튼을 그리지 않는다 */
  onAttach?: (source: ChatImageSource) => void;
}

export const ChatComposer = memo(function ChatComposer({
  onSend,
  disabled = false,
  disabledReason,
  onAttach,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const reduceMotion = useReduceMotion();
  const trimmed = text.trim();
  const canSend = !disabled && trimmed.length > 0 && text.length <= CHAT_MESSAGE_MAX_LENGTH;
  const risk = detectPrivacyRisk(text);

  /** value: 웹 Enter 는 입력창의 실제 값(조합 확정 직후 상태가 한 박자 늦을 수 있어) */
  const handleSend = (value: string = text) => {
    const body = value.trim();
    if (disabled || body.length === 0 || value.length > CHAT_MESSAGE_MAX_LENGTH) return;
    onSend(body);
    setText('');
  };

  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const e = event as unknown as WebKeyPressEvent;
    const action = composerKeyAction({
      key: e.key,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      keyCode: e.keyCode,
      isComposing: e.nativeEvent?.isComposing,
      coarsePointer: isCoarsePointer(),
    });
    if (action === 'send') {
      e.preventDefault();
      handleSend(e.target?.value ?? text);
    } else if (action === 'newline') {
      e.preventDefault();
      const input = e.target;
      const current = input?.value ?? text;
      const next = insertNewlineAt(
        current,
        input?.selectionStart ?? current.length,
        input?.selectionEnd ?? current.length
      );
      if (next.value.length > CHAT_MESSAGE_MAX_LENGTH) return;
      setText(next.value);
      // 값이 바뀐 뒤 커서를 줄바꿈 바로 뒤로(안 하면 끝으로 튄다)
      requestAnimationFrame(() => input?.setSelectionRange?.(next.cursor, next.cursor));
    }
  };

  return (
    <View className="border-t border-secondary-200 bg-surface-page px-3 pb-2 pt-2 dark:border-surface-overlay dark:bg-surface">
      {risk ? (
        <Text
          accessibilityRole="alert"
          className="mb-1.5 px-1 text-xs text-warning-700 dark:text-warning-400"
        >
          {PRIVACY_WARNING_MESSAGES[risk]}
        </Text>
      ) : null}
      {disabled && disabledReason ? (
        <Text className="mb-1.5 px-1 text-xs text-content-muted dark:text-secondary-400">
          {disabledReason}
        </Text>
      ) : null}
      <View className="flex-row items-end">
        {onAttach ? <ChatAttachButton onPick={onAttach} disabled={disabled} /> : null}
        <TextInput
          value={text}
          onChangeText={setText}
          onKeyPress={handleKeyPress}
          editable={!disabled}
          multiline
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={SECONDARY_PALETTE[400]}
          accessibilityLabel="메시지 입력"
          testID="chat-composer-input"
          className="max-h-32 min-h-[40px] flex-1 rounded-2xl bg-secondary-100 px-4 py-2.5 text-base text-content-primary dark:bg-surface-elevated dark:text-secondary-100"
        />
        <Pressable
          onPress={() => handleSend()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="보내기"
          accessibilityState={{ disabled: !canSend }}
          testID="chat-composer-send"
          hitSlop={6}
          style={({ pressed }) =>
            pressed && canSend
              ? reduceMotion
                ? { opacity: 0.7 }
                : { transform: [{ scale: 0.97 }] }
              : undefined
          }
          className={`ml-2 h-10 w-10 items-center justify-center rounded-full ${
            canSend
              ? 'bg-primary-500 dark:bg-primary-400'
              : 'bg-secondary-200 dark:bg-surface-overlay'
          }`}
        >
          <PaperPlaneOutlineIcon
            size={18}
            color={canSend ? TEXT_COLORS.onGold : SECONDARY_PALETTE[400]}
          />
        </Pressable>
      </View>
      {text.length >= COUNTER_THRESHOLD ? (
        <Text className="mt-1 self-end text-[11px] text-content-muted dark:text-secondary-400">
          {text.length}/{CHAT_MESSAGE_MAX_LENGTH}
        </Text>
      ) : null}
    </View>
  );
});
