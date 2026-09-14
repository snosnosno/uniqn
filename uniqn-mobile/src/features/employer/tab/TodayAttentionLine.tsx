/**
 * TodayAttentionLine — 내 공고 탭 "오늘 한 줄" (구인자 IA S3)
 *
 * "오늘"은 탭이 아니라 있을 때만 뜨는 한 줄이다(§0 합의).
 * - 0건이면 렌더하지 않는다. 조건부 숨김은 0개일 때만 허용된다.
 * - 미출근·퇴근 미기록 배지는 합치지 않는다 — 뭉치면 눌러봐야 안다.
 * - 조회 실패는 0건이 아니다. 조용히 숨기면 안전망이 사라진 줄 모른다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { TodayAttentionSummary, TodayAttentionTarget } from '@/domains/staff';

export interface TodayAttentionLineProps {
  summary: TodayAttentionSummary;
  isError: boolean;
  /** 갈 곳이 없으면(예: 근무표 꺼짐 + 여러 공고) 넘기지 않는다 — 누를 수 없는 줄로 그린다. */
  onPress?: (target: TodayAttentionTarget) => void;
  onRetry: () => void;
}

export function TodayAttentionLine({
  summary,
  isError,
  onPress,
  onRetry,
}: TodayAttentionLineProps) {
  if (isError) {
    return (
      <View className="mx-4 mt-2 min-h-[44px] flex-row items-center justify-between rounded-lg bg-warning-50 px-3 py-2 dark:bg-warning-900/20">
        <Text className="flex-1 font-sans-medium text-sm text-warning-700 dark:text-warning-300">
          오늘 근무 현황을 확인하지 못했습니다
        </Text>
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="오늘 근무 현황 다시 확인"
          testID="today-attention-retry"
          className="min-h-[44px] justify-center px-2"
        >
          <Text className="font-sans-medium text-sm text-primary-600 dark:text-primary-400">
            다시 시도
          </Text>
        </Pressable>
      </View>
    );
  }

  const { absentCount, missingCheckoutCount, target } = summary;
  if (!target || absentCount + missingCheckoutCount === 0) {
    return null;
  }

  const a11yLabel = [
    '오늘 확인할 근무',
    [
      absentCount > 0 ? `미출근 ${absentCount}건` : null,
      missingCheckoutCount > 0 ? `퇴근 미기록 ${missingCheckoutCount}건` : null,
    ]
      .filter(Boolean)
      .join(', '),
    onPress ? '눌러서 확인' : null,
  ]
    .filter(Boolean)
    .join('. ');

  const content = (
    <>
      <Text className="text-xs font-sans-semibold text-content-muted dark:text-secondary-400">
        오늘
      </Text>
      {absentCount > 0 ? (
        <View className="rounded-sm bg-error-100 px-2 py-0.5 dark:bg-error-900/30">
          <Text className="text-xs font-sans-medium text-error-600 dark:text-error-400">
            미출근 {absentCount}
          </Text>
        </View>
      ) : null}
      {missingCheckoutCount > 0 ? (
        <View className="rounded-sm bg-warning-100 px-2 py-0.5 dark:bg-warning-900/30">
          <Text className="text-xs font-sans-medium text-warning-700 dark:text-warning-300">
            퇴근 미기록 {missingCheckoutCount}
          </Text>
        </View>
      ) : null}
      <View className="flex-1" />
      {onPress ? <ChevronRightIcon size={16} color={SECONDARY_PALETTE[400]} /> : null}
    </>
  );

  const className =
    'mx-4 mt-2 min-h-[44px] flex-row items-center gap-2 rounded-lg border border-divider bg-surface-card px-3 py-2 dark:bg-surface-elevated';

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={a11yLabel}
        testID="today-attention-line"
        className={className}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(target)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      testID="today-attention-line"
      className={`${className} active:opacity-70`}
    >
      {content}
    </Pressable>
  );
}
