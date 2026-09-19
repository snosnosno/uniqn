/**
 * useWebWakeLock 회귀 테스트 (감사 web-02, 웹 절반).
 *
 * 고정하려는 계약:
 *  1) 웹에서 화면 잠금을 요청한다
 *  2) 탭이 다시 보이면 **재요청**한다 — 브라우저가 숨김 시 자동 해제하므로 이게 없으면
 *     화면 전환 한 번에 영구히 풀린다(전광판은 대회 내내 켜져 있어야 한다)
 *  3) 미지원 브라우저·요청 거부에서 **터지지 않는다** (기능 저하일 뿐)
 *  4) 언마운트 시 해제한다
 */
import { act, renderHook } from '@testing-library/react-native';

import { useWebWakeLock } from '../useWebWakeLock';

jest.mock('@/utils/platform', () => ({ isWeb: true }));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

type Listener = () => void;

const visibilityListeners: Listener[] = [];

/**
 * jest 는 node 환경이라 document/navigator 가 없다 — 브라우저를 흉내내는 최소 스텁을 깐다.
 * (훅이 typeof 가드로 미선언 식별자를 피하는지도 여기서 함께 지켜진다.)
 */
function installBrowserGlobals() {
  Object.defineProperty(globalThis, 'document', {
    value: {
      visibilityState: 'visible',
      addEventListener: (type: string, listener: Listener) => {
        if (type === 'visibilitychange') visibilityListeners.push(listener);
      },
      removeEventListener: () => undefined,
    },
    configurable: true,
    writable: true,
  });
  if (typeof globalThis.navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });
  }
}

function installWakeLock(options: { reject?: boolean } = {}) {
  const release = jest.fn().mockResolvedValue(undefined);
  const sentinel = {
    released: false,
    release,
    addEventListener: jest.fn(),
  };
  const request = jest.fn(() =>
    options.reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(sentinel)
  );
  Object.defineProperty(globalThis.navigator, 'wakeLock', {
    value: { request },
    configurable: true,
    writable: true,
  });
  return { request, sentinel, release };
}

function removeWakeLock() {
  // @ts-expect-error 테스트에서 지원 미탑재 브라우저를 흉내낸다
  delete globalThis.navigator.wakeLock;
}

function setVisibility(state: 'visible' | 'hidden') {
  (globalThis.document as unknown as { visibilityState: string }).visibilityState = state;
}

beforeEach(() => {
  visibilityListeners.length = 0;
  installBrowserGlobals();
});

afterEach(() => {
  jest.restoreAllMocks();
  removeWakeLock();
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useWebWakeLock', () => {
  it('마운트 시 screen 잠금을 요청한다', async () => {
    const { request } = installWakeLock();
    renderHook(() => useWebWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('enabled=false 면 요청하지 않는다', async () => {
    const { request } = installWakeLock();
    renderHook(() => useWebWakeLock(false));
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('탭이 다시 보이면 재요청한다 (브라우저 자동 해제 복구 — 이 훅의 존재 이유)', async () => {
    const { request, sentinel } = installWakeLock();
    renderHook(() => useWebWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    // 브라우저가 숨김 전환에서 스스로 해제한 상태를 흉내낸다
    sentinel.released = true;
    await act(async () => {
      visibilityListeners.forEach((listener) => listener());
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('숨겨진 탭에서는 요청하지 않는다 (NotAllowedError 회피)', async () => {
    const { request } = installWakeLock();
    setVisibility('hidden');
    renderHook(() => useWebWakeLock(true));
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('미지원 브라우저에서 터지지 않고 isSupported=false 를 준다', async () => {
    removeWakeLock();
    const { result } = renderHook(() => useWebWakeLock(true));
    await flush();
    expect(result.current.isSupported).toBe(false);
  });

  it('요청이 거부돼도 예외를 밖으로 던지지 않는다 (전광판 표시는 계속돼야 한다)', async () => {
    installWakeLock({ reject: true });
    expect(() => renderHook(() => useWebWakeLock(true))).not.toThrow();
    await flush();
  });

  it('언마운트 시 잠금을 해제한다', async () => {
    const { release } = installWakeLock();
    const { unmount } = renderHook(() => useWebWakeLock(true));
    await flush();
    unmount();
    expect(release).toHaveBeenCalled();
  });
});
