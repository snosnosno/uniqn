/**
 * 앱 내 채팅 기능 플래그 훅
 *
 * 원격 app_config.chat_enabled 를 service(appConfigService) 경유로 읽는다. 로딩·오류·원격 부재는
 * 전부 빌드타임 fallback(false)으로 닫힌다 — 서버가 다크인 동안 진입점이 열리지 않게.
 * 선례: `src/hooks/useOpsHubEnabled.ts`.
 */
import { useQuery } from '@tanstack/react-query';
import { getChatFlagRaw } from '@/services/appConfigService';
import { resolveChatEnabled } from '@/domains/chat';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';

export interface UseChatEnabledReturn {
  enabled: boolean;
  isLoading: boolean;
}

export function useChatEnabled(): UseChatEnabledReturn {
  const query = useQuery({
    queryKey: queryKeys.appConfig.chatEnabled(),
    queryFn: getChatFlagRaw,
    staleTime: cachingPolicies.stable,
  });

  return { enabled: resolveChatEnabled(query.data), isLoading: query.isLoading };
}
