/**
 * UNIQN Mobile — ops 허브 진입(entered) 퍼널 훅
 *
 * @description ops 허브 화면(대회 목록)에 진입했을 때 `ops_hub_entered` 퍼널
 * 이벤트를 마운트당 정확히 1회만 발화한다. 재렌더 반복 발화는 useRef 가드로 차단.
 *
 * 형제 훅 `useOpsHubImpressionOnce`(노출/impression)와 동형 가드 —
 * 이벤트명만 다르다(분모=impression, 분자=entered).
 */

import { useEffect, useRef } from 'react';
import { trackOpsFunnel } from '@/services/observability/analyticsService';

/**
 * ops 허브 진입 이벤트를 마운트당 1회 발화한다.
 *
 * @param enabled 진입으로 계측할지 여부. 기본 true.
 *   `false` 인 동안엔 발화하지 않고, `false`→`true` 로 바뀌는 최초 시점에 1회 발화한다.
 *   예: 메인 허브 모드(`!postingId`)에서만 진입으로 카운트해 퍼널 분모(impression) 오염 방지.
 */
export function useOpsHubEnteredOnce(enabled: boolean = true): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (enabled && !firedRef.current) {
      firedRef.current = true;
      trackOpsFunnel('ops_hub_entered');
    }
  }, [enabled]);
}
