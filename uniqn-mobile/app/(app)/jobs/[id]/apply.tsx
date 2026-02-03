/**
 * UNIQN Mobile - Job Apply Screen
 * 지원하기 화면 (로그인 필요)
 *
 * @description v2.0 - Assignment + PreQuestion 지원
 * @version 2.2.0
 *
 * @changelog
 * - 2.2.0: 지원 폼 진입 시 최신 공고 상태 fetch + 제출 전 마감 검증
 */

import { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationForm } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { useJobDetail, useApplications } from '@/hooks';
import { useThemeStore, useToastStore } from '@/stores';
import { queryKeys } from '@/lib/queryClient';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { logger } from '@/utils/logger';
import type { Assignment, PreQuestionAnswer, JobPosting } from '@/types';

// ============================================================================
// Loading Component
// ============================================================================

function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-surface-dark">
      <ActivityIndicator size="large" color="#6366f1" />
      <Text className="mt-4 text-gray-500 dark:text-gray-400">공고 정보를 불러오는 중...</Text>
    </View>
  );
}

// ============================================================================
// Error Component
// ============================================================================

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-surface-dark">
      <Text className="text-4xl mb-4">😢</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        오류가 발생했습니다
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">{message}</Text>
      <Button onPress={onRetry} variant="outline">
        다시 시도
      </Button>
    </View>
  );
}

// ============================================================================
// Already Applied Component
// ============================================================================

function AlreadyAppliedState() {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-surface-dark">
      <Text className="text-4xl mb-4">✅</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        이미 지원한 공고입니다
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
        지원 현황은 스케줄 탭에서 확인할 수 있습니다
      </Text>
      <View className="flex-col gap-3 w-full max-w-xs">
        <Button onPress={() => router.push('/(app)/(tabs)/schedule')} fullWidth>
          지원 현황 보기
        </Button>
        <Button onPress={() => router.back()} variant="outline" fullWidth>
          돌아가기
        </Button>
      </View>
    </View>
  );
}

// ============================================================================
// Screen Component
// ============================================================================

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  // Note: staleTime: 0이므로 마운트 시 자동 fresh fetch (별도 useEffect 불필요)

  // 지원 제출 핸들러 (v2.0: Assignment + PreQuestion)
  // v2.2: 제출 전 최신 공고 상태 검증 추가
  const handleSubmit = useCallback(
    async (
      assignments: Assignment[],
      message?: string,
      preQuestionAnswers?: PreQuestionAnswer[]
    ) => {
      if (!job) return;

      logger.info('지원 제출 시작', {
        jobId: job.id,
        assignmentsCount: assignments.length,
        hasPreQuestions: !!preQuestionAnswers,
      });

      // 제출 전 최신 공고 상태 확인
      try {
        const latestJob = await queryClient.fetchQuery<JobPosting | null>({
          queryKey: queryKeys.jobPostings.detail(job.id),
          staleTime: 0, // 강제 fresh fetch
        });

        if (!latestJob) {
          addToast({ type: 'error', message: '공고를 찾을 수 없습니다' });
          return;
        }

        // 공고 상태 확인
        if (latestJob.status !== 'active') {
          addToast({ type: 'error', message: '지원이 마감된 공고입니다' });
          return;
        }

        // 정원 확인
        const { total, filled } = getClosingStatus(latestJob);
        if (total > 0 && filled >= total) {
          addToast({ type: 'error', message: '모집 인원이 마감되었습니다' });
          return;
        }

        logger.info('지원 제출 검증 통과', {
          jobId: job.id,
          status: latestJob.status,
          filled,
          total,
        });
      } catch (error) {
        logger.warn('지원 전 검증 실패, 서버에서 최종 검증', { error });
        // 검증 실패해도 서버에서 최종 검증하므로 진행
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
            // 성공 후 약간의 딜레이 후 이동
            setTimeout(() => {
              router.replace('/(app)/(tabs)/schedule');
            }, 1500);
          },
        }
      );
    },
    [job, submitApplication, queryClient, addToast]
  );

  // 폼 닫기 핸들러
  const handleClose = useCallback(() => {
    router.back();
  }, []);

  if (isLoadingJob) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '지원하기',
            headerStyle: {
              backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#1A1625',
          }}
        />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (jobError || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '지원하기',
            headerStyle: {
              backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#1A1625',
          }}
        />
        <ErrorState message={jobError?.message ?? '공고를 찾을 수 없습니다'} onRetry={refreshJob} />
      </SafeAreaView>
    );
  }

  // 이미 지원한 경우
  if (hasApplied(job.id)) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '지원하기',
            headerStyle: {
              backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#1A1625',
          }}
        />
        <AlreadyAppliedState />
      </SafeAreaView>
    );
  }

  // 지원 완료 상태
  if (!showForm) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '지원 완료',
            headerStyle: {
              backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#1A1625',
          }}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-6xl mb-4">🎉</Text>
          <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">지원 완료!</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center">
            지원서가 성공적으로 제출되었습니다.{'\n'}곧 스케줄 페이지로 이동합니다...
          </Text>
          <ActivityIndicator className="mt-6" color="#6366f1" />
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
