/**
 * UNIQN Mobile - 지원자 목록 컴포넌트
 *
 * @description FlashList 기반 지원자 목록 (무한 스크롤)
 * @version 1.1.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ApplicantCard } from './ApplicantCard';
import { Loading } from '../../ui/Loading';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '../../ui/FilterTabs';
import { FilterIcon } from '../../icons';
import { useApplicantProfiles } from '@/hooks/useApplicantProfiles';
import { LIST_CONTAINER_STYLES, STATUS } from '@/constants';
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
  /** 프로필 상세보기 */
  onViewProfile?: (applicant: ApplicantWithDetails) => void;
}

type FilterStatus = 'all' | ApplicationStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: FilterTabOption<FilterStatus>[] = [
  { value: 'all', label: '전체' },
  { value: STATUS.APPLICATION.APPLIED, label: '신규' },
  { value: STATUS.APPLICATION.CONFIRMED, label: '확정' },
  { value: STATUS.APPLICATION.REJECTED, label: '거절' },
];

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
  onViewProfile,
}: ApplicantListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');

  // ==========================================================================
  // N+1 최적화: 지원자 프로필 배치 프리페치
  // ==========================================================================
  const applicantIds = useMemo(
    () => applicants.map((a) => a.applicantId).filter(Boolean),
    [applicants]
  );

  // 배치로 사용자 프로필 조회 (Hook 레이어를 통해 Repository 접근)
  useApplicantProfiles({ applicantIds });

  // 필터링된 지원자 목록
  const filteredApplicants = useMemo(() => {
    if (selectedFilter === 'all') return applicants;
    return applicants.filter((a) => a.status === selectedFilter);
  }, [applicants, selectedFilter]);

  // 필터 옵션 (카운트 포함)
  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = {
      all: applicants.length,
    };
    applicants.forEach((a) => {
      const status = a.status as ApplicationStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return FILTER_OPTIONS.map((option) => ({
      ...option,
      count: counts[option.value] ?? 0,
    }));
  }, [applicants]);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: ApplicantWithDetails }) => (
      <View className="px-4 mb-3">
        <ApplicantCard
          applicant={item}
          onConfirm={onConfirm}
          onReject={onReject}
          onViewProfile={onViewProfile}
        />
      </View>
    ),
    [onConfirm, onReject, onViewProfile]
  );

  const keyExtractor = useCallback((item: ApplicantWithDetails) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">지원자 목록을 불러오는 중...</Text>
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
        options={filterOptions}
        selectedValue={selectedFilter}
        onSelect={setSelectedFilter}
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
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing ?? false}
                onRefresh={onRefresh}
                tintColor="#6366f1"
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={LIST_CONTAINER_STYLES.paddingBottom100}
        />
      )}
    </View>
  );
}

export default ApplicantList;
