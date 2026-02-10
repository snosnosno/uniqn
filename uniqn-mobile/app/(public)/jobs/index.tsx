/**
 * UNIQN Mobile - Job List Screen
 * 구인공고 목록 화면 (공개)
 *
 * @version 1.1.0 - PostingTypeChips 통일 적용
 */

import { useState, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobList, PostingTypeChips } from '@/components/jobs';
import { useJobPostings } from '@/hooks';
import { useThemeStore } from '@/stores';
import { STATUS } from '@/constants';
import type { PostingType, JobPostingFilters } from '@/types';

// ============================================================================
// Screen Component
// ============================================================================

export default function JobListScreen() {
  const [selectedType, setSelectedType] = useState<PostingType | null>('urgent');
  const { isDarkMode } = useThemeStore();

  // 필터 변환 (App 라우트와 동일한 패턴)
  const filters = useMemo<JobPostingFilters>(() => {
    const result: JobPostingFilters = { status: STATUS.JOB_POSTING.ACTIVE };
    if (selectedType) {
      result.postingType = selectedType;
    }
    return result;
  }, [selectedType]);

  const { jobs, isLoading, isRefreshing, isFetchingMore, hasMore, refresh, loadMore } =
    useJobPostings({ filters });

  const handleJobPress = useCallback((jobId: string) => {
    router.push(`/(public)/jobs/${jobId}`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '구인공고',
          headerStyle: {
            backgroundColor: isDarkMode ? '#1A1625' : '#ffffff',
          },
          headerTintColor: isDarkMode ? '#ffffff' : '#1A1625',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />

      {/* 공고 타입 칩 필터 */}
      <PostingTypeChips selected={selectedType} onChange={setSelectedType} />

      {/* 공고 목록 */}
      <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <JobList
          jobs={jobs}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          onRefresh={refresh}
          onLoadMore={loadMore}
          onJobPress={handleJobPress}
        />
      </View>
    </SafeAreaView>
  );
}
