/**
 * UNIQN Mobile - WalletBalanceBadge (connected)
 *
 * @description useWalletBalance를 호출해 BalanceBadge에 전달하는 컨테이너.
 *   여러 화면에 배치해도 단일 queryKey라 네트워크 1회로 dedup된다.
 */

import { BalanceBadge, type BalanceBadgeProps } from './BalanceBadge';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { summarizeExpiringHearts } from '@/utils/wallet/expiringHearts';

type WalletBalanceBadgeProps = Pick<BalanceBadgeProps, 'testID'>;

export function WalletBalanceBadge({ testID }: WalletBalanceBadgeProps) {
  const { data, isLoading } = useWalletBalance();
  const expiring = data ? summarizeExpiringHearts(data.expiring_lots, new Date()) : null;

  return (
    <BalanceBadge
      testID={testID}
      heartBalance={data?.heart_balance ?? 0}
      diamondBalance={data?.diamond_balance ?? 0}
      expiring={expiring}
      isLoading={isLoading}
    />
  );
}
