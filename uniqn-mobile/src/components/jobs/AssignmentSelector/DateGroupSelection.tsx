/**
 * UNIQN Mobile - 날짜 그룹 선택 컴포넌트
 *
 * @description 대회 공고용 연속 날짜 그룹 선택 UI
 */

import React, { memo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { TBA_TIME_MARKER } from '@/types';
import { formatTimeSlotDisplay } from '@/types/unified';
import { makeSelectionKey } from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import type { DateGroupSelectionProps } from './types';

/**
 * 날짜 그룹 선택 항목 (대회 공고용)
 *
 * @description 연속 날짜 그룹을 하나의 카드로 표시
 * 역할 선택 시 그룹 내 모든 날짜에 동시 적용
 *
 * @example
 * <DateGroupSelection
 *   group={scheduleGroup}
 *   selectedKeys={selectedKeysSet}
 *   onGroupRoleToggle={handleGroupRoleToggle}
 * />
 */
export const DateGroupSelection = memo(function DateGroupSelection({
  group,
  selectedKeys,
  onGroupRoleToggle,
  disabled,
}: DateGroupSelectionProps) {
  const isSingleDate = group.startDate === group.endDate;
  const dayCount = group.dates.length;

  // 그룹 내 역할 선택 상태 확인 (첫 번째 날짜 기준)
  const isGroupRoleSelected = useCallback(
    (slotTime: string, effectiveRoleId: string): boolean => {
      const firstDate = group.startDate;
      const key = makeSelectionKey(firstDate, slotTime, effectiveRoleId);
      return selectedKeys.has(key);
    },
    [group.startDate, selectedKeys]
  );

  return (
    <View className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-surface-dark">
      {/* 그룹 헤더 */}
      <View className="flex-row items-center flex-wrap mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          📅 {group.label}
        </Text>
        {!isSingleDate && (
          <Badge variant="primary" size="sm" className="ml-2">
            {dayCount}일간 동시 선택
          </Badge>
        )}
      </View>

      {/* 시간대별 역할 선택 */}
      <View className="flex-col gap-3">
        {group.timeSlots.map((slot, slotIndex) => {
          const slotTime = slot.isTimeToBeAnnounced ? TBA_TIME_MARKER : (slot.startTime ?? '');
          const timeDisplay = formatTimeSlotDisplay(slot);

          return (
            <View key={slot.id || slotIndex} className="pl-2">
              {/* 시간 표시 */}
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                🕐 {timeDisplay}
              </Text>
              {/* 역할 체크박스들 */}
              <View className="flex-row flex-wrap pl-4">
                {slot.roles.map((role, roleIndex) => {
                  const effectiveRoleId =
                    role.roleId === 'other' && role.customName ? role.customName : role.roleId;
                  const isSelected = isGroupRoleSelected(slotTime, effectiveRoleId);

                  return (
                    <RoleCheckbox
                      key={role.roleId || roleIndex}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() =>
                        onGroupRoleToggle(group, slotTime, effectiveRoleId, {
                          isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
                          tentativeDescription: slot.tentativeDescription,
                        })
                      }
                      disabled={disabled}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* 안내 문구 (여러 날짜인 경우) */}
      {!isSingleDate && (
        <View className="mt-3 pt-2 border-t border-gray-200 dark:border-surface-overlay">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            ⓘ 선택 시 {dayCount}일 모두 지원됩니다
          </Text>
        </View>
      )}
    </View>
  );
});
