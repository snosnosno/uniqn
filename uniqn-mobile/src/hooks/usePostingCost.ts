/**
 * UNIQN Mobile - usePostingCost
 * @description 공고 비용(get_posting_cost) 조회 훅. 표시용 단일소스. flag off면 cost=0.
 */
import { useQuery } from '@tanstack/react-query';
import { getPostingCost } from '@/services/wallet';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';

export function usePostingCost(postingType: string, ownerId?: string) {
  return useQuery({
    queryKey: queryKeys.wallet.postingCost(postingType, ownerId),
    queryFn: () => getPostingCost(postingType, ownerId as string),
    enabled: !!ownerId,
    staleTime: queryCachingOptions.wallet.staleTime,
    gcTime: queryCachingOptions.wallet.gcTime,
  });
}
