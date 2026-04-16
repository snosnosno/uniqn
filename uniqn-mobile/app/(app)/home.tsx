/**
 * HomeDashboard — 앱 진입 후 메인 화면
 *
 * employer는 employer/staff 뷰 전환 토글 제공.
 * staff 전용 사용자는 StaffDashboard 고정.
 */

import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { Loading } from '@/components/ui';
import { TabHeader } from '@/components/headers';
import { StaffDashboard } from '@/components/home/StaffDashboard';
import { EmployerDashboard } from '@/components/home/EmployerDashboard';
import { DashboardViewToggle } from '@/components/home/DashboardViewToggle';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function HomeDashboard() {
  const { isLoading, isEmployer } = useAuth();
  const canToggle = isEmployer;
  const [view, setView] = useState<'staff' | 'employer'>('staff');

  // auth 비동기 로딩 완료 후 적절한 기본 뷰로 동기화
  // (첫 렌더 시 isEmployer가 false일 수 있으므로 useState 초기값에 의존 불가)
  useEffect(() => {
    if (!isLoading) {
      setView(isEmployer ? 'employer' : 'staff');
    }
  }, [isLoading, isEmployer]);

  const isDark = useThemeStore((state) => state.isDarkMode);
  const bgColor = getLayoutColor(isDark, 'content');

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
        <TabHeader title="" showQR={false} />
        <Loading variant="layout" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <TabHeader title="" showQR={false} />
      {canToggle && (
        <DashboardViewToggle value={view} onChange={(v) => setView(v as 'staff' | 'employer')} />
      )}
      {view === 'employer' ? <EmployerDashboard /> : <StaffDashboard />}
    </SafeAreaView>
  );
}
