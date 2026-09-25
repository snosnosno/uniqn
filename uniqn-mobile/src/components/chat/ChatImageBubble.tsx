/**
 * 채팅 사진 말풍선 — 서버 사진(서명 URL) 또는 아직 올라가는 중인 내 사진(로컬 uri)
 *
 * - 크기: 원본 비율을 지킨 상자에 담는다(image_width/height). 레이아웃이 로드 뒤 튀지 않는다.
 * - 캐시: expo-image cacheKey = image_path. 서명 URL 은 5분마다 바뀌지만 같은 사진을 다시 받지 않는다.
 * - 누르면 전체화면 뷰어.
 */
import React, { memo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useChatMediaUrl } from '@/hooks/chat/useChatMediaUrl';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { ChatImageViewer } from './ChatImageViewer';

const MAX_WIDTH = 220;
const MAX_HEIGHT = 280;
const MIN_SIDE = 96;

/** 비율을 지키며 최대 상자 안에 맞춘다. 크기를 모르면 정사각형 */
export function chatImageBoxSize(width: number | null, height: number | null) {
  if (!width || !height) return { width: MAX_WIDTH * 0.8, height: MAX_WIDTH * 0.8 };
  const ratio = width / height;
  if (ratio >= MAX_WIDTH / MAX_HEIGHT) {
    return { width: MAX_WIDTH, height: Math.max(MIN_SIDE, Math.round(MAX_WIDTH / ratio)) };
  }
  return { width: Math.max(MIN_SIDE, Math.round(MAX_HEIGHT * ratio)), height: MAX_HEIGHT };
}

interface ChatImageBubbleProps {
  /** 서버에 올라간 사진 경로 — localUri 가 없을 때 서명 URL 로 보인다 */
  imagePath?: string | null;
  /** 보내는 중인 내 사진(원본) */
  localUri?: string;
  width: number | null;
  height: number | null;
  isMine: boolean;
  /** "사진 올리는 중" 등 진행 표시 */
  pendingLabel?: string;
  /** (S4) 신고 — 사진은 자체 Pressable 이 터치를 잡으므로 말풍선 줄 대신 여기서 받는다 */
  onLongPress?: () => void;
}

export const ChatImageBubble = memo(function ChatImageBubble({
  imagePath = null,
  localUri,
  width,
  height,
  isMine,
  pendingLabel,
  onLongPress,
}: ChatImageBubbleProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const { url, isError } = useChatMediaUrl(localUri ? null : imagePath);
  const source = localUri
    ? { uri: localUri }
    : url && imagePath
      ? { uri: url, cacheKey: imagePath }
      : null;
  const box = chatImageBoxSize(width, height);

  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        onLongPress={onLongPress}
        disabled={!source && !onLongPress}
        accessibilityRole="imagebutton"
        accessibilityLabel="사진 크게 보기"
        style={box}
        className={`overflow-hidden rounded-2xl bg-secondary-100 dark:bg-surface-elevated ${
          isMine ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
      >
        {source ? (
          <Image
            source={source}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
            transition={0}
            accessibilityIgnoresInvertColors
            testID="chat-image"
          />
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-2">
            <Text className="text-center text-xs text-content-muted dark:text-secondary-400">
              사진을 불러오지 못했어요
            </Text>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={SECONDARY_PALETTE[400]} />
          </View>
        )}
        {pendingLabel ? (
          <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 dark:bg-black/60">
            <Text className="text-center text-[11px] text-white dark:text-white">
              {pendingLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {viewerOpen ? (
        <ChatImageViewer visible source={source} onClose={() => setViewerOpen(false)} />
      ) : null}
    </>
  );
});
