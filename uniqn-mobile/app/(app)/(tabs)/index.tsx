/**
 * UNIQN Mobile - Jobs Screen
 * 구인구직 메인 화면 (탭 홈)
 *
 * @version 2.1.0 - 공고 타입 칩 필터 + 날짜 슬라이더 추가
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { BellIcon, QrCodeIcon } from '@/components/icons';
import { JobList, PostingTypeChips, DateSlider } from '@/components/jobs';
import { useJobPostings } from '@/hooks/useJobPostings';
import { useUnreadCountRealtime } from '@/hooks/useNotifications';
import type { PostingType, JobPostingFilters } from '@/types';

export default function JobsScreen() {
  // 필터 상태 (기본: 긴급)
  const [selectedType, setSelectedType] = useState<PostingType | null>('urgent');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  // 구인공고 목록 훅 (필터 적용)
  const {
    jobs,
    isLoading,
    isRefreshing,
    isFetchingMore,
    hasMore,
    refresh,
    loadMore,
  } = useJobPostings({ filters });

  // 읽지 않은 알림 수 (실시간)
  const unreadCount = useUnreadCountRealtime();

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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">구인구직</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/qr')}
            className="p-2"
            hitSlop={8}
          >
            <QrCodeIcon size={24} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className="p-2"
            hitSlop={8}
          >
            <BellIcon size={24} color="#6B7280" />
            {/* 알림 배지 (실시간) */}
            {unreadCount > 0 && (
              <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-error-500 px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* 공고 타입 칩 필터 */}
      <PostingTypeChips
        selected={selectedType}
        onChange={handleTypeChange}
      />

      {/* 날짜 슬라이더 (지원 타입 선택 시만 표시) */}
      {selectedType === 'regular' && (
        <DateSlider
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      )}

      {/* 공고 목록 - JobCard 사용 */}
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
    </SafeAreaView>
  );
}
