import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@/components/icons';
import type { BoardImageAttachment } from '@/types/board';

interface BoardImageViewerOverlayProps {
  visible: boolean;
  images: BoardImageAttachment[];
  currentIndex: number;
  onClose: () => void;
  onChangeIndex: (nextIndex: number) => void;
}

export function BoardImageViewerOverlay({
  visible,
  images,
  currentIndex,
  onClose,
  onChangeIndex,
}: BoardImageViewerOverlayProps) {
  // 조건부 early return 앞에서 호출해야 한다 (Rules of Hooks).
  const insets = useSafeAreaInsets();

  if (!visible || images.length === 0 || !images[currentIndex]) {
    return null;
  }

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;
  const activeImage = images[currentIndex];

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={StyleSheet.absoluteFillObject} className="bg-black/95">
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="이미지 뷰어 닫기"
        />

        <View
          className="flex-1"
          style={{
            pointerEvents: 'box-none',
            // SafeAreaView 는 RNModal 의 별도 윈도우를 자기 기준으로 측정해 인셋이
            // 0으로 떨어져 상단 닫기 버튼이 상태바와 겹친다 (2026-07-19).
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
            <View
              className="flex-row items-center justify-between px-4 py-3"
              style={{ pointerEvents: 'box-none' }}
            >
              <View style={{ pointerEvents: 'none' }}>
                <Text className="text-sm font-sans-medium text-white">
                  이미지 {currentIndex + 1} / {images.length}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="rounded-sm bg-white/10 p-2 active:bg-white/20"
                accessibilityRole="button"
                accessibilityLabel="이미지 닫기"
              >
                <XMarkIcon size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <View
              className="flex-1 flex-row items-center px-2 pb-4"
              style={{ pointerEvents: 'box-none' }}
            >
              {hasPrevious ? (
                <Pressable
                  onPress={() => onChangeIndex(currentIndex - 1)}
                  className="h-12 w-12 items-center justify-center rounded-sm bg-white/10 active:bg-white/20"
                  accessibilityRole="button"
                  accessibilityLabel="이전 이미지"
                >
                  <ChevronLeftIcon size={24} color="#FFFFFF" />
                </Pressable>
              ) : (
                <View className="h-12 w-12" style={{ pointerEvents: 'none' }} />
              )}

              <View
                className="mx-2 flex-1 items-center justify-center overflow-hidden rounded-lg"
                style={{ pointerEvents: 'none' }}
              >
                <Image
                  source={{ uri: activeImage.url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  placeholder={
                    activeImage.blurhash ? { blurhash: activeImage.blurhash } : undefined
                  }
                  placeholderContentFit="contain"
                  transition={200}
                />
              </View>

              {hasNext ? (
                <Pressable
                  onPress={() => onChangeIndex(currentIndex + 1)}
                  className="h-12 w-12 items-center justify-center rounded-sm bg-white/10 active:bg-white/20"
                  accessibilityRole="button"
                  accessibilityLabel="다음 이미지"
                >
                  <ChevronRightIcon size={24} color="#FFFFFF" />
                </Pressable>
              ) : (
                <View className="h-12 w-12" style={{ pointerEvents: 'none' }} />
              )}
            </View>
          </View>
        </View>
      </View>
    </RNModal>
  );
}
