/**
 * UNIQN Mobile - 내 공고 관리 화면
 * 구인자가 등록한 공고 목록
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { Card, Badge, Button, Loading, EmptyState, ErrorState } from '@/components';
import {
  PlusIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  BriefcaseIcon,
} from '@/components/icons';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

type FilterStatus = 'all' | 'active' | 'closed' | 'draft';

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '모집중' },
  { value: 'closed', label: '마감' },
  { value: 'draft', label: '임시저장' },
];

// ============================================================================
// Sub-components
// ============================================================================

interface FilterTabsProps {
  selected: FilterStatus;
  onChange: (status: FilterStatus) => void;
  counts: Partial<Record<FilterStatus, number>>;
}

function FilterTabs({ selected, onChange, counts }: FilterTabsProps) {
  return (
    <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mx-4 mb-4">
      {FILTER_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        const count = counts[option.value] || 0;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center py-2 rounded-md ${
              isSelected ? 'bg-white dark:bg-gray-700 shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isSelected
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {option.label} ({count})
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface JobPostingCardProps {
  posting: JobPosting;
  onPress: (posting: JobPosting) => void;
}

function JobPostingCard({ posting, onPress }: JobPostingCardProps) {
  const statusConfig = {
    active: { label: '모집중', variant: 'success' as const },
    closed: { label: '마감', variant: 'default' as const },
    draft: { label: '임시저장', variant: 'warning' as const },
    cancelled: { label: '취소됨', variant: 'error' as const },
  };

  const status = statusConfig[posting.status] || statusConfig.active;

  return (
    <Card
      variant="elevated"
      padding="md"
      onPress={() => onPress(posting)}
      className="mx-4 mb-3"
    >
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="flex-1 text-lg font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
          {posting.title}
        </Text>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </View>

      {/* 장소 */}
      <View className="flex-row items-center mb-2">
        <MapPinIcon size={14} color="#9CA3AF" />
        <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400" numberOfLines={1}>
          {posting.location.name}
        </Text>
      </View>

      {/* 날짜/시간 */}
      <View className="flex-row items-center mb-3">
        <ClockIcon size={14} color="#9CA3AF" />
        <Text className="ml-1 text-sm text-gray-600 dark:text-gray-400">
          {posting.workDate} {posting.timeSlot}
        </Text>
      </View>

      {/* 통계 */}
      <View className="flex-row items-center pt-3 border-t border-gray-100 dark:border-gray-700">
        <View className="flex-row items-center mr-6">
          <UsersIcon size={16} color="#2563EB" />
          <Text className="ml-1 text-sm font-medium text-primary-600 dark:text-primary-400">
            지원자 {posting.applicationCount || 0}명
          </Text>
        </View>
        <View className="flex-row items-center">
          <BriefcaseIcon size={16} color="#10B981" />
          <Text className="ml-1 text-sm font-medium text-success-600 dark:text-success-400">
            확정 {posting.filledPositions || 0}/{posting.totalPositions || 0}명
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MyPostingsScreen() {
  const router = useRouter();
  const { data: postings, isLoading, error, refetch, isRefetching } = useMyJobPostings();
  const [filter, setFilter] = useState<FilterStatus>('all');

  // 필터링된 목록
  const filteredPostings = useMemo(() => {
    if (!postings) return [];
    if (filter === 'all') return postings;
    return postings.filter((p: JobPosting) => p.status === filter);
  }, [postings, filter]);

  // 필터별 카운트
  const filterCounts = useMemo(() => {
    if (!postings) return {};
    const counts: Partial<Record<FilterStatus, number>> = {
      all: postings.length,
    };
    postings.forEach((p: JobPosting) => {
      const status = p.status as FilterStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [postings]);

  // 공고 클릭
  const handlePostingPress = useCallback((posting: JobPosting) => {
    router.push(`/(employer)/my-postings/${posting.id}`);
  }, [router]);

  // 새 공고 작성
  const handleCreatePosting = useCallback(() => {
    // TODO: 공고 작성 화면으로 이동
    router.push('/(employer)/my-postings/create');
  }, [router]);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: JobPosting }) => (
      <JobPostingCard posting={item} onPress={handlePostingPress} />
    ),
    [handlePostingPress]
  );

  const keyExtractor = useCallback((item: JobPosting) => item.id, []);

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            공고 목록을 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <ErrorState
          title="공고 목록을 불러올 수 없습니다"
          message={error.message}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      {/* 새 공고 작성 버튼 */}
      <View className="px-4 py-3">
        <Button
          variant="primary"
          onPress={handleCreatePosting}
          className="flex-row items-center justify-center"
        >
          <PlusIcon size={20} color="#fff" />
          <Text className="ml-2 text-white font-semibold">새 공고 작성</Text>
        </Button>
      </View>

      {/* 필터 탭 */}
      <FilterTabs selected={filter} onChange={setFilter} counts={filterCounts} />

      {/* 공고 목록 */}
      {filteredPostings.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon size={48} color="#9CA3AF" />}
          title={filter === 'all' ? '등록된 공고가 없습니다' : `${FILTER_OPTIONS.find(o => o.value === filter)?.label} 공고가 없습니다`}
          description="새 공고를 작성해보세요."
        />
      ) : (
        <FlashList
          data={filteredPostings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={160}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
