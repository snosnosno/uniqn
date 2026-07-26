/**
 * UNIQN Mobile - GroupedScheduleCard component
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation, AccessibilityInfo } from 'react-native';
import { CardStripe, Badge } from '@/components/ui';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  BriefcaseIcon,
  BanknotesIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@/components/icons';
import { formatDateDisplay, formatRolesDisplay } from '@/utils/scheduleGrouping';
import { parseTimeSlot } from '@/utils/date/ranges';
import { formatGroupSalaryDisplay, SCHEDULE_STATUS_STRIPE_TONE } from './helpers';
import { STATUS } from '@/constants';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import { WorkTimeDisplay } from '@/shared/time';
import { SCHEDULE_STATUS, ATTENDANCE_STATUS } from '@/constants/statusConfig';
import type { GroupedScheduleEvent } from '@/types';

export interface GroupedScheduleCardProps {
  group: GroupedScheduleEvent;
  onPress?: () => void;
  onDatePress?: (date: string, scheduleEventId: string) => void;
  defaultExpanded?: boolean;
}

export const GroupedScheduleCard = memo(function GroupedScheduleCard({
  group,
  onPress,
  onDatePress,
  defaultExpanded = false,
}: GroupedScheduleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const status = SCHEDULE_STATUS[group.type];
  const isCancelled = group.type === STATUS.SCHEDULE.CANCELLED;
  const hasPendingCancellation = group.originalEvents.some((event) => event.isCancellationPending);

  const rolesDisplay = useMemo(
    () => formatRolesDisplay(group.roles, group.customRoles),
    [group.roles, group.customRoles]
  );
  const dateDisplay = useMemo(
    () => formatDateDisplay(group.dateRange.dates),
    [group.dateRange.dates]
  );
  // 공고 기본 단가가 아니라 **내가 맡은 역할**의 단가를 쓴다.
  const salaryDisplay = useMemo(
    () => formatGroupSalaryDisplay(group.postingProjection, group.roles, group.customRoles),
    [group.postingProjection, group.roles, group.customRoles]
  );
  const ownerName = group.postingProjection?.ownerName;

  // 시간 표시는 SSOT(WorkTimeDisplay) 경유 — 심야(자정 넘김) 근무는 종료 시각에 "익일"을 병기한다.
  // 시작·종료가 모두 해석되는 "HH:mm - HH:mm" 만 라벨로 변환하고,
  // 파싱 불가(단일 시각·"협의" 등)면 원문을 그대로 유지한다(빈칸/미정 표시 방지).
  const timeSlotLabel = useMemo(() => {
    const parsed = parseTimeSlot(group.timeSlot);
    if (!parsed || !parsed.end) return group.timeSlot;

    const info = WorkTimeDisplay.getDisplayInfo({
      timeSlot: group.timeSlot,
      date: group.dateRange.start,
    });
    return info.isEndNextDay
      ? `${info.scheduledStart} – 익일 ${info.scheduledEnd}`
      : `${info.scheduledStart} – ${info.scheduledEnd}`;
  }, [group.timeSlot, group.dateRange.start]);

  const attendanceSummary = useMemo(() => {
    if (group.type !== STATUS.SCHEDULE.CONFIRMED) return null;

    const checkedIn = group.dateStatuses.filter(
      (d) => d.status === STATUS.ATTENDANCE.CHECKED_IN
    ).length;
    const checkedOut = group.dateStatuses.filter(
      (d) => d.status === STATUS.ATTENDANCE.CHECKED_OUT
    ).length;

    if (checkedIn > 0) return { label: '근무 중', status: STATUS.ATTENDANCE.CHECKED_IN };
    if (checkedOut > 0) return { label: '퇴근 완료', status: STATUS.ATTENDANCE.CHECKED_OUT };
    return { label: '출근 전', status: STATUS.ATTENDANCE.NOT_STARTED };
  }, [group.type, group.dateStatuses]);

  // Reduce Motion 대응. 공용 `useReduceMotion` 훅은 애니메이션 토큰 브랜치에 있어
  // 여기서는 중복 훅을 만들지 않고 직접 읽는다(머지 후 공용 훅으로 교체).
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const toggleExpanded = useCallback(() => {
    // 모션을 줄이도록 설정한 사용자에게 펼침 애니메이션을 강행하지 않는다.
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsExpanded((prev) => !prev);
  }, [reduceMotion]);

  const handleDatePress = useCallback(
    (date: string, scheduleEventId: string) => {
      onDatePress?.(date, scheduleEventId);
    },
    [onDatePress]
  );

  // 그룹은 동일 공고의 동일 ScheduleType 일정만 묶이므로 group.type 으로 tone 결정.
  const stripeTone = SCHEDULE_STATUS_STRIPE_TONE[group.type];

  // 스크린리더 라벨은 완결 문장이어야 한다. 예전엔 '○○홀덤 일정 상세 보기, 3일' 한 문장뿐이라
  // 상태·기간·근무지·출퇴근 요약이 전부 빠졌다.
  const cardAccessibilityLabel = [
    status.label,
    group.jobPostingName,
    dateDisplay,
    group.location,
    attendanceSummary?.label,
    hasPendingCancellation ? '취소 요청 검토 중' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      // RN Pressable 은 기본 accessible=true 라 내부 요소(펼치기 버튼·날짜 행)를 통째로
      // 흡수한다. 컨테이너를 접근성에서 빼야 안쪽 컨트롤이 스크린리더에 도달한다.
      accessible={false}
      accessibilityRole="button"
      accessibilityLabel={cardAccessibilityLabel}
    >
      <CardStripe tone={stripeTone} style={{ marginBottom: 12 }}>
        <View
          className={`bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3 ${
            isCancelled ? 'opacity-60' : ''
          }`}
        >
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 flex-row flex-wrap items-center">
              <Badge variant="chip" dot>
                {status.label}
              </Badge>

              <View className="ml-2 rounded-sm bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
                <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                  {group.dateRange.totalDays}일
                </Text>
              </View>

              {attendanceSummary && (
                <View
                  className={`ml-2 rounded-sm px-2 py-0.5 ${
                    ATTENDANCE_STATUS[attendanceSummary.status].bgColor
                  }`}
                >
                  <Text
                    className={`text-xs font-sans-medium ${
                      ATTENDANCE_STATUS[attendanceSummary.status].textColor
                    }`}
                  >
                    {attendanceSummary.label}
                  </Text>
                </View>
              )}

              {hasPendingCancellation && (
                <View className="ml-2">
                  <Badge variant="warning">{APPLICATION_STATUS_LABELS.cancellation_pending}</Badge>
                </View>
              )}
            </View>
          </View>

          <Text
            className={`mb-2 text-base font-sans-semibold ${
              isCancelled
                ? 'text-secondary-400 dark:text-secondary-500 line-through'
                : 'text-content-primary'
            }`}
            numberOfLines={1}
          >
            {group.jobPostingName}
          </Text>

          {group.location && (
            <View className="mb-2 flex-row items-center">
              <MapIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text
                className="ml-1.5 flex-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans"
                numberOfLines={1}
              >
                {group.location}
              </Text>
            </View>
          )}

          <View className="mb-2 flex-row items-center">
            <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
              {dateDisplay}
            </Text>
          </View>

          {group.timeSlot && (
            <View className="mb-2 flex-row items-center">
              <ClockIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
                {timeSlotLabel}
              </Text>
            </View>
          )}

          <View className="flex-row flex-wrap items-center">
            <View className="mr-3 flex-row items-center">
              <BriefcaseIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1.5 text-sm text-content-secondary font-sans">
                {rolesDisplay}
              </Text>
            </View>

            {/* 확정에도 급여를 남긴다 — '언제/어디서/얼마'가 카드 3요소인데, 지원 중에 보이던
                금액이 확정되는 순간(실제로 돈이 걸린 순간) 사라지고 있었다. */}
            {(group.type === STATUS.SCHEDULE.APPLIED || group.type === STATUS.SCHEDULE.CONFIRMED) &&
              salaryDisplay && (
                <View className="mr-3 flex-row items-center">
                  <BanknotesIcon size={14} color={SECONDARY_PALETTE[500]} />
                  <Text className="ml-1.5 text-sm font-sans-medium text-content-secondary">
                    {salaryDisplay}
                  </Text>
                </View>
              )}

            {ownerName &&
              (group.type === STATUS.SCHEDULE.APPLIED ||
                group.type === STATUS.SCHEDULE.CONFIRMED) && (
                <View className="flex-row items-center">
                  <UserIcon size={14} color={SECONDARY_PALETTE[400]} />
                  <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                    {ownerName}
                  </Text>
                </View>
              )}
          </View>

          {group.dateRange.totalDays > 1 && (
            <Pressable
              onPress={toggleExpanded}
              className="mt-3 flex-row items-center justify-center border-t border-secondary-200 py-2 dark:border-surface-overlay"
              accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
            >
              <Text className="mr-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                날짜별 상세
              </Text>
              {isExpanded ? (
                <ChevronUpIcon size={16} color={SECONDARY_PALETTE[500]} />
              ) : (
                <ChevronDownIcon size={16} color={SECONDARY_PALETTE[500]} />
              )}
            </Pressable>
          )}

          {isExpanded && (
            <View className="mt-2 border-t border-secondary-100 pt-2 dark:border-surface-overlay">
              {group.dateStatuses.map((dateStatus, index) => {
                const attendance = ATTENDANCE_STATUS[dateStatus.status];
                return (
                  <Pressable
                    key={dateStatus.date}
                    onPress={() => handleDatePress(dateStatus.date, dateStatus.scheduleEventId)}
                    className={`flex-row items-center justify-between py-2 ${
                      index < group.dateStatuses.length - 1
                        ? 'border-b border-secondary-100 dark:border-surface-overlay/50'
                        : ''
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`${dateStatus.formattedDate} ${attendance.label}, 이 날짜 상세 보기`}
                  >
                    <Text className="text-sm text-content-secondary font-sans">
                      {dateStatus.formattedDate}
                    </Text>
                    <View className={`rounded-sm px-2 py-0.5 ${attendance.bgColor}`}>
                      <Text className={`text-xs font-sans-medium ${attendance.textColor}`}>
                        {attendance.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {hasPendingCancellation && (
            <View className="mt-3 rounded-lg bg-warning-50 px-3 py-2 dark:bg-warning-900/20">
              <Text className="text-center text-xs text-warning-700 dark:text-warning-400 font-sans">
                취소 요청 검토 중입니다.
              </Text>
            </View>
          )}

          {isCancelled && (
            <View className="mt-3 rounded-lg bg-error-50 px-3 py-2 dark:bg-error-900/20">
              <Text className="text-center text-xs text-error-600 dark:text-error-400 font-sans">
                이 일정이 취소되었습니다.
              </Text>
            </View>
          )}
        </View>
      </CardStripe>
    </Pressable>
  );
});
