/**
 * MonthlyPayrollWidget
 * 스태프 월별 정산(급여) 위젯 (Phase 2A.후속 PR3-B 통합).
 *
 * useMonthlyPayroll(year, month) — useActiveWorkspace 의존. Staff 가 여러 workspace
 * 에서 근무하면 active workspace 별로 분리. queryKey 에 workspaceId 포함되어
 * workspace 스위치 시 자동 refetch (PR #71 ghost cache 회귀 방지).
 *
 * MonthSummaryWidget 은 schedule 기반 "확정/근무시간/예상 수령액" 요약, 본 위젯은
 * work_log 기반 "정산 완료/미정산 금액" 분리 — 보완 관계.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useMonthlyPayroll } from '@/hooks/useWorkLogs';
// canonical currency 배럴 직접 참조 (impeccable v2 §19, "₩N" 포맷)
import { formatCurrency } from '@/utils/formatters/currency';

export function MonthlyPayrollWidget() {
  // 현재 달 기준 — 매 렌더 동일 month 유지하도록 useMemo
  const { year, month } = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, []);

  const { payroll, isLoading, error, refetch } = useMonthlyPayroll(year, month);

  const totalAmount = payroll?.totalAmount ?? 0;
  const pendingAmount = payroll?.pendingAmount ?? 0;
  const completedAmount = payroll?.completedAmount ?? 0;
  const workLogCount = payroll?.workLogs?.length ?? 0;

  const hasData = payroll !== undefined && payroll !== null && workLogCount > 0;
  const accessibilityLabel = hasData
    ? `이번 달 급여, 합계 ${totalAmount}원, 미정산 ${pendingAmount}원, 정산 완료 ${completedAmount}원, 근무 ${workLogCount}건`
    : '이번 달 급여';

  return (
    <DashboardWidgetShell
      variant="section"
      title={`${month}월 정산`}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={refetch}
      emptyState={!hasData ? { message: `${month}월 근무 기록이 없습니다` } : undefined}
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/schedule')}
          accessibilityRole="button"
          accessibilityLabel="스케줄에서 상세 보기"
          hitSlop={8}
        >
          <Text className="text-primary-500 text-[10px] font-sans-bold">상세 →</Text>
        </Pressable>
      }
    >
      {hasData ? (
        <View accessibilityLabel={accessibilityLabel}>
          <View className="flex-row justify-between items-end">
            <View>
              <NumericText
                className="text-3xl font-sans-bold text-primary-500"
                style={{ letterSpacing: -0.6 }}
              >
                {formatCurrency(totalAmount)}
              </NumericText>
              <Text className="text-[10px] uppercase tracking-wider text-content-muted mt-1">
                {month}월 합계
              </Text>
            </View>
            <View className="items-end">
              <NumericText className="text-base font-sans-bold text-content-primary dark:text-content-primary">
                {formatCurrency(pendingAmount)}
              </NumericText>
              <NumericText className="text-xs text-content-secondary dark:text-content-secondary">
                미정산 · 완료 {formatCurrency(completedAmount)} · {workLogCount}건
              </NumericText>
            </View>
          </View>
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}

export default MonthlyPayrollWidget;
