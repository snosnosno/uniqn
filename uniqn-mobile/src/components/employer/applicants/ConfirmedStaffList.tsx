/**
 * UNIQN Mobile - 확정 스태프 목록 컴포넌트
 *
 * @description 날짜별 그룹화된 확정 스태프 목록 (FlashList 기반)
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, SectionList, RefreshControl } from 'react-native';
import { ConfirmedStaffCard } from './ConfirmedStaffCard';
import { Loading } from '../../ui/Loading';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '../../ui/FilterTabs';
import { UsersIcon, CalendarIcon, ChevronDownIcon, ChevronUpIcon } from '../../icons';
import {
  CONFIRMED_STAFF_STATUS_LABELS,
  type ConfirmedStaff,
  type ConfirmedStaffGroup,
  type ConfirmedStaffStatus,
  type ConfirmedStaffStats,
} from '@/types';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmedStaffListProps {
  grouped: ConfirmedStaffGroup[];
  stats?: ConfirmedStaffStats;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onStaffPress?: (staff: ConfirmedStaff) => void;
  /** 프로필 상세보기 */
  onViewProfile?: (staff: ConfirmedStaff) => void;
  onEditTime?: (staff: ConfirmedStaff) => void;
  onChangeRole?: (staff: ConfirmedStaff) => void;
  /** 신고 (노쇼 포함) */
  onReport?: (staff: ConfirmedStaff) => void;
  onDelete?: (staff: ConfirmedStaff) => void;
  /** 상태 변경 (뱃지 클릭) */
  onStatusChange?: (staff: ConfirmedStaff) => void;
  showActions?: boolean;
}

type FilterStatus = 'all' | ConfirmedStaffStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: FilterTabOption<FilterStatus>[] = [
  { value: 'all', label: '전체' },
  { value: STATUS.WORK_LOG.SCHEDULED, label: '예정' },
  { value: STATUS.WORK_LOG.CHECKED_IN, label: '근무중' },
  { value: STATUS.WORK_LOG.CHECKED_OUT, label: '퇴근' },
];

// ============================================================================
// Sub-components
// ============================================================================

interface SectionHeaderProps {
  group: ConfirmedStaffGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ group, isExpanded, onToggle }: SectionHeaderProps) {
  return (
    <Pressable
      onPress={onToggle}
      className={`
        flex-row items-center justify-between px-4 py-3 mb-2
        bg-gray-50 dark:bg-surface/50 rounded-lg mx-4
        ${group.isToday ? 'border border-primary-200 dark:border-primary-700' : ''}
      `}
    >
      <View className="flex-row items-center">
        <CalendarIcon size={18} color={group.isToday ? '#9333EA' : '#6B7280'} />
        <Text
          className={`
          ml-2 text-base font-semibold
          ${
            group.isToday
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-900 dark:text-white'
          }
        `}
        >
          {group.formattedDate}
          {group.isToday && ' (오늘)'}
        </Text>
      </View>

      <View className="flex-row items-center">
        {/* 통계 배지 */}
        <View className="flex-row items-center mr-2">
          <Text className="text-sm text-gray-500 dark:text-gray-400">{group.stats.total}명</Text>
          {group.stats.checkedIn > 0 && (
            <View className="ml-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
              <Text className="text-xs text-green-600 dark:text-green-400">
                {group.stats.checkedIn}
              </Text>
            </View>
          )}
          {group.stats.noShow > 0 && (
            <View className="ml-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 rounded">
              <Text className="text-xs text-orange-600 dark:text-orange-400">
                {group.stats.noShow}
              </Text>
            </View>
          )}
        </View>

        {isExpanded ? (
          <ChevronUpIcon size={20} color="#6B7280" />
        ) : (
          <ChevronDownIcon size={20} color="#6B7280" />
        )}
      </View>
    </Pressable>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConfirmedStaffList({
  grouped,
  stats: _stats,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  onStaffPress,
  onViewProfile,
  onEditTime,
  onChangeRole,
  onReport,
  onDelete,
  onStatusChange,
  showActions = true,
}: ConfirmedStaffListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    // 기본: 오늘과 미래 날짜 펼침
    const today = new Date().toISOString().split('T')[0];
    const expanded = new Set<string>();
    grouped.forEach((group) => {
      if (group.date >= today) {
        expanded.add(group.date);
      }
    });
    return expanded;
  });

  // 필터 옵션 (카운트 포함)
  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = { all: 0 };
    grouped.forEach((group) => {
      group.staff.forEach((s) => {
        counts.all = (counts.all || 0) + 1;
        counts[s.status as FilterStatus] = (counts[s.status as FilterStatus] || 0) + 1;
      });
    });
    return FILTER_OPTIONS.map((option) => ({
      ...option,
      count: counts[option.value] ?? 0,
    }));
  }, [grouped]);

  // 필터링된 그룹
  const filteredGrouped = useMemo(() => {
    if (selectedFilter === 'all') return grouped;

    return grouped
      .map((group) => ({
        ...group,
        staff: group.staff.filter((s) => s.status === selectedFilter),
      }))
      .filter((group) => group.staff.length > 0);
  }, [grouped, selectedFilter]);

  // 섹션 데이터
  const sections = useMemo(() => {
    return filteredGrouped.map((group) => ({
      title: group.date,
      group,
      data: expandedDates.has(group.date) ? group.staff : [],
    }));
  }, [filteredGrouped, expandedDates]);

  // 섹션 토글
  const toggleSection = useCallback((date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: ConfirmedStaff }) => (
      <View className="px-4 mb-3">
        <ConfirmedStaffCard
          staff={item}
          onPress={onStaffPress}
          onViewProfile={onViewProfile}
          onEditTime={onEditTime}
          onChangeRole={onChangeRole}
          onReport={onReport}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          showActions={showActions}
        />
      </View>
    ),
    [
      onStaffPress,
      onViewProfile,
      onEditTime,
      onChangeRole,
      onReport,
      onDelete,
      onStatusChange,
      showActions,
    ]
  );

  // 섹션 헤더 렌더
  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; group: ConfirmedStaffGroup } }) => (
      <SectionHeader
        group={section.group}
        isExpanded={expandedDates.has(section.title)}
        onToggle={() => toggleSection(section.title)}
      />
    ),
    [expandedDates, toggleSection]
  );

  const keyExtractor = useCallback((item: ConfirmedStaff) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">스태프 목록을 불러오는 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState
        title="스태프 목록을 불러올 수 없습니다"
        message={error.message}
        onRetry={onRefresh}
      />
    );
  }

  // 빈 상태
  if (!grouped.length) {
    return (
      <EmptyState
        icon={<UsersIcon size={48} color="#9CA3AF" />}
        title="확정된 스태프가 없습니다"
        description="지원자를 확정하면 여기에 표시됩니다."
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

      {/* 스태프 목록 (날짜별 섹션) */}
      {filteredGrouped.length === 0 ? (
        <EmptyState
          title={`${CONFIRMED_STAFF_STATUS_LABELS[selectedFilter as ConfirmedStaffStatus] || '해당'} 상태의 스태프가 없습니다`}
          description="다른 필터를 선택해 보세요."
        />
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={isRefreshing ?? false} onRefresh={onRefresh} tintColor="#6366f1" />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListFooterComponent={<View className="h-4" />}
        />
      )}
    </View>
  );
}

export default ConfirmedStaffList;
