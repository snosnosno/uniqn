/**
 * UNIQN Mobile — ops 허브 진입 표면 노출(impression) 퍼널 훅
 *
 * @description ops 허브 진입 표면(프로필 메뉴)이 실제 노출됐을 때
 * `ops_hub_impression` 퍼널 이벤트를 마운트당 정확히 1회만 발화한다.
 * 재렌더 반복 발화는 useRef 가드로 차단(퍼널 분모 오염 방지).
 */

import { useEffect, useRef } from 'react';
import { trackOpsFunnel } from '@/services/observability/analyticsService';

/**
 * ops 허브 노출 impression 을 마운트당 1회 발화한다.
 *
 * @param enabled 진입 표면이 실제 노출됐는지 여부(`useOpsHubEnabled().enabled`).
 *   false 인 동안엔 발화하지 않고, false→true 로 바뀌는 최초 시점에 1회 발화한다.
 */
export function useOpsHubImpressionOnce(enabled: boolean): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (enabled && !firedRef.current) {
      firedRef.current = true;
      trackOpsFunnel('ops_hub_impression');
    }
  }, [enabled]);
}
