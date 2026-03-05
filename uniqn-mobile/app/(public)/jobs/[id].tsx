/**
 * UNIQN Mobile - Job Detail Screen
 * 구인공고 상세 화면 (공개)
 *
 * @version 1.0.0
 */

import { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '@/components/icons';
import { JobDetail } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui';
import { useJobDetail, useApplications } from '@/hooks';
import { useAuthStore, useThemeStore } from '@/stores';
import { getLayoutColor } from '@/constants/colors';
import { STATUS } from '@/constants';
import { trackJobView } from '@/services/observability';
import { logger } from '@/utils/logger';

// ============================================================================
// Custom Header Component
// ============================================================================

function CustomHeader({ title }: { title?: string }) {
  const { isDarkMode } = useThemeStore();

  return (
    <View className="flex-row items-center px-4 py-3 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-surface-overlay">
      <Pressable
        onPress={() => router.back()}
        className="p-2 -ml-2 mr-2"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronLeftIcon size={24} color={isDarkMode ? '#ffffff' : '#1A1625'} />
      </Pressable>
      <Text className="text-base font-semibold text-gray-900 dark:text-white">공고 상세</Text>
      {title && (
        <>
          <Text className="mx-2 text-gray-400 dark:text-gray-500">|</Text>
          <Text className="flex-1 text-base text-gray-600 dark:text-gray-400" numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </View>
  );
}

// ============================================================================
// Loading Component
// ============================================================================

function LoadingState() {
  return <Loading variant="layout" message="공고 정보를 불러오는 중..." />;
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
        <CustomHeader />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <CustomHeader />
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
      <CustomHeader title={job.title} />

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
                {applicationStatus?.status === STATUS.APPLICATION.APPLIED && '지원 완료 - 검토 중'}
                {applicationStatus?.status === STATUS.APPLICATION.PENDING && '지원 검토 중'}
                {applicationStatus?.status === STATUS.APPLICATION.CONFIRMED && '지원 승인됨'}
                {applicationStatus?.status === STATUS.APPLICATION.REJECTED &&
                  '지원이 거절되었습니다'}
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
