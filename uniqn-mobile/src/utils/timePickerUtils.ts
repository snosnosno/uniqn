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

/** 분 값을 interval에 맞게 정규화 (0..60-interval 로 클램프) */
export function normalizeMinute(minute: number, interval: number): number {
  // Math.round 는 상한 근처(예: 53,15 → 60)에서 generateMinutes 배열 밖 값을 낼 수 있어
  // 인덱스가 어긋난다(선택 분 undefined). 유효 범위 [0, 60-interval] 로 클램프한다.
  const normalized = Math.round(minute / interval) * interval;
  return Math.min(60 - interval, Math.max(0, normalized));
}

/**
 * 스크롤 종료 오프셋 → 선택 인덱스(범위 클램프).
 *
 * ⚠️ 호출부는 이 값으로 **선택 상태만 갱신**하고 `scrollTo`를 호출하면 안 된다.
 * ScrollView가 `snapToInterval`로 이미 OS 레벨에서 스냅하므로 프로그래매틱 스크롤은 중복이고,
 * 그 중복이 Android에서 재진입 고리를 만든다: scrollTo(animated) → momentum 으로 간주 →
 * onMomentumScrollEnd 재발화 → 오프셋이 정확한 정렬값이 아니면 또 scrollTo → 무한 반복.
 * 루프 도는 동안 ScrollView가 프로그래매틱 스크롤 상태라 사용자 스와이프가 먹통이 된다
 * (2026-07-22 Android 실기기 — 휠 1회 조작 후 멈춤, 탭·버튼은 정상).
 * 이전 시도(±0.5dp 정렬이면 재스크롤 생략)는 dp↔px 반올림 오차가 임계를 넘으면 무력화됐다.
 */
export function snapIndex(offsetY: number, itemCount: number, itemHeight: number): number {
  return Math.max(0, Math.min(Math.round(offsetY / itemHeight), itemCount - 1));
}
