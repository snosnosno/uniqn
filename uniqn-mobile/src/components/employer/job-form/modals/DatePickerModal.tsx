/**
 * UNIQN Mobile - 날짜 선택 모달
 *
 * @description 날짜별 요구사항 섹션에서 날짜를 선택하는 모달
 * @version 2.0.0
 *
 * 주요 기능:
 * - 타입별 제약사항 표시 (regular/urgent: 1개, tournament: 30개)
 * - 중복 날짜 검사
 * - 긴급 공고 7일 이내 제한
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { useToastStore } from '@/stores/toastStore';
import { DATE_CONSTRAINTS } from '@/constants';
import { isDuplicateDate, isWithinUrgentDateLimit, getTodayDateString } from '@/utils/job-posting/dateUtils';
import type { PostingType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface DatePickerModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 날짜 선택 콜백 */
  onSelectDate: (date: string) => void;
  /** 공고 타입 */
  postingType: PostingType;
  /** 이미 선택된 날짜 목록 */
  existingDates: string[];
}

// ============================================================================
// Component
// ============================================================================

export function DatePickerModal({
  visible,
  onClose,
  onSelectDate,
  postingType,
  existingDates,
}: DatePickerModalProps) {
  const { addToast } = useToastStore();
  const [selectedDate, setSelectedDate] = useState<string>('');

  // 타입별 제약사항
  const constraints = DATE_CONSTRAINTS[postingType];
  const canAddMore = existingDates.length < constraints.maxDates;

  // 날짜 형식 검증 (YYYY-MM-DD)
  const isValidDateFormat = (date: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;

    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  };

  // 날짜 선택 처리
  const handleConfirm = useCallback(() => {
    // 1. 형식 검증
    if (!selectedDate) {
      addToast({ type: 'error', message: '날짜를 입력해주세요' });
      return;
    }

    if (!isValidDateFormat(selectedDate)) {
      addToast({ type: 'error', message: '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)' });
      return;
    }

    // 2. 과거 날짜 검증
    const today = getTodayDateString();
    if (selectedDate < today) {
      addToast({ type: 'error', message: '과거 날짜는 선택할 수 없습니다' });
      return;
    }

    // 3. 긴급 공고 7일 이내 제한
    if (postingType === 'urgent' && !isWithinUrgentDateLimit(selectedDate)) {
      addToast({ type: 'error', message: '긴급 공고는 오늘부터 7일 이내만 선택할 수 있습니다' });
      return;
    }

    // 4. 중복 검사
    if (isDuplicateDate(existingDates, selectedDate)) {
      addToast({ type: 'error', message: '이미 추가된 날짜입니다' });
      return;
    }

    // 5. 최대 개수 검사
    if (!canAddMore) {
      addToast({
        type: 'error',
        message: `최대 ${constraints.maxDates}개까지 추가할 수 있습니다`,
      });
      return;
    }

    // 6. 선택 완료
    onSelectDate(selectedDate);
    setSelectedDate('');
    onClose();
  }, [selectedDate, existingDates, postingType, canAddMore, onSelectDate, onClose, addToast]);

  // 모달 닫기 처리
  const handleClose = useCallback(() => {
    setSelectedDate('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="날짜 선택"
      size="md"
    >
      {/* 제약사항 안내 */}
      <View className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Text className="text-sm text-blue-700 dark:text-blue-300">
          최대 {constraints.maxDates}개 날짜 추가 가능 (현재: {existingDates.length}개)
        </Text>
        {postingType === 'urgent' && (
          <Text className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            긴급 공고는 오늘부터 7일 이내만 선택할 수 있습니다
          </Text>
        )}
      </View>

      {/* 날짜 입력 */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          날짜 (YYYY-MM-DD)
        </Text>
        <TextInput
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="예: 2025-01-15"
          className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          오늘 이후 날짜만 선택할 수 있습니다
        </Text>
      </View>

      {/* 버튼 */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={handleClose}
          className="flex-1 bg-gray-200 dark:bg-gray-700 py-3 rounded-xl"
          accessibilityRole="button"
          accessibilityLabel="취소"
        >
          <Text className="text-gray-700 dark:text-gray-200 text-center font-medium">
            취소
          </Text>
        </Pressable>
        <Pressable
          onPress={handleConfirm}
          disabled={!canAddMore}
          className={`flex-1 py-3 rounded-xl ${
            canAddMore
              ? 'bg-blue-600'
              : 'bg-gray-300 dark:bg-gray-600 opacity-50'
          }`}
          accessibilityRole="button"
          accessibilityLabel="확인"
        >
          <Text className="text-white text-center font-semibold">
            확인
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
