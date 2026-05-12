/**
 * UNIQN Mobile - 공지사항 작성/수정 폼 컴포넌트
 *
 * @description 관리자용 공지사항 작성 폼 (다중 이미지 지원)
 * @version 2.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
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
import { z } from 'zod';
import { useThemeStore } from '@/stores/themeStore';
import { createAnnouncementSchema } from '@/schemas/announcement.schema';
import { AnnouncementImagePicker } from './AnnouncementImagePicker';
import { useAnnouncementImages } from '@/hooks/useAnnouncementImages';
import type {
  CreateAnnouncementInput,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementImage,
  TargetAudience,
} from '@/types';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITY_LABELS,
  MAX_ANNOUNCEMENT_IMAGES,
} from '@/types/announcement';
import type { UserRole } from '@/types/role';

const TARGET_ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  employer: '구인자',
  staff: '스태프',
};

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

  // Form State
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [category, setCategory] = useState<AnnouncementCategory | ''>(initialData?.category ?? '');
  const [priority, setPriority] = useState<AnnouncementPriority>(initialData?.priority ?? 0);
  const [isPinned, setIsPinned] = useState(initialData?.isPinned ?? false);
  const [targetType, setTargetType] = useState<'all' | 'roles'>(
    initialData?.targetAudience?.type ?? 'all'
  );
  const [targetRoles, setTargetRoles] = useState<UserRole[]>(
    initialData?.targetAudience?.roles ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Image State (커스텀 Hook으로 분리)
  const {
    images,
    uploadingIndex,
    uploadProgress,
    isUploading,
    handleAddImages,
    handleRemoveImage,
    handleReorderImages,
  } = useAnnouncementImages({
    initialImages: initialData?.images,
    legacyImageUrl: initialData?.imageUrl,
    legacyStoragePath: initialData?.imageStoragePath,
  });

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

  // 단순 핸들러 (useCallback 불필요)
  const toggleRole = (role: UserRole) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleTargetTypeChange = (type: 'all' | 'roles') => {
    setTargetType(type);
  };

  // Submit
  const handleSubmit = useCallback(() => {
    // Build target audience
    const targetAudience: TargetAudience =
      targetType === 'all' ? { type: 'all' } : { type: 'roles', roles: targetRoles };

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
      imageUrlBlurhash: firstImage?.blurhash ?? null,
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

  const isValid =
    title.length >= 2 &&
    content.length >= 10 &&
    category !== '' &&
    (targetType === 'all' || targetRoles.length > 0) &&
    !isUploading;

  const inputBaseClass = `rounded-lg border px-4 py-3 text-content-primary ${
    isDarkMode ? 'bg-secondary-800' : 'bg-white'
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
          <Text className="text-sm font-sans-medium text-content-secondary mb-2">
            제목 <Text className="text-error-500 font-sans">*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (text.length >= 2) validateField('title', text);
            }}
            onBlur={() => validateField('title', title)}
            placeholder="공지사항 제목을 입력해주세요"
            placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
            className={`${inputBaseClass} ${
              errors.title ? 'border-error-500' : 'border-secondary-300 dark:border-surface-overlay'
            }`}
            maxLength={100}
          />
          {errors.title ? (
            <Text className="text-xs text-error-500 mt-1 font-sans">{errors.title}</Text>
          ) : null}
          <Text className="text-xs text-content-placeholder mt-1 text-right font-sans">
            {title.length}/100
          </Text>
        </View>

        {/* Category */}
        <View className="mb-4">
          <Text className="text-sm font-sans-medium text-content-secondary mb-2">
            카테고리 <Text className="text-error-500 font-sans">*</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {ANNOUNCEMENT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                className={`px-4 py-2 rounded-lg border ${
                  category === cat.key
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-white dark:bg-surface border-secondary-300 dark:border-surface-overlay'
                }`}
              >
                <Text
                  className={`text-sm font-sans ${
                    category === cat.key
                      ? 'text-surface-dark font-sans-medium'
                      : 'text-secondary-700 dark:text-secondary-300'
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
          <Text className="text-sm font-sans-medium text-content-secondary mb-2">
            내용 <Text className="text-error-500 font-sans">*</Text>
          </Text>
          <TextInput
            value={content}
            onChangeText={(text) => {
              setContent(text);
              if (text.length >= 10) validateField('content', text);
            }}
            onBlur={() => validateField('content', content)}
            placeholder="공지사항 내용을 입력해주세요"
            placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            className={`${inputBaseClass} min-h-[200px] ${
              errors.content
                ? 'border-error-500'
                : 'border-secondary-300 dark:border-surface-overlay'
            }`}
            maxLength={5000}
          />
          {errors.content ? (
            <Text className="text-xs text-error-500 mt-1 font-sans">{errors.content}</Text>
          ) : null}
          <Text className="text-xs text-content-placeholder mt-1 text-right font-sans">
            {content.length}/5000
          </Text>
        </View>

        {/* Image Upload (다중 이미지) */}
        <View className="mb-4">
          <Text className="text-sm font-sans-medium text-content-secondary mb-2">
            이미지 첨부{' '}
            <Text className="text-content-placeholder font-normal font-sans">
              (선택, 최대 {MAX_ANNOUNCEMENT_IMAGES}장)
            </Text>
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
          <Text className="text-sm font-sans-medium text-content-secondary mb-2">우선순위</Text>
          <View className="flex-row gap-2">
            {([0, 1, 2] as AnnouncementPriority[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                  priority === p
                    ? p === 2
                      ? 'bg-error-600 border-error-600'
                      : p === 1
                        ? 'bg-primary-600 border-primary-600'
                        : 'bg-secondary-600 border-secondary-600'
                    : 'bg-white dark:bg-surface border-secondary-300 dark:border-surface-overlay'
                }`}
              >
                <Text
                  className={`text-sm font-sans ${
                    priority === p
                      ? 'text-surface-dark font-sans-medium'
                      : 'text-secondary-700 dark:text-secondary-300'
                  }`}
                >
                  {ANNOUNCEMENT_PRIORITY_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Pinned */}
        <View className="mb-4 flex-row items-center justify-between bg-white dark:bg-surface rounded-lg border border-secondary-300 dark:border-surface-overlay px-4 py-3">
          <View>
            <Text className="text-sm font-sans-medium text-content-secondary">상단 고정</Text>
            <Text className="text-xs text-content-placeholder font-sans">
              목록 최상단에 고정됩니다
            </Text>
          </View>
          <Switch
            value={isPinned}
            onValueChange={setIsPinned}
            trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
            thumbColor={isPinned ? '#FFFFFF' : '#F4F4F5'}
          />
        </View>

        {/* Target Audience */}
        <View className="mb-6">
          <Text className="text-sm font-sans-medium text-content-secondary mb-2">대상 설정</Text>

          {/* Target Type */}
          <View className="flex-row gap-2 mb-3">
            <Pressable
              onPress={() => handleTargetTypeChange('all')}
              className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                targetType === 'all'
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white dark:bg-surface border-secondary-300 dark:border-surface-overlay'
              }`}
            >
              <Text
                className={`text-sm font-sans ${
                  targetType === 'all'
                    ? 'text-surface-dark font-sans-medium'
                    : 'text-secondary-700 dark:text-secondary-300'
                }`}
              >
                전체
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleTargetTypeChange('roles')}
              className={`flex-1 px-4 py-2 rounded-lg border items-center ${
                targetType === 'roles'
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white dark:bg-surface border-secondary-300 dark:border-surface-overlay'
              }`}
            >
              <Text
                className={`text-sm font-sans ${
                  targetType === 'roles'
                    ? 'text-surface-dark font-sans-medium'
                    : 'text-secondary-700 dark:text-secondary-300'
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
                      ? 'bg-success-600 border-success-600'
                      : 'bg-white dark:bg-surface border-secondary-300 dark:border-surface-overlay'
                  }`}
                >
                  <Text
                    className={`text-sm font-sans ${
                      targetRoles.includes(role)
                        ? 'text-surface-dark font-sans-medium'
                        : 'text-secondary-700 dark:text-secondary-300'
                    }`}
                  >
                    {TARGET_ROLE_LABELS[role]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {targetType === 'roles' && targetRoles.length === 0 && (
            <Text className="text-xs text-error-500 mt-2 font-sans">
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
              className="flex-1 bg-secondary-200 dark:bg-surface rounded-lg py-3 items-center"
            >
              <Text className="text-content-secondary font-sans-medium">취소</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            className={`flex-1 rounded-lg py-3 items-center ${
              isValid && !isSubmitting
                ? 'bg-primary-600'
                : 'bg-secondary-300 dark:bg-surface-elevated'
            }`}
          >
            <Text
              className={`font-sans-medium ${
                isValid && !isSubmitting
                  ? 'text-surface-dark'
                  : 'text-secondary-500 dark:text-secondary-400'
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
