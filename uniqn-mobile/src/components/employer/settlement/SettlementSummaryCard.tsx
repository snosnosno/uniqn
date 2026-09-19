/**
 * UNIQN Mobile - 지급 예정 합계 카드
 *
 * @description [근무] `금액` 탭 맨 위 한 장. 구인자 IA S2 에서 `미정산 / 완료 / 총 정산액` 세 칸을
 *   **합계 한 줄**로 줄였다. 앱은 돈을 보내지 않으므로 "미정산"·"완료" 로 나눌 근거가 없다.
 *
 * 🔑 합계는 **퇴근이 기록된 근무만** 더한다. 퇴근 전 근무로 추정 금액을 만들면 사장이 그 숫자를
 *    보고 보낸 뒤 실제 금액과 달라진다. 빠진 건수는 따로 밝힌다.
 * 🔑 사람별 합산은 이 카드 아래 목록 자체다(스태프별 묶음 카드) — 같은 사람의 여러 날이 한 줄이라
 *    세 번 보내지 않는다. 별도 시트를 두지 않는다.
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SettingsIcon } from '@/components/icons';
import { formatCurrency } from '@/utils/settlement';

export interface SettlementSummaryCardProps {
  /** 퇴근이 기록된 근무 수 */
  payableCount: number;
  /** 퇴근이 기록된 근무의 금액 합(수당 포함 · 세후, 확정 금액은 그대로) */
  payableAmount: number;
  /** 퇴근 전이라 합계에서 빠진 근무 수 */
  beforeCheckoutCount: number;
  /**
   * 과거에 `지급 완료` 로 처리돼 합계에서 뺀 근무 수·금액(확정 동결값).
   * 🚨 이걸 "지급 예정" 에 더하면 사장이 합계를 그대로 보내 이미 준 돈을 한 번 더 보낸다.
   */
  settledCount: number;
  settledAmount: number;
  onOpenSettings?: () => void;
}

export const SettlementSummaryCard = React.memo(function SettlementSummaryCard({
  payableCount,
  payableAmount,
  beforeCheckoutCount,
  settledCount,
  settledAmount,
  onOpenSettings,
}: SettlementSummaryCardProps) {
  return (
    <Card variant="filled" padding="md" className="mb-4 mx-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-sans-semibold text-content-secondary">지급 예정 합계</Text>
        {onOpenSettings && (
          <Pressable
            onPress={onOpenSettings}
            hitSlop={8}
            className="flex-row items-center px-2 py-1.5 rounded-lg bg-surface-card dark:bg-surface active:opacity-70"
            accessibilityLabel="급여 설정"
            accessibilityRole="button"
          >
            <SettingsIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
              급여 설정
            </Text>
          </Pressable>
        )}
      </View>

      <Text
        testID="settlement-payable-total"
        className="mt-1 text-2xl font-display text-primary-600 dark:text-primary-400"
      >
        {formatCurrency(payableAmount)}
      </Text>

      <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
        {beforeCheckoutCount > 0
          ? `퇴근이 기록된 근무 ${payableCount}건 · 퇴근 전 ${beforeCheckoutCount}건은 빠져요`
          : `퇴근이 기록된 근무 ${payableCount}건`}
      </Text>

      {settledCount > 0 ? (
        <Text
          testID="settlement-settled-note"
          className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans"
        >
          {`이미 지급 처리된 근무 ${settledCount}건(${formatCurrency(settledAmount)})은 빠져요`}
        </Text>
      ) : null}

      <Text className="mt-2 text-micro text-content-placeholder font-sans">
        수당 포함 · 세후 기준이에요. 입금은 앱이 아니라 사장님이 직접 보내요.
      </Text>
    </Card>
  );
});
