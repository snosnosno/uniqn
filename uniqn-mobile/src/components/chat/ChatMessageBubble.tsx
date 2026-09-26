/**
 * 채팅 말풍선 — 서버 메시지 또는 아직 서버에 없는 내 메시지(아웃박스)
 *
 * - 내 것: 오른쪽·골드. 상대: 왼쪽·회색. 시스템/공지: 가운데 작은 안내.
 * - 상대 말풍선 위에 발신자 이름을 작게 단다 — 양쪽 화면 모두, 연달아 보낸 묶음의 첫 말풍선에만
 *   (판정은 ChatTimelineRow 의 senderNameRowKeys).
 * - 실패: 모양 전환 없이 아이콘+색만 바꾸고 "재전송"·"삭제"를 붙인다(자주 보는 요소라 움직임 없음).
 * - 사진(kind=image)은 ChatImageBubble 로 그린다(S2b). 삭제된 사진은 일반 삭제 문구.
 * - (S4) 신고 가능한 상대 메시지는 길게 눌러(또는 접근성 동작) 신고 메뉴를 연다. 이때 본문 텍스트
 *   선택(selectable)은 끈다 — 안드로이드에서 텍스트 선택이 길게 누르기를 가로챈다.
 */
import React, { memo } from 'react';
import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { RefreshIcon } from '@/components/icons';
import { STATUS_COLORS } from '@/constants/colors';
import { isChatNoticeMessage } from '@/domains/chat';
import type { ChatMessage, ChatOutboxItem, ChatOutboxStage } from '@/types/chat';
import { ChatImageBubble } from './ChatImageBubble';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'a h:mm', { locale: ko });
}

interface ServerBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  showSenderName: boolean;
  /** (S4) 신고 가능한 메시지일 때만 준다 */
  onLongPress?: (message: ChatMessage) => void;
}

const REPORT_A11Y_ACTIONS = [{ name: 'longpress', label: '신고하기' }];

/** 발신자 이름 + 본문(텍스트/사진) + 시각 — 감싸는 줄(길게 누르기 여부)과 분리 */
function ServerBubbleContent({ message, isMine, showSenderName, onLongPress }: ServerBubbleProps) {
  const deleted = message.deletedAt !== null;
  const isImage = message.kind === 'image' && !deleted && !!message.imagePath;
  const body = deleted ? '삭제된 메시지예요' : message.body;

  return (
    <>
      {showSenderName && !isMine ? (
        <Text className="mb-0.5 ml-1 text-xs text-content-muted dark:text-secondary-400">
          {message.senderDisplayName}
        </Text>
      ) : null}
      <View className={`max-w-[80%] flex-row items-end ${isMine ? 'flex-row-reverse' : ''}`}>
        {isImage ? (
          <ChatImageBubble
            imagePath={message.imagePath}
            width={message.imageWidth}
            height={message.imageHeight}
            isMine={isMine}
            onLongPress={onLongPress ? () => onLongPress(message) : undefined}
          />
        ) : (
          <View
            className={`rounded-2xl px-3 py-2 ${
              isMine
                ? 'rounded-br-sm bg-primary-500 dark:bg-primary-400'
                : 'rounded-bl-sm bg-secondary-100 dark:bg-surface-elevated'
            }`}
          >
            <Text
              selectable={!onLongPress}
              className={`text-base ${
                deleted
                  ? 'italic text-content-muted dark:text-secondary-400'
                  : isMine
                    ? 'text-content-onGold'
                    : 'text-content-primary dark:text-secondary-100'
              }`}
            >
              {body}
            </Text>
          </View>
        )}
        <Text className="mx-1.5 mb-0.5 text-[11px] text-content-muted dark:text-secondary-400">
          {timeLabel(message.createdAt)}
        </Text>
      </View>
    </>
  );
}

export const ChatServerBubble = memo(function ChatServerBubble({
  message,
  isMine,
  showSenderName,
  onLongPress,
}: ServerBubbleProps) {
  if (isChatNoticeMessage(message)) {
    return (
      <View className="my-2 items-center px-6">
        <Text className="text-center text-xs text-content-muted dark:text-secondary-400">
          {message.body}
        </Text>
      </View>
    );
  }

  const content = (
    <ServerBubbleContent
      message={message}
      isMine={isMine}
      showSenderName={showSenderName}
      onLongPress={onLongPress}
    />
  );
  const rowClass = `my-1 px-4 ${isMine ? 'items-end' : 'items-start'}`;
  const testID = `chat-bubble-${message.id}`;

  if (!onLongPress) {
    return (
      <View className={rowClass} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onLongPress={() => onLongPress(message)}
      delayLongPress={350}
      accessibilityHint="길게 누르면 신고할 수 있어요"
      accessibilityActions={REPORT_A11Y_ACTIONS}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress(message);
      }}
      className={rowClass}
      testID={testID}
    >
      {content}
    </Pressable>
  );
});

const STAGE_LABELS: Record<ChatOutboxStage, string> = {
  preparing: '사진 준비 중',
  uploading: '사진 올리는 중',
  sending: '보내는 중',
};

interface OutboxBubbleProps {
  item: ChatOutboxItem;
  onRetry: (clientMessageId: string) => void;
  onDiscard: (clientMessageId: string) => void;
}

export const ChatOutboxBubble = memo(function ChatOutboxBubble({
  item,
  onRetry,
  onDiscard,
}: OutboxBubbleProps) {
  const failed = item.status === 'failed';

  return (
    <View className="my-1 items-end px-4">
      <View className="max-w-[80%] flex-row-reverse items-end">
        {item.image ? (
          <ChatImageBubble
            localUri={item.image.localUri}
            width={item.image.width}
            height={item.image.height}
            isMine
            pendingLabel={
              item.status === 'sending' ? STAGE_LABELS[item.stage ?? 'sending'] : undefined
            }
          />
        ) : (
          <View
            className={`rounded-2xl rounded-br-sm px-3 py-2 ${
              failed
                ? 'border border-error-500 bg-error-50 dark:border-error-500 dark:bg-error-900/20'
                : 'bg-primary-500 opacity-70 dark:bg-primary-400'
            }`}
          >
            <Text
              className={`text-base ${
                failed ? 'text-content-primary dark:text-secondary-100' : 'text-content-onGold'
              }`}
            >
              {item.body}
            </Text>
          </View>
        )}
        {item.status === 'sending' && !item.image ? (
          <Text className="mx-1.5 mb-0.5 text-[11px] text-content-muted dark:text-secondary-400">
            보내는 중
          </Text>
        ) : null}
      </View>
      {failed ? (
        <View className="mt-1 flex-row items-center">
          <Text className="mr-2 text-xs text-error-600 dark:text-error-400">
            {item.errorMessage ?? '보내지 못했어요'}
          </Text>
          {item.retryable === false ? null : (
            <Pressable
              onPress={() => onRetry(item.clientMessageId)}
              accessibilityRole="button"
              accessibilityLabel="메시지 다시 보내기"
              hitSlop={8}
              className="mr-2 flex-row items-center"
            >
              <RefreshIcon size={14} color={STATUS_COLORS.error} />
              <Text className="ml-1 text-xs font-sans-semibold text-error-600 dark:text-error-400">
                재전송
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onDiscard(item.clientMessageId)}
            accessibilityRole="button"
            accessibilityLabel="보내지 못한 메시지 삭제"
            hitSlop={8}
          >
            <Text className="text-xs text-content-muted dark:text-secondary-400">삭제</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

/** "여기까지 읽었어요" 구분선 — 진입 시점 내 읽음 커서 기준 */
export function ChatUnreadDivider() {
  return (
    <View className="my-3 flex-row items-center px-4" accessibilityRole="text">
      <View className="h-px flex-1 bg-secondary-200 dark:bg-surface-overlay" />
      <Text className="mx-2 text-xs text-content-muted dark:text-secondary-400">
        여기부터 새 메시지
      </Text>
      <View className="h-px flex-1 bg-secondary-200 dark:bg-surface-overlay" />
    </View>
  );
}
