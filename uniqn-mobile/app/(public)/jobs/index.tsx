/**
 * UNIQN Mobile - Job List Screen
 * Public jobs entry point with install prompts for protected actions.
 */

import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { JobList, PostingTypeChips } from '@/components/jobs';
import { PublicBottomTabBar } from '@/components/navigation';
import { LAYOUT, STATUS } from '@/constants';
import { useInstallPrompt, useJobPostings } from '@/hooks';
import { useThemeStore } from '@/stores';
import type { JobPostingFilters, PostingType } from '@/types';

export default function JobListScreen() {
  const [selectedType, setSelectedType] = useState<PostingType | null>('urgent');
  const { isDarkMode } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { openInstallPrompt } = useInstallPrompt();

  const filters = useMemo<JobPostingFilters>(() => {
    const result: JobPostingFilters = { status: STATUS.JOB_POSTING.ACTIVE };

    if (selectedType) {
      result.postingType = selectedType;
    }

    return result;
  }, [selectedType]);

  const { jobs, isLoading, isRefreshing, isFetchingMore, hasMore, error, refresh, loadMore } =
    useJobPostings({ filters });

  const handleJobPress = useCallback(
    (jobId: string) => {
      openInstallPrompt('job-card', {
        loginRedirect: `/(app)/jobs/${jobId}`,
      });
    },
    [openInstallPrompt]
  );

  const handleProtectedTabPress = useCallback(
    (tab: 'schedule' | 'employer' | 'profile') => {
      if (tab === 'schedule') {
        openInstallPrompt('schedule-tab');
        return;
      }

      if (tab === 'employer') {
        openInstallPrompt('employer-tab');
        return;
      }

      openInstallPrompt('profile-tab');
    },
    [openInstallPrompt]
  );

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

      <PostingTypeChips selected={selectedType} onChange={setSelectedType} />

      <View
        className="flex-1 bg-gray-50 dark:bg-surface-dark"
        style={{ paddingBottom: LAYOUT.TAB_BAR_HEIGHT + insets.bottom }}
      >
        <JobList
          jobs={jobs}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          error={error}
          onRefresh={refresh}
          onLoadMore={loadMore}
          onJobPress={handleJobPress}
        />
      </View>

      <PublicBottomTabBar activeTab="jobs" onProtectedTabPress={handleProtectedTabPress} />
    </SafeAreaView>
  );
}
