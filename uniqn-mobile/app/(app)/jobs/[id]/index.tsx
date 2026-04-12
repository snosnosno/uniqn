import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STATUS } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { JobDetail, JobDetailHeader } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { ErrorState, Loading } from '@/components/ui';
import {
  useApplications,
  useAuth,
  useHasAppliedToJob,
  useInstallPrompt,
  useJobDetail,
  useShare,
} from '@/hooks';
import { resolveSessionUserId } from '@/hooks/internal/sessionUserId';
import { trackJobView } from '@/services/observability';
import { useThemeStore } from '@/stores';
import { getApplicationStatusMessage } from '@/utils/applicationStatusMessage';
import { isSupportedReleasePosting } from '@/utils/jobPostingVisibility';

const DEFAULT_BOTTOM_ACTION_HEIGHT = 116;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { user, isInitialized } = useAuth();
  const { hasApplied, getApplicationStatus } = useApplications();
  const { openInstallPrompt } = useInstallPrompt();
  const sessionUserId = resolveSessionUserId(user?.uid, isInitialized);
  const {
    data: hasAppliedDirect = false,
    isLoading: isCheckingExistingApplication,
    isFetching: isFetchingExistingApplication,
  } = useHasAppliedToJob(id);
  const { shareJob, isSharing } = useShare();
  const { job, isLoading, isRefreshing, error, refresh } = useJobDetail(id ?? '');
  const [bottomActionHeight, setBottomActionHeight] = useState(DEFAULT_BOTTOM_ACTION_HEIGHT);

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

  useEffect(() => {
    if (job && user) {
      trackJobView(job.id, job.title);
    }
  }, [job, user]);

  const handleApply = useCallback(() => {
    if (!sessionUserId) {
      openInstallPrompt('job-detail-cta', {
        loginRedirect: `/(app)/jobs/${id}/apply`,
      });
      return;
    }

    router.push(`/(app)/jobs/${id}/apply`);
  }, [id, openInstallPrompt, sessionUserId]);

  const handleCancelRequest = useCallback(() => {
    const application = getApplicationStatus(id ?? '');
    if (!application) {
      return;
    }

    router.push(`/(app)/applications/${application.id}/cancel`);
  }, [getApplicationStatus, id]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader fallbackHref="/(app)/(tabs)" />
        <Loading variant="layout" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader fallbackHref="/(app)/(tabs)" />
        <ErrorState message={error?.message ?? '공고를 찾을 수 없습니다'} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  const shouldBlockForExistingApplicationCheck =
    !!sessionUserId &&
    !hasApplied(job.id) &&
    !hasAppliedDirect &&
    (isCheckingExistingApplication || isFetchingExistingApplication);

  if (shouldBlockForExistingApplicationCheck) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader fallbackHref="/(app)/(tabs)" />
        <Loading variant="layout" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (!isSupportedReleasePosting(job)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <JobDetailHeader
          title={job.title}
          onShare={handleShare}
          isSharing={isSharing}
          fallbackHref="/(app)/(tabs)"
        />
        <ErrorState
          message="이 공고는 현재 앱 내부 상세 화면에서 지원하지 않습니다."
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  const isFixed = job.schedule.kind === 'fixed';
  const alreadyApplied = !!sessionUserId && (hasApplied(job.id) || hasAppliedDirect);
  const applicationStatus = getApplicationStatus(job.id);
  const canRequestCancel =
    !isFixed &&
    applicationStatus?.status === STATUS.APPLICATION.CONFIRMED &&
    !applicationStatus?.cancellationRequest;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <JobDetailHeader
        title={job.title}
        onShare={handleShare}
        isSharing={isSharing}
        fallbackHref="/(app)/(tabs)"
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
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          if (nextHeight > 0 && nextHeight !== bottomActionHeight) {
            setBottomActionHeight(nextHeight);
          }
        }}
      >
        <SafeAreaView edges={['bottom']}>
          {alreadyApplied ? (
            <View className="items-center">
              <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {getApplicationStatusMessage(applicationStatus?.status)}
              </Text>
              <View className="w-full flex-row">
                <View className="mr-2 flex-1">
                  <Button
                    onPress={() =>
                      router.push(isFixed ? '/(app)/(tabs)/profile' : '/(app)/(tabs)/schedule')
                    }
                    variant="outline"
                    fullWidth
                  >
                    {isFixed ? '프로필 보기' : '내 일정 확인'}
                  </Button>
                </View>
                {canRequestCancel ? (
                  <View className="flex-1">
                    <Button onPress={handleCancelRequest} variant="ghost" fullWidth>
                      취소 요청
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          ) : job.status !== STATUS.JOB_POSTING.ACTIVE ? (
            <Button disabled fullWidth>
              마감된 공고입니다
            </Button>
          ) : (
            <View>
              {!sessionUserId ? (
                <Text className="mb-2 text-center text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  로그인 후 지원할 수 있어요
                </Text>
              ) : null}
              <Button onPress={handleApply} fullWidth>
                지원하기
              </Button>
            </View>
          )}
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
