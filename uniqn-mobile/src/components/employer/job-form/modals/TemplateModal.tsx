/**
 * UNIQN Mobile - 템플릿 저장 모달
 *
 * @description 공고 템플릿 이름/설명 입력 및 저장
 * @version 1.0.0
 */

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
    <Modal
      visible={visible}
      onClose={onClose}
      title="템플릿으로 저장"
      size="md"
    >
      {/* 템플릿 이름 */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          템플릿 이름 <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={templateName}
          onChangeText={onTemplateNameChange}
          placeholder="예: 서울 딜러 모집"
          placeholderTextColor="#9CA3AF"
          className={`bg-gray-50 dark:bg-gray-700 border rounded-xl px-4 py-3 text-gray-900 dark:text-white ${
            isTooShort
              ? 'border-red-400 dark:border-red-500'
              : 'border-gray-200 dark:border-gray-600'
          }`}
          maxLength={50}
          editable={!isSaving}
        />
        {isTooShort && (
          <Text className="text-red-500 text-xs mt-1">
            템플릿 이름은 2자 이상 입력해주세요
          </Text>
        )}
      </View>

      {/* 템플릿 설명 */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          설명 (선택)
        </Text>
        <TextInput
          value={templateDescription}
          onChangeText={onTemplateDescriptionChange}
          placeholder="예: 보장시간 3시간 기본 템플릿"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
          maxLength={100}
          editable={!isSaving}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* 안내 문구 */}
      <View className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-6">
        <Text className="text-blue-800 dark:text-blue-200 text-sm font-medium mb-2">
          저장되는 내용
        </Text>
        <View className="flex-col gap-1">
          <Text className="text-blue-700 dark:text-blue-300 text-xs">
            - 제목, 공고 타입, 지역 정보
          </Text>
          <Text className="text-blue-700 dark:text-blue-300 text-xs">
            - 급여 정보, 복리후생
          </Text>
          <Text className="text-blue-700 dark:text-blue-300 text-xs">
            - 사전질문 설정
          </Text>
          <Text className="text-blue-700 dark:text-blue-300 text-xs">
            - 역할/인원 정보
          </Text>
        </View>
        <View className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
          <Text className="text-blue-600 dark:text-blue-400 text-xs">
            * 날짜 및 일정은 저장되지 않습니다
          </Text>
        </View>
      </View>

      {/* 버튼 */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onClose}
          disabled={isSaving}
          className="flex-1 bg-gray-200 dark:bg-gray-700 py-3 rounded-xl"
          accessibilityRole="button"
          accessibilityLabel="취소"
        >
          <Text className="text-gray-700 dark:text-gray-200 text-center font-medium">
            취소
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={!isValid || isSaving}
          className={`flex-1 py-3 rounded-xl ${
            isValid && !isSaving ? 'bg-blue-600' : 'bg-gray-400'
          }`}
          accessibilityRole="button"
          accessibilityLabel="템플릿 저장"
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold">
              저장
            </Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

export default TemplateModal;
