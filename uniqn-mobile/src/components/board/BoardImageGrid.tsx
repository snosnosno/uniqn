import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { BoardImageAttachment } from '@/types/board';

interface BoardImageGridProps {
  images: BoardImageAttachment[];
  onPressImage?: (index: number) => void;
}

export type BoardImageLayoutVariant = 'single' | 'double' | 'grid';

export function getBoardImageLayoutVariant(imageCount: number): BoardImageLayoutVariant {
  if (imageCount <= 1) {
    return 'single';
  }

  if (imageCount === 2) {
    return 'double';
  }

  return 'grid';
}

function getImageAccessibilityLabel(index: number, totalCount: number): string {
  if (totalCount <= 1) {
    return '이미지 보기';
  }

  return `${index + 1}번째 이미지 보기`;
}

function getImageAccessibilityHint(index: number, totalCount: number): string {
  if (totalCount <= 1) {
    return '누르면 전체 화면 이미지 뷰어가 열립니다.';
  }

  return `총 ${totalCount}장 중 ${index + 1}번째 이미지입니다. 누르면 전체 화면 이미지 뷰어가 열립니다.`;
}

interface ImageCellProps {
  image: BoardImageAttachment;
  index: number;
  totalCount: number;
  onPressImage?: (index: number) => void;
  className?: string;
  aspectRatio: number;
}

function ImageCell({
  image,
  index,
  totalCount,
  onPressImage,
  className,
  aspectRatio,
}: ImageCellProps) {
  return (
    <Pressable
      onPress={() => onPressImage?.(index)}
      className={className}
      disabled={!onPressImage}
      accessibilityRole={onPressImage ? 'button' : undefined}
      accessibilityLabel={onPressImage ? getImageAccessibilityLabel(index, totalCount) : undefined}
      accessibilityHint={onPressImage ? getImageAccessibilityHint(index, totalCount) : undefined}
      accessible={Boolean(onPressImage)}
    >
      <Image
        source={{ uri: image.url }}
        style={{ width: '100%', aspectRatio, borderRadius: 16 }}
        contentFit="cover"
        transition={200}
      />
      {totalCount > 1 ? (
        <View className="absolute bottom-2 right-2 rounded-sm bg-black/60 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-white">
            {index + 1}/{totalCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function BoardImageGrid({ images, onPressImage }: BoardImageGridProps) {
  if (images.length === 0) {
    return null;
  }

  const layout = getBoardImageLayoutVariant(images.length);

  if (layout === 'single') {
    return (
      <View className="mt-4">
        <ImageCell
          image={images[0]}
          index={0}
          totalCount={1}
          onPressImage={onPressImage}
          aspectRatio={1.15}
        />
      </View>
    );
  }

  if (layout === 'double') {
    return (
      <View className="mt-4 flex-row" style={{ marginHorizontal: -4 }}>
        {images.map((image, index) => (
          <ImageCell
            key={image.id}
            image={image}
            index={index}
            totalCount={images.length}
            onPressImage={onPressImage}
            className="w-1/2 p-1"
            aspectRatio={1.05}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="mt-4 flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
      {images.map((image, index) => (
        <ImageCell
          key={image.id}
          image={image}
          index={index}
          totalCount={images.length}
          onPressImage={onPressImage}
          className="w-1/3 p-1"
          aspectRatio={1}
        />
      ))}
    </View>
  );
}

export default BoardImageGrid;
