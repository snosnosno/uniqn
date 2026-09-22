/**
 * UNIQN Mobile - GroupedSettlementCard 컴포넌트
 *
 * @description 같은 스태프의 여러 근무를 **한 줄**로 합산하는 카드
 * - 기본 상태: 접힘 (지급 예정 금액, 건수만 표시)
 * - 펼침 상태: 날짜별 금액
 * - 다중 역할 통합 지원
 *
 * @version 2.0.0 - 구인자 IA S2: 지급 상태 배지·지급 완료·일괄 정산·선택 모드 제거.
 *
 * 🔑 사람별 합산이 이 카드의 존재 이유다. 민수의 3일치가 세 줄이면 사장은 세 번 보낸다.
 * 🔑 카드 금액은 **퇴근이 기록됐고 아직 지급 처리되지 않은 날만** 더한다.
 *    - 퇴근 전 날은 금액을 만들지 않고 건수만 밝힌다.
 *    - 과거에 `지급 완료` 로 처리된 날(워크플로우가 살아 있던 시절)은 빼고 따로 밝힌다 —
 *      더하면 사장이 카드 금액을 그대로 보내 이미 준 돈을 한 번 더 보낸다.
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Avatar, CardStripe, NumericText } from '@/components/ui';
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
} from '@/components/icons';
import { formatDateDisplay, formatGroupRolesDisplay } from '@/utils/settlementGrouping';
import { formatCurrency } from '@/utils/settlement';
import { getRoleDisplayName } from '@/types/unified';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION_DURATION } from '@/constants/motion';
import { STATUS } from '@/constants';
import type { GroupedSettlement, DateSettlementStatus } from '@/types/settlement';
import type { WorkLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface GroupedSettlementCardProps {
  /** 그룹화된 근무 금액 정보 */
  group: GroupedSettlement;
  /** 카드 클릭 핸들러 (첫 번째 WorkLog 계산 근거) - 그룹 정보 포함 */
  onPress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  /** 개별 날짜 클릭 핸들러 - 그룹 정보 포함 */
  onDatePress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  /** 기본 펼침 상태 (기본: false) */
  defaultExpanded?: boolean;
}

/** 퇴근 전 날짜를 가리키는 말 — 금액 칸·배지·접근성 라벨이 같은 값을 쓴다. */
const BEFORE_CHECKOUT_LABEL = '퇴근 전';
/** 과거에 지급 완료로 처리된 날짜를 가리키는 말 — 같은 이유로 한 곳에서 쓴다. */
const SETTLED_LABEL = '지급 처리됨';

// ============================================================================
// Sub-components
// ============================================================================

/** 날짜별 금액 행 */
const DateAmountRow = memo(function DateAmountRow({
  status,
  workLog,
  group,
  isLast,
  onPress,
}: {
  status: DateSettlementStatus;
  workLog: WorkLog;
  group: GroupedSettlement;
  isLast: boolean;
  onPress?: (workLog: WorkLog, group: GroupedSettlement) => void;
}) {
  const roleDisplay = getRoleDisplayName(status.role, status.customRole);
  const isSettled = status.payrollStatus === STATUS.PAYROLL.COMPLETED;
  const amountText = !status.hasValidTimes
    ? BEFORE_CHECKOUT_LABEL
    : isSettled
      ? `${formatCurrency(status.amount)} · ${SETTLED_LABEL}`
      : formatCurrency(status.amount);

  const handlePress = useCallback(() => {
    onPress?.(workLog, group);
  }, [onPress, workLog, group]);

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-row items-center py-2.5 ${
        !isLast ? 'border-b border-secondary-100 dark:border-surface-overlay/50' : ''
      }`}
      accessibilityRole="button"
      accessibilityLabel={`${status.formattedDate} ${roleDisplay} ${amountText}`}
    >
      <View className="flex-1">
        <Text className="text-sm font-sans-medium text-secondary-800 dark:text-secondary-200">
          {status.formattedDate}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {roleDisplay}
        </Text>
      </View>

      <Text
        className={`text-sm font-sans-semibold ${
          status.hasValidTimes && !isSettled
            ? 'text-content-secondary'
            : 'text-content-muted dark:text-secondary-400'
        }`}
      >
        {amountText}
      </Text>
    </Pressable>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const GroupedSettlementCard = memo(function GroupedSettlementCard({
  group,
  onPress,
  onDatePress,
  defaultExpanded = false,
}: GroupedSettlementCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 사용자 프로필 조회 (프로필 사진, 닉네임)
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: group.staffId,
    fallbackName: group.staffProfile.name,
    fallbackNickname: group.staffProfile.nickname,
    fallbackPhotoURL: group.staffProfile.photoURL,
    fallbackPhotoURLBlurhash: group.staffProfile.photoURLBlurhash,
  });

  const rolesDisplay = useMemo(() => formatGroupRolesDisplay(group), [group]);

  const dateDisplay = useMemo(
    () => formatDateDisplay(group.dateRange.dates),
    [group.dateRange.dates]
  );

  // `summary.totalAmount` 는 퇴근 전 날의 계산값과 이미 지급 처리된 날까지 섞여 있다 — 직접 센다.
  const { payableAmount, beforeCheckoutCount, settledCount } = useMemo(() => {
    let amount = 0;
    let before = 0;
    let settled = 0;
    for (const status of group.dateStatuses) {
      if (!status.hasValidTimes) {
        before += 1;
      } else if (status.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        settled += 1;
      } else {
        amount += status.amount;
      }
    }
    return { payableAmount: amount, beforeCheckoutCount: before, settledCount: settled };
  }, [group.dateStatuses]);

  const workLogMap = useMemo(
    () => new Map(group.originalWorkLogs.map((wl) => [wl.id, wl])),
    [group.originalWorkLogs]
  );

  // 아직 퇴근이 안 찍힌 날이 있으면 골드(진행 중), 전부 끝났으면 뮤트(지나간 근무).
  const stripeTone = beforeCheckoutCount > 0 ? 'gold' : 'muted';

  const reduceMotion = useReduceMotion();

  // 높이 전이는 아래 Animated.View 의 layout 이 담당한다(구 LayoutAnimation 대체).
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handlePress = useCallback(() => {
    if (group.originalWorkLogs.length > 0) {
      onPress?.(group.originalWorkLogs[0], group);
    }
  }, [onPress, group]);

  return (
    <CardStripe tone={stripeTone} style={{ marginBottom: 12 }}>
      <Animated.View
        layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base)}
        className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3"
      >
        {/* 상단: 프로필 + 지급 예정 금액 */}
        <Pressable
          onPress={handlePress}
          className="active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`${displayName} 근무 금액 상세 보기`}
        >
          <View className="flex-row items-center">
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size="md"
              className="mr-3"
              blurhash={profilePhotoURLBlurhash}
            />

            <View className="flex-1">
              <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                {displayName}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {rolesDisplay}
              </Text>
            </View>

            <View className="items-end">
              <NumericText
                className="text-base font-sans-bold text-primary-600 dark:text-primary-400"
                style={{
                  letterSpacing: -0.3,
                  textAlign: 'right',
                }}
              >
                {formatCurrency(payableAmount)}
              </NumericText>
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                {group.summary.totalCount}건
              </Text>
            </View>
          </View>
        </Pressable>

        {/* 날짜 범위 */}
        <View className="flex-row items-center mt-3">
          <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-1.5 text-sm text-content-muted dark:text-secondary-400 font-sans">
            {dateDisplay}
          </Text>
        </View>

        {/* 합계에서 빠진 날을 밝힌다. 0건이면 자리도 없다. */}
        {beforeCheckoutCount > 0 || settledCount > 0 ? (
          <View className="flex-row flex-wrap items-center mt-2 gap-2">
            {beforeCheckoutCount > 0 && (
              <View className="flex-row items-center px-2 py-1 bg-surface-page dark:bg-surface rounded-lg">
                <ClockIcon size={12} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                  {BEFORE_CHECKOUT_LABEL} {beforeCheckoutCount}건 · 퇴근을 찍어야 금액이 정해져요
                </Text>
              </View>
            )}
            {settledCount > 0 && (
              <View className="flex-row items-center px-2 py-1 bg-surface-page dark:bg-surface rounded-lg">
                <CheckCircleIcon size={12} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                  {SETTLED_LABEL} {settledCount}건 · 합계에서 뺐어요
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* 펼침/접힘 버튼 */}
        <Pressable
          onPress={toggleExpanded}
          className="flex-row items-center justify-center mt-3 py-2 border-t border-divider"
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? '날짜별 금액 접기' : '날짜별 금액 펼치기'}
        >
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 mr-1 font-sans">
            날짜별 금액
          </Text>
          {isExpanded ? (
            <ChevronUpIcon size={16} color={SECONDARY_PALETTE[500]} />
          ) : (
            <ChevronDownIcon size={16} color={SECONDARY_PALETTE[500]} />
          )}
        </Pressable>

        {isExpanded && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(MOTION_DURATION.base)}
            exiting={reduceMotion ? undefined : FadeOut.duration(MOTION_DURATION.fast)}
            className="mt-2 pt-2 border-t border-secondary-100 dark:border-surface-overlay"
          >
            {group.dateStatuses.map((status, index) => {
              const workLog = workLogMap.get(status.workLogId);
              if (!workLog) return null;

              return (
                <DateAmountRow
                  key={status.workLogId}
                  status={status}
                  workLog={workLog}
                  group={group}
                  isLast={index === group.dateStatuses.length - 1}
                  onPress={onDatePress}
                />
              );
            })}
          </Animated.View>
        )}
      </Animated.View>
    </CardStripe>
  );
});
