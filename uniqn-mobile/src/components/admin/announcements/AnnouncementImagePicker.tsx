/**
 * UNIQN Mobile - 공지사항 다중 이미지 선택 컴포넌트
 *
 * @description 최대 10장의 이미지 선택/업로드/순서변경 지원
 * @version 2.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { AnnouncementImage } from '@/types';
import { MAX_ANNOUNCEMENT_IMAGES } from '@/types/announcement';

// ============================================================================
// Types
// ============================================================================

interface AnnouncementImagePickerProps {
  /** 현재 이미지 배열 */
  images: AnnouncementImage[];
  /** 업로드 중인 이미지 인덱스 */
  uploadingIndex: number | null;
  /** 업로드 진행률 (0-100) */
  uploadProgress: number;
  /** 이미지 추가 핸들러 */
  onAddImages: () => void;
  /** 이미지 삭제 핸들러 */
  onRemoveImage: (id: string) => void;
  /** 이미지 순서 변경 핸들러 */
  onReorderImages: (images: AnnouncementImage[]) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_GAP = 8;
const PADDING = 16;
const COLUMNS = 2;
const IMAGE_SIZE = (SCREEN_WIDTH - PADDING * 2 - IMAGE_GAP * (COLUMNS - 1)) / COLUMNS;

// ============================================================================
// Component
// ============================================================================

export function AnnouncementImagePicker({
  images,
  uploadingIndex,
  uploadProgress,
  onAddImages,
  onRemoveImage,
  onReorderImages,
  disabled = false,
}: AnnouncementImagePickerProps) {
  const isUploading = uploadingIndex !== null;
  const canAddMore = images.length < MAX_ANNOUNCEMENT_IMAGES && !isUploading && !disabled;

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<AnnouncementImage>) => {
      const isCurrentlyUploading = uploadingIndex !== null && item.id === `uploading-${uploadingIndex}`;

      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={disabled ? undefined : drag}
            disabled={isActive || disabled}
            style={{
              width: IMAGE_SIZE,
              height: IMAGE_SIZE,
              marginRight: IMAGE_GAP,
              marginBottom: IMAGE_GAP,
              opacity: isActive ? 0.8 : 1,
            }}
          >
            <View
              className={`w-full h-full rounded-xl overflow-hidden border-2 ${
                isActive
                  ? 'border-primary-500'
                  : 'border-gray-200 dark:border-surface-overlay'
              }`}
            >
              {/* 이미지 */}
              <Image
                source={{ uri: item.url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />

              {/* 업로드 중 오버레이 */}
              {isCurrentlyUploading && (
                <View className="absolute inset-0 bg-black/50 items-center justify-center">
                  <ActivityIndicator color="#fff" size="small" />
                  <Text className="text-white text-xs mt-1">{uploadProgress}%</Text>
                </View>
              )}

              {/* 삭제 버튼 */}
              {!disabled && !isCurrentlyUploading && (
                <Pressable
                  onPress={() => onRemoveImage(item.id)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>
              )}

              {/* 순서 표시 */}
              <View className="absolute bottom-1 left-1 bg-black/60 rounded-full px-2 py-0.5">
                <Text className="text-white text-xs font-medium">{item.order + 1}</Text>
              </View>
            </View>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [uploadingIndex, uploadProgress, onRemoveImage, disabled]
  );

  // 순서 변경 핸들러
  const handleDragEnd = useCallback(
    ({ data }: { data: AnnouncementImage[] }) => {
      // order 값 재할당
      const reorderedImages = data.map((img, index) => ({
        ...img,
        order: index,
      }));
      onReorderImages(reorderedImages);
    },
    [onReorderImages]
  );

  return (
    <View className="w-full">
      {/* 안내 텍스트 */}
      <View className="mb-3 px-1">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {images.length}/{MAX_ANNOUNCEMENT_IMAGES}장 · 권장 1200x675px (16:9)
        </Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          자동으로 1200px로 리사이징 · 최대 5MB · 길게 눌러 순서 변경
        </Text>
      </View>

      {/* 이미지가 있을 때: 그리드 + 추가 버튼 */}
      {images.length > 0 ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <DraggableFlatList
            data={images}
            onDragEnd={handleDragEnd}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={COLUMNS}
            scrollEnabled={false}
            activationDistance={10}
            ListFooterComponent={
              canAddMore ? (
                <Pressable
                  onPress={onAddImages}
                  style={{
                    width: IMAGE_SIZE,
                    height: IMAGE_SIZE,
                    marginBottom: IMAGE_GAP,
                  }}
                  className="rounded-xl border-2 border-dashed border-gray-300 dark:border-surface-overlay items-center justify-center bg-gray-50 dark:bg-surface/50 active:bg-gray-100 dark:active:bg-gray-700"
                >
                  <Ionicons name="add" size={32} color="#9CA3AF" />
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    이미지 추가
                  </Text>
                </Pressable>
              ) : null
            }
          />
        </GestureHandlerRootView>
      ) : (
        /* 이미지가 없을 때: 업로드 영역 */
        <Pressable
          onPress={onAddImages}
          disabled={disabled || isUploading}
          className={`
            w-full h-40 rounded-xl border-2 border-dashed
            items-center justify-center
            ${
              disabled || isUploading
                ? 'bg-gray-100 dark:bg-surface border-gray-300 dark:border-surface-overlay'
                : 'bg-gray-50 dark:bg-surface/50 border-gray-300 dark:border-surface-overlay active:bg-gray-100 dark:active:bg-gray-700'
            }
          `}
          accessibilityLabel="이미지 선택"
        >
          {isUploading ? (
            <View className="items-center">
              <ActivityIndicator size="large" color="#A855F7" />
              <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                업로드 중... {uploadProgress}%
              </Text>
            </View>
          ) : (
            <View className="items-center">
              <View className="w-14 h-14 rounded-full bg-gray-200 dark:bg-surface items-center justify-center mb-2">
                <Ionicons name="images-outline" size={28} color="#9CA3AF" />
              </View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                이미지를 선택하세요
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                최대 {MAX_ANNOUNCEMENT_IMAGES}장 · JPG, PNG
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {/* 업로드 진행률 바 */}
      {isUploading && uploadProgress > 0 && (
        <View className="mt-2">
          <View className="h-1.5 bg-gray-200 dark:bg-surface rounded-full overflow-hidden">
            <View
              className="h-full bg-primary-600 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

export default AnnouncementImagePicker;
