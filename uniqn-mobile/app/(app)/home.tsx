/**
 * HomeDashboard — 앱 진입 후 메인 화면
 *
 * employer는 employer/staff 뷰 전환 토글 제공.
 * staff 전용 사용자는 StaffDashboard 고정.
 */

import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { Loading } from '@/components/ui';
import { StaffDashboard } from '@/components/home/StaffDashboard';
import { EmployerDashboard } from '@/components/home/EmployerDashboard';
import { DashboardViewToggle } from '@/components/home/DashboardViewToggle';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function HomeDashboard() {
  const { isLoading, isEmployer } = useAuth();
  const canToggle = isEmployer;
  const [view, setView] = useState<'staff' | 'employer'>(canToggle ? 'employer' : 'staff');

  const isDark = useThemeStore((state) => state.isDarkMode);
  const bgColor = getLayoutColor(isDark, 'content');

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
        <Loading variant="layout" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      {canToggle && (
        <DashboardViewToggle value={view} onChange={(v) => setView(v as 'staff' | 'employer')} />
      )}
      {view === 'employer' ? <EmployerDashboard /> : <StaffDashboard />}
    </SafeAreaView>
  );
}
