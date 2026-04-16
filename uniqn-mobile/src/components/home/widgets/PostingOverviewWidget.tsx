/**
 * PostingOverviewWidget
 * 내 공고 현황 요약 위젯 (모집중/마감 카운트 + 새 지원자 수)
 */
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { useMyJobPostings } from '@/hooks/useJobManagement';

export function PostingOverviewWidget() {
  const { data, isLoading, error, refetch } = useMyJobPostings();

  const postings = data ?? [];
  const activePostings = postings.filter((p) => p.status === 'active' || p.status === 'approved');
  const closedPostings = postings.filter((p) => p.status === 'closed');

  const newApplicantCount = activePostings.reduce((sum, p) => {
    const active = p.stats?.activeApplicants ?? 0;
    return sum + active;
  }, 0);

  const hasPostings = postings.length > 0;

  return (
    <DashboardWidgetShell
      title="공고 현황"
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={refetch}
      onSeeMore={() => router.push('/(app)/(tabs)/employer')}
      seeMoreLabel="전체 보기"
      emptyState={
        hasPostings
          ? undefined
          : {
              message: '진행 중인 공고가 없습니다. 공고를 작성해볼까요?',
              cta: {
                label: '공고 작성',
                onPress: () => router.push('/(employer)/my-postings/create'),
              },
            }
      }
    >
      {hasPostings ? (
        <View className="gap-2 py-1">
          <Text className="text-sm text-neutral-200 dark:text-neutral-200">
            모집중 {activePostings.length}건 · 마감 {closedPostings.length}건
          </Text>
          {newApplicantCount > 0 && (
            <Text className="text-sm dark:text-neutral-400">
              새 지원자:{' '}
              <Text style={{ color: '#D4AF37' }} className="font-semibold">
                {newApplicantCount}명
              </Text>
            </Text>
          )}
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}

export default PostingOverviewWidget;
