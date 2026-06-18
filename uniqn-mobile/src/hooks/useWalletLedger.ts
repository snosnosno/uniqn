/**
 * UNIQN Mobile - useWalletLedger
 *
 * @description 본인 지갑 거래내역(wallet_ledger) 무한스크롤 조회 훅.
 *   - offset 기반 페이지네이션(limit+1 prefetch로 hasMore 판정).
 *   - 차감/충전/환불 시 invalidate되도록 queryKeys.wallet.ledger 사용.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getWalletLedger } from '@/services/wallet';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';

const PAGE_SIZE = 20;

export function useWalletLedger() {
  const { user } = useAuth();
  const uid = user?.uid;

  return useInfiniteQuery({
    queryKey: queryKeys.wallet.ledger(uid),
    queryFn: ({ pageParam }) => getWalletLedger(pageParam, PAGE_SIZE),
    enabled: !!uid,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    staleTime: queryCachingOptions.wallet.staleTime,
    gcTime: queryCachingOptions.wallet.gcTime,
  });
}
