/**
 * 채팅 사진 전체화면 뷰어 — 닫기만(핀치 줌은 후속)
 *
 * 배경은 사진 감상용이라 라이트/다크 모두 검정이다.
 */
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XMarkIcon } from '@/components/icons';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface ChatImageViewerProps {
  visible: boolean;
  source: { uri: string; cacheKey?: string } | null;
  onClose: () => void;
}

const VIEWER_ICON_COLOR = '#FFFFFF';

export function ChatImageViewer({ visible, source, onClose }: ChatImageViewerProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View testID="chat-image-viewer" className="flex-1 bg-black dark:bg-black">
        {source ? (
          <Image
            source={source}
            contentFit="contain"
            style={{ flex: 1 }}
            accessibilityLabel="사진"
            testID="chat-image-viewer-image"
          />
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="사진 닫기"
          hitSlop={12}
          style={{ top: insets.top + 12 }}
          className="absolute right-4 h-10 w-10 items-center justify-center rounded-full bg-black/50 dark:bg-black/50"
        >
          <XMarkIcon size={22} color={VIEWER_ICON_COLOR} />
        </Pressable>
      </View>
    </Modal>
  );
}
