/**
 * UNIQN Mobile - Job Detail Screen
 * 구인공고 상세 화면 (공개)
 *
 * @version 1.0.0
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobDetail } from '@/components/jobs';
import { Button } from '@/components/ui/Button';
import { useJobDetail, useApplications } from '@/hooks';
import { useAuthStore, useThemeStore } from '@/stores';
import { logger } from '@/utils/logger';

// ============================================================================
// Loading Component
// ============================================================================

function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
      <ActivityIndicator size="large" color="#6366f1" />
      <Text className="mt-4 text-gray-500 dark:text-gray-400">
        공고 정보를 불러오는 중...
      </Text>
    </View>
  );
}

// ============================================================================
// Error Component
// ============================================================================

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Text className="text-4xl mb-4">😢</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        오류가 발생했습니다
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
        {message}
      </Text>
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
  const { isDarkMode } = useThemeStore();
  const { user } = useAuthStore();
  const { hasApplied, getApplicationStatus } = useApplications();

  const {
    job,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useJobDetail(id ?? '');

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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '공고 상세',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '공고 상세',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <ErrorState
          message={error?.message ?? '공고를 찾을 수 없습니다'}
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  // 지원 상태 확인
  const alreadyApplied = hasApplied(job.id);
  const applicationStatus = getApplicationStatus(job.id);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: job.title,
          headerStyle: {
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          },
          headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor="#6366f1"
          />
        }
      >
        <JobDetail job={job} />
      </ScrollView>

      {/* 하단 지원 버튼 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <SafeAreaView edges={['bottom']}>
          {alreadyApplied ? (
            <View className="items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {applicationStatus?.status === 'applied' && '지원 완료 - 검토 중'}
                {applicationStatus?.status === 'pending' && '지원 검토 중'}
                {applicationStatus?.status === 'confirmed' && '지원 승인됨'}
                {applicationStatus?.status === 'rejected' && '지원이 거절되었습니다'}
                {applicationStatus?.status === 'waitlisted' && '대기자 명단에 등록됨'}
              </Text>
              <Button
                onPress={() => router.push('/(app)/(tabs)/schedule')}
                variant="outline"
                fullWidth
              >
                내 지원 현황 보기
              </Button>
            </View>
          ) : job.status !== 'active' ? (
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
