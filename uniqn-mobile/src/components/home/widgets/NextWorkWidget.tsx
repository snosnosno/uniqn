import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { CalendarIcon, MapPinIcon, ClockIcon } from '@/components/icons';
import { useUpcomingSchedules } from '@/hooks/useSchedules';
import type { ScheduleEvent } from '@/types/schedule';

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

interface ScheduleCardProps {
  schedule: ScheduleEvent;
}

function ScheduleCard({ schedule }: ScheduleCardProps) {
  const diffDays = computeDayDiff(schedule.date);
  const badge = formatBadge(diffDays);
  const accessibilityLabel = `다음 근무, ${badge}, ${schedule.location}에서 ${formatRole(schedule.role)}로 근무, ${formatDate(schedule.date)}, 탭하여 상세 보기`;

  return (
    <Pressable
      onPress={() => router.push(`/(app)/schedules/${schedule.id}`)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View
          className="rounded px-2 py-0.5"
          style={{ backgroundColor: '#D4AF37', borderRadius: 4 }}
        >
          <Text className="text-xs font-semibold" style={{ color: '#000000' }}>
            {badge}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-1 mb-1">
        <CalendarIcon size={14} color="#9CA3AF" />
        <Text className="text-sm text-foreground dark:text-foreground">
          {formatDate(schedule.date)}
        </Text>
      </View>

      <View className="flex-row items-center gap-1 mb-1">
        <MapPinIcon size={14} color="#9CA3AF" />
        <Text className="text-sm text-foreground dark:text-foreground">{schedule.location}</Text>
      </View>

      <View className="flex-row items-center gap-1">
        <ClockIcon size={14} color="#9CA3AF" />
        <Text className="text-sm text-foreground dark:text-foreground">
          {formatRole(schedule.role)}
        </Text>
      </View>
    </Pressable>
  );
}

export function NextWorkWidget() {
  const { schedules, isLoading, error, refetch } = useUpcomingSchedules(14);

  const confirmedSchedules = schedules.filter((s) => s.type === 'confirmed');
  const nextSchedule = confirmedSchedules[0] ?? null;

  const emptyState = {
    message: '예정된 근무가 없습니다. 공고를 둘러볼까요?',
    cta: {
      label: '공고 보기',
      onPress: () => router.push('/(app)/(tabs)'),
    },
  };

  return (
    <DashboardWidgetShell
      title="다음 근무"
      isLoading={isLoading}
      emptyState={nextSchedule ? undefined : emptyState}
      error={error}
      onRetry={refetch}
    >
      {nextSchedule ? <ScheduleCard schedule={nextSchedule} /> : null}
    </DashboardWidgetShell>
  );
}

export default NextWorkWidget;
