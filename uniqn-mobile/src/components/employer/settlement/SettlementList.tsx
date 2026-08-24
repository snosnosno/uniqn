/**
 * UNIQN Mobile - 정산 목록 컴포넌트
 *
 * @description FlashList 기반 정산 목록 (필터링, 일괄 정산, 스태프별 그룹핑)
 * @version 4.0.0 - SummaryCard, BulkActions 서브컴포넌트 분해
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { GroupedSettlementCard } from './GroupedSettlementCard';
import { SettlementSummaryCard } from './SettlementSummaryCard';
import { SettlementBulkActions } from './SettlementBulkActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '@/components/ui/FilterTabs';
import { ScreenSkeleton } from '@/components/ui';
import { BanknotesIcon, CheckIcon } from '@/components/icons';
import {
  type SalaryType,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
  exportSettlementCsv,
} from '@/utils/settlement';
import { useToast } from '@/stores/toastStore';
import {
  groupSettlementsByStaff,
  calculateGroupedSettlementStats,
  type SettlementGroupingContext,
} from '@/utils/settlementGrouping';
import type { GroupedSettlement } from '@/types/settlement';
import type { WorkLog } from '@/types';
import { STATUS } from '@/constants';
import {
  PAYROLL_STATUS_LABELS,
  isSettlableWorkLogStatus,
  toSettlementDisplayStatus,
  type SettlementDisplayStatus,
} from '@/shared/status';
import { loadFailed } from '@/constants/messages';

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

/**
 * 필터 축은 **화면 어휘 2단**이다(`SettlementDisplayStatus`), 데이터 3값이 아니다.
 * 예전엔 `'all' | PayrollStatus` 라 `'failed'` 가 타입상 선택 가능했는데 그 탭은 존재한 적이
 * 없다 — 고를 수 없는 값이 축에 있으니 `=== selectedFilter` 비교가 failed 행을 어느 칸에도
 * 넣지 못했다(감사 M11). 타입을 실제 탭 목록과 일치시킨다.
 */
type FilterStatus = 'all' | SettlementDisplayStatus;

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: FilterTabOption<FilterStatus>[] = [
  { value: 'all', label: '전체' },
  { value: STATUS.PAYROLL.PENDING, label: PAYROLL_STATUS_LABELS.pending },
  { value: STATUS.PAYROLL.COMPLETED, label: PAYROLL_STATUS_LABELS.completed },
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
  const toast = useToast();

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
    // 데이터 3값을 화면 어휘 2값으로 접어서 비교한다 — 'failed' 는 '정산 대기' 칸에 든다.
    return workLogs.filter(
      (log) => toSettlementDisplayStatus(log.payrollStatus) === selectedFilter
    );
  }, [workLogs, selectedFilter]);

  // 그룹화된 목록
  const groupedSettlements = useMemo(() => {
    return groupSettlementsByStaff(filteredWorkLogs, groupingContext, {
      enabled: enableGrouping,
    });
  }, [filteredWorkLogs, groupingContext, enableGrouping]);

  // 선택 가능한 항목 (미정산 + 출퇴근 완료 + 서버 게이트 통과 status)
  // status 축이 없으면 "전체 선택" 이 서버가 거부할 행까지 담아 일괄 정산이 부분 실패한다 —
  // 카드 버튼과 같은 술어를 쓴다(shared/status SSOT).
  const selectableWorkLogs = useMemo(() => {
    return workLogs.filter(
      (log) =>
        log.payrollStatus !== STATUS.PAYROLL.COMPLETED &&
        isSettlableWorkLogStatus(log.status) &&
        log.checkInTime &&
        log.checkOutTime
    );
  }, [workLogs]);

  /** 이 근무를 선택 모드에서 고를 수 있는가 — 체크박스 노출·토글·전체 선택이 같은 축을 본다. */
  const selectableIds = useMemo(
    () => new Set(selectableWorkLogs.map((log) => log.id)),
    [selectableWorkLogs]
  );

  // 필터 옵션 (카운트 포함)
  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = {
      all: workLogs.length,
    };
    // 화면 어휘로 접어서 센다. 데이터 3값 그대로 세면 'failed' 가 탭이 없는 칸에 쌓여
    // 탭 합계가 '전체' 와 안 맞는다(1 + 0 ≠ 2).
    workLogs.forEach((log) => {
      const status = toSettlementDisplayStatus(log.payrollStatus);
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

  // CSV 내보내기 — 전체 정산 내역(필터 무관) 기준. 세무/정산 증빙용.
  const handleExport = useCallback(async () => {
    const allGroups = groupSettlementsByStaff(workLogs, groupingContext, {
      enabled: enableGrouping,
    });
    const result = await exportSettlementCsv(allGroups);
    if (result.reason === 'empty') {
      toast.info('내보낼 정산 내역이 없어요.');
    } else if (!result.success) {
      toast.error('내보내기에 실패했어요.');
    }
  }, [workLogs, groupingContext, enableGrouping, toast]);

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

  // 선택 핸들러 — 선택 불가 행은 담지 않는다(전체 선택과 같은 축).
  const handleSelect = useCallback(
    (workLog: WorkLog) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(workLog.id)) {
          next.delete(workLog.id);
        } else if (selectableIds.has(workLog.id)) {
          next.add(workLog.id);
        }
        return next;
      });
    },
    [selectableIds]
  );

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
            // 선택 게이트(`handleSelect`)와 **같은 축**을 카드에도 내려준다.
            // 카드가 자체 판정하면 부모가 거부하는 행을 전체 선택에 넣어 편도 토글이 된다.
            selectableIds={selectableIds}
            onToggleSelect={handleSelect}
          />
        </View>
      );
    },
    [
      handleGroupBulkSettle,
      onWorkLogPress,
      onSettle,
      selectionMode,
      selectedIds,
      selectableIds,
      handleSelect,
    ]
  );

  const keyExtractor = useCallback((item: GroupedSettlement) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return <ScreenSkeleton type="settlementList" count={6} />;
  }

  // 에러 상태
  if (error) {
    return <ErrorState title={loadFailed('정산 목록')} error={error} onRetry={onRefresh} />;
  }

  // 빈 상태
  if (!workLogs.length) {
    return (
      <EmptyState
        icon={<BanknotesIcon size={48} color={SECONDARY_PALETTE[400]} />}
        title="정산할 내역이 없습니다"
        description="확정된 스태프의 출퇴근 기록이 여기에 표시됩니다."
      />
    );
  }

  const isAllSelected =
    selectedIds.size === selectableWorkLogs.length && selectableWorkLogs.length > 0;

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
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

      {/* CSV 내보내기 — 세무/정산 증빙용 (전체 내역) */}
      {workLogs.length > 0 && (
        <View className="flex-row justify-end px-4 mb-2">
          <Pressable
            onPress={handleExport}
            className="flex-row items-center px-3 py-1.5 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="정산 내역 CSV 내보내기"
          >
            <BanknotesIcon size={14} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1 text-xs font-sans-medium text-secondary-600 dark:text-secondary-400">
              CSV 내보내기
            </Text>
          </Pressable>
        </View>
      )}

      {/* 일괄 선택 버튼 */}
      {showBulkActions && selectableWorkLogs.length > 0 && (
        <View className="px-4 mb-3">
          <Pressable
            onPress={toggleSelectionMode}
            className="flex-row items-center justify-center py-2 rounded-lg bg-surface-card dark:bg-surface"
          >
            <CheckIcon size={16} color={selectionMode ? '#B8962E' : SECONDARY_PALETTE[500]} />
            <Text
              className={`
              ml-2 text-sm font-sans-medium
              ${
                selectionMode
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-secondary-600 dark:text-secondary-400'
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
      <AppFlashList
        data={groupedSettlements}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // 그룹 카드는 펼침 가능하여 높이가 가변적 (기본 약 200, 펼침 시 최대 ~500)
        estimatedItemSize={250}
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
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}
