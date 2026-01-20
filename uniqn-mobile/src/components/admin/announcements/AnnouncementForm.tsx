/**
 * UNIQN Mobile - 공지사항 작성/수정 폼 컴포넌트
 *
 * @description 관리자용 공지사항 작성 폼 (다중 이미지 지원)
 * @version 2.0.0
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { z } from 'zod';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { createAnnouncementSchema } from '@/schemas/announcement.schema';
import { uploadMultipleAnnouncementImages } from '@/services/storageService';
import { AnnouncementImagePicker } from './AnnouncementImagePicker';
import { logger } from '@/utils/logger';
import type {
  CreateAnnouncementInput,
  AnnouncementCategory,
  AnnouncementPriority,
  TargetAudience,
  AnnouncementImage,
} from '@/types';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITY_LABELS,
  MAX_ANNOUNCEMENT_IMAGES,
} from '@/types/announcement';
import type { UserRole } from '@/types/common';

interface AnnouncementFormProps {
  initialData?: Partial<CreateAnnouncementInput> & {
    imageUrl?: string | null;
    imageStoragePath?: string | null;
    images?: AnnouncementImage[];
  };
  onSubmit: (data: CreateAnnouncementInput) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

export function AnnouncementForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  onCancel,
  submitLabel = '저장',
}: AnnouncementFormProps) {
  const { isDarkMode } = useThemeStore();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  // Form State
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [category, setCategory] = useState<AnnouncementCategory | ''>(
    initialData?.category ?? ''
  );
  const [priority, setPriority] = useState<AnnouncementPriority>(
    initialData?.priority ?? 0
  );
  const [isPinned, setIsPinned] = useState(initialData?.isPinned ?? false);
  const [targetType, setTargetType] = useState<'all' | 'roles'>(
    initialData?.targetAudience?.type ?? 'all'
  );
  const [targetRoles, setTargetRoles] = useState<UserRole[]>(
    initialData?.targetAudience?.roles ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Image State (다중 이미지)
  const [images, setImages] = useState<AnnouncementImage[]>(() => {
    // 기존 images 배열 또는 단일 imageUrl 호환성 처리
    if (initialData?.images && initialData.images.length > 0) {
      return initialData.images;
    }
    if (initialData?.imageUrl) {
      return [{
        id: 'legacy-0',
        url: initialData.imageUrl,
        storagePath: initialData.imageStoragePath ?? '',
        order: 0,
      }];
    }
    return [];
  });
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Validation
  const validateField = useCallback((field: string, value: unknown) => {
    try {
      if (field === 'title') {
        createAnnouncementSchema.shape.title.parse(value);
      } else if (field === 'content') {
        createAnnouncementSchema.shape.content.parse(value);
      }
      setErrors((prev) => ({ ...prev, [field]: '' }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [field]: error.issues[0]?.message || '',
        }));
      }
    }
  }, []);

  // Toggle role selection
  const toggleRole = useCallback((role: UserRole) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }, []);

  // Category selection handler
  const handleCategorySelect = useCallback((cat: AnnouncementCategory) => {
    setCategory(cat);
  }, []);

  // Priority selection handler
  const handlePrioritySelect = useCallback((p: AnnouncementPriority) => {
    setPriority(p);
  }, []);

  // Target type handlers
  const handleTargetTypeAll = useCallback(() => {
    setTargetType('all');
  }, []);

  const handleTargetTypeRoles = useCallback(() => {
    setTargetType('roles');
  }, []);

  // Image Add Handler (다중 선택 지원)
  const handleAddImages = useCallback(async () => {
    if (!user || uploadingIndex !== null) return;

    // 추가 가능한 이미지 수 확인
    const remainingSlots = MAX_ANNOUNCEMENT_IMAGES - images.length;
    if (remainingSlots <= 0) {
      addToast({ type: 'warning', message: `이미지는 최대 ${MAX_ANNOUNCEMENT_IMAGES}장까지 첨부할 수 있습니다` });
      return;
    }

    try {
      // 권한 요청
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        addToast({ type: 'error', message: '사진 접근 권한이 필요합니다' });
        return;
      }

      // 이미지 선택 (다중)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const selectedCount = result.assets.length;
      logger.info('공지사항 이미지 업로드 시작', { uid: user.uid, count: selectedCount });

      // 업로드 시작 - 첫 번째 이미지 인덱스를 uploading으로 설정
      const startIndex = images.length;
      setUploadingIndex(startIndex);
      setUploadProgress(0);

      // 다중 업로드 실행
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
        // 기존 이미지에 새 이미지 추가 (order 재할당)
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
          addToast({ type: 'success', message: `${uploadedImages.length}장의 이미지가 업로드되었습니다` });
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
  }, [user, uploadingIndex, images.length, addToast]);

  // Image Remove Handler
  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      // order 재할당
      return filtered.map((img, index) => ({ ...img, order: index }));
    });
  }, []);

  // Image Reorder Handler
  const handleReorderImages = useCallback((reorderedImages: AnnouncementImage[]) => {
    setImages(reorderedImages);
  }, []);

  // Submit
  const handleSubmit = useCallback(() => {
    // Build target audience
    const targetAudience: TargetAudience =
      targetType === 'all'
        ? { type: 'all' }
        : { type: 'roles', roles: targetRoles };

    // 호환성: 첫 번째 이미지를 단일 imageUrl로도 설정
    const firstImage = images.length > 0 ? images[0] : null;

    const formData: CreateAnnouncementInput = {
      title,
      content,
      category: category as AnnouncementCategory,
      priority,
      isPinned,
      targetAudience,
      // 단일 이미지 필드 (호환성 유지)
      imageUrl: firstImage?.url ?? null,
      imageStoragePath: firstImage?.storagePath ?? null,
      // 다중 이미지 배열
      images: images.length > 0 ? images : undefined,
    };

    const result = createAnnouncementSchema.safeParse(formData);

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  }, [title, content, category, priority, isPinned, targetType, targetRoles, images, onSubmit]);

  const isUploading = uploadingIndex !== null;
  const isValid =
    title.length >= 2 &&
    content.length >= 10 &&
    category !== '' &&
    (targetType === 'all' || targetRoles.length > 0) &&
    !isUploading;

  const inputBaseClass = `rounded-lg border px-4 py-3 text-gray-900 dark:text-white ${
    isDarkMode ? 'bg-gray-800' : 'bg-white'
  }`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Title */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            제목 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (text.length >= 2) validateField('title', text);
            }}
            onBlur={() => validateField('title', title)}
            placeholder="공지사항 제목을 입력해주세요"
            placeholderTextColor={isDarkMode ? '#6b7280' : '#9ca3af'}
            className={`${inputBaseClass} ${
              errors.title
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            maxLength={100}
          />
          {errors.title && (
            <Text className="text-xs text-red-500 mt-1">{errors.title}</Text>
          )}
          <Text className="text-xs text-gray-400 mt-1 text-right">
            {title.length}/100
          </Text>
        </View>

        {/* Category */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            카테고리 <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {ANNOUNCEMENT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => handleCategorySelect(cat.key)}
                className={`px-4 py-2 rounded-lg border ${
                  category === cat.key
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                <Text
                  className={`text-sm ${
                    category === cat.key
                      ? 'text-white font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Content */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            내용 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={content}
            onChangeText={(text) => {
              setContent(text);
              if (text.length >= 10) validateField('content', text);
            }}
            onBlur={() => validateField('content', content)}
            placeholder="공지사항 내용을 입력해주세요"
            placeholderTextColor={isDarkMode ? '#6b7280' : '#9ca3af'}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            className={`${inputBaseClass} min-h-[200px] ${
              errors.content
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            maxLength={5000}
          />
          {errors.content && (
            <Text className="text-xs text-red-500 mt-1">{errors.content}</Text>
          )}
          <Text className="text-xs text-gray-400 mt-1 text-right">
            {content.length}/5000
          </Text>
        </View>

        {/* Image Upload (다중 이미지) */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            이미지 첨부 <Text className="text-gray-400 font-normal">(선택, 최대 {MAX_ANNOUNCEMENT_IMAGES}장)</Text>
          </Text>
          <AnnouncementImagePicker
            images={images}
            uploadingIndex={uploadingIndex}
            uploadProgress={uploadProgress}
            onAddImages={handleAddImages}
            onRemoveImage={handleRemoveImage}
            onReorderImages={handleReorderImages}
            disabled={isSubmitting}
          />
        </View>

        {/* Priority */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            우선순위
          </Text>
          <View className="flex-row gap-2">
            {([0, 1, 2] as AnnouncementPriority[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => handlePrioritySelect(p)}
                className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                  priority === p
                    ? p === 2
                      ? 'bg-red-600 border-red-600'
                      : p === 1
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-gray-600 border-gray-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                <Text
                  className={`text-sm ${
                    priority === p
                      ? 'text-white font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {ANNOUNCEMENT_PRIORITY_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Pinned */}
        <View className="mb-4 flex-row items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3">
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              상단 고정
            </Text>
            <Text className="text-xs text-gray-400">
              목록 최상단에 고정됩니다
            </Text>
          </View>
          <Switch
            value={isPinned}
            onValueChange={setIsPinned}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor={isPinned ? '#ffffff' : '#f4f4f5'}
          />
        </View>

        {/* Target Audience */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            대상 설정
          </Text>

          {/* Target Type */}
          <View className="flex-row gap-2 mb-3">
            <Pressable
              onPress={handleTargetTypeAll}
              className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                targetType === 'all'
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
              }`}
            >
              <Text
                className={`text-sm ${
                  targetType === 'all'
                    ? 'text-white font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                전체
              </Text>
            </Pressable>
            <Pressable
              onPress={handleTargetTypeRoles}
              className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                targetType === 'roles'
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
              }`}
            >
              <Text
                className={`text-sm ${
                  targetType === 'roles'
                    ? 'text-white font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                역할 지정
              </Text>
            </Pressable>
          </View>

          {/* Role Selection */}
          {targetType === 'roles' && (
            <View className="flex-row gap-2">
              {(['admin', 'employer', 'staff'] as UserRole[]).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => toggleRole(role)}
                  className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                    targetRoles.includes(role)
                      ? 'bg-green-600 border-green-600'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      targetRoles.includes(role)
                        ? 'text-white font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {role === 'admin' ? '관리자' : role === 'employer' ? '구인자' : '스태프'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {targetType === 'roles' && targetRoles.length === 0 && (
            <Text className="text-xs text-red-500 mt-2">
              대상 역할을 최소 1개 이상 선택해주세요
            </Text>
          )}
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3 pb-8">
          {onCancel && (
            <Pressable
              onPress={onCancel}
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-lg py-3 items-center"
            >
              <Text className="text-gray-700 dark:text-gray-300 font-medium">
                취소
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            className={`flex-1 rounded-lg py-3 items-center ${
              isValid && !isSubmitting
                ? 'bg-blue-600'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <Text
              className={`font-medium ${
                isValid && !isSubmitting
                  ? 'text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {isSubmitting ? '저장 중...' : submitLabel}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default AnnouncementForm;
