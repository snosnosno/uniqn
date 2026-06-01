/**
 * UNIQN Mobile - BalanceBadge (순수 표시)
 *
 * @description 하트/다이아 잔액 + 만료 임박 하트 inline 표시. 데이터는 props로만 받는다.
 *   연결(훅 호출)은 WalletBalanceBadge가 담당.
 */

import { View, Text } from 'react-native';
import { HeartFilledIcon, GemIcon } from '@/components/icons';
import { PRIMARY_COLORS } from '@/constants/colors';
import type { ExpiringHeartSummary } from '@/utils/wallet/expiringHearts';

export interface BalanceBadgeProps {
  heartBalance: number;
  diamondBalance: number;
  expiring?: ExpiringHeartSummary | null;
  isLoading?: boolean;
  testID?: string;
}

export function BalanceBadge({
  heartBalance,
  diamondBalance,
  expiring,
  isLoading,
  testID,
}: BalanceBadgeProps) {
  const heartLabel = isLoading ? '—' : String(heartBalance);
  const diamondLabel = isLoading ? '—' : String(diamondBalance);

  return (
    <View testID={testID} className="flex-row items-center gap-3">
      <View className="flex-row items-center gap-1">
        <HeartFilledIcon size={16} />
        <Text className="text-sm font-sans-medium text-content-primary dark:text-secondary-100">
          {heartLabel}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <GemIcon size={16} color={PRIMARY_COLORS[500]} />
        <Text className="text-sm font-sans-medium text-content-primary dark:text-secondary-100">
          {diamondLabel}
        </Text>
      </View>
      {expiring && (
        <Text className="text-xs font-sans text-warning-600 dark:text-warning-400">
          {expiring.totalAmount}💖 D-{expiring.daysUntilExpiry} 만료
        </Text>
      )}
    </View>
  );
}
