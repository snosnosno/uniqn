import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { AddIcon, ImagesOutlineIcon, XMarkIcon } from '@/components/icons';
import { MAX_BOARD_POST_IMAGES, type BoardImageAttachment } from '@/types/board';

interface BoardImagePickerProps {
  images: BoardImageAttachment[];
  uploadingIndex: number | null;
  uploadProgress: number;
  onAddImages: () => void;
  onRemoveImage: (id: string) => void;
  disabled?: boolean;
}

const GRID_GAP = 8;
const GRID_COLUMNS = 3;
const GRID_FALLBACK_SIDE_PADDING = 32;
const MAX_TILE_SIZE = 120;
const MIN_TILE_SIZE = 84;

function getTileStyle(index: number, size: number) {
  return {
    width: size,
    height: size,
    marginRight: index % GRID_COLUMNS === GRID_COLUMNS - 1 ? 0 : GRID_GAP,
    marginBottom: GRID_GAP,
  };
}

export function getBoardImagePickerTileSize(containerWidth: number): number {
  if (containerWidth <= 0) {
    return MIN_TILE_SIZE;
  }

  const rawTileSize = (containerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  return Math.min(Math.max(rawTileSize, MIN_TILE_SIZE), MAX_TILE_SIZE);
}

export function BoardImagePicker({
  images,
  uploadingIndex,
  uploadProgress,
  onAddImages,
  onRemoveImage,
  disabled = false,
}: BoardImagePickerProps) {
  const { width } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);
  const isUploading = uploadingIndex !== null;
  const canAddMore = images.length < MAX_BOARD_POST_IMAGES && !disabled && !isUploading;
  const containerWidth =
    gridWidth > 0 ? gridWidth : Math.max(width - GRID_FALLBACK_SIDE_PADDING, MIN_TILE_SIZE);
  const tileSize = getBoardImagePickerTileSize(containerWidth);

  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setGridWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth));
  }, []);

  return (
    <View className="w-full">
      <View className="mb-3 px-1">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {images.length}/{MAX_BOARD_POST_IMAGES}장
        </Text>
        <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          커뮤니티 글에 첨부할 이미지를 선택하세요.
        </Text>
      </View>

      <View className="flex-row flex-wrap" onLayout={handleGridLayout}>
        {images.map((image, index) => (
          <View key={image.id} style={getTileStyle(index, tileSize)} className="relative">
            <Image
              source={{ uri: image.url }}
              style={{ width: tileSize, height: tileSize, borderRadius: 16 }}
              contentFit="cover"
              transition={200}
            />
            <Pressable
              onPress={() => onRemoveImage(image.id)}
              className="absolute right-1 top-1 rounded-sm bg-black/70 p-1.5 active:bg-black/85"
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`첨부 이미지 ${index + 1} 삭제`}
            >
              <XMarkIcon size={14} color="#FFFFFF" />
            </Pressable>
            <View className="absolute bottom-1 left-1 rounded-sm bg-black/60 px-2 py-0.5">
              <Text className="text-xs font-medium text-white">{index + 1}</Text>
            </View>
          </View>
        ))}

        {(canAddMore || isUploading) && (
          <Pressable
            onPress={onAddImages}
            disabled={!canAddMore}
            style={getTileStyle(images.length, tileSize)}
            className={`items-center justify-center rounded-lg border border-dashed ${
              canAddMore
                ? 'border-gray-300 bg-gray-50 active:bg-gray-100 dark:border-surface-overlay dark:bg-surface/60 dark:active:bg-surface-elevated'
                : 'border-gray-300 bg-gray-100 dark:border-surface-overlay dark:bg-surface'
            }`}
            accessibilityRole="button"
            accessibilityLabel="게시글 이미지 추가"
          >
            {isUploading ? (
              <View className="items-center px-2">
                <ActivityIndicator size="small" color="#6366F1" />
                <Text className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                  업로드 중
                </Text>
                <Text className="mt-0.5 text-center text-xs font-medium text-primary-600 dark:text-primary-400">
                  {uploadProgress}%
                </Text>
              </View>
            ) : (
              <View className="items-center px-2">
                <View className="mb-2 rounded-sm bg-gray-200 p-3 dark:bg-surface-elevated">
                  <ImagesOutlineIcon size={20} color="#9CA3AF" />
                </View>
                <AddIcon size={18} color="#6B7280" />
                <Text className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                  추가
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default BoardImagePicker;
