/**
 * UNIQN Mobile — 주간 그리드 기능 플래그 훅
 *
 * @description 원격 app_config.weekly_grid_enabled 를 읽어 그리드 UI 노출 여부를 도출한다.
 * 아키텍처 준수: 훅은 supabase 직접호출 금지 → service(appConfigService) 경유.
 * 정규화는 도메인 순수 파서(parseWeeklyGridFlag)에 위임.
 *
 * 불변식: 로딩/에러/원격 부재 시 빌드타임 fallback(featureFlags.weekly_grid_enabled)을 적용한다.
 * 신규 그리드 UI 는 전부 이 enabled 플래그 뒤(OFF 면 미노출, 기존 캘린더 무회귀).
 */

import { useQuery } from '@tanstack/react-query';
import { featureFlags } from '@/config/featureFlags';
import { getWeeklyGridFlagRaw } from '@/services/appConfigService';
import { parseWeeklyGridFlag } from '@/domains/weeklyGrid';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';

export interface UseWeeklyGridEnabledReturn {
  /** 주간 그리드 활성화 여부(원격 우선, 실패 시 빌드타임 fallback). */
  enabled: boolean;
  /** 원격 플래그 최초 로딩 중 여부. */
  isLoading: boolean;
}

/**
 * 주간 그리드 활성화 플래그 훅.
 *
 * @returns `{ enabled, isLoading }` — getWeeklyGridFlagRaw 는 실패 시 throw 없이 null 을
 *          반환하므로, 파서가 모든 비정상 입력(undefined/null/잘못된 모양)을 fallback 으로 흡수한다.
 */
export function useWeeklyGridEnabled(): UseWeeklyGridEnabledReturn {
  const fallback = featureFlags.weekly_grid_enabled;

  const query = useQuery({
    queryKey: queryKeys.appConfig.weeklyGridEnabled(),
    queryFn: getWeeklyGridFlagRaw,
    staleTime: cachingPolicies.stable,
  });

  // query.data: 로딩 중 undefined / 성공 시 raw value(또는 null). 모두 파서가 fallback 흡수.
  const enabled = parseWeeklyGridFlag(query.data, fallback);

  return { enabled, isLoading: query.isLoading };
}
