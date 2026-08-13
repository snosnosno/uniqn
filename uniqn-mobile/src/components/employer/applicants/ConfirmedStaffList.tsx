import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { getTodayString } from '@/utils/date';
import type {
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
  ConfirmedStaffStatus,
} from '@/types';
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, UsersIcon } from '@/components/icons';
import {
  formatCapacityGapLabel,
  type PostingCapacityGap,
} from '@/domains/job-posting/capacityGap';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '@/components/ui/FilterTabs';
import { Loading } from '@/components/ui/Loading';
import { ConfirmedStaffCard } from './ConfirmedStaffCard';

export interface ConfirmedStaffListProps {
  grouped: ConfirmedStaffGroup[];
  stats?: ConfirmedStaffStats;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onStaffPress?: (staff: ConfirmedStaff) => void;
  onViewProfile?: (staff: ConfirmedStaff) => void;
  onEditTime?: (staff: ConfirmedStaff) => void;
  onReport?: (staff: ConfirmedStaff) => void;
  onDelete?: (staff: ConfirmedStaff) => void;
  onStatusChange?: (staff: ConfirmedStaff) => void;
  onCancelNoShow?: (staff: ConfirmedStaff) => void;
  showActions?: boolean;
  /**
   * 근무일별 D-day 정원 미달 (S3-1) — `selectPostingCapacityGaps` → `toCapacityGapByDate` 결과.
   * 미주입 시 경고 줄은 렌더되지 않는다(기존 동작 완전 보존).
   */
  capacityGapByDate?: Map<string, PostingCapacityGap>;
}

type FilterStatus = 'all' | ConfirmedStaffStatus;

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: '전체',
  scheduled: '출근 예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '근무 완료',
  cancelled: '취소됨',
  no_show: '노쇼',
};

const FILTER_OPTIONS: FilterTabOption<FilterStatus>[] = [
  { value: 'all', label: FILTER_LABELS.all },
  { value: STATUS.WORK_LOG.SCHEDULED, label: FILTER_LABELS.scheduled },
  { value: STATUS.WORK_LOG.CHECKED_IN, label: FILTER_LABELS.checked_in },
  { value: STATUS.WORK_LOG.CHECKED_OUT, label: FILTER_LABELS.checked_out },
  { value: STATUS.WORK_LOG.COMPLETED, label: FILTER_LABELS.completed },
];

interface SectionHeaderProps {
  group: ConfirmedStaffGroup;
  isExpanded: boolean;
  onToggle: () => void;
  /** 이 날짜의 D-day 정원 미달 (S3-1). 없으면 경고 줄을 렌더하지 않는다. */
  capacityGap?: PostingCapacityGap;
}

function SectionHeader({ group, isExpanded, onToggle, capacityGap }: SectionHeaderProps) {
  return (
    <Pressable
      onPress={onToggle}
      className={`mx-4 mb-2 rounded-lg bg-surface-page dark:bg-surface px-4 py-3 dark:bg-surface/50 ${
        group.isToday ? 'border border-primary-200 dark:border-primary-700' : ''
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <CalendarIcon size={18} color={group.isToday ? '#D4AF37' : SECONDARY_PALETTE[500]} />
          <Text
            className={`ml-2 text-base font-sans-semibold ${
              group.isToday ? 'text-primary-600 dark:text-primary-400' : 'text-content-primary'
            }`}
          >
            {group.formattedDate}
            {group.isToday ? ' (오늘)' : ''}
          </Text>
        </View>

        <View className="flex-row items-center">
          <View className="mr-2 flex-row items-center">
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              {group.stats.total}
            </Text>
            {group.stats.checkedIn > 0 ? (
              <View className="ml-1 rounded bg-success-50 px-1.5 py-0.5 dark:bg-success-900/30">
                <Text className="text-xs text-success-600 dark:text-success-400 font-sans">
                  {group.stats.checkedIn}
                </Text>
              </View>
            ) : null}
            {group.stats.noShow > 0 ? (
              <View className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 dark:bg-orange-900/30">
                <Text className="text-xs text-orange-600 dark:text-orange-400 font-sans">
                  {group.stats.noShow}
                </Text>
              </View>
            ) : null}
          </View>

          {isExpanded ? (
            <ChevronUpIcon size={20} color={SECONDARY_PALETTE[500]} />
          ) : (
            <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />
          )}
        </View>
      </View>

      {/*
        D-2/D-1 정원 미달 경고 (S3-1).
        같은 판정이 서버 크론으로 알림도 나가지만, 알림은 하루 한 번 지나가고 근무표는 계속 본다 —
        여기 없으면 "알림은 왔는데 어느 날인지 화면에서 못 찾는" 상태가 된다.
        접근성 라벨에 숫자를 풀어 담는 이유: 색 틴트만으로는 경고임을 전달하지 못하고,
        `accessibilityState` 는 웹(react-native-web)에서 무효라 상태를 라벨에 실어야 한다.
      */}
      {capacityGap ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`정원 미달 경고. ${group.formattedDate} 근무, ${formatCapacityGapLabel(
            capacityGap
          )}. 필요 ${capacityGap.required}명 중 ${capacityGap.filled}명 확정.`}
          className="mt-2 self-start rounded-md bg-warning-100 px-2 py-1 dark:bg-warning-700/30"
        >
          <Text className="text-xs font-sans-semibold text-warning-700 dark:text-warning-500">
            {formatCapacityGapLabel(capacityGap)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

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
  onReport,
  onDelete,
  onStatusChange,
  onCancelNoShow,
  showActions = true,
  capacityGapByDate,
}: ConfirmedStaffListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    const today = getTodayString();
    const initial = new Set<string>();

    grouped.forEach((group) => {
      if (group.date >= today) {
        initial.add(group.date);
      }
    });

    return initial;
  });

  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = { all: 0 };

    grouped.forEach((group) => {
      group.staff.forEach((staff) => {
        counts.all = (counts.all ?? 0) + 1;
        counts[staff.status as FilterStatus] = (counts[staff.status as FilterStatus] ?? 0) + 1;
      });
    });

    return FILTER_OPTIONS.map((option) => ({
      ...option,
      count: counts[option.value] ?? 0,
    }));
  }, [grouped]);

  const filteredGrouped = useMemo(() => {
    if (selectedFilter === 'all') {
      return grouped;
    }

    return grouped
      .map((group) => ({
        ...group,
        staff: group.staff.filter((staff) => staff.status === selectedFilter),
      }))
      .filter((group) => group.staff.length > 0);
  }, [grouped, selectedFilter]);

  const sections = useMemo(
    () =>
      filteredGrouped.map((group) => ({
        title: group.date,
        group,
        data: expandedDates.has(group.date) ? group.staff : [],
      })),
    [expandedDates, filteredGrouped]
  );

  const toggleSection = useCallback((date: string) => {
    setExpandedDates((previous) => {
      const next = new Set(previous);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ConfirmedStaff }) => (
      <View className="mb-3 px-4">
        <ConfirmedStaffCard
          staff={item}
          onPress={onStaffPress}
          onViewProfile={onViewProfile}
          onEditTime={onEditTime}
          onReport={onReport}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onCancelNoShow={onCancelNoShow}
          showActions={showActions}
        />
      </View>
    ),
    [
      onCancelNoShow,
      onDelete,
      onEditTime,
      onReport,
      onStaffPress,
      onStatusChange,
      onViewProfile,
      showActions,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; group: ConfirmedStaffGroup } }) => (
      <SectionHeader
        group={section.group}
        isExpanded={expandedDates.has(section.title)}
        onToggle={() => toggleSection(section.title)}
        capacityGap={capacityGapByDate?.get(section.group.date)}
      />
    ),
    [capacityGapByDate, expandedDates, toggleSection]
  );

  const keyExtractor = useCallback((item: ConfirmedStaff) => item.id, []);

  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-secondary-500 dark:text-secondary-400 font-sans">
          확정된 스태프를 불러오는 중입니다...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState title="확정된 스태프를 불러오지 못했습니다" error={error} onRetry={onRefresh} />
    );
  }

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon size={48} color={SECONDARY_PALETTE[400]} />}
        title="아직 확정된 스태프가 없습니다"
        description="지원자를 확정하면 여기에 표시됩니다"
      />
    );
  }

  return (
    <View className="flex-1">
      <FilterTabs
        options={filterOptions}
        selectedValue={selectedFilter}
        onSelect={setSelectedFilter}
      />

      {filteredGrouped.length === 0 ? (
        <EmptyState
          title={`${FILTER_LABELS[selectedFilter]} 상태의 스태프가 없습니다`}
          description="다른 필터를 선택해 보세요"
        />
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing ?? false}
                onRefresh={onRefresh}
                tintColor="#D4AF37"
              />
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
