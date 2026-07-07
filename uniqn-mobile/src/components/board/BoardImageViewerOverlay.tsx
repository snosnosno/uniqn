import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
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

        <SafeAreaView
          className="flex-1"
          edges={['top', 'bottom']}
          style={{ pointerEvents: 'box-none' }}
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
        </SafeAreaView>
      </View>
    </RNModal>
  );
}
