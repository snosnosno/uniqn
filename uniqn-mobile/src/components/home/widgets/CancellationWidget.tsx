/**
 * CancellationWidget
 * pending 취소 요청 현황 위젯 (0건이면 null 반환)
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useAuthStore } from '@/stores/authStore';
import { getCancellationRequests } from '@/services';
import type { ApplicationWithJob } from '@/services/jobs/applicationService';

export function CancellationWidget() {
  const {
    data: postings,
    isLoading: isPostingsLoading,
    refetch: refetchPostings,
  } = useMyJobPostings();
  const user = useAuthStore((state) => state.user);

  const activePostingIds = React.useMemo(
    () =>
      (postings ?? [])
        .filter((p) => p.status === 'active' || p.status === 'approved')
        .map((p) => p.id)
        .slice(0, 5),
    [postings]
  );

  const cancellationQueries = useQueries({
    queries: activePostingIds.map((id) => ({
      queryKey: ['cancellationRequests', id, user?.uid],
      queryFn: () => getCancellationRequests(id, user!.uid),
      enabled: !!user?.uid && !!id,
      staleTime: 60_000,
    })),
  });

  const isQueriesLoading = cancellationQueries.some((q) => q.isLoading);
  const isLoading = isPostingsLoading || isQueriesLoading;

  const handleRetry = React.useCallback(() => {
    void refetchPostings();
    cancellationQueries.forEach((q) => void q.refetch());
  }, [refetchPostings, cancellationQueries]);

  const allPending: ApplicationWithJob[] = cancellationQueries.flatMap((q) => {
    const apps = q.data ?? [];
    return apps.filter((app) => app.cancellationRequest?.status === 'pending');
  });

  const pendingCount = allPending.length;

  if (isLoading) {
    return (
      <DashboardWidgetShell variant="section" title="취소 요청" isLoading onRetry={handleRetry}>
        {undefined}
      </DashboardWidgetShell>
    );
  }

  if (pendingCount === 0) {
    return null;
  }

  const recentTwo = allPending.slice(0, 2);

  return (
    <DashboardWidgetShell
      variant="section"
      title="취소 요청"
      isLoading={false}
      onRetry={handleRetry}
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/employer')}
          accessibilityRole="button"
          accessibilityLabel={`취소 요청 ${pendingCount}건 검토하기`}
          hitSlop={8}
        >
          <Text className="text-primary-500 text-[10px] font-sans-bold">검토 →</Text>
        </Pressable>
      }
    >
      <View className="gap-2 py-1">
        <NumericText className="text-xs font-sans-bold text-warning">
          ⚠ {pendingCount}건 대기 중
        </NumericText>
        {recentTwo.map((req) => (
          <View key={req.id} className="border-l-2 border-warning/40 bg-warning/10 px-2 py-1">
            <Text className="text-xs text-content-secondary">
              {req.applicantName} · {req.jobPostingDate ?? ''} 근무 취소
            </Text>
          </View>
        ))}
      </View>
    </DashboardWidgetShell>
  );
}

export default CancellationWidget;
