/**
 * UNIQN Mobile - ?좎쭨 ?좏깮 而댄룷?뚰듃
 *
 * @description 媛쒕퀎 ?좎쭨???쒓컙?蹂???븷 ?좏깮 UI
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { TBA_TIME_MARKER } from '@/domains/application';
import { formatDateDisplay, formatTimeSlotDisplay } from '@/types/unified';
import { makeSelectionKey } from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import type { DateSelectionProps } from './types';
import { getEffectiveRoleId, getRoleCheckboxKey } from './utils';

/**
 * ?좎쭨/?쒓컙? ?좏깮 ??ぉ (??븷 泥댄겕諛뺤뒪 ?ы븿)
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
  selectedKeys,
  onRoleToggle,
  disabled,
}: DateSelectionProps) {
  const formattedDate = formatDateDisplay(date);

  return (
    <View className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-surface-dark">
      {/* ?좎쭨 ?ㅻ뜑 */}
      <View className="flex-row items-center mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          ?뱟 {formattedDate}
        </Text>
      </View>

      {/* ?쒓컙?蹂???븷 ?좏깮 */}
      <View className="flex-col gap-3">
        {timeSlots.map((slot, slotIndex) => {
          // ?쒓컙 誘몄젙?대㈃ TBA_TIME_MARKER, ?꾨땲硫?startTime ?ъ슜
          const slotTime = slot.isTimeToBeAnnounced ? TBA_TIME_MARKER : (slot.startTime ?? '');
          const timeDisplay = formatTimeSlotDisplay(slot);

          return (
            <View key={slot.id || slotIndex} className="pl-2">
              {/* ?쒓컙 ?쒖떆 */}
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                ?븧 {timeDisplay}
              </Text>
              {/* ??븷 泥댄겕諛뺤뒪??*/}
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
