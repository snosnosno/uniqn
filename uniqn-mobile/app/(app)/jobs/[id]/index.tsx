import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_CLASSES, STATUS } from '@/constants';
import { getIconColor, getLayoutColor } from '@/constants/colors';
import { JobDetail } from '@/components/jobs';
import { StackHeader } from '@/components/headers';
import { ShareIcon } from '@/components/icons';
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
import {
  getApplicationStatusMessage,
  getCancelUnavailableReason,
} from '@/utils/applicationStatusMessage';
import { isSupportedReleasePosting } from '@/utils/jobPostingVisibility';

const DEFAULT_BOTTOM_ACTION_HEIGHT = 116;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const secondaryTextColor = getIconColor(isDark, 'primary');
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
  const [ctaFocused, setCtaFocused] = useState(false);

  const handleShare = useCallback(() => {
    if (!job) {
      return;
    }

    void shareJob(job);
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

  const shareAction = job ? (
    <Pressable
      onPress={handleShare}
      disabled={isSharing}
      className={`-mr-2 ml-2 rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="공고 공유하기"
      accessibilityRole="button"
    >
      <ShareIcon size={22} color={secondaryTextColor} />
    </Pressable>
  ) : null;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)/home-jobs" />
        <Loading variant="layout" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="공고 상세" fallbackHref="/(app)/(tabs)/home-jobs" />
        <ErrorState message={error?.message ?? '공고를 찾을 수 없습니다'} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  // 지원 이력 확인 중 — 본문(JobDetail)은 즉시 렌더하고 CTA 영역만 게이팅한다.
  // (예전엔 비핵심 체크가 화면 전체를 다시 가려 진입마다 이중 로딩이 발생)
  const isCheckingApplication =
    !!sessionUserId &&
    !hasApplied(job.id) &&
    !hasAppliedDirect &&
    (isCheckingExistingApplication || isFetchingExistingApplication);

  const titleSuffix = job?.title ? (
    <Text
      className="text-sm font-sans"
      style={{ color: getLayoutColor(isDark, 'headerTint') }}
      numberOfLines={1}
    >
      · {job.title}
    </Text>
  ) : null;

  if (!isSupportedReleasePosting(job)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader
          title="공고 상세"
          titleSuffix={titleSuffix}
          fallbackHref="/(app)/(tabs)/home-jobs"
          rightAction={shareAction}
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
  const cancelUnavailableReason = getCancelUnavailableReason({
    status: applicationStatus?.status,
    isFixed,
    hasPendingCancellation: !!applicationStatus?.cancellationRequest,
  });

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackHeader
        title="공고 상세"
        titleSuffix={titleSuffix}
        fallbackHref="/(app)/(tabs)/home-jobs"
        rightAction={shareAction}
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
          {isCheckingApplication ? (
            <Button disabled fullWidth>
              지원 여부 확인 중...
            </Button>
          ) : alreadyApplied ? (
            <View className="items-center">
              <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {getApplicationStatusMessage(applicationStatus?.status)}
              </Text>
              {cancelUnavailableReason ? (
                <Text className="mb-2 text-center text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  {cancelUnavailableReason}
                </Text>
              ) : null}
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
              {job.status === STATUS.JOB_POSTING.CAPACITY_FULL
                ? '정원이 마감되었습니다'
                : '마감된 공고입니다'}
            </Button>
          ) : isFixed ? (
            // 고정 공고는 앱 지원 플로우(AssignmentSelector)가 비활성 상태 — 빈 지원폼으로
            // 진입하는 dead-end를 막기 위해 CTA 단계에서 차단한다.
            <View className="items-center">
              <Button disabled fullWidth>
                고정 공고는 앱에서 지원할 수 없어요
              </Button>
              <Text className="mt-2 text-center text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                상시 모집 공고예요. 위 연락처로 직접 문의해 주세요.
              </Text>
            </View>
          ) : (
            <View>
              {!sessionUserId ? (
                <Text className="mb-2 text-center text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  로그인 후 지원할 수 있어요
                </Text>
              ) : null}
              {/* Focus ring — Button과 동일 idiom: m-[-2px] + border-2 border-transparent, focus 시 info-500 */}
              <View
                className={`rounded-md m-[-2px] border-2 ${
                  ctaFocused ? 'border-info-500' : 'border-transparent'
                }`}
              >
                <Pressable
                  onPress={handleApply}
                  onFocus={() => setCtaFocused(true)}
                  onBlur={() => setCtaFocused(false)}
                  className="bg-primary-500 active:bg-primary-600 rounded-md py-3 min-h-[44px] items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="공고에 지원하기"
                >
                  <Text className="text-content-onGold text-center font-sans-bold text-base">
                    지원하기 →
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
