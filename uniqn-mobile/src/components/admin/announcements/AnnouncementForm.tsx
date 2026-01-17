/**
 * UNIQN Mobile - 공지사항 작성/수정 폼 컴포넌트
 *
 * @description 관리자용 공지사항 작성 폼
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
import { z } from 'zod';
import { useThemeStore } from '@/stores/themeStore';
import { createAnnouncementSchema } from '@/schemas/announcement.schema';
import type {
  CreateAnnouncementInput,
  AnnouncementCategory,
  AnnouncementPriority,
  TargetAudience,
} from '@/types';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITY_LABELS,
} from '@/types/announcement';
import type { UserRole } from '@/types/common';

interface AnnouncementFormProps {
  initialData?: Partial<CreateAnnouncementInput>;
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
  const toggleRole = (role: UserRole) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Submit
  const handleSubmit = useCallback(() => {
    // Build target audience
    const targetAudience: TargetAudience =
      targetType === 'all'
        ? { type: 'all' }
        : { type: 'roles', roles: targetRoles };

    const formData = {
      title,
      content,
      category: category as AnnouncementCategory,
      priority,
      isPinned,
      targetAudience,
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
  }, [title, content, category, priority, isPinned, targetType, targetRoles, onSubmit]);

  const isValid =
    title.length >= 2 &&
    content.length >= 10 &&
    category !== '' &&
    (targetType === 'all' || targetRoles.length > 0);

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
                onPress={() => setCategory(cat.key)}
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

        {/* Priority */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            우선순위
          </Text>
          <View className="flex-row gap-2">
            {([0, 1, 2] as AnnouncementPriority[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
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
              onPress={() => setTargetType('all')}
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
              onPress={() => setTargetType('roles')}
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
