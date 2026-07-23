import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  PostingRoleDisplayModel,
  PostingScheduleModel,
  PostingScheduleSource,
} from './postingSurfaceModel';
import { buildPostingScheduleModel, FOCUSED_GROUP_DATE_HINT } from './postingSurfaceModel';

interface PostingScheduleContentProps extends PostingScheduleSource {
  display: 'card' | 'detail';
  showFilledCount?: boolean;
  filledCounts?: Map<string, number>;
  /**
   * 상위에서 이미 생성한 스케줄 모델. 주입 시 재생성하지 않고 그대로 렌더에 사용해
   * a11y label 모델과의 이원화(0/N 드리프트 소지)를 방지한다(S2). 미주입 시
   * source + filledCounts 로 생성 — 기존 호출부(JobDetail 등) 동작 완전 보존.
   */
  schedule?: PostingScheduleModel;
}

export function PostingScheduleContent({
  display,
  showFilledCount = true,
  filledCounts,
  schedule: providedSchedule,
  ...source
}: PostingScheduleContentProps) {
  const schedule = providedSchedule ?? buildPostingScheduleModel(source, filledCounts);
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

      {schedule.sections.map((section) => {
        const dateRangeText = section.label; // 단일 행 라벨 — split 불필요
        // 그룹 섹션: card=요약만, detail=일별 전개(8일↑ 기본 접힘)
        const renderDays = display === 'detail' && section.days && section.days.length > 0;

        return (
          <View
            key={section.key}
            className={
              display === 'card' ? 'mb-3' : 'mb-3 rounded-lg bg-surface-page dark:bg-surface p-3'
            }
          >
            <Text
              className={
                display === 'card'
                  ? 'text-sm font-sans-bold text-content-primary'
                  : 'text-sm font-sans-semibold text-content-primary'
              }
            >
              {dateRangeText}
            </Text>

            {renderDays ? (
              <GroupedDaysBlock section={section} showFilledCount={showFilledCount} />
            ) : (
              section.timeSlots.map((slot) => (
                <View
                  key={slot.key}
                  className={display === 'card' ? 'mt-1.5 flex-row' : 'ml-2 mt-2'}
                >
                  {display === 'card' ? (
                    <>
                      <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
                        {slot.timeLabel}{' '}
                      </Text>
                      <View className="flex-1 gap-0.5">
                        {slot.roles.map((role) => (
                          <Text
                            key={role.key}
                            className={`text-sm font-sans ${
                              role.isFilled
                                ? 'text-secondary-400 line-through dark:text-secondary-500'
                                : 'text-content-primary'
                            }`}
                          >
                            {formatRoleLine(role, showFilledCount)}
                          </Text>
                        ))}
                      </View>
                    </>
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
              ))
            )}
          </View>
        );
      })}
    </>
  );
}

const COLLAPSE_THRESHOLD_DAYS = 8;

/**
 * 그룹 날짜범위 섹션의 detail 일별 전개 블록.
 * 8일 이상이면 기본 접힘(요약 timeSlots만) + '펼치기' 토글로 일별 상세를 연다.
 */
function GroupedDaysBlock({
  section,
  showFilledCount,
}: {
  section: Extract<PostingScheduleModel, { variant: 'dated' }>['sections'][number];
  showFilledCount: boolean;
}) {
  const days = section.days ?? [];
  const [expanded, setExpanded] = React.useState(days.length < COLLAPSE_THRESHOLD_DAYS);

  if (!expanded) {
    return (
      <View className="ml-2 mt-2">
        {section.timeSlots.map((slot) => (
          <View key={slot.key} className="mt-1">
            <Text className="mb-1 text-sm font-sans-medium text-content-secondary">
              {slot.timeLabel}
            </Text>
            <View className="ml-4 flex-row flex-wrap">
              {slot.roles.map((role) => (
                <RoleBadge key={role.key} role={role} showFilledCount={showFilledCount} />
              ))}
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="일별 인원 펼치기"
          className="mt-2 min-h-[44px] justify-center"
        >
          <Text className="text-sm text-primary-600 dark:text-primary-400 font-sans">
            일별 인원 보기 ({days.length}일)
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="ml-2 mt-2 gap-2">
      {days.map((day) => (
        <View key={day.key}>
          <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
            {day.label}
          </Text>
          {day.timeSlots.map((slot) => (
            <View key={slot.key} className="ml-2 mt-1">
              <Text className="mb-1 text-sm font-sans-medium text-content-secondary">
                {slot.timeLabel}
              </Text>
              <View className="ml-4 flex-row flex-wrap">
                {slot.roles.map((role) => (
                  <RoleBadge key={role.key} role={role} showFilledCount={showFilledCount} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
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
          : 'bg-secondary-100 dark:bg-surface-elevated'
      }`}
    >
      <Text
        className={`text-xs font-sans ${
          role.isFilled
            ? 'text-secondary-500 line-through dark:text-secondary-400'
            : 'text-secondary-700 dark:text-secondary-200'
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
