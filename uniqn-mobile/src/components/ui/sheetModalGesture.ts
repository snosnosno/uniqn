/**
 * UNIQN Mobile - SheetModal 드래그 dismiss 제스처 판정 (순수 함수)
 *
 * @description SheetModal 헤더 팬 제스처의 수학/판정 로직. 워크렛에서 호출되지만
 *              순수 함수라 jest 유닛 테스트로 경계값(방향 가드·임계값·러버밴드
 *              불변식)을 고정한다. (2026-07-17 /review 회귀 테스트 대상)
 */

/** dismiss 속도 임계 (px/s) — 실기기 튜닝 대상 (계획005 Tuning note: 300~600 범위) */
export const SHEET_DISMISS_VELOCITY = 400;

/** dismiss 거리 임계 (windowHeight 대비 비율) */
export const SHEET_DISMISS_DISTANCE_RATIO = 0.25;

/**
 * 러버밴드 저항 (Apple 공식): 경계 밖으로 갈수록 이동량이 점점 줄어든다.
 * 위로 끌 때(overshoot < 0) 딱딱한 정지 대신 탄성 저항을 준다.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * 릴리즈 시 dismiss 여부 판정.
 * 빠른 하향 플릭(velocityY > 400)이거나 25% 초과 하향 드래그면 dismiss.
 * 단, 25% 초과 드래그여도 위로 플릭(velocityY < 0)이면 명백한 취소 의도 → dismiss 금지.
 */
export function shouldDismissSheet(
  translationY: number,
  velocityY: number,
  windowHeight: number
): boolean {
  'worklet';
  return (
    velocityY > SHEET_DISMISS_VELOCITY ||
    (translationY > windowHeight * SHEET_DISMISS_DISTANCE_RATIO && velocityY >= 0)
  );
}
