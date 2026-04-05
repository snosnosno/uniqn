import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { BoardImageAttachment } from '@/types/board';

interface BoardImageGridProps {
  images: BoardImageAttachment[];
  onPressImage?: (index: number) => void;
}

export function BoardImageGrid({ images, onPressImage }: BoardImageGridProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <View className="mt-3 flex-row flex-wrap" style={{ margin: -4 }}>
      {images.map((image, index) => (
        <Pressable
          key={image.id}
          onPress={() => onPressImage?.(index)}
          className="w-1/3 p-1"
          disabled={!onPressImage}
        >
          <Image
            source={{ uri: image.url }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
            contentFit="cover"
            transition={200}
          />
          {images.length > 1 ? (
            <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-white">
                {index + 1}/{images.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export default BoardImageGrid;
