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
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, UsersIcon } from '../../icons';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '../../ui/FilterTabs';
import { Loading } from '../../ui/Loading';
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
  onChangeRole?: (staff: ConfirmedStaff) => void;
  onReport?: (staff: ConfirmedStaff) => void;
  onDelete?: (staff: ConfirmedStaff) => void;
  onStatusChange?: (staff: ConfirmedStaff) => void;
  showActions?: boolean;
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
];

interface SectionHeaderProps {
  group: ConfirmedStaffGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ group, isExpanded, onToggle }: SectionHeaderProps) {
  return (
    <Pressable
      onPress={onToggle}
      className={`mx-4 mb-2 flex-row items-center justify-between rounded-lg bg-secondary-50 px-4 py-3 dark:bg-surface/50 ${
        group.isToday ? 'border border-primary-200 dark:border-primary-700' : ''
      }`}
    >
      <View className="flex-row items-center">
        <CalendarIcon size={18} color={group.isToday ? '#6366F1' : '#9A9078'} />
        <Text
          className={`ml-2 text-base font-semibold ${
            group.isToday
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-secondary-900 dark:text-white'
          }`}
        >
          {group.formattedDate}
          {group.isToday ? ' (오늘)' : ''}
        </Text>
      </View>

      <View className="flex-row items-center">
        <View className="mr-2 flex-row items-center">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">
            {group.stats.total}
          </Text>
          {group.stats.checkedIn > 0 ? (
            <View className="ml-1 rounded bg-success-50 px-1.5 py-0.5 dark:bg-success-900/30">
              <Text className="text-xs text-success-600 dark:text-success-400">
                {group.stats.checkedIn}
              </Text>
            </View>
          ) : null}
          {group.stats.noShow > 0 ? (
            <View className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 dark:bg-orange-900/30">
              <Text className="text-xs text-orange-600 dark:text-orange-400">
                {group.stats.noShow}
              </Text>
            </View>
          ) : null}
        </View>

        {isExpanded ? (
          <ChevronUpIcon size={20} color="#9A9078" />
        ) : (
          <ChevronDownIcon size={20} color="#9A9078" />
        )}
      </View>
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
  onChangeRole,
  onReport,
  onDelete,
  onStatusChange,
  showActions = true,
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
          onChangeRole={onChangeRole}
          onReport={onReport}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          showActions={showActions}
        />
      </View>
    ),
    [
      onChangeRole,
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
      />
    ),
    [expandedDates, toggleSection]
  );

  const keyExtractor = useCallback((item: ConfirmedStaff) => item.id, []);

  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-secondary-500 dark:text-secondary-400">
          확정된 스태프를 불러오는 중입니다...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="확정된 스태프를 불러오지 못했습니다"
        message={error.message}
        onRetry={onRefresh}
      />
    );
  }

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon size={48} color="#A89C84" />}
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
                tintColor="#6366F1"
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

export default ConfirmedStaffList;
