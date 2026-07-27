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
 *
 * ⚠️ `src/hooks/index.ts` 배럴에 export 하지 말 것 — 리프 UI 는 직접 경로만 쓴다
 *    (배럴 상수 순환 참조로 모듈 스코프 값이 undefined 가 되는 함정이 3회 재발했다).
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 모듈 스코프 프리페치 캐시: 앱 부팅(모듈 로드) 시 1회 조회해 둔다.
 * useState(false) 비동기 초기값 때문에 RM 사용자에게도 마운트 첫 1~2프레임 동안
 * 모션이 재생된 뒤 스냅되는 문제(2026-07-17 /review)를 막고, 훅이 마운트 시점부터
 * 올바른 값으로 시딩되게 한다. 조회 실패 시 캐시 미시딩 — 훅이 마운트 시 재조회.
 */
let cachedReduceMotion: boolean | null = null;

AccessibilityInfo.isReduceMotionEnabled?.()
  ?.then((value) => {
    cachedReduceMotion = value;
  })
  .catch(() => {});

/**
 * OS의 Reduce Motion 설정 활성 여부를 반환한다.
 * 프리페치 캐시로 초기값을 시딩하고, 마운트 시 현재 값을 재조회하며,
 * 이후 `reduceMotionChanged` 이벤트로 갱신한다.
 */
export function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(cachedReduceMotion ?? false);

  useEffect(() => {
    let mounted = true;

    // 프리페치와 동일한 방어를 본문에도 적용한다 — 이 메서드를 주지 않는 mock 환경에서
    // throw / unhandled rejection 이 나기 때문(원본은 프리페치만 방어돼 비대칭이었다).
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((value) => {
        cachedReduceMotion = value;
        if (mounted) setEnabled(value);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value: boolean) => {
      cachedReduceMotion = value;
      if (mounted) setEnabled(value);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return enabled;
}
