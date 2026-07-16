/**
 * UNIQN Mobile — ops 허브 진입 표면 기능 플래그 훅
 *
 * @description 원격 app_config.ops_hub_enabled 를 읽어 ops 허브 진입 표면(발견 동선) 노출 여부를 도출한다.
 * 아키텍처 준수: 훅은 supabase 직접호출 금지 → service(appConfigService) 경유.
 * 정규화는 도메인 순수 파서(parseOpsHubFlag)에 위임.
 *
 * 불변식: 로딩/에러/원격 부재 시 빌드타임 fallback(featureFlags.ops_hub_enabled)을 적용한다.
 * 진입 표면은 전부 이 enabled 플래그 뒤(OFF 면 미노출, 직접 라우트는 유지).
 */

import { useQuery } from '@tanstack/react-query';
import { featureFlags } from '@/config/featureFlags';
import { getOpsHubFlagRaw } from '@/services/appConfigService';
import { parseOpsHubFlag } from '@/domains/ops';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';

export interface UseOpsHubEnabledReturn {
  /** ops 허브 진입 표면 활성화 여부(원격 우선, 실패 시 빌드타임 fallback). */
  enabled: boolean;
  /** 원격 플래그 최초 로딩 중 여부. */
  isLoading: boolean;
}

/**
 * ops 허브 진입 표면 활성화 플래그 훅.
 *
 * @returns `{ enabled, isLoading }` — getOpsHubFlagRaw 는 실패 시 throw 없이 null 을
 *          반환하므로, 파서가 모든 비정상 입력(undefined/null/잘못된 모양)을 fallback 으로 흡수한다.
 */
export function useOpsHubEnabled(): UseOpsHubEnabledReturn {
  const fallback = featureFlags.ops_hub_enabled;

  const query = useQuery({
    queryKey: queryKeys.appConfig.opsHubEnabled(),
    queryFn: getOpsHubFlagRaw,
    staleTime: cachingPolicies.stable,
  });

  // query.data: 로딩 중 undefined / 성공 시 raw value(또는 null). 모두 파서가 fallback 흡수.
  const enabled = parseOpsHubFlag(query.data, fallback);

  return { enabled, isLoading: query.isLoading };
}
