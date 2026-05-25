import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_CLASSES, STATUS } from '@/constants';
import { getIconColor, getLayoutColor } from '@/constants/colors';
import { JobDetail, PostingSurfaceState } from '@/components/jobs';
import { StackHeader } from '@/components/headers';
import { ShareIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt, useJobDetail, useShare } from '@/hooks';
import { trackJobView } from '@/services/observability';
import { useThemeStore } from '@/stores';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';

export default function PublicJobDetailAliasRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const secondaryTextColor = getIconColor(isDark, 'primary');
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

    void shareJob(job);
  }, [job, shareJob]);

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

  const titleSuffix = job?.title ? (
    <Text className="text-sm font-sans" style={{ color: secondaryTextColor }} numberOfLines={1}>
      · {job.title}
    </Text>
  ) : null;

  if (!resolvedId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="공고 상세" fallbackHref="/jobs" />
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
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="공고 상세" fallbackHref="/jobs" />
        <PostingSurfaceState mode="loading" scope="detail" message="공고 정보를 불러오는 중..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="공고 상세" fallbackHref="/jobs" />
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
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader
          title="공고 상세"
          titleSuffix={titleSuffix}
          fallbackHref="/jobs"
          rightAction={shareAction}
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
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackHeader
        title="공고 상세"
        titleSuffix={titleSuffix}
        fallbackHref="/jobs"
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
