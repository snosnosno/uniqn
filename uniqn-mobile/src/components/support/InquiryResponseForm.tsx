/**
 * UNIQN Mobile - InquiryResponseForm 컴포넌트
 *
 * @description 관리자용 문의 답변 폼
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Button, FormField, FormSelect } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import type { InquiryStatus, RespondInquiryInput } from '@/types';
import { respondInquirySchema } from '@/schemas';
import { z } from 'zod';

export interface InquiryResponseFormProps {
  /** 제출 핸들러 */
  onSubmit: (data: RespondInquiryInput) => void;
  /** 제출 중 상태 */
  isSubmitting?: boolean;
  /** 기존 응답 (수정 시) */
  existingResponse?: string;
  /** 현재 상태 */
  currentStatus?: InquiryStatus;
}

const statusOptions: SelectOption[] = [
  { label: '처리중', value: 'in_progress' },
  { label: '답변 완료', value: 'closed' },
];

export function InquiryResponseForm({
  onSubmit,
  isSubmitting = false,
  existingResponse = '',
  currentStatus = 'open',
}: InquiryResponseFormProps) {
  const [response, setResponse] = useState(existingResponse);
  const [status, setStatus] = useState<InquiryStatus>(
    currentStatus === 'open' ? 'closed' : currentStatus
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: string, value: string) => {
    try {
      if (field === 'response') {
        respondInquirySchema.shape.response.parse(value);
      }
      setErrors((prev) => ({ ...prev, [field]: '' }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: error.issues[0]?.message || '' }));
      }
    }
  }, []);

  const handleSubmit = useCallback(() => {
    // 유효성 검사
    const result = respondInquirySchema.safeParse({ response, status });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return;
    }

    onSubmit({ response, status });
  }, [response, status, onSubmit]);

  const isValid = response.trim().length > 0;

  return (
    <View className="rounded-xl bg-white p-4 dark:bg-gray-800">
      <Text className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        답변 작성
      </Text>

      {/* 답변 내용 */}
      <FormField
        label="답변 내용"
        required
        error={errors.response}
        className="mb-4"
      >
        <TextInput
          value={response}
          onChangeText={(text) => {
            setResponse(text);
            if (text.length > 0) {
              validateField('response', text);
            }
          }}
          onBlur={() => validateField('response', response)}
          placeholder="답변 내용을 입력해주세요"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          className={`min-h-[150px] rounded-lg border px-4 py-3 text-base text-gray-900 dark:text-gray-100 ${
            errors.response
              ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
              : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700'
          }`}
          maxLength={2000}
        />
        <Text className="mt-1 text-right text-xs text-gray-400">
          {response.length}/2000
        </Text>
      </FormField>

      {/* 상태 선택 */}
      <FormField label="상태 변경" className="mb-6">
        <FormSelect
          options={statusOptions}
          value={status}
          onValueChange={(value) => setStatus(value as InquiryStatus)}
        />
      </FormField>

      {/* 제출 버튼 */}
      <Button
        onPress={handleSubmit}
        disabled={!isValid || isSubmitting}
        loading={isSubmitting}
        className="w-full"
      >
        {existingResponse ? '답변 수정' : '답변 등록'}
      </Button>
    </View>
  );
}

export default InquiryResponseForm;
