/**
 * UNIQN Mobile - 날짜 요구사항 카드
 *
 * @description 날짜별 요구사항을 표시하고 편집하는 카드
 * @version 2.0.0
 *
 * 주요 기능:
 * - 날짜 표시 및 삭제
 * - 시간대 목록 관리
 * - 시간대 추가/삭제
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { formatDateWithDay } from '@/utils/dateUtils';
import { TimeSlotCard } from './TimeSlotCard';
import { MAX_TIME_SLOTS_PER_DATE, DEFAULT_START_TIME } from '@/constants';
import { useToast } from '@/stores/toastStore';
import { generateId } from '@/utils/generateId';
import type { DateSpecificRequirement, TimeSlot } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

export interface DateRequirementCardProps {
  /** 날짜 요구사항 데이터 */
  requirement: DateSpecificRequirement;
  /** 인덱스 */
  index: number;
  /** 삭제 가능 여부 (최소 1개 유지) */
  canRemove: boolean;
  /** 날짜 업데이트 콜백 */
  onUpdate: (index: number, requirement: Partial<DateSpecificRequirement>) => void;
  /** 날짜 삭제 콜백 */
  onRemove: (index: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DateRequirementCard({
  requirement,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: DateRequirementCardProps) {
  const toast = useToast();

  // 날짜 문자열 추출
  const getDateString = (dateInput: DateSpecificRequirement['date']): string => {
    if (typeof dateInput === 'string') return dateInput;
    if ('toDate' in dateInput && typeof dateInput.toDate === 'function') {
      return dateInput.toDate().toISOString().split('T')[0] ?? '';
    }
    if ('seconds' in dateInput) {
      return new Date(dateInput.seconds * 1000).toISOString().split('T')[0] ?? '';
    }
    return '';
  };

  const dateString = getDateString(requirement.date);

  // 시간대 추가
  const handleAddTimeSlot = useCallback(() => {
    if (requirement.timeSlots.length >= MAX_TIME_SLOTS_PER_DATE) {
      toast.warning(`시간대는 최대 ${MAX_TIME_SLOTS_PER_DATE}개까지 추가할 수 있습니다`);
      return;
    }

    const newTimeSlot: TimeSlot = {
      id: generateId(),
      startTime: DEFAULT_START_TIME,
      isTimeToBeAnnounced: false,
      roles: [
        {
          id: generateId(),
          role: 'dealer',
          headcount: 1,
        },
      ],
    };

    const updated: Partial<DateSpecificRequirement> = {
      timeSlots: [...requirement.timeSlots, newTimeSlot],
    };
    onUpdate(index, updated);
  }, [index, requirement.timeSlots, onUpdate, toast]);

  // 시간대 업데이트
  const handleUpdateTimeSlot = useCallback(
    (timeSlotIndex: number, timeSlot: Partial<TimeSlot>) => {
      const updated = [...requirement.timeSlots];
      updated[timeSlotIndex] = { ...updated[timeSlotIndex]!, ...timeSlot };
      onUpdate(index, { timeSlots: updated });
    },
    [index, requirement.timeSlots, onUpdate]
  );

  // 시간대 삭제
  const handleRemoveTimeSlot = useCallback(
    (timeSlotIndex: number) => {
      if (requirement.timeSlots.length <= 1) {
        toast.warning('최소 1개의 시간대가 필요합니다');
        return;
      }

      const updated = requirement.timeSlots.filter((_, i) => i !== timeSlotIndex);
      onUpdate(index, { timeSlots: updated });
    },
    [index, requirement.timeSlots, onUpdate, toast]
  );

  const canAddTimeSlot = requirement.timeSlots.length < MAX_TIME_SLOTS_PER_DATE;

  return (
    <View className="p-4 bg-white dark:bg-surface rounded-lg border border-gray-200 dark:border-surface-overlay mb-3">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {dateString ? formatDateWithDay(dateString) : '날짜 선택 필요'}
        </Text>

        {/* 삭제 버튼 */}
        {canRemove && (
          <Pressable
            onPress={() => onRemove(index)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            accessibilityRole="button"
            accessibilityLabel="날짜 삭제"
          >
            <TrashIcon size={20} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* 시간대 목록 */}
      <View className="gap-3 mb-3">
        {requirement.timeSlots.map((timeSlot, timeSlotIndex) => (
          <TimeSlotCard
            key={timeSlot.id || timeSlotIndex}
            timeSlot={timeSlot}
            index={timeSlotIndex}
            canRemove={requirement.timeSlots.length > 1}
            onUpdate={handleUpdateTimeSlot}
            onRemove={handleRemoveTimeSlot}
          />
        ))}
      </View>

      {/* 시간대 추가 버튼 */}
      <Pressable
        onPress={handleAddTimeSlot}
        disabled={!canAddTimeSlot}
        className={`flex-row items-center justify-center p-3 rounded-lg border border-dashed ${
          canAddTimeSlot
            ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
            : 'border-gray-300 dark:border-surface-overlay bg-gray-50 dark:bg-surface opacity-50'
        }`}
        accessibilityRole="button"
        accessibilityLabel="시간대 추가"
      >
        <View className="mr-2">
          <PlusIcon size={16} color={canAddTimeSlot ? '#A855F7' : '#9CA3AF'} />
        </View>
        <Text
          className={`text-sm font-medium ${
            canAddTimeSlot
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-400 dark:text-gray-600'
          }`}
        >
          시간대 추가{' '}
          {canAddTimeSlot && `(${requirement.timeSlots.length}/${MAX_TIME_SLOTS_PER_DATE})`}
        </Text>
      </Pressable>
    </View>
  );
}
