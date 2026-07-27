/**
 * useVenueSettlement — 지점(컨테이너) 월 단위 정산 조회 (JIT 급여 설계 §D).
 * getVenueSettlementWorkLogs(서비스)의 첫 UI 소비처. 날짜범위는 SQL 경계(repo)에서 적용됨.
 */
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, parse, startOfMonth } from 'date-fns';
import { queryKeys } from '@/lib/queryClient';
import { getVenueSettlementWorkLogs } from '@/services/work/settlement';

/** 'YYYY-MM' → 월 경계(YYYY-MM-DD inclusive). date-fns 사용(수동 날짜계산 금지 규칙). */
export function monthToRange(month: string): { start: string; end: string } {
  const base = parse(month, 'yyyy-MM', new Date());
  return {
    start: format(startOfMonth(base), 'yyyy-MM-dd'),
    end: format(endOfMonth(base), 'yyyy-MM-dd'),
  };
}

export function useVenueSettlement(venueId: string | null, month: string) {
  const { start, end } = monthToRange(month);
  return useQuery({
    queryKey: queryKeys.settlement.byVenue(venueId ?? '', start, end),
    queryFn: () => getVenueSettlementWorkLogs(venueId as string, { start, end }),
    enabled: !!venueId,
  });
}
