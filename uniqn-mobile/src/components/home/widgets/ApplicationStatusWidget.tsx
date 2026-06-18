import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useApplications } from '@/hooks/useApplications';
import { APPLICATION_COUNT_LABELS } from '@/utils/applicationStatusLabel';

interface StripCellProps {
  num: number;
  label: string;
  gold?: boolean;
  isLast?: boolean;
}

function StripCell({ num, label, gold, isLast }: StripCellProps) {
  return (
    <View
      className={`flex-1 items-center py-2 ${
        isLast === true ? '' : 'border-r border-divider dark:border-surface-overlay'
      }`}
    >
      <NumericText
        className={`text-2xl font-sans-bold ${gold === true ? 'text-primary-500' : 'text-content-primary'}`}
        style={{ letterSpacing: -0.5 }}
      >
        {num}
      </NumericText>
      <Text className="text-[9px] uppercase tracking-wider text-content-muted mt-0.5">{label}</Text>
    </View>
  );
}

export function ApplicationStatusWidget() {
  const { myApplications, isLoading, error } = useApplications();

  const hasApplications = myApplications.length > 0;

  const applied = myApplications.filter((a) => a.status === 'applied').length;
  const confirmed = myApplications.filter((a) => a.status === 'confirmed').length;
  const rejected = myApplications.filter((a) => a.status === 'rejected').length;
  const cancelled = myApplications.filter(
    (a) => a.status === 'cancelled' || a.status === 'cancellation_pending'
  ).length;

  const accessibilityLabel = `내 지원 현황, ${APPLICATION_COUNT_LABELS.applied} ${applied}건, ${APPLICATION_COUNT_LABELS.confirmed} ${confirmed}건, ${APPLICATION_COUNT_LABELS.rejected} ${rejected}건, ${APPLICATION_COUNT_LABELS.cancelled} ${cancelled}건`;

  const emptyState = {
    message: '아직 지원한 공고가 없습니다',
  };

  return (
    <DashboardWidgetShell
      variant="section"
      title="내 지원 현황"
      isLoading={isLoading}
      emptyState={hasApplications ? undefined : emptyState}
      error={error}
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/schedule')}
          accessibilityRole="button"
          accessibilityLabel="지원 현황 전체 보기"
          hitSlop={8}
        >
          <Text className="text-primary-500 text-micro font-sans-bold">전체 →</Text>
        </Pressable>
      }
    >
      {hasApplications ? (
        <View
          className="flex-row"
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="summary"
        >
          <StripCell num={applied} label={APPLICATION_COUNT_LABELS.applied} gold />
          <StripCell num={confirmed} label={APPLICATION_COUNT_LABELS.confirmed} />
          <StripCell num={rejected} label={APPLICATION_COUNT_LABELS.rejected} />
          <StripCell num={cancelled} label={APPLICATION_COUNT_LABELS.cancelled} isLast />
        </View>
      ) : null}
    </DashboardWidgetShell>
  );
}

export default ApplicationStatusWidget;
