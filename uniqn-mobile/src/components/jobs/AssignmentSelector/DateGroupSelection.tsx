/**
 * UNIQN Mobile - ?좎쭨 洹몃９ ?좏깮 而댄룷?뚰듃
 *
 * @description ???怨듦퀬???곗냽 ?좎쭨 洹몃９ ?좏깮 UI
 */

import React, { memo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { TBA_TIME_MARKER } from '@/domains/application';
import { formatTimeSlotDisplay } from '@/types/unified';
import { makeSelectionKey } from '@/utils/assignment';
import { RoleCheckbox } from './RoleCheckbox';
import type { DateGroupSelectionProps } from './types';
import { getEffectiveRoleId, getRoleCheckboxKey } from './utils';

/**
 * ?좎쭨 洹몃９ ?좏깮 ??ぉ (???怨듦퀬??
 *
 * @description ?곗냽 ?좎쭨 洹몃９???섎굹??移대뱶濡??쒖떆
 * ??븷 ?좏깮 ??洹몃９ ??紐⑤뱺 ?좎쭨???숈떆 ?곸슜
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

  // 洹몃９ ????븷 ?좏깮 ?곹깭 ?뺤씤 (泥?踰덉㎏ ?좎쭨 湲곗?)
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
      {/* 洹몃９ ?ㅻ뜑 */}
      <View className="flex-row items-center flex-wrap mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          ?뱟 {group.label}
        </Text>
        {!isSingleDate && (
          <Badge variant="primary" size="sm" className="ml-2">
            {dayCount}?쇨컙 ?숈떆 ?좏깮
          </Badge>
        )}
      </View>

      {/* ?쒓컙?蹂???븷 ?좏깮 */}
      <View className="flex-col gap-3">
        {group.timeSlots.map((slot, slotIndex) => {
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

      {/* ?덈궡 臾멸뎄 (?щ윭 ?좎쭨??寃쎌슦) */}
      {!isSingleDate && (
        <View className="mt-3 pt-2 border-t border-gray-200 dark:border-surface-overlay">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            ???좏깮 ??{dayCount}??紐⑤몢 吏?먮맗?덈떎
          </Text>
        </View>
      )}
    </View>
  );
});
