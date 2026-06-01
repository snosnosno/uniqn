/**
 * UNIQN Mobile - useWalletBalance
 *
 * @description 본인 지갑 요약(하트/다이아 잔액 + 만료 임박 lot) 조회 훅.
 *   - 단일 queryKey(uid 기준)라 여러 화면에서 동시 사용해도 네트워크 1회로 dedup된다.
 *   - 차감/충전 시 같은 키를 invalidate해 동기 갱신(6A).
 */

import { useQuery } from '@tanstack/react-query';
import { getWalletSummary } from '@/services/wallet';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';

export function useWalletBalance() {
  const { user } = useAuth();
  const uid = user?.uid;

  return useQuery({
    queryKey: queryKeys.wallet.summary(uid),
    queryFn: () => getWalletSummary(),
    enabled: !!uid,
    staleTime: queryCachingOptions.wallet.staleTime,
    gcTime: queryCachingOptions.wallet.gcTime,
  });
}
