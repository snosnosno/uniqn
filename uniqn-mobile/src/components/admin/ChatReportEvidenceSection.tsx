/**
 * (S4) 관리자 신고 상세 — 채팅 신고 증거(스냅샷)
 *
 * - 스냅샷은 신고 시점에 서버가 DB 에서 떠 둔 것이다(관리자는 `chat_messages` 를 직접 못 읽는다).
 * - 사진은 `imagePaths` 에 있는 경로만 `chat-media` 서명 URL 로 읽는다 — 서버 `chat_media_can_read`
 *   가 관리자에게 허용하는 범위와 같다. 목록에 없는 경로는 요청하지 않는다.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { ChatBubbleLeftIcon } from '@/components/icons';
import { useChatMediaUrl } from '@/hooks/chat/useChatMediaUrl';
import { CHAT_REPORT_REASON_LABELS, CHAT_REPORT_REASONS } from '@/constants/chat';
import { PRIMARY_COLORS } from '@/constants/colors';
import type { ChatReportEvidence, ChatReportEvidenceMessage } from '@/types/report';

const SIDE_LABELS: Record<ChatReportEvidenceMessage['senderSide'], string> = {
  seeker: '구직자',
  employer: '구인자',
  system: '시스템',
};

function reasonLabel(reason: string): string {
  return (CHAT_REPORT_REASONS as readonly string[]).includes(reason)
    ? CHAT_REPORT_REASON_LABELS[reason as keyof typeof CHAT_REPORT_REASON_LABELS]
    : reason;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'M월 d일 HH:mm', { locale: ko });
}

function EvidenceImage({
  message,
  allowed,
}: {
  message: ChatReportEvidenceMessage;
  allowed: boolean;
}) {
  const { url, isError } = useChatMediaUrl(allowed ? message.imagePath : null);
  if (!allowed || isError) {
    return (
      <Text className="text-xs italic text-content-muted dark:text-secondary-400">
        사진을 볼 수 없어요
      </Text>
    );
  }
  if (!url)
    return <View className="h-40 w-40 rounded-md bg-secondary-100 dark:bg-surface-elevated" />;
  return (
    <Image
      source={{ uri: url, cacheKey: message.imagePath ?? undefined }}
      style={{ width: 160, height: 160, borderRadius: 6 }}
      contentFit="cover"
      transition={0}
      accessibilityLabel="신고 증거 사진"
      testID={`chat-evidence-image-${message.id}`}
    />
  );
}

function EvidenceMessage({
  message,
  imageAllowed,
}: {
  message: ChatReportEvidenceMessage;
  imageAllowed: boolean;
}) {
  const side = SIDE_LABELS[message.senderSide];
  const a11y = `${message.reported ? '신고된 메시지, ' : ''}${message.senderDisplayName}(${side})`;
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      testID={`chat-evidence-${message.id}`}
      className={`mb-2 rounded-md p-3 ${
        message.reported
          ? 'border border-error-500 bg-error-50 dark:border-error-500 dark:bg-error-900/20'
          : 'bg-secondary-50 dark:bg-surface-elevated'
      }`}
    >
      <View className="mb-1 flex-row items-center">
        <Text className="text-xs font-sans-semibold text-content-primary dark:text-off-white">
          {message.senderDisplayName}
        </Text>
        <Text className="ml-1 text-xs text-content-muted dark:text-secondary-400">
          · {side} · {timeLabel(message.createdAt)}
        </Text>
        {message.reported ? (
          <Text className="ml-auto text-xs font-sans-bold text-error-600 dark:text-error-400">
            신고된 메시지
          </Text>
        ) : null}
      </View>
      {message.kind === 'image' && message.imagePath ? (
        <EvidenceImage message={message} allowed={imageAllowed} />
      ) : (
        <Text className="text-sm text-content-secondary dark:text-secondary-300" selectable>
          {message.body || '(내용 없음)'}
        </Text>
      )}
    </View>
  );
}

export function ChatReportEvidenceSection({ snapshot }: { snapshot: ChatReportEvidence }) {
  const allowedPaths = new Set(snapshot.imagePaths);
  return (
    <View className="mx-4 mb-4 rounded-md bg-surface-card p-4 dark:bg-surface">
      <View className="mb-3 flex-row items-center">
        <ChatBubbleLeftIcon size={18} color={PRIMARY_COLORS[500]} />
        <Text className="ml-2 text-micro font-sans-bold uppercase tracking-wider text-content-muted dark:text-secondary-400">
          채팅 신고 증거
        </Text>
      </View>
      <View className="mb-3">
        <Text className="mb-1 text-xs text-content-secondary dark:text-secondary-300">
          신고 사유
        </Text>
        <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
          {reasonLabel(snapshot.reason)}
        </Text>
      </View>
      <View className="mb-3">
        <Text className="mb-1 text-xs text-content-secondary dark:text-secondary-300">공고</Text>
        <Text className="text-sm text-content-primary dark:text-off-white">
          {snapshot.postingTitle}
        </Text>
      </View>
      <Text className="mb-2 text-xs text-content-secondary dark:text-secondary-300">
        신고 시점 대화 (최근 {snapshot.messages.length}개)
      </Text>
      {snapshot.messages.map((message) => (
        <EvidenceMessage
          key={message.id}
          message={message}
          imageAllowed={!!message.imagePath && allowedPaths.has(message.imagePath)}
        />
      ))}
    </View>
  );
}
