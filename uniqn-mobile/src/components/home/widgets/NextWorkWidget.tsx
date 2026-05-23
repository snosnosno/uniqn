import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useUpcomingSchedules } from '@/hooks/useSchedules';
import { formatTimeOfDay } from '@/utils/formatters/date';
import { useThemeStore } from '@/stores/themeStore';
import type { ScheduleEvent } from '@/types/schedule';

const HERO_GRADIENT_DARK = ['#1A1710', '#0B0B0E'] as const;
const HERO_GRADIENT_LIGHT = ['#FAF8F3', '#FFFFFF'] as const;

function computeDayDiff(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduleDate = new Date(dateStr);
  scheduleDate.setHours(0, 0, 0, 0);
  return Math.round((scheduleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBadge(diffDays: number): string {
  if (diffDays === 0) return 'D-DAY';
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatRole(role: string): string {
  const map: Record<string, string> = {
    dealer: '딜러',
    floor: '플로어',
    serving: '서빙',
  };
  return map[role] ?? role;
}

function formatScheduleTimeRange(schedule: ScheduleEvent): string {
  if (!schedule.startTime) return '';
  const start = formatTimeOfDay(schedule.startTime);
  if (!schedule.endTime) return start;
  const end = formatTimeOfDay(schedule.endTime);
  return `${start} ~ ${end}`;
}

interface HeroScheduleCardProps {
  schedule: ScheduleEvent;
}

function HeroScheduleCard({ schedule }: HeroScheduleCardProps) {
  const diffDays = computeDayDiff(schedule.date);
  const badge = formatBadge(diffDays);
  const timeRange = formatScheduleTimeRange(schedule);
  const roleLabel = formatRole(schedule.role);
  const dateLabel = formatDate(schedule.date);
  const subtitleParts = [dateLabel, timeRange, roleLabel].filter(Boolean);
  const accessibilityLabel = `다음 근무 ${badge}, ${schedule.location}, 탭하면 스케줄 이동`;

  return (
    <Pressable
      onPress={() => router.push('/(app)/(tabs)/schedule')}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-center gap-2 mb-1">
        <View className="bg-primary-500 rounded px-2 py-0.5" style={{ borderRadius: 4 }}>
          <NumericText className="font-sans-bold text-content-onGold" style={{ fontSize: 14 }}>
            {badge}
          </NumericText>
        </View>
        <Text
          className="text-content-primary font-sans-bold"
          style={{ fontSize: 20, letterSpacing: -0.5 }}
          numberOfLines={1}
        >
          {schedule.location}
        </Text>
      </View>
      <NumericText className="text-content-secondary text-xs mt-1" numberOfLines={1}>
        {subtitleParts.join(' · ')}
      </NumericText>
    </Pressable>
  );
}

export function NextWorkWidget() {
  const { schedules, isLoading, error, refetch } = useUpcomingSchedules(14);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const gradientColors = isDarkMode ? HERO_GRADIENT_DARK : HERO_GRADIENT_LIGHT;

  const confirmedSchedules = schedules.filter((s) => s.type === 'confirmed');
  const nextSchedule = confirmedSchedules[0] ?? null;

  const emptyState = {
    message: '예정된 근무가 없습니다. 공고를 둘러볼까요?',
    cta: {
      label: '공고 보기',
      onPress: () => router.push('/(app)/(tabs)/home-jobs'),
    },
  };

  return (
    <DashboardWidgetShell
      variant="hero"
      title="다음 근무"
      isLoading={isLoading}
      emptyState={nextSchedule ? undefined : emptyState}
      error={error}
      onRetry={refetch}
    >
      {nextSchedule ? (
        /*
         * Gradient bleed contract:
         * - marginHorizontal: -16 cancels DashboardWidgetShell hero variant's
         *   horizontal px-4 padding so the gradient reaches the card edges.
         * - Shell's vertical py-4 is intentionally preserved (no negative
         *   marginVertical) for breathing room between hero and adjacent widgets.
         * - borderRadius: 12 is retained for future cases where the shell adds
         *   horizontal inset; at full bleed it's a cosmetic no-op.
         */
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            borderRadius: 12,
            marginHorizontal: -16,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <HeroScheduleCard schedule={nextSchedule} />
        </LinearGradient>
      ) : null}
    </DashboardWidgetShell>
  );
}

export default NextWorkWidget;
