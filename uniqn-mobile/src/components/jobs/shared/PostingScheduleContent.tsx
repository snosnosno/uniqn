import React from 'react';
import { Text, View } from 'react-native';
import type { PostingRoleDisplayModel, PostingScheduleSource } from './postingSurfaceModel';
import { buildPostingScheduleModel } from './postingSurfaceModel';

interface PostingScheduleContentProps extends PostingScheduleSource {
  display: 'card' | 'detail';
  showFilledCount?: boolean;
}

export function PostingScheduleContent({
  display,
  showFilledCount = true,
  ...source
}: PostingScheduleContentProps) {
  const schedule = buildPostingScheduleModel(source);

  if (schedule.variant === 'fixed') {
    return display === 'card' ? (
      <View className="py-1">
        <Text className="text-sm text-gray-700 dark:text-gray-300">
          📅 {schedule.fixed.daysLabel} 출근
        </Text>
        <Text className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
          ⏰ 출근시간 {schedule.fixed.timeLabel}
        </Text>
      </View>
    ) : (
      <View className="py-1">
        <Text className="text-sm font-medium text-gray-900 dark:text-white">
          📅 {schedule.fixed.daysLabel}
        </Text>
        <Text className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          ⏰ {schedule.fixed.timeLabel}
        </Text>

        {schedule.fixed.roles.length > 0 ? (
          <View className="mt-3">
            <View className="mb-1 flex-row items-center">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                👥 모집 인원
              </Text>
              {showFilledCount ? (
                <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {schedule.fixed.filledCount}/{schedule.fixed.totalCount}명
                </Text>
              ) : null}
            </View>
            <View className="ml-5 flex-row flex-wrap">
              {schedule.fixed.roles.map((role) => (
                <RoleBadge key={role.key} role={role} showFilledCount={showFilledCount} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  if (schedule.variant === 'legacy') {
    return display === 'card' ? (
      <View className="mb-2">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
          📅 {schedule.dateLabel}
        </Text>
        <Text className="ml-5 mt-1 text-sm text-gray-900 dark:text-gray-100">
          ⏰ {schedule.timeLabel}
        </Text>
      </View>
    ) : (
      <View className="py-1">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
          {schedule.dateLabel}
        </Text>
        <Text className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          ⏰ {schedule.timeLabel}
        </Text>
      </View>
    );
  }

  return (
    <>
      {schedule.sections.map((section) => (
        <View
          key={section.key}
          className={display === 'card' ? 'mb-2' : 'mb-3 rounded-lg bg-gray-50 p-3 dark:bg-surface'}
        >
          <Text
            className={
              display === 'card'
                ? 'text-sm font-medium text-gray-700 dark:text-gray-300'
                : 'text-sm font-semibold text-gray-900 dark:text-white'
            }
          >
            📅 {section.label}
          </Text>

          {section.timeSlots.map((slot) => (
            <View key={slot.key} className={display === 'card' ? 'ml-5 mt-1' : 'ml-2 mt-2'}>
              {display === 'card' ? (
                slot.roles.map((role, roleIndex) => (
                  <Text
                    key={role.key}
                    className={`text-sm ${
                      role.isFilled
                        ? 'text-gray-400 line-through dark:text-gray-500'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {roleIndex === 0 ? `${slot.timeLabel} ` : '       '}
                    {formatRoleLine(role, showFilledCount)}
                  </Text>
                ))
              ) : (
                <>
                  <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {slot.timeLabel}
                  </Text>
                  <View className="ml-4 flex-row flex-wrap">
                    {slot.roles.map((role) => (
                      <RoleBadge key={role.key} role={role} showFilledCount={showFilledCount} />
                    ))}
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function RoleBadge({
  role,
  showFilledCount,
}: {
  key?: string;
  role: PostingRoleDisplayModel;
  showFilledCount: boolean;
}) {
  return (
    <View
      className={`mr-2 mb-1 rounded-md px-2 py-1 ${
        role.isFilled
          ? 'bg-gray-200 dark:bg-surface-overlay'
          : 'bg-primary-100 dark:bg-primary-900/30'
      }`}
    >
      <Text
        className={`text-xs ${
          role.isFilled
            ? 'text-gray-500 line-through dark:text-gray-400'
            : 'text-primary-700 dark:text-primary-300'
        }`}
      >
        {formatRoleLine(role, showFilledCount)}
      </Text>
    </View>
  );
}

function formatRoleLine(role: PostingRoleDisplayModel, showFilledCount: boolean) {
  return showFilledCount
    ? `${role.label} ${role.count}명 (${role.filled}/${role.count})`
    : `${role.label} ${role.count}명`;
}

export default PostingScheduleContent;
