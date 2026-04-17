/**
 * Haptics — 결정적 순간에만 발화 + 200ms throttle
 *
 * 룰 근거: `.claude/rules/impeccable-design.md` §17
 *
 * 사용처 가이드:
 *
 * | 순간 | type |
 * |------|------|
 * | 승인/거절 (employer) | `'medium'` |
 * | 결제 완료 | `'success'` |
 * | 토글 전환 (다크모드 등) | `'light'` |
 * | 삭제 확인 | `'warning'` |
 * | 스와이프로 삭제 경계 | `'light'` |
 *
 * 금지: 일반 탭, 스크롤, 리스트 선택, 네비게이션.
 *
 * 접근성: 수동 체크 불필요 — expo-haptics는 OS 시스템 햅틱 설정을 자동 존중한다.
 */

import * as Haptics from 'expo-haptics';

export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection';

// employer 반복 승인 플로우에서 햅틱 피로 유발 방지.
// 200ms 이내 연속 트리거는 skip.
const THROTTLE_MS = 200;

let lastTriggerAt = 0;

function shouldSkip(): boolean {
  const now = Date.now();
  if (now - lastTriggerAt < THROTTLE_MS) return true;
  lastTriggerAt = now;
  return false;
}

async function fire(type: HapticType): Promise<void> {
  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      case 'selection':
        await Haptics.selectionAsync();
        return;
    }
  } catch {
    // 시스템 햅틱 비활성화·장치 미지원 시 silent fail — 기능 실패로 간주하지 않음.
  }
}

/**
 * 단발 햅틱 트리거 — 200ms throttle 적용.
 * 결정적 순간(승인/결제/토글/삭제 경계)에만 사용.
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  if (shouldSkip()) return;
  await fire(type);
}

/**
 * 대량 액션 **시작** 햅틱. 일괄 승인/거절 진입 직전 1회.
 * throttle 무관하게 반드시 발화.
 */
export async function triggerBatchStart(): Promise<void> {
  lastTriggerAt = Date.now();
  await fire('light');
}

/**
 * 대량 액션 **종료** 햅틱. 일괄 작업 완료 시 1회.
 * `success=true` → `'success'`, `false` → `'warning'`.
 * throttle 무관하게 반드시 발화.
 */
export async function triggerBatchEnd(success: boolean): Promise<void> {
  lastTriggerAt = Date.now();
  await fire(success ? 'success' : 'warning');
}

/**
 * 테스트용 throttle 리셋. 프로덕션 코드에서 호출하지 말 것.
 * @internal
 */
export function __resetHapticThrottleForTests(): void {
  lastTriggerAt = 0;
}
