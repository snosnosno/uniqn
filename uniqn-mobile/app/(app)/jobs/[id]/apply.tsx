/**
 * UNIQN Mobile - Job Apply Screen
 */

import { useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationForm } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui';
import { useJobDetail, useApplications, useHasAppliedToJob } from '@/hooks';
import { getJobDetailQueryOptions } from '@/hooks/useJobDetail';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore, useThemeStore, useToastStore } from '@/stores';
import { STATUS } from '@/constants';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import { logger } from '@/utils/logger';
import type { Assignment, PreQuestionAnswer, JobPosting } from '@/types';

function LoadingState() {
  return <Loading variant="layout" message="공고 정보를 불러오는 중..." />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6 dark:bg-surface-dark">
      <Text className="mb-4 text-4xl">앗</Text>
      <Text className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        오류가 발생했습니다
      </Text>
      <Text className="mb-6 text-center text-gray-500 dark:text-gray-400">{message}</Text>
      <Button onPress={onRetry} variant="outline">
        다시 시도
      </Button>
    </View>
  );
}

function AlreadyAppliedState() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6 dark:bg-surface-dark">
      <Text className="mb-4 text-4xl">이미</Text>
      <Text className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        이미 지원한 공고입니다
      </Text>
      <Text className="mb-6 text-center text-gray-500 dark:text-gray-400">
        지원 현황은 일정 탭에서 확인할 수 있습니다
      </Text>
      <View className="w-full max-w-xs gap-3">
        <Button onPress={() => router.push('/(app)/(tabs)/schedule')} fullWidth>
          내 일정 보기
        </Button>
        <Button onPress={() => router.back()} variant="outline" fullWidth>
          돌아가기
        </Button>
      </View>
    </View>
  );
}

function UnsupportedPostingState() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6 dark:bg-surface-dark">
      <Text className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        현재 지원할 수 없는 공고입니다
      </Text>
      <Text className="mb-6 text-center text-gray-500 dark:text-gray-400">
        V3 canonical 통합 동안 고정 공고 지원은 비활성화되어 있습니다.
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
  const userId = storeUserId ?? getFirebaseAuth().currentUser?.uid ?? null;
  const { isDarkMode } = useThemeStore();
  const { addToast } = useToastStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(true);

  const {
    job,
    isLoading: isLoadingJob,
    error: jobError,
    refresh: refreshJob,
  } = useJobDetail(id ?? '');

  const { submitApplication, isSubmitting, hasApplied } = useApplications();
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
      message?: string,
      preQuestionAnswers?: PreQuestionAnswer[]
    ) => {
      if (!job) {
        return;
      }

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
          addToast({ type: 'error', message: '공고를 찾을 수 없습니다' });
          return;
        }

        if (latestJob.status !== STATUS.JOB_POSTING.ACTIVE) {
          addToast({ type: 'error', message: '지원이 마감된 공고입니다' });
          return;
        }

        const { total, filled } = getClosingStatus(latestJob);
        if (total > 0 && filled >= total) {
          addToast({ type: 'error', message: '모집 인원이 마감되었습니다' });
          return;
        }

        logger.info('지원서 제출 검증 통과', {
          jobId: job.id,
          status: latestJob.status,
          filled,
          total,
        });
      } catch (error) {
        logger.warn('지원 전 검증 실패, 서버에서 최종 검증', { error });
      }

      submitApplication(
        {
          jobPostingId: job.id,
          assignments,
          message,
          preQuestionAnswers,
        },
        {
          onSuccess: () => {
            setShowForm(false);
          },
        }
      );
    },
    [addToast, job, queryClient, submitApplication, userId]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleViewSchedule = useCallback(() => {
    router.replace('/(app)/(tabs)/schedule');
  }, []);

  const handleReturnToJob = useCallback(() => {
    if (!id) {
      router.back();
      return;
    }

    router.replace(`/(app)/jobs/${id}`);
  }, [id]);

  const stackOptions = {
    headerShown: true,
    title: '지원하기',
    headerStyle: {
      backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
    },
    headerTintColor: isDarkMode ? '#ffffff' : '#1A1625',
  } as const;

  if (isLoadingJob || shouldBlockForExistingApplicationCheck) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen options={stackOptions} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (jobError || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen options={stackOptions} />
        <ErrorState message={jobError?.message ?? '공고를 찾을 수 없습니다'} onRetry={refreshJob} />
      </SafeAreaView>
    );
  }

  if (!isCanonicalDatedPosting(job)) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen options={stackOptions} />
        <UnsupportedPostingState />
      </SafeAreaView>
    );
  }

  if (hasApplied(job.id) || hasAppliedDirect) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen options={stackOptions} />
        <AlreadyAppliedState />
      </SafeAreaView>
    );
  }

  if (!showForm) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen
          options={{
            ...stackOptions,
            title: '지원 완료',
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="mb-4 text-6xl">완료</Text>
          <Text className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-white">
            지원이 완료되었습니다
          </Text>
          <Text className="mb-8 text-center text-gray-500 dark:text-gray-400">
            지원 현황은 일정 탭에서 확인할 수 있습니다.
            {'\n'}
            지금 바로 다음 행동을 선택해 주세요.
          </Text>
          <View className="w-full max-w-xs gap-3">
            <Button onPress={handleViewSchedule} fullWidth>
              내 일정 보기
            </Button>
            <Button onPress={handleReturnToJob} variant="outline" fullWidth>
              공고 상세로 돌아가기
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
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
