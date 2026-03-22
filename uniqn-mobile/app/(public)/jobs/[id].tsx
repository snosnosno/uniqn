import { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STATUS } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { JobDetail, JobDetailHeader, PostingSurfaceState } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { useApplications, useJobDetail } from '@/hooks';
import { trackJobView } from '@/services/observability';
import { useAuthStore, useThemeStore } from '@/stores';
import { getApplicationStatusMessage } from '@/utils/applicationStatusMessage';
import { logger } from '@/utils/logger';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { user } = useAuthStore();
  const { hasApplied, getApplicationStatus } = useApplications();
  const { job, isLoading, isRefreshing, error, refresh } = useJobDetail(id ?? '');

  useEffect(() => {
    if (job) {
      trackJobView(job.id, job.title);
    }
  }, [job]);

  const handleApply = useCallback(() => {
    if (!user) {
      logger.info('비로그인 상태에서 지원 시도', { jobId: id });
      router.push({
        pathname: '/(auth)/login',
        params: { redirect: `/(app)/jobs/${id}/apply` },
      });
      return;
    }

    router.push(`/(app)/jobs/${id}/apply`);
  }, [id, user]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader />
        <PostingSurfaceState mode="loading" scope="detail" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          message={error?.message ?? '공고를 찾을 수 없습니다'}
          error={error}
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  if (job.postingType === 'fixed' || job.schedule.kind === 'fixed') {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader title={job.title} />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          message="고정 공고는 V3 canonical 전환 동안 공개 상세 화면에서 제공되지 않습니다."
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

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

      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 dark:border-surface-overlay dark:bg-surface">
        <SafeAreaView edges={['bottom']}>
          {alreadyApplied ? (
            <View className="items-center">
              <Text className="mb-2 text-sm text-gray-500 dark:text-gray-400">
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
