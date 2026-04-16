import React from 'react';
import { ScrollView } from 'react-native';
import { NextWorkWidget } from '@/components/home/widgets/NextWorkWidget';
import { ApplicationStatusWidget } from '@/components/home/widgets/ApplicationStatusWidget';
import { MonthSummaryWidget } from '@/components/home/widgets/MonthSummaryWidget';
import { RecentNoticesWidget } from '@/components/home/widgets/RecentNoticesWidget';

interface StaffDashboardProps {
  bottomPadding?: number;
}

export function StaffDashboard({ bottomPadding = 0 }: StaffDashboardProps) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 16 + bottomPadding }}>
      <NextWorkWidget />
      <ApplicationStatusWidget />
      <MonthSummaryWidget />
      <RecentNoticesWidget />
    </ScrollView>
  );
}
