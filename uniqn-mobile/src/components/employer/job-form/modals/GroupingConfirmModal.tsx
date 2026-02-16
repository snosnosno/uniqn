/**
 * UNIQN Mobile - 날짜 그룹화 확인 모달
 *
 * @description 대회 공고 작성 시 날짜를 그룹으로 묶을지 개별 관리할지 선택
 * @version 1.1.0 - 연속/비연속 날짜 모두 지원
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { CalendarIcon } from '@/components/icons';
import { formatDateRangeWithCount, groupConsecutiveDates } from '@/utils/date';

// ============================================================================
// Types
// ============================================================================

export interface GroupingConfirmModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 선택된 날짜들 (YYYY-MM-DD 형식, 연속/비연속 모두 가능) */
  dates: string[];
  /** 그룹화 확인 콜백 (true=그룹화, false=개별) */
  onConfirm: (shouldGroup: boolean) => void;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

type GroupingOption = 'group' | 'individual';

// ============================================================================
// Helpers
// ============================================================================

/**
 * 단일 날짜 포맷 (M/D(요일))
 */
function formatSingleDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

  return `${month}/${day}(${dayOfWeek})`;
}

// ============================================================================
// Component
// ============================================================================

export const GroupingConfirmModal = memo(function GroupingConfirmModal({
  visible,
  dates,
  onConfirm,
  onClose,
}: GroupingConfirmModalProps) {
  const [selectedOption, setSelectedOption] = useState<GroupingOption>('group');

  // 날짜 정보 계산
  const sortedDates = useMemo(() => [...dates].sort(), [dates]);
  const dayCount = dates.length;

  // 그룹화 미리보기: 연속 날짜만 그룹화 (예: "1/19(월)~1/21(수)(3일), 1/23(금)")
  const groupedPreview = useMemo(() => {
    const groups = groupConsecutiveDates(sortedDates);
    return groups
      .map((group) => {
        if (group.length === 1) {
          return formatSingleDate(group[0]!);
        }
        const start = group[0]!;
        const end = group[group.length - 1]!;
        return formatDateRangeWithCount(start, end);
      })
      .join(', ');
  }, [sortedDates]);

  // 개별 미리보기: 모든 날짜 나열 (예: "1/19(월), 1/20(화), 1/21(수), 1/23(금)")
  const individualPreview = useMemo(() => {
    return sortedDates.map((date) => formatSingleDate(date)).join(', ');
  }, [sortedDates]);

  // 옵션 선택 핸들러
  const handleOptionSelect = useCallback((option: GroupingOption) => {
    setSelectedOption(option);
  }, []);

  // 확인 핸들러
  const handleConfirm = useCallback(() => {
    onConfirm(selectedOption === 'group');
    setSelectedOption('group'); // 초기화
  }, [selectedOption, onConfirm]);

  // 닫기 핸들러
  const handleClose = useCallback(() => {
    setSelectedOption('group'); // 초기화
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} onClose={handleClose} title="날짜 그룹화" size="md" position="center">
      <View className="-mt-2">
        {/* 선택된 날짜 미리보기 (선택 옵션에 따라 변경) */}
        <View className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <View className="flex-row items-center mb-1">
            <CalendarIcon size={18} color="#F59E0B" />
            <Text className="ml-2 text-xs text-amber-600 dark:text-amber-400">
              {dayCount}일 선택됨
            </Text>
          </View>
          <Text className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {selectedOption === 'group' ? groupedPreview : individualPreview}
          </Text>
        </View>

        {/* 안내 문구 */}
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          어떻게 관리하시겠습니까?
        </Text>

        {/* 옵션 1: 그룹으로 묶기 */}
        <Pressable
          onPress={() => handleOptionSelect('group')}
          className={`mb-3 p-4 rounded-xl border-2 ${
            selectedOption === 'group'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-surface-overlay bg-gray-50 dark:bg-surface-dark'
          }`}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedOption === 'group' }}
        >
          <View className="flex-row items-center mb-2">
            {/* 라디오 버튼 */}
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                selectedOption === 'group'
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-gray-400 dark:border-surface-overlay'
              }`}
            >
              {selectedOption === 'group' && <View className="w-2 h-2 rounded-full bg-white" />}
            </View>
            <Text
              className={`text-base font-semibold ${
                selectedOption === 'group'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              그룹으로 묶기
            </Text>
            <View className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-800 rounded-full">
              <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                권장
              </Text>
            </View>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-8">
            모든 날짜에 동일한 시간대/인원 적용
          </Text>
        </Pressable>

        {/* 옵션 2: 개별로 관리 */}
        <Pressable
          onPress={() => handleOptionSelect('individual')}
          className={`p-4 rounded-xl border-2 ${
            selectedOption === 'individual'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-surface-overlay bg-gray-50 dark:bg-surface-dark'
          }`}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedOption === 'individual' }}
        >
          <View className="flex-row items-center mb-2">
            {/* 라디오 버튼 */}
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                selectedOption === 'individual'
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-gray-400 dark:border-surface-overlay'
              }`}
            >
              {selectedOption === 'individual' && (
                <View className="w-2 h-2 rounded-full bg-white" />
              )}
            </View>
            <Text
              className={`text-base font-semibold ${
                selectedOption === 'individual'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              개별로 관리
            </Text>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-8">
            각 날짜마다 다른 시간대/인원 설정 가능
          </Text>
        </Pressable>

        {/* 푸터 버튼 */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            onPress={handleClose}
            className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-surface active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="취소"
          >
            <Text className="text-center text-base font-semibold text-gray-700 dark:text-gray-300">
              취소
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-primary-600 dark:bg-primary-500 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="확인"
          >
            <Text className="text-center text-base font-semibold text-white">확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

export default GroupingConfirmModal;
