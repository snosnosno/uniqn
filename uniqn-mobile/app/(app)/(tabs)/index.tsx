/**
 * UNIQN Mobile - Jobs Screen
 * 구인구직 메인 화면 (탭 홈)
 *
 * @version 2.3.0 - 검색바 추가 (제목/장소 검색)
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { JobList, PostingTypeChips, DateSlider, SearchBar } from '@/components/jobs';
import { TabHeader } from '@/components/headers';
import { useJobPostings } from '@/hooks/useJobPostings';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';
import { searchJobPostings, convertToCard, trackSearch } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import type { PostingType, JobPostingFilters } from '@/types';

export default function JobsScreen() {
  // 필터 상태 (기본: null, 자동 선택 후 설정됨)
  const [selectedType, setSelectedType] = useState<PostingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 검색 상태
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 자동 탭 선택이 완료되었는지 추적
  const hasAutoSelected = useRef(false);

  // 타입별 공고 존재 여부 확인
  const { firstAvailableType, isLoading: isLoadingTypeCounts } = usePostingTypeCounts();

  // 첫 로드 시 공고가 있는 탭으로 자동 이동
  // 우선순위: 긴급 → 대회 → 지원 → 고정
  useEffect(() => {
    if (!hasAutoSelected.current && !isLoadingTypeCounts && firstAvailableType) {
      setSelectedType(firstAvailableType);
      hasAutoSelected.current = true;
    } else if (!hasAutoSelected.current && !isLoadingTypeCounts && !firstAvailableType) {
      // 모든 타입에 공고가 없으면 기본값 'urgent' 설정
      setSelectedType('urgent');
      hasAutoSelected.current = true;
    }
  }, [firstAvailableType, isLoadingTypeCounts]);

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    if (!searchText.trim()) {
      setDebouncedSearch(''); // 빈 값은 즉시 반영 (검색모드 즉시 해제)
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const isSearchMode = searchText.length > 0; // UI 전환 기준 (즉시 반영)
  const isSearching = debouncedSearch.length > 0; // 쿼리 활성화 기준 (디바운스 후)

  // 필터 조건 구성
  const filters = useMemo<JobPostingFilters>(() => {
    const result: JobPostingFilters = {};

    if (selectedType) {
      result.postingType = selectedType;
    }

    // 날짜 필터는 regular 타입에서만 적용
    if (selectedType === 'regular' && selectedDate) {
      result.workDate = format(selectedDate, 'yyyy-MM-dd');
    }

    return result;
  }, [selectedType, selectedDate]);

  // 구인공고 목록 훅 (필터 적용, 타입 선택 전까지 비활성화)
  const { jobs, isLoading, isRefreshing, isFetchingMore, hasMore, refresh, loadMore } =
    useJobPostings({
      filters,
      enabled: selectedType !== null, // 타입 선택 전까지 쿼리 비활성화
    });

  // 검색 쿼리 (디바운싱된 검색어가 있을 때만 활성화)
  const searchQuery = useQuery({
    queryKey: queryKeys.jobPostings.search(debouncedSearch),
    queryFn: async () => {
      const results = await searchJobPostings(debouncedSearch, 50);
      return results.map(convertToCard); // 검색 결과는 relevance 순서 유지 (sortJobPostings 미적용)
    },
    enabled: isSearching,
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
  });

  // 검색 analytics (queryFn 외부에서 1회만 트래킹)
  useEffect(() => {
    if (debouncedSearch) {
      trackSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  // 타입 변경 핸들러 (탭 변경 시 항상 날짜 초기화)
  const handleTypeChange = useCallback((type: PostingType | null) => {
    setSelectedType(type);
    setSelectedDate(null);
  }, []);

  // 검색 모드 핸들러
  const noop = useCallback(() => undefined, []);
  const handleSearchRefresh = useCallback(() => {
    searchQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch 참조는 TanStack Query가 안정적으로 유지
  }, [searchQuery.refetch]);

  // 공고 클릭 핸들러
  const handleJobPress = useCallback((jobId: string) => {
    Keyboard.dismiss();
    router.push(`/(app)/jobs/${jobId}`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      {/* 헤더 */}
      <TabHeader title="구인구직" />

      {/* 검색바 */}
      <SearchBar value={searchText} onChangeText={setSearchText} />

      {/* 필터 — 검색 모드 시 숨김 (입력 즉시 반영) */}
      {!isSearchMode && (
        <>
          {/* 공고 타입 칩 필터 */}
          <PostingTypeChips selected={selectedType} onChange={handleTypeChange} />

          {/* 날짜 슬라이더 (지원 타입 선택 시만 표시) */}
          {selectedType === 'regular' && (
            <DateSlider selectedDate={selectedDate} onDateSelect={setSelectedDate} />
          )}
        </>
      )}

      {/* 공고 목록 — 검색 결과 또는 기존 목록 */}
      {isSearchMode ? (
        <JobList
          jobs={searchQuery.data ?? []}
          isLoading={isSearching && searchQuery.isLoading}
          isRefreshing={searchQuery.isRefetching}
          isFetchingMore={false}
          hasMore={false}
          onRefresh={handleSearchRefresh}
          onLoadMore={noop}
          onJobPress={handleJobPress}
          emptyMessage={`'${debouncedSearch || searchText}' 검색 결과가 없습니다`}
        />
      ) : (
        <JobList
          jobs={jobs}
          isLoading={isLoading || isLoadingTypeCounts || selectedType === null}
          isRefreshing={isRefreshing}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          onRefresh={refresh}
          onLoadMore={loadMore}
          onJobPress={handleJobPress}
        />
      )}
    </SafeAreaView>
  );
}
