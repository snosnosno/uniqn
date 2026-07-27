/**
 * UNIQN Mobile - Job Apply Screen
 */

import { useState, useCallback, useRef } from 'react';
import { View, Text, Linking } from 'react-native';
import { showAlert } from '@/utils/showAlert';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationForm } from '@/components/jobs';
import { StackHeader } from '@/components/headers';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui';
import { AlertTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@/components/icons';
import { PRIMARY_COLORS, STATUS_COLORS } from '@/constants/colors';
import { useJobDetail, useApplications, useHasAppliedToJob } from '@/hooks';
import { resolveSessionUserId } from '@/hooks/internal/sessionUserId';
import { getJobDetailQueryOptions } from '@/hooks/useJobDetail';
import { useAuthStore } from '@/stores';
import { STATUS } from '@/constants';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { isSupportedReleasePosting } from '@/utils/jobPostingVisibility';
import { logger } from '@/utils/logger';
import type { Assignment, PreQuestionAnswer, JobPosting } from '@/types';

function LoadingState() {
  return <Loading variant="layout" message="공고 정보를 불러오는 중..." />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface p-6">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-error-50 dark:bg-error-900/30">
        <AlertTriangleIcon size={40} color={STATUS_COLORS.error} />
      </View>
      <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
        오류가 발생했습니다
      </Text>
      <Text className="mb-6 text-center text-content-secondary font-sans">{message}</Text>
      <Button onPress={onRetry} variant="outline">
        다시 시도
      </Button>
    </View>
  );
}

function AlreadyAppliedState({ isFixed }: { isFixed: boolean }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface p-6">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
        <InformationCircleIcon size={40} color={PRIMARY_COLORS[600]} />
      </View>
      <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
        이미 지원한 공고입니다
      </Text>
      <Text className="mb-6 text-center text-content-secondary font-sans">
        공고 상세 화면에서 지원 상태를 확인하실 수 있어요.
      </Text>
      <View className="w-full max-w-xs gap-3">
        <Button onPress={() => router.back()} fullWidth>
          공고 상세로 돌아가기
        </Button>
        <Button
          onPress={() => router.push(isFixed ? '/(app)/(tabs)/profile' : '/(app)/(tabs)/schedule')}
          variant="outline"
          fullWidth
        >
          {isFixed ? '프로필 보기' : '내 일정 보기'}
        </Button>
      </View>
    </View>
  );
}

/**
 * 고정(장기) 공고 — 앱 내 지원 비대상 정책 안내.
 *
 * @description 에러가 아니라 **정책 상태**다. `public/guide.html` 이 "고정(장기) 공고는 앱 내
 * 지원 대신 연락처로 직접 문의하는 방식"이라고 사용자에게 공표하고 있고, 공개 공고 상세
 * (`app/jobs/[id].tsx`)도 같은 축으로 전화 문의를 designed channel 로 제시한다. 따라서 문구를
 * "지원 불가"가 아니라 **다음 행동(전화)** 중심으로 쓴다.
 */
function FixedPostingState({
  contactPhone,
  onReturn,
}: {
  contactPhone?: string;
  onReturn: () => void;
}) {
  const phone = contactPhone?.trim();

  return (
    <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface p-6">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
        <InformationCircleIcon size={40} color={PRIMARY_COLORS[600]} />
      </View>
      <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
        상시 모집 공고예요
      </Text>
      <Text className="mb-6 text-center text-content-secondary font-sans">
        고정(장기) 공고는 앱 내 지원 대신 연락처로 직접 문의하는 방식이에요.
      </Text>
      <View className="w-full max-w-xs gap-3">
        {phone ? (
          <Button onPress={() => void Linking.openURL(`tel:${phone}`)} fullWidth>
            전화 문의
          </Button>
        ) : (
          // 죽은 버튼 금지 — 누를 수 없는 이유를 라벨에 명시한다.
          <Button disabled fullWidth>
            전화 문의 (연락처 미등록)
          </Button>
        )}
        <Button onPress={onReturn} variant="outline" fullWidth>
          공고 상세로 돌아가기
        </Button>
      </View>
    </View>
  );
}

function UnsupportedPostingState() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface p-6">
      <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
        현재 지원할 수 없는 공고입니다
      </Text>
      <Text className="mb-6 text-center text-content-secondary font-sans">
        이 공고는 현재 앱 내부 지원 범위에 포함되어 있지 않습니다.
      </Text>
      <Button onPress={() => router.back()} variant="outline">
        돌아가기
      </Button>
    </View>
  );
}

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storeUserId = useAuthStore((state) => state.user?.uid);
  const isAuthInitialized = useAuthStore((state) => state.isInitialized);
  const userId = resolveSessionUserId(storeUserId, isAuthInitialized);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(true);
  // 제출 in-flight 가드 (더블탭 중복 제출 방지). submitApplication 의 throttle 을 대체.
  const submitInFlightRef = useRef(false);

  const {
    job,
    isLoading: isLoadingJob,
    error: jobError,
    refresh: refreshJob,
  } = useJobDetail(id ?? '');

  const { submitApplicationAsync, isSubmitting, hasApplied } = useApplications();
  const {
    data: hasAppliedDirect = false,
    isLoading: isCheckingExistingApplication,
    isFetching: isFetchingExistingApplication,
  } = useHasAppliedToJob(id);

  const shouldBlockForExistingApplicationCheck =
    !!job &&
    !!userId &&
    !hasApplied(job.id) &&
    !hasAppliedDirect &&
    (isCheckingExistingApplication || isFetchingExistingApplication);

  const handleSubmit = useCallback(
    async (
      assignments: Assignment[],
      message: string | undefined,
      preQuestionAnswers: PreQuestionAnswer[] | undefined,
      provisionConsent: { at: string; version: string }
    ) => {
      // 중복 제출 방지 — fetchQuery await 동안 isSubmitting 이 아직 false 라 버튼이 활성이므로
      // 더블탭 시 두 번 제출될 수 있다(unique 인덱스가 데이터 중복은 막지만 2번째는 에러 Alert 노출).
      if (!job || submitInFlightRef.current) {
        return;
      }
      submitInFlightRef.current = true;

      try {
        logger.info('지원서 제출 시작', {
          jobId: job.id,
          assignmentsCount: assignments.length,
          hasPreQuestions: !!preQuestionAnswers,
        });

        try {
          const latestJob = await queryClient.fetchQuery<JobPosting | null>({
            ...getJobDetailQueryOptions(job.id, userId ?? undefined),
            staleTime: 0,
          });

          if (!latestJob) {
            showAlert('오류', '공고를 찾을 수 없습니다');
            return;
          }

          if (latestJob.status !== STATUS.JOB_POSTING.ACTIVE) {
            showAlert('지원 불가', '지원이 마감된 공고입니다');
            return;
          }

          const { total, filled } = getClosingStatus(latestJob);
          if (total > 0 && filled >= total) {
            showAlert('지원 불가', '모집 인원이 마감되었습니다');
            return;
          }
        } catch (error) {
          logger.warn('지원 전 최신 공고 검증 실패', { error });
        }

        // mutateAsync + try/catch — 에러 메시지를 다이얼로그로 노출한다(웹은 window.alert 분기).
        // (전역 onError 토스트는 네이티브 SheetModal 뒤에 가려 안 보이므로)
        try {
          await submitApplicationAsync({
            jobPostingId: job.id,
            assignments,
            message,
            preQuestionAnswers,
            provisionConsentAt: provisionConsent.at,
            provisionConsentVersion: provisionConsent.version,
          });
          setShowForm(false);
        } catch (error) {
          logger.error('지원서 제출 실패', error instanceof Error ? error : undefined);
          const errorMessage =
            error instanceof Error
              ? error.message
              : '지원 중 오류가 발생했습니다. 다시 시도해 주세요.';
          showAlert('지원 실패', errorMessage);
        }
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [job, queryClient, submitApplicationAsync, userId]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleViewPostSubmitTarget = useCallback(() => {
    if (job?.schedule.kind === 'fixed') {
      router.replace('/(app)/(tabs)/profile');
      return;
    }

    router.replace('/(app)/(tabs)/schedule');
  }, [job?.schedule.kind]);

  const handleReturnToJob = useCallback(() => {
    if (!id) {
      router.back();
      return;
    }

    router.replace(`/(app)/jobs/${id}`);
  }, [id]);

  const fallbackHref = id ? (`/(app)/jobs/${id}` as const) : ('/(app)/(tabs)/home-jobs' as const);

  if (isLoadingJob || shouldBlockForExistingApplicationCheck) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="지원하기" fallbackHref={fallbackHref} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (jobError || !job) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="지원하기" fallbackHref={fallbackHref} />
        <ErrorState message={jobError?.message ?? '공고를 찾을 수 없습니다'} onRetry={refreshJob} />
      </SafeAreaView>
    );
  }

  if (!isSupportedReleasePosting(job)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="지원하기" fallbackHref={fallbackHref} />
        <UnsupportedPostingState />
      </SafeAreaView>
    );
  }

  const isFixed = job.schedule.kind === 'fixed';

  if (hasApplied(job.id) || hasAppliedDirect) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="지원하기" fallbackHref={fallbackHref} />
        <AlreadyAppliedState isFixed={isFixed} />
      </SafeAreaView>
    );
  }

  // 고정 공고는 앱 내 지원 비대상 — 두 공고 상세 화면의 CTA 만 막혀 있었고 이 라우트 자체는
  // 열려 있어 딥링크·URL 직접 입력으로 정책이 뚫렸다. 위 isSupportedReleasePosting 가드는
  // fixed 를 **명시적으로 통과**시키므로(jobPostingVisibility.ts) 여기서 별도로 막는다.
  // 이미 지원한 레거시 행은 위 AlreadyAppliedState 가 먼저 잡도록 순서를 뒤에 둔다.
  if (isFixed) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="지원하기" fallbackHref={fallbackHref} />
        <FixedPostingState contactPhone={job.contactPhone} onReturn={handleReturnToJob} />
      </SafeAreaView>
    );
  }

  if (!showForm) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="지원 완료" fallbackHref={fallbackHref} />
        <View className="flex-1 items-center justify-center p-6">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-success-50 dark:bg-success-900/30">
            <CheckCircleIcon size={56} color={STATUS_COLORS.success} />
          </View>
          <Text className="mb-2 text-center text-xl font-display text-content-primary dark:text-off-white">
            지원이 완료되었습니다
          </Text>
          <Text className="mb-8 text-center text-content-secondary font-sans">
            공고 상세 화면에서 지원 상태를 확인하실 수 있어요.
          </Text>
          <View className="w-full max-w-xs gap-3">
            <Button onPress={handleReturnToJob} fullWidth>
              공고 상세로 돌아가기
            </Button>
            <Button onPress={handleViewPostSubmitTarget} variant="outline" fullWidth>
              {isFixed ? '프로필 보기' : '내 일정 보기'}
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackHeader title="지원하기" fallbackHref={fallbackHref} />
      <ApplicationForm
        job={job}
        visible={showForm}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </SafeAreaView>
  );
}
