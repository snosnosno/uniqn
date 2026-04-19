import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';
import { CalendarIcon } from '@/components/icons';
import { Modal } from '@/components/ui/Modal';
import {
  formatDateRangeWithCount,
  formatDateShortWithDay,
  groupConsecutiveDates,
} from '@/utils/date';

export interface GroupingConfirmModalProps {
  visible: boolean;
  dates: string[];
  onConfirm: (shouldGroup: boolean) => void;
  onClose: () => void;
}

type GroupingOption = 'group' | 'individual';

function formatSingleDate(dateStr: string): string {
  return formatDateShortWithDay(dateStr) || dateStr || '-';
}

export const GroupingConfirmModal = memo(function GroupingConfirmModal({
  visible,
  dates,
  onConfirm,
  onClose,
}: GroupingConfirmModalProps) {
  const [selectedOption, setSelectedOption] = useState<GroupingOption>('group');
  const sortedDates = useMemo(() => [...dates].sort(), [dates]);
  const dayCount = dates.length;

  const groupedPreview = useMemo(() => {
    const groups = groupConsecutiveDates(sortedDates);

    return groups
      .map((group) => {
        if (group.length === 1) {
          return formatSingleDate(group[0]!);
        }

        return formatDateRangeWithCount(group[0]!, group[group.length - 1]!);
      })
      .join(', ');
  }, [sortedDates]);

  const individualPreview = useMemo(
    () => sortedDates.map((date) => formatSingleDate(date)).join(', '),
    [sortedDates]
  );

  const handleOptionSelect = useCallback((option: GroupingOption) => {
    setSelectedOption(option);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedOption('group');
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedOption === 'group');
    resetSelection();
  }, [onConfirm, resetSelection, selectedOption]);

  const handleClose = useCallback(() => {
    resetSelection();
    onClose();
  }, [onClose, resetSelection]);

  return (
    <Modal visible={visible} onClose={handleClose} title="날짜 그룹화" size="md" position="center">
      <View className="-mt-2">
        <View className="mb-4 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
          <View className="mb-1 flex-row items-center">
            <CalendarIcon size={18} color={STATUS_COLORS.warning} />
            <Text className="ml-2 text-xs text-warning-600 dark:text-warning-400 font-sans">
              {dayCount}일 선택됨
            </Text>
          </View>
          <Text className="text-sm font-sans-semibold text-warning-700 dark:text-warning-300">
            {selectedOption === 'group' ? groupedPreview : individualPreview}
          </Text>
        </View>

        <Text className="mb-4 text-sm text-content-muted dark:text-secondary-400 font-sans">
          날짜별 요구사항을 어떻게 관리할까요?
        </Text>

        <Pressable
          onPress={() => handleOptionSelect('group')}
          className={`mb-3 rounded-md border-2 p-4 ${
            selectedOption === 'group'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-secondary-200 bg-surface-page dark:bg-surface dark:border-surface-overlay'
          }`}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedOption === 'group' }}
        >
          <View className="mb-2 flex-row items-center">
            <View
              className={`mr-3 h-5 w-5 items-center justify-center rounded-sm border-2 ${
                selectedOption === 'group'
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-secondary-400 dark:border-surface-overlay'
              }`}
            >
              {selectedOption === 'group' && <View className="h-2 w-2 rounded-sm bg-white" />}
            </View>
            <Text
              className={`text-base font-sans-semibold ${
                selectedOption === 'group'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-secondary-700 dark:text-secondary-300'
              }`}
            >
              그룹으로 묶기
            </Text>
            <View className="ml-2 rounded-sm bg-primary-100 px-2 py-0.5 dark:bg-primary-800">
              <Text className="text-xs font-sans-medium text-primary-700 dark:text-primary-300">
                권장
              </Text>
            </View>
          </View>
          <Text className="ml-8 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            모든 날짜에 같은 시간대와 인원 설정을 적용합니다.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleOptionSelect('individual')}
          className={`rounded-md border-2 p-4 ${
            selectedOption === 'individual'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-secondary-200 bg-surface-page dark:bg-surface dark:border-surface-overlay'
          }`}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedOption === 'individual' }}
        >
          <View className="mb-2 flex-row items-center">
            <View
              className={`mr-3 h-5 w-5 items-center justify-center rounded-sm border-2 ${
                selectedOption === 'individual'
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-secondary-400 dark:border-surface-overlay'
              }`}
            >
              {selectedOption === 'individual' && <View className="h-2 w-2 rounded-sm bg-white" />}
            </View>
            <Text
              className={`text-base font-sans-semibold ${
                selectedOption === 'individual'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-secondary-700 dark:text-secondary-300'
              }`}
            >
              개별로 관리
            </Text>
          </View>
          <Text className="ml-8 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            각 날짜마다 다른 시간대와 인원 설정을 둘 수 있습니다.
          </Text>
        </Pressable>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={handleClose}
            className="flex-1 rounded-md bg-secondary-200 py-3 active:opacity-80 dark:bg-surface"
            accessibilityRole="button"
            accessibilityLabel="취소"
          >
            <Text className="text-center text-base font-sans-semibold text-content-secondary">
              취소
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            className="flex-1 rounded-md bg-primary-600 py-3 active:opacity-80 dark:bg-primary-500"
            accessibilityRole="button"
            accessibilityLabel="확인"
          >
            <Text className="text-center text-base font-sans-semibold text-surface-dark">확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

export default GroupingConfirmModal;
