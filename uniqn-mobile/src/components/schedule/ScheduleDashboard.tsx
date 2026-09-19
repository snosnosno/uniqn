/**
 * ScheduleDashboard — 내 스케줄 월 요약 + 상태 필터 패널
 *
 * 요약 밴드와 상태 필터는 "이번 달을 어떻게 볼 것인가" 라는 한 가지 관심사라 함께 접힌다.
 * 화면(schedule.tsx)에서 분리한 이유는 두 가지다 — 화면이 이미 800줄 상한을 넘었고,
 * 접힘 상태의 표시 규칙은 화면 전체를 마운트하지 않고 단독으로 검증해야 한다.
 *
 * 구인자 IA S2b — 앱은 돈을 보내지 않는다. 사장이 `지급 완료` 를 누르는 흐름을 없앴으므로
 * `정산 완료 / 정산 예정` 두 칸과 `미지급 N건` 칩은 영원히 "미지급" 을 가리키게 된다.
 * 금액은 `이번 달 근무 금액` 한 칸으로 합치고, 입금 주체를 밝힌다.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Skeleton } from '@/components/ui';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { formatCurrency } from '@/utils/formatters';
import { SCHEDULE_STATS_LABELS } from '@/utils/applicationStatusLabel';

interface StatsCardProps {
  /** 밴드 우상단에 붙는 접기 토글 — 전용 44px 띠를 없애기 위해 안으로 들인다. */
  toggle?: React.ReactNode;
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

/** 금액 칸의 이름 — 화면 라벨과 접근성 라벨이 같은 말을 쓴다. */
const MONTH_EARNINGS_LABEL = '이번 달 근무 금액';
/** 입금 주체 안내 — 화면 문구와 접근성 라벨이 같은 값을 쓴다(한쪽만 바뀌면 낭독이 어긋난다). */
const PAYOUT_NOTICE = '입금은 사장님이 직접 보냅니다';

// StatsCard — full-bleed 밴드로 전환 (옵션 A). MonthNavigator와 동일한 시각 언어
// (bg-surface-card + px-4 py-3 + border-b border-divider)를 사용해
// TabHeader 아래 정보 패널이 하나의 띠 구조로 연결되도록 함.
function StatsCard({ stats, isLoading, toggle }: StatsCardProps) {
  const BAND_CLASS = 'bg-surface-card px-4 py-3 border-b border-divider';

  if (isLoading) {
    return (
      <View className={BAND_CLASS}>
        {/* 1행: 지원/확정/완료 스켈레톤 */}
        <View className="flex-row items-start">
          <View className="flex-1 flex-row justify-around">
            {[1, 2, 3].map((i) => (
              <View key={i} className="items-center">
                <Skeleton width={50} height={14} />
                <Skeleton width={36} height={20} className="mt-1" />
              </View>
            ))}
          </View>
          {toggle}
        </View>
        {/* 내부 구분선 */}
        <View className="h-px bg-secondary-200 dark:bg-surface-overlay my-2" />
        {/* 2행: 금액 스켈레톤 — 실제 레이아웃(라벨 · 금액 · 입금 안내 세 줄)과 같은 높이를 잡는다.
            한 줄만 두면 로딩이 끝나는 순간 밴드가 늘어나 아래 필터·리스트가 밀려 내려간다. */}
        <View className="px-2">
          <Skeleton width={70} height={12} />
          <Skeleton width={110} height={22} className="mt-1" />
          <Skeleton width={150} height={10} className="mt-1" />
        </View>
      </View>
    );
  }

  if (!stats) return null;

  // 받은 돈/받을 돈으로 나누던 두 값을 합친다. 'failed' 는 서비스 집계에서 이미 빠져 있다.
  const monthEarnings = stats.settledEarnings + stats.estimatedEarnings;

  return (
    <View className={BAND_CLASS}>
      {/* 1행: 대기중/확정/완료 — 지원 상태 어휘와 통일.
          접기 토글은 absolute 가 아니라 **형제**다 — 겹쳐 놓으면 '완료' 라벨 위에 앉는다. */}
      <View className="flex-row items-start">
        <View className="flex-1 flex-row justify-around">
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
        {toggle}
      </View>
      {/* 내부 구분선 */}
      <View className="h-px bg-secondary-200 dark:bg-surface-overlay my-2" />
      {/* 2행: 금액 — '수익' 한 단어는 스코프(어느 달)를 숨겨 입금 예정액으로 오해됐다.
          달을 밝히고, 입금은 앱이 아니라 사장님이 한다고 함께 적는다. */}
      {/* 🔴 `accessible` + 명시 라벨이라 자식 Text 는 낭독되지 않는다 — 화면에 보이는 입금 안내를
          라벨에도 넣어야 스크린리더 사용자에게도 "앱이 지급을 보증하지 않는다" 가 전달된다. */}
      <View
        className="px-2"
        accessible
        accessibilityLabel={`${MONTH_EARNINGS_LABEL} ${formatCurrency(monthEarnings)}, ${PAYOUT_NOTICE}`}
      >
        <Text className="text-xs text-secondary-600 dark:text-secondary-400 font-sans">
          {MONTH_EARNINGS_LABEL}
        </Text>
        <Text className="text-xl font-display text-primary-600 dark:text-primary-400">
          {formatCurrency(monthEarnings)}
        </Text>
        <Text className="mt-0.5 text-micro text-content-muted dark:text-secondary-500 font-sans">
          {PAYOUT_NOTICE}
        </Text>
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
  /** 펼쳤을 때 대시보드 안에 들어가는 상태 필터 UI */
  children?: React.ReactNode;
}

/**
 * 월 요약 + 상태 필터를 하나로 묶어 접을 수 있게 한 패널.
 *
 * 요약 밴드와 필터가 따로 놓여 리스트가 시작하기까지 세로가 길었다. 둘은 "이번 달을
 * 어떻게 볼 것인가" 라는 한 가지 관심사라 함께 접힌다.
 *
 * 🔴 접었을 때도 **활성 필터는 계속 보인다.** 필터가 걸린 채로 접히면 사용자는 리스트가
 * 왜 비었는지 알 수 없다 — 접기가 상태를 숨기면 그건 접기가 아니라 실종이다.
 */
export function ScheduleDashboard({
  stats,
  isLoading,
  collapsed,
  onToggle,
  activeFilterLabel,
  children,
}: ScheduleDashboardProps) {
  // 🔴 접힘 헤더의 접근성 라벨은 칩 상태에서 **합성해야 한다.**
  // Pressable 은 기본 accessible=true 라 자식 텍스트가 한 노드로 병합되는데, 명시
  // accessibilityLabel 이 그 파생 라벨을 통째로 덮어쓴다. 고정 문구만 두면 필터 칩이
  // 화면에만 있고 음성으로는 존재하지 않아, "접어도 계속 보인다" 는
  // 이 컴포넌트의 불변식이 스크린리더 사용자에게만 깨진다.
  const collapsedA11yLabel = [
    '이번 달 요약과 필터 펼치기',
    activeFilterLabel ? `필터 ${activeFilterLabel} 적용 중` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View>
      {collapsed ? (
        <View className="bg-surface-card px-4 py-2 border-b border-divider">
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: false }}
            accessibilityLabel={collapsedA11yLabel}
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
            </View>
            <ChevronDownIcon size={18} color={SECONDARY_PALETTE[400]} />
          </Pressable>
        </View>
      ) : (
        <>
          {/* 접기 버튼은 밴드 안 우상단에 얹는다 — 전용 띠 하나가 통계 아래에서
              44px 을 더 먹고 있었고, 그만큼 리스트 시작점이 아래로 밀렸다. */}
          <StatsCard
            stats={stats}
            isLoading={isLoading}
            toggle={
              <Pressable
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: true }}
                accessibilityLabel="이번 달 요약과 필터 접기"
                testID="schedule-dashboard-toggle"
                hitSlop={12}
                className="ml-1 shrink-0 flex-row items-center gap-1 rounded-sm px-1.5 py-1 active:bg-secondary-100 dark:active:bg-surface-overlay"
              >
                <Text className="text-xs font-sans text-content-muted">접기</Text>
                <ChevronUpIcon size={14} color={SECONDARY_PALETTE[400]} />
              </Pressable>
            }
          />
          {children}
        </>
      )}
    </View>
  );
}
