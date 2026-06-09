/**
 * UNIQN Mobile - usePurchaseDiamonds
 * @description 패키지 구매 → 성공 시 wallet 잔액 폴링으로 적립 감지 → 캐시 무효화.
 *   상태: idle | purchasing | processing(폴링) | done | timeout | cancelled | error.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PurchasesPackage } from 'react-native-purchases';
import { purchasesService } from '@/services/purchases';
import { getWalletSummary } from '@/services/wallet';
import { pollWalletCredit } from '@/utils/wallet/pollWalletCredit';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/utils/logger';

export type PurchaseStatus =
  | 'idle'
  | 'purchasing'
  | 'processing'
  | 'done'
  | 'timeout'
  | 'cancelled'
  | 'error';

export function usePurchaseDiamonds() {
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);
  const [status, setStatus] = useState<PurchaseStatus>('idle');

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setStatus('purchasing');
      try {
        const before = await getWalletSummary();
        const baseline = before.diamond_balance;

        const result = await purchasesService.purchasePackage(pkg);
        if (result.cancelled) {
          setStatus('cancelled');
          return;
        }

        // 적립은 웹훅 비동기 → 폴링
        setStatus('processing');
        const poll = await pollWalletCredit({
          baseline,
          fetchBalance: async () => (await getWalletSummary()).diamond_balance,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary(uid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.ledger(uid) });
        setStatus(poll.credited ? 'done' : 'timeout');
      } catch (error) {
        logger.error('purchaseDiamonds.failed', error as Error);
        setStatus('error');
      }
    },
    [queryClient, uid]
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, purchase, reset };
}
