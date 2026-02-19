/**
 * UNIQN Mobile - 인앱 메시지 데이터 소스 훅
 *
 * @description Firestore에서 활성 인앱 메시지를 조회하고 processMessages로 전달
 * @version 1.0.0
 */

import { useEffect, useRef } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { fetchActiveMessages } from '@/repositories/firebase/InAppMessageRepository';
import { processMessages } from '@/services/inAppMessageService';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';

// ============================================================================
// Hook
// ============================================================================

/**
 * 인앱 메시지를 Firestore에서 조회하고 표시 큐에 전달하는 훅
 *
 * @description
 * - useQuery로 활성 메시지 조회 (staleTime: 30분)
 * - 조회 결과를 processMessages()에 전달
 * - 포그라운드 복귀 시 재조회
 */
export function useInAppMessages(): void {
  const { isAuthenticated } = useAuth();
  const appStateRef = useRef(AppState.currentState);

  const { data: messages, refetch } = useQuery({
    queryKey: queryKeys.inAppMessages.active(),
    queryFn: fetchActiveMessages,
    staleTime: cachingPolicies.stable, // 60분 (stable 정책: 드물게 변경)
    enabled: isAuthenticated,
  });

  // 메시지가 로드되면 processMessages로 전달
  useEffect(() => {
    if (messages && messages.length > 0) {
      processMessages(messages);
    }
  }, [messages]);

  // 포그라운드 복귀 시 재조회
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isAuthenticated) {
          refetch().catch((e) => logger.warn('인앱 메시지 재조회 실패', { error: String(e) }));
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, refetch]);
}

export default useInAppMessages;
