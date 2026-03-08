/**
 * UNIQN Mobile - 공지사항 이미지 관리 Hook
 *
 * @description AnnouncementForm에서 이미지 업로드/삭제/재정렬 로직을 분리
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleAnnouncementImages } from '@/services/auth';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { MAX_ANNOUNCEMENT_IMAGES } from '@/types/announcement';
import type { AnnouncementImage } from '@/types';

interface UseAnnouncementImagesOptions {
  initialImages?: AnnouncementImage[];
  /** 레거시 단일 이미지 호환성 */
  legacyImageUrl?: string | null;
  legacyStoragePath?: string | null;
}

export function useAnnouncementImages({
  initialImages,
  legacyImageUrl,
  legacyStoragePath,
}: UseAnnouncementImagesOptions = {}) {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const [images, setImages] = useState<AnnouncementImage[]>(() => {
    if (initialImages && initialImages.length > 0) {
      return initialImages;
    }
    if (legacyImageUrl) {
      return [
        {
          id: 'legacy-0',
          url: legacyImageUrl,
          storagePath: legacyStoragePath ?? '',
          order: 0,
        },
      ];
    }
    return [];
  });
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isUploading = uploadingIndex !== null;

  const handleAddImages = useCallback(async () => {
    if (!user || isUploading) return;

    const remainingSlots = MAX_ANNOUNCEMENT_IMAGES - images.length;
    if (remainingSlots <= 0) {
      addToast({
        type: 'warning',
        message: `이미지는 최대 ${MAX_ANNOUNCEMENT_IMAGES}장까지 첨부할 수 있습니다`,
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        addToast({ type: 'error', message: '사진 접근 권한이 필요합니다' });
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
      logger.info('공지사항 이미지 업로드 시작', { uid: user.uid, count: selectedCount });

      const startIndex = images.length;
      setUploadingIndex(startIndex);
      setUploadProgress(0);

      const uris = result.assets.map((asset) => asset.uri);
      const uploadedImages = await uploadMultipleAnnouncementImages(
        user.uid,
        uris,
        (index, progress) => {
          setUploadingIndex(startIndex + index);
          setUploadProgress(progress);
        }
      );

      if (uploadedImages.length > 0) {
        setImages((prev) => {
          const newImages = [...prev];
          uploadedImages.forEach((img, idx) => {
            newImages.push({
              ...img,
              order: prev.length + idx,
            });
          });
          return newImages;
        });

        if (uploadedImages.length === selectedCount) {
          addToast({
            type: 'success',
            message: `${uploadedImages.length}장의 이미지가 업로드되었습니다`,
          });
        } else {
          addToast({
            type: 'warning',
            message: `${uploadedImages.length}/${selectedCount}장 업로드 완료 (일부 실패)`,
          });
        }
      } else {
        addToast({ type: 'error', message: '이미지 업로드에 실패했습니다' });
      }
    } catch (error) {
      logger.error('공지사항 이미지 업로드 실패', error as Error);
      addToast({ type: 'error', message: '이미지 업로드에 실패했습니다' });
    } finally {
      setUploadingIndex(null);
      setUploadProgress(0);
    }
  }, [user, isUploading, images.length, addToast]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      return filtered.map((img, index) => ({ ...img, order: index }));
    });
  }, []);

  const handleReorderImages = useCallback((reorderedImages: AnnouncementImage[]) => {
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
