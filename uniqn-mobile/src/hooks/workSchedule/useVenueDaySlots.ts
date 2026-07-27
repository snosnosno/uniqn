/**
 * useVenueDaySlots — 운영처 하루 슬롯(배치 work_log) 목록 조회 훅(읽기 전용 TanStack Query).
 *
 * 비활성(venueId null 또는 date 빈값)이면 disabled. 그 날 배치 인원은 실시간성이 있어
 * realtime(30초) staleTime 으로 짧게 캐시한다.
 */
import { useQuery } from '@tanstack/react-query';
import { cachingPolicies, queryKeys } from '@/lib/queryClient';
import { workScheduleRepository } from '@/repositories/workSchedule';
import type { VenueDaySlot } from '@/repositories/workSchedule';

export function useVenueDaySlots(
  venueId: string | null,
  date: string,
  // 기능 플래그 OFF 시 호출측에서 쿼리를 비활성화할 수 있게 한다(기본 활성).
  options?: { enabled?: boolean }
) {
  const featureEnabled = options?.enabled ?? true;
  return useQuery<VenueDaySlot[]>({
    queryKey:
      venueId && date
        ? queryKeys.workSchedule.daySlots(venueId, date)
        : [...queryKeys.workSchedule.all, 'daySlots', 'none'],
    queryFn: () => workScheduleRepository.getVenueDaySlots(venueId as string, date),
    enabled: featureEnabled && !!venueId && !!date,
    staleTime: cachingPolicies.realtime,
  });
}
