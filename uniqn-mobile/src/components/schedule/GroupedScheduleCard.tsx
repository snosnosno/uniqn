/**
 * UNIQN Mobile - GroupedScheduleCard component
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
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
import {
  formatGroupSalaryDisplay,
  formatWorkTimeRange,
  SCHEDULE_STATUS_STRIPE_TONE,
  NO_SHOW_NOTICE_TITLE,
  NO_SHOW_NOTICE_DESCRIPTION,
} from './helpers';
import { STATUS } from '@/constants';
// 배럴(@/hooks)이 아니라 직접 경로 — 훅 파일 주석의 순환 참조 경고를 따른다.
import { useReduceMotion } from '@/hooks/useReduceMotion';
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
  // 그룹 키에 type 이 들어가므로(createGroupKey) 노쇼 일자는 별도 그룹/카드로 갈라진다.
  // 취소와 달리 흐리게 처리하지 않는다 — 이의 제기 기한이 있는 기록이다.
  const isNoShow = group.type === STATUS.SCHEDULE.NO_SHOW;
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

  // 시간 표시는 SSOT(WorkTimeDisplay + formatWorkTimeRange) 경유 — 심야(자정 넘김) 근무는
  // 종료 시각에 "익일"을 병기하고, 단일 시각은 "HH:mm 시작", 시각이 없으면 상태에 맞는
  // 문장('출근 시간 미정' / '시간 협의')을 받는다.
  //
  // 예전엔 이 카드만 자체 규칙을 썼다: 파싱 실패 시 원문을 그대로 노출하고, 시간대가 비면
  // 아래 렌더에서 행을 통째로 숨겼다. 그래서 같은 근무가 스케줄 카드에선 "시간 협의",
  // 그룹 카드에선 아무것도 안 보이는 상태가 됐다. 예정 시각은 항상 그린다.
  const timeSlotLabel = useMemo(
    () =>
      formatWorkTimeRange(
        WorkTimeDisplay.getDisplayInfo({
          timeSlot: group.timeSlot,
          date: group.dateRange.start,
        }),
        false
      ),
    [group.timeSlot, group.dateRange.start]
  );

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

  // Reduce Motion 대응 — 공용 훅(SSOT). 여기 있던 로컬 구현은 useState(false) 로 시작해
  // RM 사용자에게도 마운트 첫 1~2프레임 동안 모션이 재생됐고, isReduceMotionEnabled 를
  // 옵셔널 호출하지 않아 그 메서드가 없는 mock 환경에서 터졌다. 공용 훅은 둘 다 해결돼 있다.
  const reduceMotion = useReduceMotion();

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
    isNoShow ? NO_SHOW_NOTICE_TITLE : null,
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
              {/* ScheduleCard 와 같은 규칙 — 상태 색은 SCHEDULE_STATUS 한 곳에서만 온다. */}
              <Badge variant={status.variant} dot>
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

          <View className="mb-2 flex-row items-center">
            <ClockIcon size={14} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1.5 flex-1 text-sm text-content-muted dark:text-secondary-400 font-sans">
              {timeSlotLabel}
            </Text>
          </View>

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

          {isNoShow && (
            <View className="mt-3 rounded-lg bg-error-50 px-3 py-2 dark:bg-error-900/20">
              <Text className="text-center text-xs font-sans-semibold text-error-700 dark:text-error-300">
                {NO_SHOW_NOTICE_TITLE}
              </Text>
              <Text className="mt-1 text-center text-xs text-error-600 dark:text-error-400 font-sans">
                {NO_SHOW_NOTICE_DESCRIPTION}
              </Text>
            </View>
          )}
        </View>
      </CardStripe>
    </Pressable>
  );
});
