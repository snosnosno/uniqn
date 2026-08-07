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
});
