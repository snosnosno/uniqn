/**
 * useReduceMotion 훅 회귀 테스트 (2026-07-17 /review)
 *
 * 주의: 레포 jest 는 restoreMocks 라 spy 는 각 테스트 안에서 설치한다
 * (모듈 스코프 spyOn 은 2번째 테스트부터 무력화 — 기존 함정).
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

describe('useReduceMotion', () => {
  it('마운트 시 현재 OS 값을 조회해 반영한다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);

    const { result } = renderHook(() => useReduceMotion());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('reduceMotionChanged 이벤트로 런타임 갱신된다', async () => {
    let listener: ((value: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      cb: (value: boolean) => void
    ) => {
      listener = cb;
      return { remove: jest.fn() };
    }) as never);

    const { result } = renderHook(() => useReduceMotion());

    await waitFor(() => expect(result.current).toBe(false));
    expect(listener).toBeDefined();

    act(() => listener!(true));
    expect(result.current).toBe(true);
  });

  it('언마운트 시 구독을 해제한다', async () => {
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove } as never);

    const { unmount } = renderHook(() => useReduceMotion());
    unmount();

    expect(remove).toHaveBeenCalled();
  });
});
