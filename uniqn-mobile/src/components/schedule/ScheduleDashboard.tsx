/**
 * ScheduleDashboard — 내 스케줄 월 요약 + 상태 필터 패널
 *
 * 요약 밴드와 상태 필터는 "이번 달을 어떻게 볼 것인가" 라는 한 가지 관심사라 함께 접힌다.
 * 화면(schedule.tsx)에서 분리한 이유는 두 가지다 — 화면이 이미 800줄 상한을 넘었고,
 * 접힘 상태의 표시 규칙은 화면 전체를 마운트하지 않고 단독으로 검증해야 한다.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Skeleton } from '@/components/ui';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { formatCurrency } from '@/utils/formatters';
import { SCHEDULE_STATS_LABELS } from '@/utils/applicationStatusLabel';

interface StatsCardProps {
  stats:
    | {
        upcomingSchedules: number;
        confirmedSchedules: number;
        completedSchedules: number;
        completedWorkDays: number;
        settledEarnings: number;
        estimatedEarnings: number;
      }
    | undefined;
  isLoading: boolean;
}

// StatsCard — full-bleed 밴드로 전환 (옵션 A). MonthNavigator와 동일한 시각 언어
// (bg-surface-card + px-4 py-3 + border-b border-divider)를 사용해
// TabHeader 아래 정보 패널이 하나의 띠 구조로 연결되도록 함.
function StatsCard({ stats, isLoading }: StatsCardProps) {
  const BAND_CLASS = 'bg-surface-card px-4 py-3 border-b border-divider';

  if (isLoading) {
    return (
      <View className={BAND_CLASS}>
        {/* 1행: 지원/확정/완료 스켈레톤 */}
        <View className="flex-row justify-around">
          {[1, 2, 3].map((i) => (
            <View key={i} className="items-center">
              <Skeleton width={50} height={14} />
              <Skeleton width={36} height={20} className="mt-1" />
            </View>
          ))}
        </View>
        {/* 내부 구분선 */}
        <View className="h-px bg-secondary-200 dark:bg-surface-overlay my-2.5" />
        {/* 2행: 수익 스켈레톤 */}
        <View className="flex-row justify-between items-center px-2">
          <Skeleton width={40} height={14} />
          <Skeleton width={120} height={22} />
        </View>
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View className={BAND_CLASS}>
      {/* 1행: 대기중/확정/완료 — 지원 상태 어휘와 통일 */}
      <View className="flex-row justify-around">
        <View
          className="items-center"
          accessible
          accessibilityLabel={`${SCHEDULE_STATS_LABELS.upcoming} 통계`}
        >
          <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
            {SCHEDULE_STATS_LABELS.upcoming}
          </Text>
          <Text className="text-lg font-display text-warning-600 dark:text-warning-400">
            {stats.upcomingSchedules}
          </Text>
        </View>
        <View className="h-6 w-px bg-secondary-200 dark:bg-surface-overlay" />
        <View
          className="items-center"
          accessible
          accessibilityLabel={`${SCHEDULE_STATS_LABELS.confirmed} 통계`}
        >
          <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
            {SCHEDULE_STATS_LABELS.confirmed}
          </Text>
          <Text className="text-lg font-display text-success-600 dark:text-success-400">
            {stats.confirmedSchedules}
          </Text>
        </View>
        <View className="h-6 w-px bg-secondary-200 dark:bg-surface-overlay" />
        <View
          className="items-center"
          accessible
          accessibilityLabel={`${SCHEDULE_STATS_LABELS.completed} ${stats.completedSchedules}건, 근무 ${stats.completedWorkDays}일`}
        >
          <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
            {SCHEDULE_STATS_LABELS.completed}
          </Text>
          <Text className="text-lg font-display text-content-primary dark:text-secondary-100">
            {stats.completedSchedules}
          </Text>
          {/* 세 지표는 모두 '건' 단위다. 근무 일수는 단위를 밝혀 따로 붙인다. */}
          <Text className="text-[10px] text-content-muted dark:text-secondary-500 font-sans">
            {stats.completedWorkDays}일 근무
          </Text>
        </View>
      </View>
      {/* 내부 구분선 */}
      <View className="h-px bg-secondary-200 dark:bg-surface-overlay my-2.5" />
      {/* 2행: 수익 — '수익' 한 단어는 스코프(어느 달)와 성격(받은 돈/추정치)을 둘 다 숨겨
          입금 예정액으로 오해된다. 정산 완료분과 예정분을 분리해 밝힌다. */}
      <View
        className="px-2"
        accessible
        accessibilityLabel={`정산 완료 ${formatCurrency(stats.settledEarnings)}, 정산 예정 ${formatCurrency(
          stats.estimatedEarnings
        )}`}
      >
        <View className="flex-row justify-between items-center">
          <Text className="text-sm text-secondary-600 dark:text-secondary-400 font-sans">
            정산 완료
          </Text>
          <Text className="text-xl font-display text-primary-600 dark:text-primary-400">
            {formatCurrency(stats.settledEarnings)}
          </Text>
        </View>
        <View className="mt-1 flex-row justify-between items-center">
          <Text className="text-xs text-content-muted dark:text-secondary-500 font-sans">
            정산 예정 (추정)
          </Text>
          <Text className="text-sm font-sans-medium text-content-secondary">
            {formatCurrency(stats.estimatedEarnings)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export interface ScheduleDashboardProps {
  stats: StatsCardProps['stats'];
  isLoading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** 접었을 때도 계속 보여줄 활성 필터 라벨. 전체('all')면 null */
  activeFilterLabel: string | null;
  unpaidCount: number;
  /** 펼쳤을 때 대시보드 안에 들어가는 상태 필터 UI */
  children?: React.ReactNode;
}

/**
 * 월 요약 + 상태 필터를 하나로 묶어 접을 수 있게 한 패널.
 *
 * 요약 밴드와 필터가 따로 놓여 리스트가 시작하기까지 세로가 길었다. 둘은 "이번 달을
 * 어떻게 볼 것인가" 라는 한 가지 관심사라 함께 접힌다.
 *
 * 🔴 접었을 때도 **미지급 건수와 활성 필터는 계속 보인다.** `unpaid` 축은 미지급 근무를
 * 찾는 유일한 경로이고, 필터가 걸린 채로 접히면 사용자는 리스트가 왜 비었는지 알 수 없다
 * — 접기가 상태를 숨기면 그건 접기가 아니라 실종이다.
 */
export function ScheduleDashboard({
  stats,
  isLoading,
  collapsed,
  onToggle,
  activeFilterLabel,
  unpaidCount,
  children,
}: ScheduleDashboardProps) {
  return (
    <View>
      {collapsed ? (
        <View className="bg-surface-card px-4 py-2 border-b border-divider">
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: false }}
            accessibilityLabel="이번 달 요약과 필터 펼치기"
            testID="schedule-dashboard-toggle"
            className="min-h-[44px] flex-row items-center justify-between"
          >
            <View className="flex-1 flex-row items-center gap-2">
              <Text className="text-sm font-sans-medium text-content-secondary">이번 달 요약</Text>
              {activeFilterLabel ? (
                <View className="rounded bg-primary-100 px-1.5 py-0.5 dark:bg-primary-900/30">
                  <Text className="text-micro font-sans-semibold text-primary-700 dark:text-primary-300">
                    {activeFilterLabel}
                  </Text>
                </View>
              ) : null}
              {unpaidCount > 0 ? (
                <View className="rounded bg-warning-100 px-1.5 py-0.5 dark:bg-warning-900/30">
                  <Text className="text-micro font-sans-semibold text-warning-700 dark:text-warning-300">
                    미지급 {unpaidCount}건
                  </Text>
                </View>
              ) : null}
            </View>
            <ChevronDownIcon size={18} color={SECONDARY_PALETTE[400]} />
          </Pressable>
        </View>
      ) : (
        <>
          <StatsCard stats={stats} isLoading={isLoading} />
          {children}
          <View className="bg-surface-card px-4 pb-1 border-b border-divider">
            <Pressable
              onPress={onToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: true }}
              accessibilityLabel="이번 달 요약과 필터 접기"
              testID="schedule-dashboard-toggle"
              className="min-h-[44px] flex-row items-center justify-center gap-1"
            >
              <Text className="text-xs font-sans text-content-muted">접기</Text>
              <ChevronUpIcon size={16} color={SECONDARY_PALETTE[400]} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
