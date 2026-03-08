/**
 * UNIQN Mobile - Job Detail Screen
 * 구인공고 상세 화면 (공개)
 *
 * @version 1.0.0
 */

import { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobDetail, JobDetailHeader } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { Loading, ErrorState } from '@/components/ui';
import { useJobDetail, useApplications } from '@/hooks';
import { useAuthStore, useThemeStore } from '@/stores';
import { getLayoutColor } from '@/constants/colors';
import { STATUS } from '@/constants';
import { trackJobView } from '@/services/observability';
import { logger } from '@/utils/logger';
import { getApplicationStatusMessage } from '@/utils/applicationStatusMessage';

// ============================================================================
// Screen Component
// ============================================================================

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((s) => s.isDarkMode);
  const { user } = useAuthStore();
  const { hasApplied, getApplicationStatus } = useApplications();

  const { job, isLoading, isRefreshing, error, refresh } = useJobDetail(id ?? '');

  // 공고 조회 추적
  useEffect(() => {
    if (job) {
      trackJobView(job.id, job.title);
    }
  }, [job]);

  // 지원하기 버튼 핸들러
  const handleApply = useCallback(() => {
    if (!user) {
      // 비로그인 상태면 로그인 페이지로
      logger.info('비로그인 상태에서 지원 시도', { jobId: id });
      router.push({
        pathname: '/(auth)/login',
        params: { redirect: `/(app)/jobs/${id}/apply` },
      });
      return;
    }

    // 로그인 상태면 지원 페이지로
    router.push(`/(app)/jobs/${id}/apply`);
  }, [user, id]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader />
        <Loading variant="layout" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader />
        <ErrorState message={error?.message ?? '공고를 찾을 수 없습니다'} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  // 지원 상태 확인
  const alreadyApplied = hasApplied(job.id);
  const applicationStatus = getApplicationStatus(job.id);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <JobDetailHeader title={job.title} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={getLayoutColor(isDark, 'refreshTint')}
          />
        }
      >
        <JobDetail job={job} />
      </ScrollView>

      {/* 하단 지원 버튼 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-surface border-t border-gray-200 dark:border-surface-overlay p-4">
        <SafeAreaView edges={['bottom']}>
          {alreadyApplied ? (
            <View className="items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {getApplicationStatusMessage(applicationStatus?.status)}
              </Text>
              <Button
                onPress={() => router.push('/(app)/(tabs)/schedule')}
                variant="outline"
                fullWidth
              >
                내 지원 현황 보기
              </Button>
            </View>
          ) : job.status !== STATUS.JOB_POSTING.ACTIVE ? (
            <Button disabled fullWidth>
              마감된 공고입니다
            </Button>
          ) : (
            <Button onPress={handleApply} fullWidth>
              {user ? '지원하기' : '로그인 후 지원하기'}
            </Button>
          )}
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
