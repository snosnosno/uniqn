/**
 * UNIQN Mobile - InquiryForm 컴포넌트
 *
 * @description 1:1 문의 작성 폼
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Button, FormField, FormSelect } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import type { InquiryCategory, CreateInquiryInput } from '@/types';
import { INQUIRY_CATEGORIES } from '@/types';
import { createInquirySchema } from '@/schemas';
import { z } from 'zod';

export interface InquiryFormProps {
  /** 제출 핸들러 */
  onSubmit: (data: CreateInquiryInput) => void;
  /** 제출 중 상태 */
  isSubmitting?: boolean;
  /** 취소 핸들러 */
  onCancel?: () => void;
  /** 기본 카테고리 */
  defaultCategory?: InquiryCategory;
}

// SelectOption 형태로 변환
const categoryOptions: SelectOption[] = INQUIRY_CATEGORIES.map((cat) => ({
  label: cat.label,
  value: cat.key,
  description: cat.description,
}));

export function InquiryForm({
  onSubmit,
  isSubmitting = false,
  onCancel,
  defaultCategory,
}: InquiryFormProps) {
  // 다크모드 감지 (앱 테마 스토어 사용)
  const { isDarkMode: isDark } = useThemeStore();

  const [category, setCategory] = useState<InquiryCategory | ''>(defaultCategory || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // 다크모드 대응 입력 필드 스타일
  const getInputStyle = (hasError: boolean) => ({
    backgroundColor: hasError
      ? isDark
        ? 'rgba(127, 29, 29, 0.2)'
        : '#FEF2F2'
      : isDark
        ? '#1A1625'
        : '#FFFFFF',
  });

  const validateField = useCallback((field: string, value: string) => {
    try {
      if (field === 'category') {
        z.enum(['general', 'technical', 'payment', 'account', 'report', 'other']).parse(value);
      } else if (field === 'subject') {
        createInquirySchema.shape.subject.parse(value);
      } else if (field === 'message') {
        createInquirySchema.shape.message.parse(value);
      }
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: error.issues[0]?.message }));
      }
    }
  }, []);

  const handleSubmit = useCallback(() => {
    // 전체 유효성 검사
    const result = createInquirySchema.safeParse({
      category,
      subject,
      message,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return;
    }

    onSubmit({
      category: category as InquiryCategory,
      subject,
      message,
    });
  }, [category, subject, message, onSubmit]);

  const isValid = category && subject.length >= 2 && message.length >= 10;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* 카테고리 선택 */}
        <FormField label="문의 유형" required error={errors.category} className="mb-4">
          <FormSelect
            options={categoryOptions}
            value={category}
            onValueChange={(value) => {
              setCategory(value as InquiryCategory);
              validateField('category', value);
            }}
            placeholder="문의 유형을 선택해주세요"
            error={!!errors.category}
          />
        </FormField>

        {/* 제목 입력 */}
        <FormField label="제목" required error={errors.subject} hint="2~100자" className="mb-4">
          <TextInput
            value={subject}
            onChangeText={(text) => {
              setSubject(text);
              if (text.length >= 2) {
                validateField('subject', text);
              }
            }}
            onBlur={() => validateField('subject', subject)}
            placeholder="문의 제목을 입력해주세요"
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            className={`rounded-lg border px-4 py-3 text-base text-gray-900 dark:text-gray-100 ${
              errors.subject ? 'border-error-500' : 'border-gray-300 dark:border-surface-overlay'
            }`}
            style={getInputStyle(!!errors.subject)}
            maxLength={100}
          />
        </FormField>

        {/* 내용 입력 */}
        <FormField
          label="문의 내용"
          required
          error={errors.message}
          hint="10~2000자"
          className="mb-6"
        >
          <TextInput
            value={message}
            onChangeText={(text) => {
              setMessage(text);
              if (text.length >= 10) {
                validateField('message', text);
              }
            }}
            onBlur={() => validateField('message', message)}
            placeholder="문의 내용을 상세히 입력해주세요"
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            className={`min-h-[200px] rounded-lg border px-4 py-3 text-base text-gray-900 dark:text-gray-100 ${
              errors.message ? 'border-error-500' : 'border-gray-300 dark:border-surface-overlay'
            }`}
            style={getInputStyle(!!errors.message)}
            maxLength={2000}
          />
          <Text className="mt-1 text-right text-xs text-gray-400">{message.length}/2000</Text>
        </FormField>

        {/* 버튼 */}
        <View className="flex-row gap-3">
          {onCancel && (
            <Button variant="outline" onPress={onCancel} disabled={isSubmitting} className="flex-1">
              취소
            </Button>
          )}
          <Button
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            loading={isSubmitting}
            className={onCancel ? 'flex-1' : 'w-full'}
          >
            문의하기
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default InquiryForm;
