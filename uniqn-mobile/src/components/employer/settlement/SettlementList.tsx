/**
 * UNIQN Mobile - 정산 목록 컴포넌트
 *
 * @description FlashList 기반 정산 목록 (필터링, 일괄 정산, 스태프별 그룹핑)
 * @version 4.0.0 - SummaryCard, BulkActions 서브컴포넌트 분해
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { GroupedSettlementCard } from './GroupedSettlementCard';
import { SettlementSummaryCard } from './SettlementSummaryCard';
import { SettlementBulkActions } from './SettlementBulkActions';
import { Loading } from '../../ui/Loading';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '../../ui/FilterTabs';
import { BanknotesIcon, CheckIcon } from '../../icons';
import {
  type SalaryType,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from '@/utils/settlement';
import {
  groupSettlementsByStaff,
  calculateGroupedSettlementStats,
  type SettlementGroupingContext,
} from '@/utils/settlementGrouping';
import type { GroupedSettlement } from '@/types/settlement';
import type { WorkLog, PayrollStatus } from '@/types';
import { STATUS } from '@/constants';

// Re-export types for backward compatibility
export type { SalaryType, SalaryInfo };

/** 역할 + 급여 정보 타입 */
export interface RoleWithSalary {
  role?: string;
  name?: string;
  customRole?: string;
  salary?: SalaryInfo;
}

// ============================================================================
// Types
// ============================================================================

export interface SettlementListProps {
  workLogs: WorkLog[];
  /** 역할 목록 (급여 포함) */
  roles: RoleWithSalary[];
  /** 기본 급여 (useSameSalary=true일 때) */
  defaultSalary?: SalaryInfo;
  /** 수당 정보 */
  allowances?: Allowances;
  /** 세금 설정 */
  taxSettings?: TaxSettings;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** 근무기록 클릭 핸들러 (그룹 정보 포함) */
  onWorkLogPress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  onSettle?: (workLog: WorkLog) => void;
  onBulkSettle?: (workLogs: WorkLog[]) => void;
  showBulkActions?: boolean;
  /** 설정 모달 열기 콜백 */
  onOpenSettings?: () => void;
  /** 스태프별 그룹핑 활성화 (기본: true) */
  enableGrouping?: boolean;
  /** 그룹 일괄 정산 핸들러 */
  onGroupBulkSettle?: (workLogs: WorkLog[]) => void;
}

type FilterStatus = 'all' | PayrollStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: FilterTabOption<FilterStatus>[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '미정산' },
  { value: 'completed', label: '완료' },
];

// ============================================================================
// Main Component
// ============================================================================

export function SettlementList({
  workLogs,
  roles,
  defaultSalary,
  allowances,
  taxSettings,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  onWorkLogPress,
  onSettle,
  onBulkSettle,
  showBulkActions = false,
  onOpenSettings,
  enableGrouping = true,
  onGroupBulkSettle,
}: SettlementListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 그룹핑 컨텍스트
  const groupingContext: SettlementGroupingContext = useMemo(
    () => ({
      roles,
      defaultSalary,
      allowances,
      taxSettings,
    }),
    [roles, defaultSalary, allowances, taxSettings]
  );

  // 필터링된 목록
  const filteredWorkLogs = useMemo(() => {
    if (selectedFilter === 'all') return workLogs;
    return workLogs.filter((log) => (log.payrollStatus || STATUS.PAYROLL.PENDING) === selectedFilter);
  }, [workLogs, selectedFilter]);

  // 그룹화된 목록
  const groupedSettlements = useMemo(() => {
    return groupSettlementsByStaff(filteredWorkLogs, groupingContext, {
      enabled: enableGrouping,
      minGroupSize: 1, // 항상 그룹 카드 형태로 표시
    });
  }, [filteredWorkLogs, groupingContext, enableGrouping]);

  // 선택 가능한 항목 (미정산 + 출퇴근 완료)
  const selectableWorkLogs = useMemo(() => {
    return workLogs.filter(
      (log) => (log.payrollStatus || STATUS.PAYROLL.PENDING) === STATUS.PAYROLL.PENDING && log.checkInTime && log.checkOutTime
    );
  }, [workLogs]);

  // 필터 옵션 (카운트 포함)
  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = {
      all: workLogs.length,
    };
    workLogs.forEach((log) => {
      const status = (log.payrollStatus || STATUS.PAYROLL.PENDING) as PayrollStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return FILTER_OPTIONS.map((option) => ({
      ...option,
      count: counts[option.value] ?? 0,
    }));
  }, [workLogs]);

  // 요약 정보 (그룹 통계 사용) - 최적화: 필터='all'일 때 groupedSettlements 재사용
  const summaryInfo = useMemo(() => {
    // 필터가 'all'이면 이미 계산된 groupedSettlements 재사용 (중복 그룹화 방지)
    const targetGrouped =
      selectedFilter === 'all'
        ? groupedSettlements
        : groupSettlementsByStaff(workLogs, groupingContext, {
            enabled: true,
            minGroupSize: 1,
          });

    const stats = calculateGroupedSettlementStats(targetGrouped);

    return {
      totalCount: stats.totalWorkLogs,
      pendingCount: stats.totalPendingCount,
      completedCount: stats.totalCompletedCount,
      totalAmount: stats.totalAmount,
      pendingAmount: stats.totalPendingAmount,
    };
  }, [selectedFilter, groupedSettlements, workLogs, groupingContext]);

  // 선택된 항목 금액
  const selectedAmount = useMemo(() => {
    let totalAmount = 0;
    for (const group of groupedSettlements) {
      for (const status of group.dateStatuses) {
        if (selectedIds.has(status.workLogId)) {
          totalAmount += status.amount;
        }
      }
    }
    return totalAmount;
  }, [groupedSettlements, selectedIds]);

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

  // 그룹 일괄 정산 핸들러
  const handleGroupBulkSettle = useCallback(
    (settlableWorkLogs: WorkLog[]) => {
      const handler = onGroupBulkSettle || onBulkSettle;
      handler?.(settlableWorkLogs);
    },
    [onGroupBulkSettle, onBulkSettle]
  );

  // 렌더 아이템 (그룹화된 카드)
  const renderItem = useCallback(
    ({ item }: { item: GroupedSettlement }) => {
      return (
        <View className="px-4">
          <GroupedSettlementCard
            group={item}
            onPress={onWorkLogPress}
            onDatePress={onWorkLogPress}
            onBulkSettle={handleGroupBulkSettle}
            onSettle={onSettle}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleSelect}
          />
        </View>
      );
    },
    [handleGroupBulkSettle, onWorkLogPress, onSettle, selectionMode, selectedIds, handleSelect]
  );

  const keyExtractor = useCallback((item: GroupedSettlement) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Loading size="large" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">정산 목록을 불러오는 중...</Text>
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

  const isAllSelected =
    selectedIds.size === selectableWorkLogs.length && selectableWorkLogs.length > 0;

  return (
    <View className="flex-1">
      {/* 요약 카드 */}
      <SettlementSummaryCard {...summaryInfo} onOpenSettings={onOpenSettings} />

      {/* 필터 탭 */}
      <FilterTabs
        options={filterOptions}
        selectedValue={selectedFilter}
        onSelect={setSelectedFilter}
        countDisplay="always"
        labelSize="sm"
      />

      {/* 일괄 선택 버튼 */}
      {showBulkActions && selectableWorkLogs.length > 0 && (
        <View className="px-4 mb-3">
          <Pressable
            onPress={toggleSelectionMode}
            className="flex-row items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-surface"
          >
            <CheckIcon size={16} color={selectionMode ? '#9333EA' : '#6B7280'} />
            <Text
              className={`
              ml-2 text-sm font-medium
              ${
                selectionMode
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }
            `}
            >
              {selectionMode ? '선택 취소' : '일괄 정산 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 선택 모드 액션 바 */}
      {selectionMode && (
        <SettlementBulkActions
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
        data={groupedSettlements}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        // 그룹 카드는 펼침 가능하여 높이가 가변적 (기본 약 200, 펼침 시 최대 ~500)
        estimatedItemSize={250}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing ?? false} onRefresh={onRefresh} tintColor="#6366f1" />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

export default SettlementList;
