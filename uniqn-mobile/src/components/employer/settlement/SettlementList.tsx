/**
 * UNIQN Mobile - 근무 금액 목록 컴포넌트
 *
 * @description FlashList 기반 스태프별 금액 목록 ([근무] 의 `금액` 탭)
 * @version 5.0.0 - 구인자 IA S2: 지급 상태 필터·일괄 정산·선택 모드 제거. 금액 계산·표시만 남긴다.
 *
 * 앱은 돈을 보내지 않는다. 그런데 이 목록은 `정산 대기 / 정산 완료` 필터와 `일괄 정산 선택` 으로
 * 앱이 지급을 관리하는 것처럼 굴었고, 아무도 `지급 완료` 를 누르지 않으면 영원히 "정산 대기"가 쌓였다.
 * 금액 컬럼·RPC 는 그대로 두고 **화면에서 워크플로우만** 걷어냈다.
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { GroupedSettlementCard } from './GroupedSettlementCard';
import { SettlementSummaryCard } from './SettlementSummaryCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ScreenSkeleton } from '@/components/ui';
import { BanknotesIcon } from '@/components/icons';
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
  type SettlementGroupingContext,
} from '@/utils/settlementGrouping';
import type { GroupedSettlement } from '@/types/settlement';
import type { WorkLog } from '@/types';
import { STATUS } from '@/constants';
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
  /** 근무기록 클릭 핸들러 (그룹 정보 포함) — 계산 근거 시트를 연다 */
  onWorkLogPress?: (workLog: WorkLog, group: GroupedSettlement) => void;
  /** 급여 설정 모달 열기 콜백 */
  onOpenSettings?: () => void;
  /** 스태프별 그룹핑 활성화 (기본: true) */
  enableGrouping?: boolean;
}

/**
 * 목록 전체의 지급 예정 합계.
 *
 * 🔑 `dateStatuses[].amount` 는 확정 금액(과거 지급 완료 행)이면 그 동결값, 아니면 재계산값이다
 *    (`settlementGrouping` 의 SSOT).
 * 🚨 과거에 `지급 완료` 로 처리된 근무는 "지급 예정" 에 넣지 않는다 — 사장이 합계를 그대로 보내면
 *    이미 준 돈을 한 번 더 보낸다(워크플로우가 살아 있던 시절의 공고에 실재한다). 따로 센다.
 */
function summarizePayable(groups: GroupedSettlement[]) {
  let payableCount = 0;
  let payableAmount = 0;
  let beforeCheckoutCount = 0;
  let settledCount = 0;
  let settledAmount = 0;

  for (const group of groups) {
    for (const status of group.dateStatuses) {
      if (!status.hasValidTimes) {
        beforeCheckoutCount += 1;
      } else if (status.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        settledCount += 1;
        settledAmount += status.amount;
      } else {
        payableCount += 1;
        payableAmount += status.amount;
      }
    }
  }

  return { payableCount, payableAmount, beforeCheckoutCount, settledCount, settledAmount };
}

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
  onOpenSettings,
  enableGrouping = true,
}: SettlementListProps) {
  const toast = useToast();

  const groupingContext: SettlementGroupingContext = useMemo(
    () => ({
      roles,
      defaultSalary,
      allowances,
      taxSettings,
    }),
    [roles, defaultSalary, allowances, taxSettings]
  );

  const groupedSettlements = useMemo(
    () => groupSettlementsByStaff(workLogs, groupingContext, { enabled: enableGrouping }),
    [workLogs, groupingContext, enableGrouping]
  );

  const summary = useMemo(() => summarizePayable(groupedSettlements), [groupedSettlements]);

  // CSV 내보내기 — 세무 증빙용 금액 내역.
  const handleExport = useCallback(async () => {
    const result = await exportSettlementCsv(groupedSettlements);
    if (result.reason === 'empty') {
      toast.info('내보낼 근무 금액이 없어요.');
    } else if (!result.success) {
      toast.error('내보내기에 실패했어요.');
    }
  }, [groupedSettlements, toast]);

  const renderItem = useCallback(
    ({ item }: { item: GroupedSettlement }) => (
      <View className="px-4">
        <GroupedSettlementCard group={item} onPress={onWorkLogPress} onDatePress={onWorkLogPress} />
      </View>
    ),
    [onWorkLogPress]
  );

  const keyExtractor = useCallback((item: GroupedSettlement) => item.id, []);

  if (isLoading && !isRefreshing) {
    return <ScreenSkeleton type="settlementList" count={6} />;
  }

  if (error) {
    return <ErrorState title={loadFailed('근무 금액')} error={error} onRetry={onRefresh} />;
  }

  if (!workLogs.length) {
    return (
      <EmptyState
        icon={<BanknotesIcon size={48} color={SECONDARY_PALETTE[400]} />}
        title="아직 근무 기록이 없어요"
        description="확정된 스태프의 출퇴근이 기록되면 여기서 금액을 확인할 수 있어요."
      />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      <SettlementSummaryCard {...summary} onOpenSettings={onOpenSettings} />

      <View className="flex-row justify-end px-4 mb-2">
        <Pressable
          onPress={handleExport}
          className="flex-row items-center px-3 py-1.5 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="근무 금액 CSV 내보내기"
        >
          <BanknotesIcon size={14} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-1 text-xs font-sans-medium text-secondary-600 dark:text-secondary-400">
            CSV 내보내기
          </Text>
        </Pressable>
      </View>

      <AppFlashList
        data={groupedSettlements}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // 그룹 카드는 펼침 가능하여 높이가 가변적 (기본 약 180, 펼침 시 최대 ~450)
        estimatedItemSize={220}
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
