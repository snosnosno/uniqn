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

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { formatDateWithDay, toDateString } from '@/utils/date';
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

  const dateString = toDateString(requirement.date);

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
    <View className="p-4 bg-white dark:bg-surface rounded-lg border border-divider mb-3">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-sans-semibold text-content-primary dark:text-secondary-100">
          {dateString ? formatDateWithDay(dateString) : '날짜 선택 필요'}
        </Text>

        {/* 삭제 버튼 */}
        {canRemove && (
          <Pressable
            onPress={() => onRemove(index)}
            className="p-2 rounded-sm hover:bg-secondary-100 dark:hover:bg-secondary-700"
            accessibilityRole="button"
            accessibilityLabel="날짜 삭제"
          >
            <TrashIcon size={20} color="#DC2626" />
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
            : 'border-secondary-300 dark:border-surface-overlay bg-surface-page opacity-50'
        }`}
        accessibilityRole="button"
        accessibilityLabel="시간대 추가"
      >
        <View className="mr-2">
          <PlusIcon size={16} color={canAddTimeSlot ? '#D4AF37' : SECONDARY_PALETTE[400]} />
        </View>
        <Text
          className={`text-sm font-sans-medium ${
            canAddTimeSlot
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-secondary-400 dark:text-secondary-600'
          }`}
        >
          시간대 추가{' '}
          {canAddTimeSlot && `(${requirement.timeSlots.length}/${MAX_TIME_SLOTS_PER_DATE})`}
        </Text>
      </Pressable>
    </View>
  );
}
