/**
 * UNIQN Mobile - 지원자 목록 컴포넌트
 *
 * @description FlashList 기반 지원자 목록 (무한 스크롤)
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ApplicantCard } from './ApplicantCard';
import { Loading } from '../ui/Loading';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Badge } from '../ui/Badge';
import { FilterIcon, CheckIcon } from '../icons';
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
  onApplicantPress?: (applicant: ApplicantWithDetails) => void;
  onConfirm?: (applicant: ApplicantWithDetails) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  onWaitlist?: (applicant: ApplicantWithDetails) => void;
  onBulkConfirm?: (applicants: ApplicantWithDetails[]) => void;
  showBulkActions?: boolean;
}

type FilterStatus = 'all' | ApplicationStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'applied', label: '신규' },
  { value: 'pending', label: '검토중' },
  { value: 'confirmed', label: '확정' },
  { value: 'waitlisted', label: '대기' },
  { value: 'rejected', label: '거절' },
];

// ============================================================================
// Sub-components
// ============================================================================

interface StatsHeaderProps {
  stats?: ApplicationStats;
}

function StatsHeader({ stats }: StatsHeaderProps) {
  if (!stats) return null;

  return (
    <View className="flex-row flex-wrap gap-2 mb-4 px-4">
      <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
        <Text className="text-sm text-gray-600 dark:text-gray-400">총</Text>
        <Text className="ml-1 text-sm font-semibold text-gray-900 dark:text-white">
          {stats.total}명
        </Text>
      </View>
      {stats.applied > 0 && (
        <Badge variant="primary" size="sm" dot>
          신규 {stats.applied}
        </Badge>
      )}
      {stats.confirmed > 0 && (
        <Badge variant="success" size="sm">
          확정 {stats.confirmed}
        </Badge>
      )}
      {stats.waitlisted > 0 && (
        <Badge variant="primary" size="sm">
          대기 {stats.waitlisted}
        </Badge>
      )}
      {stats.rejected > 0 && (
        <Badge variant="error" size="sm">
          거절 {stats.rejected}
        </Badge>
      )}
    </View>
  );
}

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

interface BulkActionsBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkConfirm: () => void;
  isAllSelected: boolean;
}

function BulkActionsBar({
  selectedCount,
  onSelectAll,
  onClearSelection,
  onBulkConfirm,
  isAllSelected,
}: BulkActionsBarProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-primary-50 dark:bg-primary-900/20">
      <View className="flex-row items-center">
        <Pressable
          onPress={isAllSelected ? onClearSelection : onSelectAll}
          className="flex-row items-center mr-4"
        >
          <View className={`
            h-5 w-5 rounded border-2 items-center justify-center mr-2
            ${isAllSelected
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-400 dark:border-gray-500'}
          `}>
            {isAllSelected && <CheckIcon size={12} color="#fff" />}
          </View>
          <Text className="text-sm text-gray-700 dark:text-gray-300">
            {isAllSelected ? '전체 해제' : '전체 선택'}
          </Text>
        </Pressable>
        <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
          {selectedCount}명 선택됨
        </Text>
      </View>
      <Pressable
        onPress={onBulkConfirm}
        disabled={selectedCount === 0}
        className={`
          px-4 py-2 rounded-lg
          ${selectedCount > 0
            ? 'bg-primary-500 active:opacity-70'
            : 'bg-gray-300 dark:bg-gray-700'}
        `}
      >
        <Text className={`
          text-sm font-medium
          ${selectedCount > 0 ? 'text-white' : 'text-gray-500 dark:text-gray-400'}
        `}>
          일괄 확정
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ApplicantList({
  applicants,
  stats,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  onApplicantPress,
  onConfirm,
  onReject,
  onWaitlist,
  onBulkConfirm,
  showBulkActions = false,
}: ApplicantListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 필터링된 지원자 목록
  const filteredApplicants = useMemo(() => {
    if (selectedFilter === 'all') return applicants;
    return applicants.filter((a) => a.status === selectedFilter);
  }, [applicants, selectedFilter]);

  // 선택 가능한 지원자 (신규/검토중만)
  const selectableApplicants = useMemo(() => {
    return filteredApplicants.filter(
      (a) => a.status === 'applied' || a.status === 'pending'
    );
  }, [filteredApplicants]);

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

  // 지원자 선택 핸들러
  const handleSelect = useCallback((applicant: ApplicantWithDetails) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicant.id)) {
        next.delete(applicant.id);
      } else {
        next.add(applicant.id);
      }
      return next;
    });
  }, []);

  // 전체 선택
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(selectableApplicants.map((a) => a.id)));
  }, [selectableApplicants]);

  // 선택 해제
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 일괄 확정
  const handleBulkConfirm = useCallback(() => {
    const selectedApplicants = applicants.filter((a) => selectedIds.has(a.id));
    onBulkConfirm?.(selectedApplicants);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [applicants, selectedIds, onBulkConfirm]);

  // 선택 모드 토글
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: ApplicantWithDetails }) => (
      <View className="px-4 mb-3">
        <ApplicantCard
          applicant={item}
          onPress={onApplicantPress}
          onConfirm={onConfirm}
          onReject={onReject}
          onWaitlist={onWaitlist}
          showActions={!selectionMode}
          selectionMode={selectionMode}
          isSelected={selectedIds.has(item.id)}
          onSelect={handleSelect}
        />
      </View>
    ),
    [onApplicantPress, onConfirm, onReject, onWaitlist, selectionMode, selectedIds, handleSelect]
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

  const isAllSelected = selectedIds.size === selectableApplicants.length &&
    selectableApplicants.length > 0;

  return (
    <View className="flex-1">
      {/* 통계 헤더 */}
      <StatsHeader stats={stats} />

      {/* 필터 탭 */}
      <FilterTabs
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        counts={filterCounts}
      />

      {/* 일괄 선택 버튼 */}
      {showBulkActions && selectableApplicants.length > 0 && (
        <View className="px-4 mb-3">
          <Pressable
            onPress={toggleSelectionMode}
            className="flex-row items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <CheckIcon size={16} color={selectionMode ? '#2563EB' : '#6B7280'} />
            <Text className={`
              ml-2 text-sm font-medium
              ${selectionMode
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400'}
            `}>
              {selectionMode ? '선택 취소' : '일괄 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 선택 모드 액션 바 */}
      {selectionMode && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBulkConfirm={handleBulkConfirm}
          isAllSelected={isAllSelected}
        />
      )}

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
