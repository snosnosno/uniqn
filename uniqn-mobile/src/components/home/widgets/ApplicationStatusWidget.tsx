import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useApplications } from '@/hooks/useApplications';

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

  const accessibilityLabel = `내 지원 현황, 대기중 ${applied}건, 확정 ${confirmed}건, 거절 ${rejected}건, 취소 ${cancelled}건`;

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
          <Text className="text-primary-500 text-[10px] font-sans-bold">전체 →</Text>
        </Pressable>
      }
    >
      {hasApplications ? (
        <View
          className="flex-row"
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="summary"
        >
          <StripCell num={applied} label="대기중" gold />
          <StripCell num={confirmed} label="확정" />
          <StripCell num={rejected} label="거절" />
          <StripCell num={cancelled} label="취소" isLast />
        </View>
      ) : null}
    </DashboardWidgetShell>
  );
}

export default ApplicationStatusWidget;
