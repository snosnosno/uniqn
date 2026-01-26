/**
 * UNIQN Mobile - 날짜 범위 카드
 *
 * @description 연속 날짜를 하나의 카드로 묶어 표시하고 편집하는 컴포넌트
 * @version 1.0.0
 *
 * 주요 기능:
 * - 날짜 범위 표시 (예: "1/17(금) ~ 1/19(일) (3일간)")
 * - 시간대 목록 관리 (공유)
 * - 시간대 추가/삭제
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlusIcon, TrashIcon, CalendarIcon } from '@/components/icons';
import { TimeSlotCard } from './TimeSlotCard';
import {
  formatDateRangeWithCount,
  getDayCount,
  isSingleDate,
  type DateRangeGroup,
} from '@/utils/dateRangeUtils';
import { MAX_TIME_SLOTS_PER_DATE, DEFAULT_START_TIME } from '@/constants';
import type { TimeSlot, RoleRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

export interface DateRangeCardProps {
  /** 날짜 범위 그룹 데이터 */
  group: DateRangeGroup;
  /** 그룹 인덱스 */
  index: number;
  /** 삭제 가능 여부 (최소 1개 유지) */
  canRemove: boolean;
  /** 그룹 업데이트 콜백 */
  onUpdate: (index: number, group: Partial<DateRangeGroup>) => void;
  /** 그룹 삭제 콜백 */
  onRemove: (index: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DateRangeCard({
  group,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: DateRangeCardProps) {
  // 날짜 범위 표시 텍스트
  const dateRangeLabel = useMemo(() => {
    return formatDateRangeWithCount(group.startDate, group.endDate);
  }, [group.startDate, group.endDate]);

  // 일수 계산
  const dayCount = useMemo(() => {
    return getDayCount(group.startDate, group.endDate);
  }, [group.startDate, group.endDate]);

  // 단일 날짜 여부
  const isSingle = useMemo(() => {
    return isSingleDate(group);
  }, [group]);

  // 총 인원 계산
  const totalHeadcount = useMemo(() => {
    return group.timeSlots.reduce((sum, slot) => {
      return sum + slot.roles.reduce((roleSum, r) => roleSum + (r.headcount ?? 0), 0);
    }, 0);
  }, [group.timeSlots]);

  // 시간대 추가
  const handleAddTimeSlot = useCallback(() => {
    if (group.timeSlots.length >= MAX_TIME_SLOTS_PER_DATE) {
      return;
    }

    const newTimeSlot: TimeSlot = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: DEFAULT_START_TIME,
      isTimeToBeAnnounced: false,
      roles: [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'dealer',
          headcount: 1,
        } as RoleRequirement,
      ],
    };

    onUpdate(index, {
      timeSlots: [...group.timeSlots, newTimeSlot],
    });
  }, [index, group.timeSlots, onUpdate]);

  // 시간대 업데이트
  const handleUpdateTimeSlot = useCallback(
    (timeSlotIndex: number, timeSlot: Partial<TimeSlot>) => {
      const updated = [...group.timeSlots];
      updated[timeSlotIndex] = { ...updated[timeSlotIndex]!, ...timeSlot };
      onUpdate(index, { timeSlots: updated });
    },
    [index, group.timeSlots, onUpdate]
  );

  // 시간대 삭제
  const handleRemoveTimeSlot = useCallback(
    (timeSlotIndex: number) => {
      if (group.timeSlots.length <= 1) {
        return;
      }

      const updated = group.timeSlots.filter((_, i) => i !== timeSlotIndex);
      onUpdate(index, { timeSlots: updated });
    },
    [index, group.timeSlots, onUpdate]
  );

  const canAddTimeSlot = group.timeSlots.length < MAX_TIME_SLOTS_PER_DATE;

  return (
    <View className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* 헤더 - 날짜 범위 표시 */}
      <View className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-3">
              <CalendarIcon size={20} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900 dark:text-white">
                {dateRangeLabel}
              </Text>
              <View className="flex-row items-center mt-0.5">
                {!isSingle && (
                  <View className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full mr-2">
                    <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {dayCount}일간
                    </Text>
                  </View>
                )}
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {group.timeSlots.length}개 시간대 | 총 {totalHeadcount}명
                </Text>
              </View>
            </View>
          </View>

          {/* 삭제 버튼 */}
          {canRemove && (
            <Pressable
              onPress={() => onRemove(index)}
              className="p-2 rounded-full bg-red-50 dark:bg-red-900/20"
              accessibilityRole="button"
              accessibilityLabel="일정 삭제"
            >
              <TrashIcon size={20} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>

      {/* 시간대 목록 */}
      <View className="p-4">
        <View className="gap-3 mb-3">
          {group.timeSlots.map((timeSlot, timeSlotIndex) => (
            <TimeSlotCard
              key={timeSlot.id || timeSlotIndex}
              timeSlot={timeSlot}
              index={timeSlotIndex}
              canRemove={group.timeSlots.length > 1}
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
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
              : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50'
          }`}
          accessibilityRole="button"
          accessibilityLabel="시간대 추가"
        >
          <View className="mr-2">
            <PlusIcon size={16} color={canAddTimeSlot ? '#3B82F6' : '#9CA3AF'} />
          </View>
          <Text
            className={`text-sm font-medium ${
              canAddTimeSlot
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-600'
            }`}
          >
            시간대 추가 {canAddTimeSlot && `(${group.timeSlots.length}/${MAX_TIME_SLOTS_PER_DATE})`}
          </Text>
        </Pressable>
      </View>

      {/* 하단 정보 - 여러 날짜인 경우 안내 */}
      {!isSingle && (
        <View className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            위 시간대와 인원은 {dayCount}일 모든 날짜에 동일하게 적용됩니다
          </Text>
        </View>
      )}
    </View>
  );
}
