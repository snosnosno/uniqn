/**
 * UNIQN Mobile - Jobs Screen
 * 구인구직 메인 화면 (탭 홈)
 *
 * @version 2.2.0 - 공고가 있는 탭으로 자동 이동 기능 추가
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { JobList, PostingTypeChips, DateSlider } from '@/components/jobs';
import { TabHeader } from '@/components/headers';
import { useJobPostings } from '@/hooks/useJobPostings';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';
import type { PostingType, JobPostingFilters } from '@/types';

export default function JobsScreen() {
  // 필터 상태 (기본: null, 자동 선택 후 설정됨)
  const [selectedType, setSelectedType] = useState<PostingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  // 필터 조건 구성
  const filters = useMemo<JobPostingFilters>(() => {
    const result: JobPostingFilters = {};

    if (selectedType) {
      // "지원" 탭은 regular + urgent 모두 표시
      if (selectedType === 'regular') {
        result.postingTypes = ['regular', 'urgent'];
      } else {
        result.postingType = selectedType;
      }
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

  // 타입 변경 핸들러 (타입 변경 시 날짜 초기화)
  const handleTypeChange = useCallback((type: PostingType | null) => {
    setSelectedType(type);
    // regular가 아닌 타입으로 변경 시 날짜 초기화
    if (type !== 'regular') {
      setSelectedDate(null);
    }
  }, []);

  // 공고 클릭 핸들러
  const handleJobPress = useCallback((jobId: string) => {
    router.push(`/(app)/jobs/${jobId}`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      {/* 헤더 */}
      <TabHeader title="구인구직" />

      {/* 공고 타입 칩 필터 */}
      <PostingTypeChips selected={selectedType} onChange={handleTypeChange} />

      {/* 날짜 슬라이더 (지원 타입 선택 시만 표시) */}
      {selectedType === 'regular' && (
        <DateSlider selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      )}

      {/* 공고 목록 - JobCard 사용 */}
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
    </SafeAreaView>
  );
}
