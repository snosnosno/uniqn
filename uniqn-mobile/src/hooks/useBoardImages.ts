import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleBoardImages } from '@/services/auth';
import { MAX_BOARD_POST_IMAGES, type BoardImageAttachment } from '@/types/board';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

interface UseBoardImagesOptions {
  initialImages?: BoardImageAttachment[];
}

export function useBoardImages({ initialImages = [] }: UseBoardImagesOptions = {}) {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const [images, setImages] = useState<BoardImageAttachment[]>(initialImages);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isUploading = uploadingIndex !== null;

  const handleAddImages = useCallback(async () => {
    if (!user || isUploading) return;

    const remainingSlots = MAX_BOARD_POST_IMAGES - images.length;
    if (remainingSlots <= 0) {
      addToast({
        type: 'warning',
        message: `?대?吏??理쒕? ${MAX_BOARD_POST_IMAGES}?κ퉴吏 泥⑤??????덉뒿?덈떎`,
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        addToast({ type: 'error', message: '?ъ쭊 ?묎렐 沅뚰븳???꾩슂?⑸땲??' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const selectedCount = result.assets.length;
      logger.info('Board image upload started', { uid: user.uid, count: selectedCount });

      const startIndex = images.length;
      setUploadingIndex(startIndex);
      setUploadProgress(0);

      const uris = result.assets.map((asset) => asset.uri);
      const uploadedImages = await uploadMultipleBoardImages(user.uid, uris, (index, progress) => {
        setUploadingIndex(startIndex + index);
        setUploadProgress(progress);
      });

      if (uploadedImages.length > 0) {
        setImages((prev) => {
          const nextImages = [...prev];
          uploadedImages.forEach((image, index) => {
            nextImages.push({
              ...image,
              order: prev.length + index,
            });
          });
          return nextImages;
        });

        if (uploadedImages.length === selectedCount) {
          addToast({
            type: 'success',
            message: `${uploadedImages.length}개의 이미지가 업로드됐습니다`,
          });
        } else {
          addToast({
            type: 'warning',
            message: `${uploadedImages.length}/${selectedCount}개 업로드 완료 (일부 실패)`,
          });
        }
      } else {
        addToast({ type: 'error', message: '이미지 업로드에 실패했습니다' });
      }
    } catch (error) {
      logger.error('Board image upload failed', error as Error);
      addToast({ type: 'error', message: '이미지 업로드에 실패했습니다' });
    } finally {
      setUploadingIndex(null);
      setUploadProgress(0);
    }
  }, [user, isUploading, images.length, addToast]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((image) => image.id !== id);
      return filtered.map((image, index) => ({ ...image, order: index }));
    });
  }, []);

  const handleReorderImages = useCallback((reorderedImages: BoardImageAttachment[]) => {
    setImages(reorderedImages);
  }, []);

  return {
    images,
    uploadingIndex,
    uploadProgress,
    isUploading,
    handleAddImages,
    handleRemoveImage,
    handleReorderImages,
  };
}
