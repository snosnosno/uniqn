/**
 * UNIQN Mobile - 날짜 선택 컴포넌트
 *
 * @description 개별 날짜의 시간대별 역할 선택 UI
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { TBA_TIME_MARKER } from '@/types';
import { formatDateDisplay, formatTimeSlotDisplay } from '@/types/unified';
import { makeSelectionKey } from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import type { DateSelectionProps } from './types';

/**
 * 날짜/시간대 선택 항목 (역할 체크박스 포함)
 *
 * @example
 * <DateSelection
 *   date="2024-01-15"
 *   timeSlots={[{ startTime: '09:00', roles: [...] }]}
 *   selectedKeys={selectedKeysSet}
 *   onRoleToggle={handleRoleToggle}
 * />
 */
export const DateSelection = memo(function DateSelection({
  date,
  timeSlots,
  isMainDate,
  description,
  selectedKeys,
  onRoleToggle,
  disabled,
}: DateSelectionProps) {
  const formattedDate = formatDateDisplay(date);

  return (
    <View className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
      {/* 날짜 헤더 */}
      <View className="flex-row items-center mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          📅 {formattedDate}
        </Text>
        {isMainDate && (
          <Badge variant="primary" size="sm" className="ml-2">
            메인
          </Badge>
        )}
      </View>

      {description && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {description}
        </Text>
      )}

      {/* 시간대별 역할 선택 */}
      <View className="flex-col gap-3">
        {timeSlots.map((slot, slotIndex) => {
          // 시간 미정이면 TBA_TIME_MARKER, 아니면 startTime 사용
          const slotTime = slot.isTimeToBeAnnounced
            ? TBA_TIME_MARKER
            : (slot.startTime ?? '');
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
                  // 커스텀 역할이면 customName을 키로 사용 (roles[].salary 구조와 일치)
                  const effectiveRoleId = role.roleId === 'other' && role.customName
                    ? role.customName
                    : role.roleId;
                  const selectionKey = makeSelectionKey(date, slotTime, effectiveRoleId);
                  const isSelected = selectedKeys.has(selectionKey);

                  return (
                    <RoleCheckbox
                      key={role.roleId || roleIndex}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() => onRoleToggle(date, slotTime, effectiveRoleId, {
                        isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
                        tentativeDescription: slot.tentativeDescription,
                      })}
                      disabled={disabled}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});
