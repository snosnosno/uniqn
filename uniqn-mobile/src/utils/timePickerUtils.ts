/**
 * UNIQN Mobile - 시간 피커 공유 유틸리티
 *
 * @description TimeWheelPicker의 웹/네이티브 구현에서 공유하는 배열 생성 로직
 * @version 1.0.0
 */

/** 시간 배열 생성 (minHour ~ maxHour) */
export function generateHours(minHour: number, maxHour: number): number[] {
  return Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
}

/** 분 배열 생성 (0부터 interval 단위) */
export function generateMinutes(interval: number): number[] {
  return Array.from({ length: 60 / interval }, (_, i) => i * interval);
}

/** 분 값을 interval에 맞게 정규화 */
export function normalizeMinute(minute: number, interval: number): number {
  return Math.round(minute / interval) * interval;
}

/**
 * 스크롤 종료 오프셋 → 스냅 인덱스 + 재스크롤 필요 여부.
 *
 * needsScroll=false(±0.5px 이내 정렬)면 호출부는 scrollTo를 **호출하면 안 된다** —
 * Android에서 programmatic scrollTo(animated)가 onMomentumScrollEnd를 재발화시켜
 * 핸들러가 같은 위치로 재-scrollTo하는 무한 재진입(휠 터치 먹통, 2026-07-22 실기기)을 만든다.
 * snapToInterval이 이미 정렬해 둔 일반 경로에서는 항상 이 가드에 걸려 재스크롤이 생략된다.
 */
export function resolveSnap(
  offsetY: number,
  itemCount: number,
  itemHeight: number
): { index: number; needsScroll: boolean } {
  const index = Math.max(0, Math.min(Math.round(offsetY / itemHeight), itemCount - 1));
  return { index, needsScroll: Math.abs(offsetY - index * itemHeight) > 0.5 };
}
