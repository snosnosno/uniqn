/**
 * UNIQN Mobile - useReduceMotion 훅
 *
 * @description OS의 "동작 줄이기(Reduce Motion)" 접근성 설정을 구독하는 단일 진실원.
 *              활성 시 transform(이동/스케일) 애니메이션은 즉시 목표값으로 세팅하고
 *              opacity 페이드만 유지하는 분기에 사용한다. (impeccable v2 §16 / 룰 8)
 *
 * 레포 관례: reanimated 내장 `useReducedMotion` 대신 `AccessibilityInfo` 구독 방식을
 *           사용한다 — 런타임 설정 변경 반응성이 검증됐고, 테스트 mock 경로가
 *           이 방식(`AccessibilityInfo.isReduceMotionEnabled`/`addEventListener`)에
 *           맞춰져 있다.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OS의 Reduce Motion 설정 활성 여부를 반환한다.
 * 마운트 시 현재 값을 조회하고, 이후 `reduceMotionChanged` 이벤트로 갱신한다.
 */
export function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      if (mounted) setEnabled(value);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return enabled;
}
