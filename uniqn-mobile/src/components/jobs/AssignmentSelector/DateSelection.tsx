import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { TBA_TIME_MARKER } from '@/domains/application';
import { formatDateDisplay, formatTimeSlotDisplay } from '@/types/unified';
import { makeSelectionKey } from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import type { DateSelectionProps } from './types';
import { getEffectiveRoleId, getRoleCheckboxKey } from './utils';

export const DateSelection = memo(function DateSelection({
  date,
  timeSlots,
  selectedKeys,
  onRoleToggle,
  disabled,
}: DateSelectionProps) {
  const formattedDate = formatDateDisplay(date);

  return (
    <View className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-surface-dark">
      <View className="mb-3 flex-row items-center">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {formattedDate}
        </Text>
      </View>

      <View className="flex-col gap-3">
        {timeSlots.map((slot, slotIndex) => {
          const slotTime = slot.isTimeToBeAnnounced ? TBA_TIME_MARKER : (slot.startTime ?? '');
          const timeDisplay = formatTimeSlotDisplay(slot);

          return (
            <View key={slot.id || slotIndex} className="pl-2">
              <Text className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                {timeDisplay}
              </Text>
              <View className="flex-row flex-wrap pl-4">
                {slot.roles.map((role, roleIndex) => {
                  const effectiveRoleId = getEffectiveRoleId(role);
                  const selectionKey = makeSelectionKey(date, slotTime, effectiveRoleId);
                  const isSelected = selectedKeys.has(selectionKey);

                  return (
                    <RoleCheckbox
                      key={getRoleCheckboxKey(role, roleIndex)}
                      role={role}
                      isSelected={isSelected}
                      onToggle={() =>
                        onRoleToggle(date, slotTime, effectiveRoleId, {
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
    </View>
  );
});
