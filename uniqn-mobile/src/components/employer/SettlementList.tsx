/**
 * UNIQN Mobile - 정산 목록 컴포넌트
 *
 * @description FlashList 기반 정산 목록 (필터링, 일괄 정산)
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SettlementCard } from './SettlementCard';
import { Loading } from '../ui/Loading';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Card } from '../ui/Card';
import {
  BanknotesIcon,
  
  CheckIcon,
  
} from '../icons';
import type { WorkLog, PayrollStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SettlementListProps {
  workLogs: WorkLog[];
  hourlyRate: number;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onWorkLogPress?: (workLog: WorkLog) => void;
  onSettle?: (workLog: WorkLog) => void;
  onBulkSettle?: (workLogs: WorkLog[]) => void;
  showBulkActions?: boolean;
}

type FilterStatus = 'all' | PayrollStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '미정산' },
  { value: 'completed', label: '완료' },
];

const REGULAR_HOURS = 8;
const OVERTIME_RATE = 1.5;

// ============================================================================
// Helpers
// ============================================================================

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function calculateTotalAmount(workLogs: WorkLog[], hourlyRate: number): number {
  return workLogs.reduce((total, log) => {
    const startTime = parseTimestamp(log.actualStartTime);
    const endTime = parseTimestamp(log.actualEndTime);

    if (!startTime || !endTime) return total;

    const totalMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const totalHours = totalMinutes / 60;
    const regularHours = Math.min(totalHours, REGULAR_HOURS);
    const overtimeHours = Math.max(0, totalHours - REGULAR_HOURS);

    const regularPay = Math.round(regularHours * hourlyRate);
    const overtimePay = Math.round(overtimeHours * hourlyRate * OVERTIME_RATE);

    return total + regularPay + overtimePay;
  }, 0);
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// ============================================================================
// Sub-components
// ============================================================================

interface SummaryCardProps {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  totalAmount: number;
  pendingAmount: number;
}

function SummaryCard({
  totalCount,
  pendingCount,
  completedCount,
  totalAmount,
  pendingAmount,
}: SummaryCardProps) {
  return (
    <Card variant="filled" padding="md" className="mb-4 mx-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          정산 현황
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          총 {totalCount}건
        </Text>
      </View>

      <View className="flex-row justify-between mb-2">
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">미정산</Text>
          <Text className="text-lg font-bold text-warning-600 dark:text-warning-400">
            {pendingCount}건
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(pendingAmount)}
          </Text>
        </View>
        <View className="w-px bg-gray-200 dark:bg-gray-700" />
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">완료</Text>
          <Text className="text-lg font-bold text-success-600 dark:text-success-400">
            {completedCount}건
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(totalAmount - pendingAmount)}
          </Text>
        </View>
        <View className="w-px bg-gray-200 dark:bg-gray-700" />
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 금액</Text>
          <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(totalAmount)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

interface FilterTabsProps {
  selectedFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  counts: Partial<Record<FilterStatus, number>>;
}

function FilterTabs({ selectedFilter, onFilterChange, counts }: FilterTabsProps) {
  return (
    <View className="px-4 mb-4">
      <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilter === option.value;
          const count = counts[option.value] || 0;

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
                  text-sm font-medium
                  ${isSelected
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'}
                `}
              >
                {option.label} ({count})
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
  selectedAmount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkSettle: () => void;
  isAllSelected: boolean;
}

function BulkActionsBar({
  selectedCount,
  selectedAmount,
  onSelectAll,
  onClearSelection,
  onBulkSettle,
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
            {isAllSelected ? '해제' : '전체'}
          </Text>
        </Pressable>
        <View>
          <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
            {selectedCount}건 선택
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(selectedAmount)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onBulkSettle}
        disabled={selectedCount === 0}
        className={`
          flex-row items-center px-4 py-2 rounded-lg
          ${selectedCount > 0
            ? 'bg-primary-500 active:opacity-70'
            : 'bg-gray-300 dark:bg-gray-700'}
        `}
      >
        <BanknotesIcon size={16} color={selectedCount > 0 ? '#fff' : '#9CA3AF'} />
        <Text className={`
          ml-1 text-sm font-medium
          ${selectedCount > 0 ? 'text-white' : 'text-gray-500 dark:text-gray-400'}
        `}>
          일괄 정산
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettlementList({
  workLogs,
  hourlyRate,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  onWorkLogPress,
  onSettle,
  onBulkSettle,
  showBulkActions = false,
}: SettlementListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 필터링된 목록
  const filteredWorkLogs = useMemo(() => {
    if (selectedFilter === 'all') return workLogs;
    return workLogs.filter((log) => (log.payrollStatus || 'pending') === selectedFilter);
  }, [workLogs, selectedFilter]);

  // 선택 가능한 항목 (미정산만)
  const selectableWorkLogs = useMemo(() => {
    return filteredWorkLogs.filter(
      (log) => (log.payrollStatus || 'pending') === 'pending' &&
        log.actualStartTime && log.actualEndTime
    );
  }, [filteredWorkLogs]);

  // 필터별 카운트
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = {
      all: workLogs.length,
    };
    workLogs.forEach((log) => {
      const status = (log.payrollStatus || 'pending') as PayrollStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [workLogs]);

  // 요약 정보
  const summaryInfo = useMemo(() => {
    const pendingLogs = workLogs.filter((log) => (log.payrollStatus || 'pending') === 'pending');
    const completedLogs = workLogs.filter((log) => log.payrollStatus === 'completed');

    return {
      totalCount: workLogs.length,
      pendingCount: pendingLogs.length,
      completedCount: completedLogs.length,
      totalAmount: calculateTotalAmount(workLogs, hourlyRate),
      pendingAmount: calculateTotalAmount(pendingLogs, hourlyRate),
    };
  }, [workLogs, hourlyRate]);

  // 선택된 항목 금액
  const selectedAmount = useMemo(() => {
    const selectedLogs = workLogs.filter((log) => selectedIds.has(log.id));
    return calculateTotalAmount(selectedLogs, hourlyRate);
  }, [workLogs, selectedIds, hourlyRate]);

  // 선택 핸들러
  const handleSelect = useCallback((workLog: WorkLog) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(workLog.id)) {
        next.delete(workLog.id);
      } else {
        next.add(workLog.id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(selectableWorkLogs.map((log) => log.id)));
  }, [selectableWorkLogs]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkSettle = useCallback(() => {
    const selectedLogs = workLogs.filter((log) => selectedIds.has(log.id));
    onBulkSettle?.(selectedLogs);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [workLogs, selectedIds, onBulkSettle]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: WorkLog }) => (
      <View className="px-4 mb-3">
        <SettlementCard
          workLog={item}
          hourlyRate={hourlyRate}
          onPress={selectionMode ? handleSelect : onWorkLogPress}
          onSettle={selectionMode ? undefined : onSettle}
        />
      </View>
    ),
    [hourlyRate, selectionMode, handleSelect, onWorkLogPress, onSettle]
  );

  const keyExtractor = useCallback((item: WorkLog) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">
          정산 목록을 불러오는 중...
        </Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState
        title="정산 목록을 불러올 수 없습니다"
        message={error.message}
        onRetry={onRefresh}
      />
    );
  }

  // 빈 상태
  if (!workLogs.length) {
    return (
      <EmptyState
        icon={<BanknotesIcon size={48} color="#9CA3AF" />}
        title="정산할 내역이 없습니다"
        description="확정된 스태프의 출퇴근 기록이 여기에 표시됩니다."
      />
    );
  }

  const isAllSelected = selectedIds.size === selectableWorkLogs.length &&
    selectableWorkLogs.length > 0;

  return (
    <View className="flex-1">
      {/* 요약 카드 */}
      <SummaryCard {...summaryInfo} />

      {/* 필터 탭 */}
      <FilterTabs
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        counts={filterCounts}
      />

      {/* 일괄 선택 버튼 */}
      {showBulkActions && selectableWorkLogs.length > 0 && (
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
              {selectionMode ? '선택 취소' : '일괄 정산 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 선택 모드 액션 바 */}
      {selectionMode && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          selectedAmount={selectedAmount}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBulkSettle={handleBulkSettle}
          isAllSelected={isAllSelected}
        />
      )}

      {/* 목록 */}
      <FlashList
        data={filteredWorkLogs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={220}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

export default SettlementList;
