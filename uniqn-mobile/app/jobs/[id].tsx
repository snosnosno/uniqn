import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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
import { isTournamentApprovalBlocked } from '@/domains/job-posting';
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

  const handleCallContact = useCallback(() => {
    const phone = job?.contactPhone?.trim();
    if (phone) {
      void Linking.openURL(`tel:${phone}`);
    }
  }, [job]);

  const shareAction = job ? (
    <Pressable
      onPress={handleShare}
      disabled={isSharing}
      className={`-mr-2 ml-2 rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="공고 공유하기"
      accessibilityRole="button"
    >
      <ShareIcon size={24} color={secondaryTextColor} />
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

  // 미승인(pending/rejected/누락) 대회 공고는 직링크로 열람할 수 없다(P0#4 승인 게이트).
  // 소유자는 (employer) 관리 상세로 보므로 예외 없음.
  if (isTournamentApprovalBlocked(job)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="공고 상세" fallbackHref="/jobs" />
        <PostingSurfaceState mode="error" scope="detail" message="승인 대기 중인 공고입니다." />
      </SafeAreaView>
    );
  }

  // 고정(상시) 공고 등 앱 지원 비대상 — 에러가 아니라 정책 상태이므로
  // 본문(연락처 포함)을 보여주고 하단에 전화 문의 안내를 제공한다(dead-end 방지).
  const isAppApplyable = isCanonicalDatedPosting(job);
  const contactPhone = job.contactPhone?.trim();

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
          {!isAppApplyable ? (
            <View>
              <Text className="mb-2 text-center text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                이 공고는 앱에서 지원할 수 없어요.{contactPhone ? ' 전화로 문의해 주세요.' : ''}
              </Text>
              {contactPhone ? (
                <Button onPress={handleCallContact} fullWidth>
                  전화 문의
                </Button>
              ) : (
                <Button disabled fullWidth>
                  전화 문의 (연락처 미등록)
                </Button>
              )}
            </View>
          ) : job.status !== STATUS.JOB_POSTING.ACTIVE ? (
            <Button disabled fullWidth>
              {job.status === STATUS.JOB_POSTING.CAPACITY_FULL
                ? '정원이 마감되었습니다'
                : '마감된 공고입니다'}
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
