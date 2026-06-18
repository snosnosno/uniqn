/**
 * SettlementSummaryWidget
 * 고용주 정산 요약 위젯 (Phase 2A.후속 PR3-C 통합).
 *
 * useSettlementDashboard wrapper 사용 — useMySettlementSummary 가 useActiveWorkspace
 * 의존이라 active workspace 스위치 시 query key 자동 invalidation (PR #71 ghost cache
 * 회귀 방지). 다중 workspace employer/admin 이 workspace 별로 정산을 분리해 본다.
 *
 * Black & Gold 토큰 + dark: 페어, accessibilityLabel + 44px touch target.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useSettlementDashboard } from '@/hooks/useSettlement';
// `@/utils/formatters` flat 파일은 레거시 "N원" 포맷이라 canonical currency 서브패스 직접 참조.
import { formatCurrency } from '@/utils/formatters/currency';

export function SettlementSummaryWidget() {
  const {
    summary,
    isLoading,
    error,
    refresh,
    totalJobPostings,
    totalWorkLogs,
    totalPendingAmount,
    totalCompletedAmount,
  } = useSettlementDashboard();

  const hasData = summary !== undefined && summary !== null && totalWorkLogs > 0;
  const accessibilityLabel = hasData
    ? `정산 요약, 미정산 ${totalPendingAmount}원, 정산 완료 ${totalCompletedAmount}원, 공고 ${totalJobPostings}건, 근무 ${totalWorkLogs}건`
    : '정산 요약';

  return (
    <DashboardWidgetShell
      variant="section"
      title="정산 요약"
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={refresh}
      emptyState={!hasData ? { message: '정산 대상 근무 기록이 없습니다' } : undefined}
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/employer')}
          accessibilityRole="button"
          accessibilityLabel="공고별 정산 보기"
          hitSlop={8}
        >
          <Text className="text-primary-500 text-micro font-sans-bold">상세 →</Text>
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
                {formatCurrency(totalPendingAmount)}
              </NumericText>
              <Text className="text-micro uppercase tracking-wider text-content-muted mt-1">
                미정산 잔액
              </Text>
            </View>
            <View className="items-end">
              <NumericText className="text-base font-sans-bold text-content-primary dark:text-content-primary">
                {formatCurrency(totalCompletedAmount)}
              </NumericText>
              <NumericText className="text-xs text-content-secondary dark:text-content-secondary">
                정산 완료 · 공고 {totalJobPostings}건 · 근무 {totalWorkLogs}건
              </NumericText>
            </View>
          </View>
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}

export default SettlementSummaryWidget;
