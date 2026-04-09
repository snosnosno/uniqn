import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { XMarkIcon } from '@/components/icons';
import type { BoardImageAttachment } from '@/types/board';

interface BoardDraftImageStripProps {
  images: BoardImageAttachment[];
  onRemoveImage: (imageId: string) => void;
}

function getRemoveImageAccessibilityLabel(index: number, totalCount: number): string {
  if (totalCount <= 1) {
    return '첨부 이미지 삭제';
  }

  return `${index + 1}번째 첨부 이미지 삭제`;
}

function getRemoveImageAccessibilityHint(index: number, totalCount: number): string {
  if (totalCount <= 1) {
    return '탭하면 업로드할 이미지 목록에서 제거됩니다';
  }

  return `총 ${totalCount}장 중 ${index + 1}번째 이미지입니다. 탭하면 업로드할 이미지 목록에서 제거됩니다`;
}

export function BoardDraftImageStrip({ images, onRemoveImage }: BoardDraftImageStripProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
      <View className="flex-row gap-3">
        {images.map((image, index) => (
          <View key={image.id} className="relative">
            <Image
              source={{ uri: image.url }}
              style={{ width: 88, height: 88, borderRadius: 12 }}
              contentFit="cover"
            />
            <Pressable
              onPress={() => onRemoveImage(image.id)}
              className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1"
              accessibilityRole="button"
              accessibilityLabel={getRemoveImageAccessibilityLabel(index, images.length)}
              accessibilityHint={getRemoveImageAccessibilityHint(index, images.length)}
            >
              <XMarkIcon size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default BoardDraftImageStrip;
