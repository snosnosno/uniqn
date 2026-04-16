import React from 'react';
import { ScrollView } from 'react-native';
import { WeeklyStaffWidget } from '@/components/home/widgets/WeeklyStaffWidget';
import { PostingOverviewWidget } from '@/components/home/widgets/PostingOverviewWidget';
import { CancellationWidget } from '@/components/home/widgets/CancellationWidget';
import { RecentNoticesWidget } from '@/components/home/widgets/RecentNoticesWidget';

interface EmployerDashboardProps {
  bottomPadding?: number;
}

export function EmployerDashboard({ bottomPadding = 0 }: EmployerDashboardProps) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 16 + bottomPadding }}>
      <WeeklyStaffWidget />
      <PostingOverviewWidget />
      <CancellationWidget />
      <RecentNoticesWidget />
    </ScrollView>
  );
}
