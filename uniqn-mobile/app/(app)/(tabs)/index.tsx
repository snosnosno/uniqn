/**
 * UNIQN Mobile - Jobs Screen
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { JobList, PostingTypeChips, DateSlider, SearchBar } from '@/components/jobs';
import { TabHeader } from '@/components/headers';
import { useJobPostings } from '@/hooks/useJobPostings';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';
import { searchJobPostings, trackSearch } from '@/services';
import {
  buildPostingFacts,
  focusPostingCardToDate,
  matchesPostingDate,
  projectPostingCard,
} from '@/domains/job-posting';
import { queryKeys } from '@/lib/queryClient';
import type { PostingType, JobPostingFilters } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialOverlay } from '@/components/tutorial';
import { APP_INTRO_STAFF, APP_INTRO_EMPLOYER } from '@/constants/tutorials';

export default function JobsScreen() {
  const { isEmployer } = useAuth();
  const tutorialConfig = isEmployer ? APP_INTRO_EMPLOYER : APP_INTRO_STAFF;
  const {
    needsTutorial,
    completeTutorial,
    isLoading: isTutorialLoading,
    timeoutMs: tutorialTimeoutMs,
  } = useTutorial('appIntro', { pageCount: tutorialConfig.pages.length, delayMs: 1500 });

  const [selectedType, setSelectedType] = useState<PostingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const normalizedSearchText = searchText.trim();

  const hasAutoSelected = useRef(false);
  const {
    counts,
    hasCounts,
    firstAvailableType,
    isLoading: isLoadingTypeCounts,
  } = usePostingTypeCounts();

  useEffect(() => {
    if (!hasAutoSelected.current && !isLoadingTypeCounts && firstAvailableType) {
      setSelectedType(firstAvailableType);
      hasAutoSelected.current = true;
    } else if (!hasAutoSelected.current && !isLoadingTypeCounts && !firstAvailableType) {
      setSelectedType('urgent');
      hasAutoSelected.current = true;
    }
  }, [firstAvailableType, isLoadingTypeCounts]);

  useEffect(() => {
    if (!normalizedSearchText) {
      setDebouncedSearch('');
      return;
    }

    const timer = setTimeout(() => setDebouncedSearch(normalizedSearchText), 300);
    return () => clearTimeout(timer);
  }, [normalizedSearchText]);

  const isSearchMode = normalizedSearchText.length > 0;
  const isSearching = debouncedSearch.length > 0;
  const isSearchPending = isSearchMode && debouncedSearch !== normalizedSearchText;
  const selectedDateString = useMemo(
    () =>
      selectedType === 'regular' && selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
    [selectedDate, selectedType]
  );
  const chipCounts = useMemo(
    () =>
      !hasCounts || isLoadingTypeCounts || !counts
        ? undefined
        : {
            urgent: counts.urgent,
            tournament: counts.tournament,
            regular: counts.regular,
            fixed: counts.fixed,
          },
    [counts, hasCounts, isLoadingTypeCounts]
  );

  const filters = useMemo<JobPostingFilters>(() => {
    const result: JobPostingFilters = {};

    if (selectedType) {
      result.postingType = selectedType;
    }

    if (selectedDateString) {
      result.workDate = selectedDateString;
    }

    return result;
  }, [selectedDateString, selectedType]);

  const { jobs, isLoading, isRefreshing, isFetchingMore, hasMore, error, refresh, loadMore } =
    useJobPostings({
      filters,
      enabled: selectedType !== null,
    });

  const searchQuery = useQuery({
    queryKey: queryKeys.jobPostings.search(debouncedSearch),
    queryFn: async () => {
      const results = await searchJobPostings(debouncedSearch, 50);
      return results.map((posting) => projectPostingCard(buildPostingFacts(posting)));
    },
    enabled: isSearching,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const filteredSearchJobs = useMemo(() => {
    const searchJobs = searchQuery.data ?? [];

    const visibleJobs = searchJobs.filter((job) => {
      if (selectedType && job.postingType !== selectedType) {
        return false;
      }

      if (selectedDateString) {
        return matchesPostingDate(job, selectedDateString);
      }

      return true;
    });

    if (!selectedDateString) {
      return visibleJobs;
    }

    return visibleJobs.map((job) => focusPostingCardToDate(job, selectedDateString));
  }, [searchQuery.data, selectedDateString, selectedType]);

  useEffect(() => {
    if (debouncedSearch) {
      trackSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  const handleTypeChange = useCallback((type: PostingType | null) => {
    setSelectedType(type);
    setSelectedDate(null);
  }, []);

  const noop = useCallback(() => undefined, []);

  const handleSearchRefresh = useCallback(() => {
    searchQuery.refetch();
  }, [searchQuery]);

  const handleJobPress = useCallback((jobId: string) => {
    Keyboard.dismiss();
    router.push(`/(app)/jobs/${jobId}`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <TabHeader title="구인구직" />

      <SearchBar value={searchText} onChangeText={setSearchText} />

      <PostingTypeChips selected={selectedType} onChange={handleTypeChange} counts={chipCounts} />

      {selectedType === 'regular' && (
        <DateSlider selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      )}

      {isSearchMode ? (
        <JobList
          jobs={filteredSearchJobs}
          isLoading={isSearchPending || (isSearching && searchQuery.isLoading)}
          isRefreshing={searchQuery.isRefetching}
          isFetchingMore={false}
          hasMore={false}
          error={searchQuery.error as Error | null}
          onRefresh={handleSearchRefresh}
          onLoadMore={noop}
          onJobPress={handleJobPress}
          emptyMessage={`'${debouncedSearch || normalizedSearchText}' 검색 결과가 없습니다`}
        />
      ) : (
        <JobList
          jobs={jobs}
          isLoading={isLoading || isLoadingTypeCounts || selectedType === null}
          isRefreshing={isRefreshing}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          error={error}
          onRefresh={refresh}
          onLoadMore={loadMore}
          onJobPress={handleJobPress}
        />
      )}

      {needsTutorial && !isTutorialLoading && (
        <View className="absolute inset-0 z-10">
          <TutorialOverlay
            config={tutorialConfig}
            onComplete={completeTutorial}
            timeoutMs={tutorialTimeoutMs}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
