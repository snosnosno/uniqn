/**
 * useManualRefresh — 배경 재조회로는 스피너가 뜨지 않는다는 계약 검증
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useManualRefresh } from '../useManualRefresh';

describe('useManualRefresh', () => {
  it('사용자가 당기기 전에는 refreshing 이 false 다 (배경 재조회로 스피너가 뜨지 않는다)', () => {
    const { result, rerender } = renderHook(() => useManualRefresh(jest.fn()));

    expect(result.current.refreshing).toBe(false);

    // 배경 재조회로 부모가 여러 번 리렌더돼도 스피너 상태는 바뀌지 않는다.
    rerender({});
    rerender({});

    expect(result.current.refreshing).toBe(false);
  });

  it('당기면 refreshing 이 켜지고, 완료되면 꺼진다', async () => {
    let resolveRefresh: (() => void) | undefined;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => useManualRefresh(refresh));

    act(() => result.current.onRefresh());
    expect(result.current.refreshing).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefresh?.();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it('진행 중에 다시 당겨도 중복 실행하지 않는다', async () => {
    let resolveRefresh: (() => void) | undefined;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => useManualRefresh(refresh));

    act(() => result.current.onRefresh());
    act(() => result.current.onRefresh());

    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefresh?.();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it('새로고침이 실패해도 스피너를 반드시 내린다', async () => {
    const refresh = jest.fn(() => Promise.reject(new Error('네트워크 실패')));

    const { result } = renderHook(() => useManualRefresh(refresh));

    await act(async () => {
      result.current.onRefresh();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  // 🔴 리뷰 MEDIUM 1 회귀 가드.
  //    이 훅의 주석은 "onRefresh 정체성 고정 — 매 렌더 새 함수면 iOS 제스처가 끊긴다" 고
  //    선언하는데, deps 가 `[refreshing]` 이라 **당기는 바로 그 순간** identity 가 바뀌었다.
  //    RefreshControl 이 제스처 진행 중에 새 prop 을 받는 상황이 정확히 그 주석이 막으려던 것이다.
  //    26개 화면이 이 훅을 쓴다.
  it('🔴 새로고침이 시작돼도 onRefresh 의 정체성이 바뀌지 않는다', async () => {
    let resolveRefresh: (() => void) | undefined;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => useManualRefresh(refresh));
    const before = result.current.onRefresh;

    act(() => {
      result.current.onRefresh();
    });

    // 진행 중(스피너가 떠 있는 상태)에도 같은 함수여야 한다.
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.onRefresh).toBe(before);

    await act(async () => {
      resolveRefresh?.();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.onRefresh).toBe(before);
  });

  it('진행 중에 다시 당겨도 중복 실행하지 않는다 (가드가 ref 로 옮겨도 유지된다)', async () => {
    let resolveRefresh: (() => void) | undefined;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => useManualRefresh(refresh));

    act(() => {
      result.current.onRefresh();
      // 같은 틱에 한 번 더 — state 가드였다면 배칭 때문에 두 번째가 통과할 수 있었다.
      result.current.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefresh?.();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    // 끝난 뒤에는 다시 당길 수 있어야 한다 — 플래그가 true 로 남으면 화면이 영구히 죽는다.
    act(() => {
      result.current.onRefresh();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
