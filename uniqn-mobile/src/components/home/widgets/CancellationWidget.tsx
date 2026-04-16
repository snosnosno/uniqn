/**
 * CancellationWidget
 * pending 취소 요청 현황 위젯 (0건이면 null 반환)
 */
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useAuthStore } from '@/stores/authStore';
import { getCancellationRequests } from '@/services';
import type { ApplicationWithJob } from '@/services/jobs/applicationService';

export function CancellationWidget() {
  const { data: postings, isLoading: isPostingsLoading } = useMyJobPostings();
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

  const allPending: ApplicationWithJob[] = cancellationQueries.flatMap((q) => {
    const apps = q.data ?? [];
    return apps.filter((app) => app.cancellationRequest?.status === 'pending');
  });

  const pendingCount = allPending.length;

  if (isLoading) {
    return (
      <DashboardWidgetShell title="취소 요청" isLoading onRetry={() => {}}>
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
      title="취소 요청"
      isLoading={false}
      onRetry={() => {}}
      onSeeMore={() => router.push('/(employer)')}
      seeMoreLabel="검토하기"
    >
      <View className="gap-2 py-1">
        {recentTwo.map((req) => (
          <View
            key={req.id}
            className="border-l-2 border-warning/40 bg-warning/10 px-2 py-1 dark:border-warning/40 dark:bg-warning/10"
          >
            <Text className="text-xs text-neutral-300 dark:text-neutral-300">
              {req.applicantName} · {req.jobPostingDate ?? ''} 근무 취소
            </Text>
          </View>
        ))}
        <Text className="text-xs font-semibold text-warning dark:text-warning">
          ⚠ {pendingCount}건 대기 중
        </Text>
      </View>
    </DashboardWidgetShell>
  );
}

export default CancellationWidget;
