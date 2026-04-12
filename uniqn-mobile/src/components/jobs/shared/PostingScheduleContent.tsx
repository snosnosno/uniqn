import React from 'react';
import { Text, View } from 'react-native';
import type { PostingRoleDisplayModel, PostingScheduleSource } from './postingSurfaceModel';
import { buildPostingScheduleModel, FOCUSED_GROUP_DATE_HINT } from './postingSurfaceModel';

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
  const shouldShowFocusedGroupHint = display === 'card' && source.displayContext?.wasGroupedRange;

  if (schedule.variant === 'fixed') {
    return display === 'card' ? (
      <View className="py-1">
        <Text className="text-sm text-content-secondary font-sans">
          {schedule.fixed.daysLabel} 출근
        </Text>
        <Text className="mt-0.5 text-sm text-content-secondary font-sans">
          출근시간 {schedule.fixed.timeLabel}
        </Text>
      </View>
    ) : (
      <View className="py-1">
        <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
          {schedule.fixed.daysLabel}
        </Text>
        <Text className="mt-2 text-sm font-sans-medium text-content-secondary">
          {schedule.fixed.timeLabel}
        </Text>

        {schedule.fixed.roles.length > 0 ? (
          <View className="mt-3">
            <View className="mb-1 flex-row items-center">
              <Text className="text-sm font-sans-medium text-content-secondary">모집 인원</Text>
              {showFilledCount ? (
                <Text className="ml-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
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
        <Text className="text-sm font-sans-medium text-content-secondary">
          {schedule.dateLabel}
        </Text>
        <Text className="ml-5 mt-1 text-sm text-content-primary dark:text-secondary-100 font-sans">
          {schedule.timeLabel}
        </Text>
      </View>
    ) : (
      <View className="py-1">
        <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
          {schedule.dateLabel}
        </Text>
        <Text className="mt-2 text-sm text-content-secondary font-sans">{schedule.timeLabel}</Text>
      </View>
    );
  }

  return (
    <>
      {shouldShowFocusedGroupHint ? (
        <Text className="mb-1 text-xs text-primary-600 dark:text-primary-400 font-sans">
          {FOCUSED_GROUP_DATE_HINT}
        </Text>
      ) : null}

      {schedule.sections.map((section) => (
        <View
          key={section.key}
          className={
            display === 'card' ? 'mb-2' : 'mb-3 rounded-lg bg-surface-page p-3 dark:bg-surface'
          }
        >
          <Text
            className={
              display === 'card'
                ? 'text-sm font-sans-medium text-content-secondary dark:text-secondary-300'
                : 'text-sm font-sans-semibold text-content-primary dark:text-off-white'
            }
          >
            {section.label}
          </Text>

          {section.timeSlots.map((slot) => (
            <View key={slot.key} className={display === 'card' ? 'ml-5 mt-1' : 'ml-2 mt-2'}>
              {display === 'card' ? (
                slot.roles.map((role, roleIndex) => (
                  <Text
                    key={role.key}
                    className={`text-sm font-sans ${
                      role.isFilled
                        ? 'text-secondary-400 line-through dark:text-secondary-500'
                        : 'text-secondary-900 dark:text-secondary-100'
                    } font-sans`}
                  >
                    {roleIndex === 0 ? `${slot.timeLabel} ` : '       '}
                    {formatRoleLine(role, showFilledCount)}
                  </Text>
                ))
              ) : (
                <>
                  <Text className="mb-1 text-sm font-sans-medium text-content-secondary">
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
          ? 'bg-secondary-200 dark:bg-surface-overlay'
          : 'bg-primary-100 dark:bg-primary-900/30'
      }`}
    >
      <Text
        className={`text-xs font-sans ${
          role.isFilled
            ? 'text-secondary-500 line-through dark:text-secondary-400'
            : 'text-primary-700 dark:text-primary-300'
        } font-sans`}
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
