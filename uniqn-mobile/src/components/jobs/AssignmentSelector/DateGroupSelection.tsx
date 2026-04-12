import React, { memo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { TBA_TIME_MARKER } from '@/domains/application';
import { formatTimeSlotDisplay } from '@/types/unified';
import { makeSelectionKey } from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import type { DateGroupSelectionProps } from './types';
import { getEffectiveRoleId, getRoleCheckboxKey } from './utils';

export const DateGroupSelection = memo(function DateGroupSelection({
  group,
  selectedKeys,
  onGroupRoleToggle,
  disabled,
}: DateGroupSelectionProps) {
  const isSingleDate = group.startDate === group.endDate;
  const dayCount = group.dates.length;

  const isGroupRoleSelected = useCallback(
    (slotTime: string, effectiveRoleId: string): boolean => {
      const key = makeSelectionKey(group.startDate, slotTime, effectiveRoleId);
      return selectedKeys.has(key);
    },
    [group.startDate, selectedKeys]
  );

  return (
    <View className="mb-3 rounded-lg bg-secondary-50 p-3 dark:bg-surface-dark">
      <View className="mb-3 flex-row flex-wrap items-center">
        <Text className="text-base font-semibold text-secondary-900 dark:text-off-white">
          {group.label}
        </Text>
        {!isSingleDate && (
          <Badge variant="primary" size="sm" className="ml-2">
            {dayCount}일 묶음 선택
          </Badge>
        )}
      </View>

      <View className="flex-col gap-3">
        {group.timeSlots.map((slot, slotIndex) => {
          const slotTime = slot.isTimeToBeAnnounced ? TBA_TIME_MARKER : (slot.startTime ?? '');
          const timeDisplay = formatTimeSlotDisplay(slot);

          return (
            <View key={slot.id || slotIndex} className="pl-2">
              <Text className="mb-2 text-sm font-medium text-secondary-600 dark:text-secondary-400">
                {timeDisplay}
              </Text>
              <View className="flex-row flex-wrap pl-4">
                {slot.roles.map((role, roleIndex) => {
                  const effectiveRoleId = getEffectiveRoleId(role);
                  const isSelected = isGroupRoleSelected(slotTime, effectiveRoleId);

                  return (
                    <RoleCheckbox
                      key={getRoleCheckboxKey(role, roleIndex)}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() =>
                        onGroupRoleToggle(group, slotTime, effectiveRoleId, {
                          assignmentGroupId: slot.id,
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

      {!isSingleDate && (
        <View className="mt-3 border-t border-secondary-200 pt-2 dark:border-surface-overlay">
          <Text className="text-center text-xs text-secondary-500 dark:text-secondary-400">
            선택하면 {dayCount}일 모두 같은 역할로 함께 지원됩니다.
          </Text>
        </View>
      )}
    </View>
  );
});
