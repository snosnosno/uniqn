/**
 * haptics.ts — throttle + batch + type 매핑 커버리지
 */

import * as Haptics from 'expo-haptics';

import {
  __resetHapticThrottleForTests,
  triggerBatchEnd,
  triggerBatchStart,
  triggerHaptic,
} from '../haptics';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe('triggerHaptic', () => {
  beforeEach(() => {
    __resetHapticThrottleForTests();
    (Haptics.impactAsync as jest.Mock).mockClear();
    (Haptics.notificationAsync as jest.Mock).mockClear();
    (Haptics.selectionAsync as jest.Mock).mockClear();
  });

  it('maps "light" → ImpactFeedbackStyle.Light', async () => {
    await triggerHaptic('light');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('maps "medium" → ImpactFeedbackStyle.Medium', async () => {
    await triggerHaptic('medium');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('maps "heavy" → ImpactFeedbackStyle.Heavy', async () => {
    await triggerHaptic('heavy');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
  });

  it('maps "success" / "warning" / "error" → NotificationFeedbackType', async () => {
    await triggerHaptic('success');
    __resetHapticThrottleForTests();
    await triggerHaptic('warning');
    __resetHapticThrottleForTests();
    await triggerHaptic('error');

    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'warning');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(3, 'error');
  });

  it('maps "selection" → selectionAsync', async () => {
    await triggerHaptic('selection');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('swallows errors from expo-haptics (silent fail, no throw)', async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('no haptic hardware'));
    await expect(triggerHaptic('light')).resolves.toBeUndefined();
  });
});

describe('throttle window (200ms)', () => {
  beforeEach(() => {
    __resetHapticThrottleForTests();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it('skips the second trigger fired within 200ms', async () => {
    await triggerHaptic('medium');
    await triggerHaptic('medium'); // 즉시 재호출 → skip
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('allows a second trigger after the throttle window elapses', async () => {
    jest.useFakeTimers();
    const baseNow = Date.now();
    jest.setSystemTime(baseNow);

    await triggerHaptic('medium');

    jest.setSystemTime(baseNow + 201);
    await triggerHaptic('medium');

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe('batch start/end', () => {
  beforeEach(() => {
    __resetHapticThrottleForTests();
    (Haptics.impactAsync as jest.Mock).mockClear();
    (Haptics.notificationAsync as jest.Mock).mockClear();
  });

  it('fires a single Light impact on batch start', async () => {
    await triggerBatchStart();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('fires Success notification on batch end when successful', async () => {
    await triggerBatchEnd(true);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('fires Warning notification on batch end when failed', async () => {
    await triggerBatchEnd(false);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
  });

  it('batch start ignores the throttle window (always fires)', async () => {
    await triggerHaptic('medium'); // 직전 트리거로 throttle 유발
    await triggerBatchStart(); // 즉시 호출이어도 발화
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it('batch end ignores the throttle window (always fires)', async () => {
    await triggerHaptic('medium');
    await triggerBatchEnd(true);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });
});
