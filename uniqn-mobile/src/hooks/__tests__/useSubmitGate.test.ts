/**
 * useSubmitGate — 제출 결과를 보고 나서 닫는다 (W1-11).
 *
 * @description 같은 실수가 8개 경로에서 반복됐다: `mutate` 를 fire-and-forget 으로 쏘고
 *   **동기적으로** 모달을 닫거나 성공 토스트를 먼저 띄운다. 결과:
 *     · 실패하면 사용자가 입력한 사유 200자가 통째로 사라지고 에러 토스트만 남는다.
 *     · '처리 중...' 라벨과 `isLoading` prop 이 렌더될 일이 없는 **죽은 코드**가 된다.
 *     · 느린 네트워크에서 재탭 → 중복 제출 경로가 열린다.
 *     · `mutate` 는 throw 하지 않으므로 try/catch 의 catch 절도 죽은 코드다.
 */
import { renderHook, act } from '@testing-library/react-native';

import { useSubmitGate } from '../useSubmitGate';

const mockLoggerError = jest.fn();
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: (...a: unknown[]) => mockLoggerError(...a) },
}));

/** 수동으로 결말을 정하는 promise — '진행 중' 상태를 관측하기 위해 필요하다. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockLoggerError.mockClear();
});

describe('성공에서만 닫는다', () => {
  it('action 이 끝나기 전에는 onSuccess 가 돌지 않는다', async () => {
    const d = deferred();
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useSubmitGate({ action: () => d.promise, onSuccess, errorMessage: '실패' })
    );

    let submitted!: Promise<void>;
    act(() => {
      submitted = result.current.submit();
    });
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      d.resolve();
      await submitted;
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('실패하면 onSuccess 를 부르지 않는다 — 모달과 입력이 그대로 남는다', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useSubmitGate({
        action: () => Promise.reject(new Error('네트워크 오류')),
        onSuccess,
        errorMessage: '거절 처리 실패',
      })
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('실패를 호출부로 되던지지 않는다 — 이벤트 핸들러에서 미처리 rejection 이 되면 안 된다', async () => {
    const { result } = renderHook(() =>
      useSubmitGate({ action: () => Promise.reject(new Error('boom')), errorMessage: '실패' })
    );

    await act(async () => {
      await expect(result.current.submit()).resolves.toBeUndefined();
    });
  });

  it('실패는 로그로 남긴다 (토스트는 mutation 훅이 이미 발행한다)', async () => {
    const { result } = renderHook(() =>
      useSubmitGate({
        action: () => Promise.reject(new Error('boom')),
        errorMessage: '역할 변경 실패',
        context: { workLogId: 'wl-1' },
      })
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mockLoggerError).toHaveBeenCalledWith('역할 변경 실패', expect.any(Error), {
      workLogId: 'wl-1',
    });
  });

  it('인자를 action 과 onSuccess 양쪽에 그대로 넘긴다', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useSubmitGate<[string, number]>({ action, onSuccess, errorMessage: '실패' })
    );

    await act(async () => {
      await result.current.submit('사유', 3);
    });

    expect(action).toHaveBeenCalledWith('사유', 3);
    expect(onSuccess).toHaveBeenCalledWith('사유', 3);
  });
});

describe('진행 중 잠금', () => {
  it('진행 중에는 isSubmitting 이 켜지고 끝나면 꺼진다', async () => {
    const d = deferred();
    const { result } = renderHook(() =>
      useSubmitGate({ action: () => d.promise, errorMessage: '실패' })
    );

    expect(result.current.isSubmitting).toBe(false);

    let submitted!: Promise<void>;
    act(() => {
      submitted = result.current.submit();
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      d.resolve();
      await submitted;
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('🔒 진행 중 재탭은 무시된다 — 같은 틱이라 state 만으로는 못 막는다', async () => {
    const d = deferred();
    const action = jest.fn(() => d.promise);
    const { result } = renderHook(() => useSubmitGate({ action, errorMessage: '실패' }));

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit();
      // 리렌더 전에 바로 한 번 더 — 느린 네트워크에서 사용자가 실제로 하는 행동.
      void result.current.submit();
    });

    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      d.resolve();
      await first;
    });
  });

  it('실패 후에는 다시 제출할 수 있다 (잠금이 걸린 채 남지 않는다)', async () => {
    const action = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useSubmitGate({ action, onSuccess, errorMessage: '실패' }));

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      await result.current.submit();
    });

    expect(action).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
