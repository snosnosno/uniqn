/**
 * UNIQN Mobile - 템플릿 저장 모달
 *
 * @description 공고 템플릿 이름/설명 입력 및 저장
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Modal } from '@/components/ui/Modal';

// ============================================================================
// Types
// ============================================================================

interface TemplateModalProps {
  visible: boolean;
  onClose: () => void;
  templateName: string;
  templateDescription: string;
  onTemplateNameChange: (name: string) => void;
  onTemplateDescriptionChange: (desc: string) => void;
  onSave: () => Promise<void>;
  isSaving?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function TemplateModal({
  visible,
  onClose,
  templateName,
  templateDescription,
  onTemplateNameChange,
  onTemplateDescriptionChange,
  onSave,
  isSaving = false,
}: TemplateModalProps) {
  const trimmedName = templateName.trim();
  const isValid = trimmedName.length >= 2;
  const isTooShort = trimmedName.length > 0 && trimmedName.length < 2;

  const handleSave = async () => {
    if (!isValid || isSaving) return;
    await onSave();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="템플릿으로 저장" size="md">
      {/* 템플릿 이름 */}
      <View className="mb-4">
        <Text className="text-sm font-sans-medium text-content-secondary mb-2">
          템플릿 이름 <Text className="text-error-500 font-sans">*</Text>
        </Text>
        <TextInput
          value={templateName}
          onChangeText={onTemplateNameChange}
          placeholder="예: 서울 딜러 모집"
          placeholderTextColor={SECONDARY_PALETTE[400]}
          className={`bg-secondary-50 dark:bg-surface border rounded-md px-4 py-3 text-content-primary ${
            isTooShort
              ? 'border-error-400 dark:border-error-500'
              : 'border-secondary-200 dark:border-surface-overlay'
          }`}
          maxLength={50}
          editable={!isSaving}
        />
        {isTooShort && (
          <Text className="text-error-500 text-xs mt-1 font-sans">
            템플릿 이름은 2자 이상 입력해주세요
          </Text>
        )}
      </View>

      {/* 템플릿 설명 */}
      <View className="mb-4">
        <Text className="text-sm font-sans-medium text-content-secondary mb-2">설명 (선택)</Text>
        <TextInput
          value={templateDescription}
          onChangeText={onTemplateDescriptionChange}
          placeholder="예: 보장시간 3시간 기본 템플릿"
          placeholderTextColor={SECONDARY_PALETTE[400]}
          className="bg-surface-page border border-divider rounded-md px-4 py-3 text-content-primary dark:text-off-white"
          maxLength={100}
          editable={!isSaving}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* 안내 문구 */}
      <View className="bg-primary-50 dark:bg-primary-900/30 rounded-md p-4 mb-6">
        <Text className="text-primary-800 dark:text-primary-200 text-sm font-sans-medium mb-2">
          저장되는 내용
        </Text>
        <View className="flex-col gap-1">
          <Text className="text-primary-700 dark:text-primary-300 text-xs font-sans">
            - 제목, 공고 타입, 지역 정보
          </Text>
          <Text className="text-primary-700 dark:text-primary-300 text-xs font-sans">
            - 급여 정보, 복리후생
          </Text>
          <Text className="text-primary-700 dark:text-primary-300 text-xs font-sans">
            - 사전질문 설정
          </Text>
          <Text className="text-primary-700 dark:text-primary-300 text-xs font-sans">
            - 역할/인원 정보
          </Text>
        </View>
        <View className="mt-2 pt-2 border-t border-primary-200 dark:border-primary-700">
          <Text className="text-primary-600 dark:text-primary-400 text-xs font-sans">
            * 날짜 및 일정은 저장되지 않습니다
          </Text>
        </View>
      </View>

      {/* 버튼 */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onClose}
          disabled={isSaving}
          className="flex-1 bg-secondary-200 dark:bg-surface py-3 rounded-md"
          accessibilityRole="button"
          accessibilityLabel="취소"
        >
          <Text className="text-content-secondary dark:text-secondary-200 text-center font-sans-medium">
            취소
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={!isValid || isSaving}
          className={`flex-1 py-3 rounded-md ${
            isValid && !isSaving ? 'bg-primary-600' : 'bg-secondary-400'
          }`}
          accessibilityRole="button"
          accessibilityLabel="템플릿 저장"
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-surface-dark text-center font-sans-semibold">저장</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

export default TemplateModal;
