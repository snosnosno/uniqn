/**
 * UNIQN Mobile - Jobs Screen
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { JobList, PostingTypeChips, DateCalendar, SearchBar } from '@/components/jobs';
import {
  FilterBar,
  RegionFilterSheet,
  RoleFilterSheet,
  SalaryFilterSheet,
} from '@/components/jobs/filters';
import { findRegionByAddress } from '@/constants/regions';
import {
  expandRegionTokensToScope,
  formatRegionTokensLabel,
  type RegionToken,
} from '@/utils/regionSelection';
import { formatRoleFiltersLabel, formatSalaryFilterLabel } from '@/utils/jobFilterLabels';
import { useJobFilterStore, type SalaryFilter } from '@/stores/jobFilterStore';
import type { StaffRole } from '@/types/role';
import { TabHeader } from '@/components/headers';
import { useJobPostings } from '@/hooks/useJobPostings';
import { useApplications } from '@/hooks/useApplications';
import { buildJobApplicationStatusMap } from '@/utils/applicationStatusMap';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';
import { usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
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
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import { TutorialOverlay } from '@/components/tutorial';
import { APP_INTRO_STAFF, APP_INTRO_EMPLOYER } from '@/constants/tutorials';

export default function JobsScreen() {
  const bottomPadding = useTabBarBottomPadding();
  const { isEmployer, profile } = useAuth();
  const tutorialConfig = isEmployer ? APP_INTRO_EMPLOYER : APP_INTRO_STAFF;
  const {
    needsTutorial,
    completeTutorial,
    isLoading: isTutorialLoading,
    timeoutMs: tutorialTimeoutMs,
  } = useTutorial('appIntro', { pageCount: tutorialConfig.pages.length, delayMs: 1500 });

  const [selectedType, setSelectedType] = useState<PostingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const normalizedSearchText = searchText.trim();

  // 지역/역할/급여 필터 — 세션 간 영속(MMKV). 지역 토큰(slug | 'group:서울') 모델은 utils/regionSelection.
  const regionTokens = useJobFilterStore((state) => state.regionTokens);
  const recentRegionTokens = useJobFilterStore((state) => state.recentRegionTokens);
  const applyRegionTokens = useJobFilterStore((state) => state.applyRegionTokens);
  const roleFilters = useJobFilterStore((state) => state.roleFilters);
  const applyRoleFilters = useJobFilterStore((state) => state.applyRoleFilters);
  const salaryFilter = useJobFilterStore((state) => state.salaryFilter);
  const applySalaryFilter = useJobFilterStore((state) => state.applySalaryFilter);
  const clearAllFilters = useJobFilterStore((state) => state.clearAllFilters);
  // 서버 쿼리 스코프 — 그룹 토큰은 접두 압축(URL 한도), 시/구 토큰은 slug 확장.
  const regionScope = useMemo(() => expandRegionTokensToScope(regionTokens), [regionTokens]);
  const regionLabel = useMemo(() => formatRegionTokensLabel(regionTokens), [regionTokens]);
  const roleLabel = useMemo(() => formatRoleFiltersLabel(roleFilters), [roleFilters]);
  const salaryLabel = useMemo(() => formatSalaryFilterLabel(salaryFilter), [salaryFilter]);
  const hasActiveFilter =
    regionTokens.length > 0 || roleFilters.length > 0 || salaryFilter !== null;
  // 프로필 지역(자유텍스트) → slug 추천 칩. 매핑 실패 시 미노출.
  const suggestedRegionSlug = useMemo(
    () => findRegionByAddress(profile?.region)?.slug,
    [profile?.region]
  );

  const hasAutoSelected = useRef(false);
  const {
    counts,
    hasCounts,
    firstAvailableType,
    isLoading: isLoadingTypeCounts,
  } = usePostingTypeCounts({
    regions: regionScope.slugs,
    regionPrefixes: regionScope.prefixes,
    roles: roleFilters,
    salaryType: salaryFilter?.type ?? null,
    salaryMin: salaryFilter?.min ?? null,
  });

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

    if (regionScope.slugs.length > 0) {
      result.regions = regionScope.slugs;
    }

    if (regionScope.prefixes.length > 0) {
      result.regionPrefixes = regionScope.prefixes;
    }

    if (roleFilters.length > 0) {
      result.roles = roleFilters;
    }

    if (salaryFilter) {
      result.salaryType = salaryFilter.type;
      result.salaryMin = salaryFilter.min;
    }

    return result;
  }, [selectedDateString, selectedType, regionScope, roleFilters, salaryFilter]);

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

    // 검색은 전체 공고 대상 — 둘러보기용 type 칩 필터는 검색에 적용하지 않는다.
    // (선택된 칩 때문에 다른 타입 검색 결과가 사라져 '결과 없음' 으로 오인되던 문제)
    // 단, 일반 탭에서 날짜를 고른 경우의 날짜 포커싱은 유지한다.
    const visibleJobs = searchJobs.filter((job) => {
      if (selectedDateString) {
        return matchesPostingDate(job, selectedDateString);
      }

      return true;
    });

    if (!selectedDateString) {
      return visibleJobs;
    }

    return visibleJobs.map((job) => focusPostingCardToDate(job, selectedDateString));
  }, [searchQuery.data, selectedDateString]);

  // 내 지원 상태 칩 — 목록 카드에 "지원완료/확정" 표시 (QW1)
  const { myApplications } = useApplications();
  const applicationStatuses = useMemo(
    () => buildJobApplicationStatusMap(myApplications),
    [myApplications]
  );

  const visibleJobIds = useMemo(
    () => (isSearchMode ? filteredSearchJobs : jobs).map((job) => job.id),
    [isSearchMode, filteredSearchJobs, jobs]
  );
  const filledCountsQuery = usePostingFilledCounts(visibleJobIds);

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

  const handleRegionApply = useCallback(
    (tokens: RegionToken[]) => {
      applyRegionTokens(tokens);
    },
    [applyRegionTokens]
  );

  const handleRoleApply = useCallback(
    (roles: StaffRole[]) => {
      applyRoleFilters(roles);
    },
    [applyRoleFilters]
  );

  const handleSalaryApply = useCallback(
    (filter: SalaryFilter | null) => {
      applySalaryFilter(filter);
    },
    [applySalaryFilter]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="구인구직" />

      <SearchBar value={searchText} onChangeText={setSearchText} />

      <PostingTypeChips
        selected={selectedType}
        onChange={handleTypeChange}
        counts={chipCounts}
        disabled={isSearchMode}
      />

      {isSearchMode ? (
        <View className="px-4 pb-2">
          <Text className="text-xs text-content-secondary dark:text-secondary-400 font-sans">
            검색은 공고 종류·지역 구분 없이 전체를 보여드려요
          </Text>
        </View>
      ) : (
        <FilterBar
          regionLabel={regionLabel}
          regionActive={regionTokens.length > 0}
          onPressRegion={() => setRegionModalVisible(true)}
          roleLabel={roleLabel}
          roleActive={roleFilters.length > 0}
          onPressRole={() => setRoleModalVisible(true)}
          salaryLabel={salaryLabel}
          salaryActive={salaryFilter !== null}
          onPressSalary={() => setSalaryModalVisible(true)}
          onReset={hasActiveFilter ? clearAllFilters : undefined}
        />
      )}

      {selectedType === 'regular' && (
        <DateCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
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
          filledCounts={filledCountsQuery.data}
          applicationStatuses={applicationStatuses}
          contentBottomPadding={bottomPadding}
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
          filledCounts={filledCountsQuery.data}
          applicationStatuses={applicationStatuses}
          contentBottomPadding={bottomPadding}
          emptyMessage={
            hasActiveFilter
              ? '조건에 맞는 공고가 없어요. 필터를 넓히거나 위 ‘초기화’로 전체 공고를 볼 수 있어요.'
              : undefined
          }
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

      {/* 필터 시트 3종 — 각각 독립 오픈(중첩 Modal 금지). pill 은 한 번에 하나만 열 수 있다. */}
      <RegionFilterSheet
        visible={regionModalVisible}
        onClose={() => setRegionModalVisible(false)}
        appliedTokens={regionTokens}
        onApply={handleRegionApply}
        recentTokens={recentRegionTokens}
        suggestedSlug={suggestedRegionSlug}
        appliedRoles={roleFilters}
        appliedSalary={salaryFilter}
      />
      <RoleFilterSheet
        visible={roleModalVisible}
        onClose={() => setRoleModalVisible(false)}
        appliedRoles={roleFilters}
        onApply={handleRoleApply}
        appliedRegions={regionScope.slugs}
        appliedRegionPrefixes={regionScope.prefixes}
        appliedSalary={salaryFilter}
      />
      <SalaryFilterSheet
        visible={salaryModalVisible}
        onClose={() => setSalaryModalVisible(false)}
        appliedSalary={salaryFilter}
        onApply={handleSalaryApply}
        appliedRegions={regionScope.slugs}
        appliedRegionPrefixes={regionScope.prefixes}
        appliedRoles={roleFilters}
      />
    </SafeAreaView>
  );
}
