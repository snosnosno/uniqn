/**
 * UNIQN Mobile - 지원자 목록 컴포넌트
 *
 * @description FlashList 기반 지원자 목록 (무한 스크롤)
 * @version 1.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo } from 'react';
import { View, RefreshControl } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { ApplicantCard } from './ApplicantCard';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '../../ui/FilterTabs';
import { ScreenSkeleton } from '../../ui';
import { FilterIcon } from '../../icons';
import { useApplicantProfiles } from '@/hooks/useApplicantProfiles';
import { LIST_CONTAINER_STYLES, STATUS } from '@/constants';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus } from '@/types';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantListProps {
  applicants: ApplicantWithDetails[];
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onConfirm?: (applicant: ApplicantWithDetails) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  /** 확정 취소 (확정된 지원자 un-confirm) */
  onCancelConfirmation?: (applicant: ApplicantWithDetails) => void;
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
  onCancelConfirmation,
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
          onCancelConfirmation={onCancelConfirmation}
          onViewProfile={onViewProfile}
        />
      </View>
    ),
    [onConfirm, onReject, onCancelConfirmation, onViewProfile]
  );

  const keyExtractor = useCallback((item: ApplicantWithDetails) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return <ScreenSkeleton type="applicantList" count={5} />;
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
        icon={<FilterIcon size={48} color={SECONDARY_PALETTE[400]} />}
        title="지원자가 없습니다"
        description="아직 이 공고에 지원한 사람이 없습니다."
      />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
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
        <AppFlashList
          data={filteredApplicants}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={180}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing ?? false}
                onRefresh={onRefresh}
                {...PTR_REFRESH_PROPS}
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
