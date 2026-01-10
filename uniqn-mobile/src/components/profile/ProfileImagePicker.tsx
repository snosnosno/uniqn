/**
 * UNIQN Mobile - 프로필 이미지 선택 컴포넌트
 *
 * @description expo-image-picker를 사용한 프로필 사진 선택/업로드
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@/components/ui';
import { CameraIcon, TrashIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { replaceProfileImage, deleteProfileImage, updateProfilePhotoURL } from '@/services';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ProfileImagePickerProps {
  /** 현재 이미지 URL */
  currentImageUrl?: string | null;
  /** 이미지가 없을 때 표시할 이름 (이니셜 생성용) */
  name?: string;
  /** 아바타 크기 */
  size?: 'md' | 'lg' | 'xl';
  /** 이미지 업데이트 콜백 */
  onImageUpdated?: (imageUrl: string | null) => void;
  /** 편집 비활성화 */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ProfileImagePicker({
  currentImageUrl,
  name,
  size = 'xl',
  onImageUpdated,
  disabled = false,
}: ProfileImagePickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { user, profile, setProfile } = useAuthStore();
  const { addToast } = useToastStore();

  /**
   * 이미지 선택 및 업로드
   */
  const pickImage = useCallback(async () => {
    if (!user || disabled) return;

    try {
      // 권한 요청
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        addToast({ type: 'error', message: '사진 접근 권한이 필요합니다' });
        return;
      }

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploading(true);
      logger.info('프로필 이미지 업로드 시작', { uid: user.uid });

      // 1. 이미지 업로드 및 이전 이미지 삭제
      const newImageUrl = await replaceProfileImage(
        user.uid,
        result.assets[0].uri,
        currentImageUrl
      );

      // 2. 프로필 URL 업데이트
      await updateProfilePhotoURL(user.uid, newImageUrl);

      // 3. 로컬 상태 업데이트
      if (profile) {
        setProfile({ ...profile, photoURL: newImageUrl });
      }

      addToast({ type: 'success', message: '프로필 사진이 변경되었습니다' });
      onImageUpdated?.(newImageUrl);
    } catch (error) {
      logger.error('프로필 이미지 업로드 실패', error as Error);
      addToast({ type: 'error', message: '이미지 업로드에 실패했습니다' });
    } finally {
      setIsUploading(false);
    }
  }, [user, profile, currentImageUrl, disabled, addToast, setProfile, onImageUpdated]);

  /**
   * 이미지 삭제
   */
  const removeImage = useCallback(async () => {
    if (!user || !currentImageUrl || disabled) return;

    Alert.alert(
      '프로필 사진 삭제',
      '프로필 사진을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setIsUploading(true);
            try {
              // 1. Storage에서 삭제
              await deleteProfileImage(currentImageUrl);

              // 2. 프로필 URL null로 업데이트
              await updateProfilePhotoURL(user.uid, null);

              // 3. 로컬 상태 업데이트
              if (profile) {
                setProfile({ ...profile, photoURL: undefined });
              }

              addToast({ type: 'success', message: '프로필 사진이 삭제되었습니다' });
              onImageUpdated?.(null);
            } catch (error) {
              logger.error('프로필 이미지 삭제 실패', error as Error);
              addToast({ type: 'error', message: '이미지 삭제에 실패했습니다' });
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  }, [user, profile, currentImageUrl, disabled, addToast, setProfile, onImageUpdated]);

  /**
   * 옵션 선택 (업로드 or 삭제)
   */
  const showOptions = useCallback(() => {
    if (disabled || isUploading) return;

    if (currentImageUrl) {
      Alert.alert(
        '프로필 사진',
        '원하는 작업을 선택하세요',
        [
          { text: '취소', style: 'cancel' },
          { text: '사진 변경', onPress: pickImage },
          { text: '사진 삭제', onPress: removeImage, style: 'destructive' },
        ]
      );
    } else {
      pickImage();
    }
  }, [currentImageUrl, disabled, isUploading, pickImage, removeImage]);

  return (
    <View className="items-center">
      <Pressable
        onPress={showOptions}
        disabled={disabled || isUploading}
        className="relative"
        accessibilityLabel="프로필 사진 변경"
        accessibilityRole="button"
      >
        <Avatar
          source={currentImageUrl ?? undefined}
          name={name}
          size={size}
        />

        {/* 카메라 아이콘 오버레이 */}
        <View
          className={`absolute bottom-0 right-0 items-center justify-center rounded-full p-2 ${
            disabled ? 'bg-gray-400' : 'bg-primary-600'
          }`}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <CameraIcon size={16} color="white" />
          )}
        </View>
      </Pressable>

      {/* 삭제 버튼 (이미지가 있고 업로드 중이 아닐 때만) */}
      {currentImageUrl && !isUploading && !disabled && (
        <Pressable
          onPress={removeImage}
          className="mt-3 flex-row items-center"
          accessibilityLabel="프로필 사진 삭제"
        >
          <TrashIcon size={14} color="#EF4444" />
          <Text className="ml-1 text-sm text-error-600 dark:text-error-400">
            사진 삭제
          </Text>
        </Pressable>
      )}

      {/* 업로드 중 안내 */}
      {isUploading && (
        <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          업로드 중...
        </Text>
      )}
    </View>
  );
}
