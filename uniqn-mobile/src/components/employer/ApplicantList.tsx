/**
 * UNIQN Mobile - 지원자 목록 컴포넌트
 *
 * @description FlashList 기반 지원자 목록 (무한 스크롤)
 * @version 1.1.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ApplicantCard } from './ApplicantCard';
import { Loading } from '../ui/Loading';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { FilterIcon } from '../icons';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus, ApplicationStats } from '@/types';
import { APPLICATION_STATUS_LABELS } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantListProps {
  applicants: ApplicantWithDetails[];
  stats?: ApplicationStats;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onConfirm?: (applicant: ApplicantWithDetails) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  onWaitlist?: (applicant: ApplicantWithDetails) => void;
  /** 프로필 상세보기 */
  onViewProfile?: (applicant: ApplicantWithDetails) => void;
}

type FilterStatus = 'all' | ApplicationStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'applied', label: '신규' },
  { value: 'confirmed', label: '확정' },
  { value: 'waitlisted', label: '대기' },
  { value: 'rejected', label: '거절' },
];

// ============================================================================
// Sub-components
// ============================================================================

interface FilterTabsProps {
  selectedFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  counts?: Partial<Record<FilterStatus, number>>;
}

function FilterTabs({ selectedFilter, onFilterChange, counts }: FilterTabsProps) {
  return (
    <View className="px-4 mb-4">
      <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilter === option.value;
          const count = option.value === 'all'
            ? counts?.all
            : counts?.[option.value as ApplicationStatus];

          return (
            <Pressable
              key={option.value}
              onPress={() => onFilterChange(option.value)}
              className={`
                flex-1 items-center justify-center py-2 rounded-md
                ${isSelected ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}
              `}
            >
              <Text
                className={`
                  text-xs font-medium
                  ${isSelected
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'}
                `}
              >
                {option.label}
                {count !== undefined && count > 0 && ` (${count})`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ApplicantList({
  applicants,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  onConfirm,
  onReject,
  onWaitlist,
  onViewProfile,
}: ApplicantListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');

  // 필터링된 지원자 목록
  const filteredApplicants = useMemo(() => {
    if (selectedFilter === 'all') return applicants;
    return applicants.filter((a) => a.status === selectedFilter);
  }, [applicants, selectedFilter]);

  // 필터별 카운트
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = {
      all: applicants.length,
    };
    applicants.forEach((a) => {
      const status = a.status as ApplicationStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [applicants]);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: ApplicantWithDetails }) => (
      <View className="px-4 mb-3">
        <ApplicantCard
          applicant={item}
          onConfirm={onConfirm}
          onReject={onReject}
          onWaitlist={onWaitlist}
          onViewProfile={onViewProfile}
        />
      </View>
    ),
    [onConfirm, onReject, onWaitlist, onViewProfile]
  );

  const keyExtractor = useCallback((item: ApplicantWithDetails) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">
          지원자 목록을 불러오는 중...
        </Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState
        title="지원자 목록을 불러올 수 없습니다"
        message={error.message}
        onRetry={onRefresh}
      />
    );
  }

  // 빈 상태
  if (!applicants.length) {
    return (
      <EmptyState
        icon={<FilterIcon size={48} color="#9CA3AF" />}
        title="지원자가 없습니다"
        description="아직 이 공고에 지원한 사람이 없습니다."
      />
    );
  }

  return (
    <View className="flex-1">
      {/* 필터 탭 */}
      <FilterTabs
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        counts={filterCounts}
      />

      {/* 지원자 목록 */}
      {filteredApplicants.length === 0 ? (
        <EmptyState
          title={`${APPLICATION_STATUS_LABELS[selectedFilter as ApplicationStatus] || '해당'} 상태의 지원자가 없습니다`}
          description="다른 필터를 선택해 보세요."
        />
      ) : (
        <FlashList
          data={filteredApplicants}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={180}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

export default ApplicantList;
