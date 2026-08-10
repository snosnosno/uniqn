/**
 * 화면 꺼짐 방지 — 플랫폼 분기 (감사 web-02 네이티브 절반)
 *
 * @description 웹 절반(Screen Wake Lock API)은 CF Pages 로 먼저 나갔고, 네이티브 절반은
 *   `expo-keep-awake` 가 네이티브 모듈이라 1.0.7 빌드를 기다렸다. 이 파일이 고정하는 것은
 *   **둘을 합치되 겹치지 않게** 한다는 계약이다 —
 *   `expo-keep-awake` 도 웹에서는 같은 Wake Lock API 를 쓰므로, 웹에서 양쪽을 다 걸면
 *   같은 자원을 두 번 잡고 해제 순서가 꼬인다.
 */

import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useScreenAwake } from '../useScreenAwake';

const mockActivateKeepAwakeAsync = jest.fn(async (_tag?: string) => undefined);
const mockDeactivateKeepAwake = jest.fn((_tag?: string) => undefined);
const mockUseWebWakeLock = jest.fn((_enabled?: boolean) => ({ isSupported: true }));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag?: string) => mockActivateKeepAwakeAsync(tag),
  deactivateKeepAwake: (tag?: string) => mockDeactivateKeepAwake(tag),
}));

jest.mock('@/hooks/useWebWakeLock', () => ({
  useWebWakeLock: (enabled?: boolean) => mockUseWebWakeLock(enabled),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const originalPlatform = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

afterEach(() => {
  setPlatform(originalPlatform);
  jest.clearAllMocks();
});

describe('useScreenAwake', () => {
  it('네이티브에서 keep-awake 를 활성화한다 (1.0.7 에서 붙은 절반)', () => {
    setPlatform('ios');

    renderHook(() => useScreenAwake(true));

    expect(mockActivateKeepAwakeAsync).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 해제한다 (다른 화면까지 잠금이 새지 않는다)', () => {
    setPlatform('android');

    const { unmount } = renderHook(() => useScreenAwake(true));
    unmount();

    expect(mockDeactivateKeepAwake).toHaveBeenCalledTimes(1);
    // 활성화와 같은 태그로 해제해야 실제로 풀린다
    expect(mockDeactivateKeepAwake).toHaveBeenCalledWith(
      mockActivateKeepAwakeAsync.mock.calls[0]?.[0]
    );
  });

  it('웹에서는 네이티브 경로를 타지 않는다 (이중 잠금 방지)', () => {
    setPlatform('web');

    renderHook(() => useScreenAwake(true));

    expect(mockActivateKeepAwakeAsync).not.toHaveBeenCalled();
    // 웹 절반은 그대로 위임된다
    expect(mockUseWebWakeLock).toHaveBeenCalledWith(true);
  });

  it('enabled=false 면 아무 잠금도 잡지 않는다 (빈 화면에서 켜두지 않는다)', () => {
    setPlatform('ios');

    renderHook(() => useScreenAwake(false));

    expect(mockActivateKeepAwakeAsync).not.toHaveBeenCalled();
    expect(mockUseWebWakeLock).toHaveBeenCalledWith(false);
  });

  it('활성화가 실패해도 던지지 않는다 (전광판 표시가 멈추면 안 된다)', () => {
    setPlatform('ios');
    mockActivateKeepAwakeAsync.mockRejectedValueOnce(new Error('not available'));

    expect(() => renderHook(() => useScreenAwake(true))).not.toThrow();
  });
});
