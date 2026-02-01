/**
 * UNIQN Mobile - Job List Screen
 * 구인공고 목록 화면 (공개)
 *
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobList } from '@/components/jobs';
import { useJobPostings } from '@/hooks';
import { useThemeStore } from '@/stores';
import type { JobPostingFilters, StaffRole } from '@/types';

// ============================================================================
// Filter Bar Component
// ============================================================================

interface FilterBarProps {
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'urgent', label: '긴급' },
  { key: 'dealer', label: '딜러' },
  { key: 'manager', label: '매니저' },
];

function FilterBar({ selectedFilter, onFilterChange }: FilterBarProps) {
  return (
    <View className="flex-row px-4 py-2 gap-2 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-surface">
      {FILTERS.map((filter) => {
        const isSelected = selectedFilter === filter.key;
        return (
          <Pressable
            key={filter.key}
            onPress={() => onFilterChange(filter.key)}
            className={`
              px-4 py-2 rounded-full
              ${isSelected
                ? 'bg-primary-500'
                : 'bg-gray-100 dark:bg-surface'
              }
            `}
          >
            <Text
              className={`
                text-sm font-medium
                ${isSelected
                  ? 'text-white'
                  : 'text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// Screen Component
// ============================================================================

export default function JobListScreen() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const { isDarkMode } = useThemeStore();

  // 필터 변환
  const getFilters = useCallback((): JobPostingFilters => {
    const filters: JobPostingFilters = { status: 'active' };

    if (selectedFilter === 'urgent') {
      filters.isUrgent = true;
    } else if (selectedFilter !== 'all') {
      filters.roles = [selectedFilter as StaffRole];
    }

    return filters;
  }, [selectedFilter]);

  const {
    jobs,
    isLoading,
    isRefreshing,
    isFetchingMore,
    hasMore,
    refresh,
    loadMore,
  } = useJobPostings({ filters: getFilters() });

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

      {/* 필터 바 */}
      <FilterBar
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
      />

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
          emptyMessage={
            selectedFilter === 'all'
              ? '등록된 공고가 없습니다'
              : `${FILTERS.find((f) => f.key === selectedFilter)?.label ?? ''} 공고가 없습니다`
          }
        />
      </View>
    </SafeAreaView>
  );
}
