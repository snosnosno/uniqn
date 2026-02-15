/**
 * UNIQN Mobile - GroupedScheduleCard 컴포넌트
 *
 * @description 같은 지원의 연속/다중 날짜를 통합 표시하는 스케줄 카드
 * - 기본 상태: 접힘 (날짜 범위만 표시)
 * - 펼침 상태: 개별 날짜별 출석 상태 표시
 * - 다중 역할 통합 지원
 *
 * @version 1.0.0
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { Card, Badge } from '@/components/ui';
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
import { STATUS } from '@/constants';
import { SCHEDULE_STATUS, ATTENDANCE_STATUS } from '@/constants/statusConfig';
import type { GroupedScheduleEvent } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface GroupedScheduleCardProps {
  /** 그룹화된 스케줄 이벤트 */
  group: GroupedScheduleEvent;
  /** 카드 클릭 핸들러 (상세 모달 열기) */
  onPress?: () => void;
  /** 개별 날짜 클릭 핸들러 */
  onDatePress?: (date: string, scheduleEventId: string) => void;
  /** 기본 펼침 상태 (기본: false) */
  defaultExpanded?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// SCHEDULE_STATUS, ATTENDANCE_STATUS: '@/constants/statusConfig'에서 import

// ============================================================================
// Component
// ============================================================================

export const GroupedScheduleCard = memo(function GroupedScheduleCard({
  group,
  onPress,
  onDatePress,
  defaultExpanded = false,
}: GroupedScheduleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const status = SCHEDULE_STATUS[group.type];
  const isCancelled = group.type === STATUS.SCHEDULE.CANCELLED;

  // 역할 표시 텍스트
  const rolesDisplay = useMemo(() => {
    return formatRolesDisplay(group.roles, group.customRoles);
  }, [group.roles, group.customRoles]);

  // 날짜 표시 텍스트
  const dateDisplay = useMemo(() => {
    return formatDateDisplay(group.dateRange.dates);
  }, [group.dateRange.dates]);

  // 급여 정보 추출
  const salaryDisplay = useMemo(() => {
    const jobCard = group.jobPostingCard;
    if (jobCard?.defaultSalary) {
      const { type, amount } = jobCard.defaultSalary;
      if (type === 'other') return '협의';
      const typeLabel = type === 'hourly' ? '시급' : type === 'daily' ? '일급' : '월급';
      return `${typeLabel} ${amount.toLocaleString()}원`;
    }
    return null;
  }, [group.jobPostingCard]);

  // 구인자명
  const ownerName = group.jobPostingCard?.ownerName;

  // 출석 상태 요약 (confirmed 상태일 때) - 상태와 색상 통합
  const attendanceSummary = useMemo(() => {
    if (group.type !== STATUS.SCHEDULE.CONFIRMED) return null;

    const checkedIn = group.dateStatuses.filter(
      (d) => d.status === STATUS.ATTENDANCE.CHECKED_IN
    ).length;
    const checkedOut = group.dateStatuses.filter(
      (d) => d.status === STATUS.ATTENDANCE.CHECKED_OUT
    ).length;

    // 우선순위: 근무 중 > 퇴근 완료 > 출근 전
    if (checkedIn > 0) return { label: '근무 중', status: STATUS.ATTENDANCE.CHECKED_IN };
    if (checkedOut > 0) return { label: '퇴근 완료', status: STATUS.ATTENDANCE.CHECKED_OUT };
    return { label: '출근 전', status: STATUS.ATTENDANCE.NOT_STARTED };
  }, [group.type, group.dateStatuses]);

  // 펼침/접힘 토글
  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  }, []);

  // 개별 날짜 클릭
  const handleDatePress = useCallback(
    (date: string, scheduleEventId: string) => {
      if (onDatePress) {
        onDatePress(date, scheduleEventId);
      }
    },
    [onDatePress]
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.jobPostingName} 스케줄 상세 보기, ${group.dateRange.totalDays}일`}
    >
      <Card className={`mb-3 ${isCancelled ? 'opacity-60' : ''}`}>
        {/* 상단: 상태 뱃지 + 총 일수 */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-wrap flex-1">
            {/* 상태 뱃지 */}
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>

            {/* 총 일수 뱃지 */}
            <View className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {group.dateRange.totalDays}일
              </Text>
            </View>

            {/* 확정 상태: 출석 상태 요약 (상태 기반 색상) */}
            {attendanceSummary && (
              <View
                className={`ml-2 px-2 py-0.5 rounded-full ${ATTENDANCE_STATUS[attendanceSummary.status].bgColor}`}
              >
                <Text
                  className={`text-xs font-medium ${ATTENDANCE_STATUS[attendanceSummary.status].textColor}`}
                >
                  {attendanceSummary.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 제목 */}
        <Text
          className={`text-base font-semibold mb-2 ${
            isCancelled
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-gray-900 dark:text-white'
          }`}
          numberOfLines={1}
        >
          {group.jobPostingName}
        </Text>

        {/* 장소 */}
        {group.location && (
          <View className="flex-row items-center mb-2">
            <MapIcon size={14} color="#6B7280" />
            <Text
              className="ml-1.5 text-sm text-gray-500 dark:text-gray-400 flex-1"
              numberOfLines={1}
            >
              {group.location}
            </Text>
          </View>
        )}

        {/* 날짜 및 시간 정보 */}
        <View className="flex-row items-center mb-2">
          <CalendarIcon size={14} color="#6B7280" />
          <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">{dateDisplay}</Text>
        </View>

        {group.timeSlot && (
          <View className="flex-row items-center mb-2">
            <ClockIcon size={14} color="#6B7280" />
            <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
              {group.timeSlot}
            </Text>
          </View>
        )}

        {/* 역할 + 급여 + 구인자 */}
        <View className="flex-row items-center flex-wrap">
          {/* 역할 */}
          <View className="flex-row items-center mr-3">
            <BriefcaseIcon size={14} color="#6B7280" />
            <Text className="ml-1.5 text-sm text-gray-700 dark:text-gray-300">{rolesDisplay}</Text>
          </View>

          {/* 급여 (지원 중 상태) */}
          {group.type === STATUS.SCHEDULE.APPLIED && salaryDisplay && (
            <View className="flex-row items-center mr-3">
              <BanknotesIcon size={14} color="#6B7280" />
              <Text className="ml-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                {salaryDisplay}
              </Text>
            </View>
          )}

          {/* 구인자 */}
          {ownerName && group.type === STATUS.SCHEDULE.APPLIED && (
            <View className="flex-row items-center">
              <UserIcon size={14} color="#9CA3AF" />
              <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">{ownerName}</Text>
            </View>
          )}
        </View>

        {/* 펼침/접힘 버튼 (날짜별 상세) */}
        {group.dateRange.totalDays > 1 && (
          <Pressable
            onPress={toggleExpanded}
            className="flex-row items-center justify-center mt-3 py-2 border-t border-gray-200 dark:border-surface-overlay"
            accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
          >
            <Text className="text-sm text-gray-500 dark:text-gray-400 mr-1">날짜별 상세</Text>
            {isExpanded ? (
              <ChevronUpIcon size={16} color="#6B7280" />
            ) : (
              <ChevronDownIcon size={16} color="#6B7280" />
            )}
          </Pressable>
        )}

        {/* 펼침 상태: 날짜별 출석 상태 */}
        {isExpanded && (
          <View className="mt-2 pt-2 border-t border-gray-100 dark:border-surface-overlay">
            {group.dateStatuses.map((dateStatus, index) => {
              const attendance = ATTENDANCE_STATUS[dateStatus.status];
              return (
                <Pressable
                  key={dateStatus.date}
                  onPress={() => handleDatePress(dateStatus.date, dateStatus.scheduleEventId)}
                  className={`flex-row items-center justify-between py-2 ${
                    index < group.dateStatuses.length - 1
                      ? 'border-b border-gray-100 dark:border-surface-overlay/50'
                      : ''
                  }`}
                  accessibilityLabel={`${dateStatus.formattedDate} ${attendance.label}`}
                >
                  <Text className="text-sm text-gray-700 dark:text-gray-300">
                    {dateStatus.formattedDate}
                  </Text>
                  <View className={`px-2 py-0.5 rounded-full ${attendance.bgColor}`}>
                    <Text className={`text-xs font-medium ${attendance.textColor}`}>
                      {attendance.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 취소됨 안내 */}
        {isCancelled && (
          <View className="mt-3 py-2 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <Text className="text-xs text-red-600 dark:text-red-400 text-center">
              이 스케줄은 취소되었습니다
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
});

export default GroupedScheduleCard;
