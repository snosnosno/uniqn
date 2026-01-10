/**
 * UNIQN Mobile - 날짜 선택 모달
 *
 * @description 캘린더 UI를 통한 날짜 선택 모달
 * @version 3.0.0 - CalendarPicker 통합
 *
 * 주요 기능:
 * - CalendarPicker 캘린더 UI로 날짜 선택
 * - 타입별 제약사항 표시 (regular/urgent: 1개, tournament: 30개)
 * - 중복 날짜 검사
 * - 긴급 공고 7일 이내 제한
 * - 과거 날짜 선택 불가
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Modal } from '@/components/ui/Modal';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { useToastStore } from '@/stores/toastStore';
import { DATE_CONSTRAINTS } from '@/constants';
import { isDuplicateDate } from '@/utils/job-posting/dateUtils';
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 타입별 제약사항
  const constraints = DATE_CONSTRAINTS[postingType];
  const canAddMore = existingDates.length < constraints.maxDates;

  // 최소/최대 날짜 계산
  const { minimumDate, maximumDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 최소 날짜: 오늘
    const minDate = today;

    // 최대 날짜: 긴급 공고는 7일 이내
    let maxDate: Date | undefined;
    if (postingType === 'urgent') {
      maxDate = addDays(today, 7);
    }

    return { minimumDate: minDate, maximumDate: maxDate };
  }, [postingType]);

  // 캘린더에서 날짜 선택
  const handleCalendarSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // 확인 버튼
  const handleConfirm = useCallback(() => {
    if (!selectedDate) {
      addToast({ type: 'error', message: '날짜를 선택해주세요' });
      return;
    }

    // YYYY-MM-DD 형식으로 변환
    const dateString = format(selectedDate, 'yyyy-MM-dd');

    // 중복 검사
    if (isDuplicateDate(existingDates, dateString)) {
      addToast({ type: 'error', message: '이미 추가된 날짜입니다' });
      return;
    }

    // 최대 개수 검사
    if (!canAddMore) {
      addToast({
        type: 'error',
        message: `최대 ${constraints.maxDates}개까지 추가할 수 있습니다`,
      });
      return;
    }

    // 선택 완료
    onSelectDate(dateString);
    setSelectedDate(null);
    onClose();
  }, [selectedDate, existingDates, canAddMore, constraints.maxDates, onSelectDate, onClose, addToast]);

  // 모달 닫기 처리
  const handleClose = useCallback(() => {
    setSelectedDate(null);
    onClose();
  }, [onClose]);

  // 선택된 날짜 표시 텍스트
  const selectedDateText = selectedDate
    ? format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })
    : '캘린더에서 날짜를 선택하세요';

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="날짜 선택"
      size="lg"
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

      {/* 선택된 날짜 표시 */}
      <View className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          선택된 날짜
        </Text>
        <Text className={`text-base font-medium ${
          selectedDate
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-400 dark:text-gray-500'
        }`}>
          {selectedDateText}
        </Text>
      </View>

      {/* 캘린더 */}
      <View className="mb-4">
        <CalendarPicker
          value={selectedDate}
          onChange={handleCalendarSelect}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      </View>

      {/* 이미 선택된 날짜 안내 */}
      {existingDates.length > 0 && (
        <View className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            이미 추가된 날짜 ({existingDates.length}개)
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300">
            {existingDates.slice(0, 5).join(', ')}
            {existingDates.length > 5 && ` 외 ${existingDates.length - 5}개`}
          </Text>
        </View>
      )}

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
          disabled={!canAddMore || !selectedDate}
          className={`flex-1 py-3 rounded-xl ${
            canAddMore && selectedDate
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
