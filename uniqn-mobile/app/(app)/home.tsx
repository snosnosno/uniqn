/**
 * HomeDashboard — 앱 진입 후 메인 화면
 *
 * employer는 employer/staff 뷰 전환 토글 제공.
 * staff 전용 사용자는 StaffDashboard 고정.
 * 홈은 탭이 아니지만 하단에 표시 전용 HomeTabBar를 렌더하여 탭 화면으로 이동 가능.
 */

import React, { useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { Loading } from '@/components/ui';
import { TabHeader } from '@/components/headers';
import { StaffDashboard } from '@/components/home/StaffDashboard';
import { EmployerDashboard } from '@/components/home/EmployerDashboard';
import { DashboardViewToggle } from '@/components/home/DashboardViewToggle';
import { HomeTabBar } from '@/components/home/HomeTabBar';
import { LAYOUT } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function HomeDashboard() {
  const { isLoading, isEmployer } = useAuth();
  const canToggle = isEmployer;
  const [view, setView] = useState<'staff' | 'employer'>('staff');

  useEffect(() => {
    if (!isLoading) {
      setView(isEmployer ? 'employer' : 'staff');
    }
  }, [isLoading, isEmployer]);

  const isDark = useThemeStore((state) => state.isDarkMode);
  const bgColor = getLayoutColor(isDark, 'content');
  const insets = useSafeAreaInsets();
  const bottomPadding = LAYOUT.TAB_BAR_HEIGHT + insets.bottom;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
        <TabHeader title="홈" showQR={true} />
        <Loading variant="layout" />
        <HomeTabBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <TabHeader title="홈" showQR={true} />
      {canToggle && (
        <DashboardViewToggle value={view} onChange={(v) => setView(v as 'staff' | 'employer')} />
      )}
      {view === 'employer' ? (
        <EmployerDashboard bottomPadding={bottomPadding} />
      ) : (
        <StaffDashboard bottomPadding={bottomPadding} />
      )}
      <HomeTabBar />
    </SafeAreaView>
  );
}
