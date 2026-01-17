/**
 * UNIQN Mobile - 취소 요청 폼 컴포넌트
 *
 * @description 확정된 지원에 대해 스태프가 취소를 요청하는 폼
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { cancellationRequestSchema } from '@/schemas/application.schema';
import { getRoleDisplayName } from '@/types/unified';
import type { Application } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface CancellationRequestFormProps {
  /** 취소 요청할 지원서 */
  application: Application;
  /** 모달 표시 여부 */
  visible: boolean;
  /** 제출 중 여부 */
  isSubmitting: boolean;
  /** 취소 요청 제출 */
  onSubmit: (applicationId: string, reason: string) => void;
  /** 닫기 */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CancellationRequestForm({
  application,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: CancellationRequestFormProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 제출 가능 여부 (5자 이상)
  const canSubmit = reason.trim().length >= 5 && !isSubmitting;

  // 제출 핸들러
  const handleSubmit = useCallback(() => {
    // Zod 스키마 검증
    const result = cancellationRequestSchema.safeParse({
      applicationId: application.id,
      reason: reason.trim(),
    });

    if (!result.success) {
      const fieldError = result.error.issues[0];
      setError(fieldError?.message ?? '입력값을 확인해주세요');
      return;
    }

    setError(null);
    onSubmit(application.id, reason.trim());
  }, [application.id, reason, onSubmit]);

  // 닫기 핸들러 (상태 초기화)
  const handleClose = useCallback(() => {
    setReason('');
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* 헤더 */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Pressable onPress={handleClose} className="p-2 -ml-2">
            <Text className="text-gray-600 dark:text-gray-400 text-lg">✕</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            취소 요청
          </Text>
          <View className="w-8" />
        </View>

        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {/* 안내 문구 */}
          <View className="bg-warning-50 dark:bg-warning-900/30 rounded-lg p-4 mb-6">
            <Text className="text-warning-700 dark:text-warning-300 text-sm leading-5">
              확정된 지원을 취소하려면 사유를 입력해주세요.{'\n'}
              구인자가 검토 후 승인/거절합니다.
            </Text>
          </View>

          {/* 지원 정보 요약 */}
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              {application.jobPostingTitle ?? application.jobPosting?.title ?? '공고'}
            </Text>
            <View className="flex-row items-center mb-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                📅 {application.jobPostingDate ?? application.jobPosting?.workDate ?? '-'}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                👤 {getRoleDisplayName(application.appliedRole, application.customRole)} 역할
              </Text>
            </View>
          </View>

          {/* 취소 사유 입력 */}
          <FormField
            label="취소 사유"
            required
            error={error}
            hint="최소 5자 이상, 최대 500자"
          >
            <TextInput
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (error) setError(null);
              }}
              placeholder="취소하려는 이유를 상세히 입력해주세요"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              maxLength={500}
              editable={!isSubmitting}
              className={`
                bg-gray-50 dark:bg-gray-800 rounded-lg p-4
                text-gray-900 dark:text-white text-base min-h-[140px]
                ${error ? 'border-2 border-red-500' : 'border border-gray-200 dark:border-gray-700'}
              `}
              textAlignVertical="top"
            />
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
              {reason.length}/500
            </Text>
          </FormField>

          {/* 주의사항 */}
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4">
            <Text className="text-xs text-gray-500 dark:text-gray-400 leading-5">
              • 취소 요청이 승인되면 지원이 취소됩니다.{'\n'}
              • 구인자가 거절하면 지원은 유지됩니다.{'\n'}
              • 무단 취소는 평판에 영향을 줄 수 있습니다.
            </Text>
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View className="p-4 border-t border-gray-200 dark:border-gray-700">
          <View className="flex-row gap-3">
            <Button
              onPress={handleClose}
              variant="outline"
              disabled={isSubmitting}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
              className="flex-1"
            >
              요청 제출
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default CancellationRequestForm;
