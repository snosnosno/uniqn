import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STATUS } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { JobDetail, JobDetailHeader, PostingSurfaceState } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt, useJobDetail, useShare } from '@/hooks';
import { trackJobView } from '@/services/observability';
import { useThemeStore } from '@/stores';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';

export default function PublicJobDetailAliasRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { openInstallPrompt } = useInstallPrompt();
  const { shareJob, isSharing } = useShare();
  const [bottomActionHeight, setBottomActionHeight] = useState(116);

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const { job, isLoading, isRefreshing, error, refresh } = useJobDetail(resolvedId ?? '');

  useEffect(() => {
    if (job) {
      trackJobView(job.id, job.title);
    }
  }, [job]);

  const handleApply = useCallback(() => {
    if (!resolvedId) {
      return;
    }

    openInstallPrompt('job-detail-cta', {
      loginRedirect: `/(app)/jobs/${resolvedId}/apply`,
    });
  }, [openInstallPrompt, resolvedId]);

  const handleShare = useCallback(() => {
    if (!job) {
      return;
    }

    const locationStr =
      typeof job.location === 'string' ? job.location : (job.location?.name ?? '');

    void shareJob({
      id: job.id,
      title: job.title,
      location: locationStr,
      workDate: job.workDate,
    });
  }, [job, shareJob]);

  if (!resolvedId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader fallbackHref="/jobs" />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          message="공고 정보를 확인할 수 없습니다."
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader fallbackHref="/jobs" />
        <PostingSurfaceState mode="loading" scope="detail" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader fallbackHref="/jobs" />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          message={error?.message ?? '공고를 찾을 수 없습니다.'}
          error={error}
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  if (!isCanonicalDatedPosting(job)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader
          title={job.title}
          onShare={handleShare}
          isSharing={isSharing}
          fallbackHref="/jobs"
        />
        <PostingSurfaceState
          mode="error"
          scope="detail"
          message="고정 공고는 공개 상세 화면에서 아직 지원할 수 없습니다."
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <JobDetailHeader
        title={job.title}
        onShare={handleShare}
        isSharing={isSharing}
        fallbackHref="/jobs"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomActionHeight + 16 }}
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

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-secondary-200 bg-white p-4 dark:border-surface-overlay dark:bg-surface"
        style={{ zIndex: 10 }}
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          if (nextHeight > 0 && nextHeight !== bottomActionHeight) {
            setBottomActionHeight(nextHeight);
          }
        }}
      >
        <SafeAreaView edges={['bottom']}>
          {job.status !== STATUS.JOB_POSTING.ACTIVE ? (
            <Button disabled fullWidth>
              마감된 공고입니다
            </Button>
          ) : (
            <View>
              <Text className="mb-2 text-center text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                앱에서 지원할 수 있어요
              </Text>
              <Button
                onPress={(event) => {
                  event.stopPropagation();
                  handleApply();
                }}
                fullWidth
              >
                지원하기
              </Button>
            </View>
          )}
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
