import React from 'react';
import { View, Text } from 'react-native';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { useApplications } from '@/hooks/useApplications';

interface CountCardProps {
  count: number;
  label: string;
}

function CountCard({ count, label }: CountCardProps) {
  return (
    <View className="flex-1 items-center py-2">
      <Text className="font-bold text-foreground dark:text-foreground" style={{ fontSize: 22 }}>
        {count}
      </Text>
      <Text className="text-secondary-500 dark:text-secondary-400" style={{ fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

interface DividerProps {
  vertical?: boolean;
}

function VerticalDivider(_props: DividerProps) {
  return <View className="w-px bg-neutral-200 dark:bg-neutral-700 self-stretch my-1" />;
}

export function ApplicationStatusWidget() {
  const { myApplications, isLoading, error } = useApplications();

  const hasApplications = myApplications.length > 0;

  const applied = myApplications.filter((a) => a.status === 'applied').length;
  const confirmed = myApplications.filter((a) => a.status === 'confirmed').length;
  const rejected = myApplications.filter((a) => a.status === 'rejected').length;

  const accessibilityLabel = `내 지원 현황, 대기중 ${applied}건, 확정 ${confirmed}건, 거절 ${rejected}건`;

  const emptyState = {
    message: '아직 지원한 공고가 없습니다',
  };

  return (
    <DashboardWidgetShell
      title="내 지원 현황"
      isLoading={isLoading}
      emptyState={hasApplications ? undefined : emptyState}
      error={error}
    >
      {hasApplications ? (
        <View
          className="flex-row"
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="summary"
        >
          <CountCard count={applied} label="대기중" />
          <VerticalDivider />
          <CountCard count={confirmed} label="확정" />
          <VerticalDivider />
          <CountCard count={rejected} label="거절" />
        </View>
      ) : null}
    </DashboardWidgetShell>
  );
}

export default ApplicationStatusWidget;
