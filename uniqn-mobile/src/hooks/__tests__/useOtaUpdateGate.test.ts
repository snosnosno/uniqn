/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { applyPendingOtaUpdate, useOtaUpdateGate } from '../useOtaUpdateGate';

const { act, create } = require('react-test-renderer') as {
  act: <T>(callback: () => Promise<T> | T) => Promise<T>;
  create: (element: React.ReactElement) => {
    update: (nextElement: React.ReactElement) => void;
    unmount: () => void;
  };
};

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

function createController() {
  return {
    checkForUpdateAsync: jest.fn(),
    fetchUpdateAsync: jest.fn(),
    reloadAsync: jest.fn(),
  };
}

describe('applyPendingOtaUpdate', () => {
  it('dev 환경에서는 아무것도 확인하지 않고 skipped를 반환한다', async () => {
    const controller = createController();

    const result = await applyPendingOtaUpdate({
      platformOS: 'ios',
      isDev: true,
      isEnabled: true,
      controller,
    });

    expect(result).toBe('skipped');
    expect(controller.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('웹에서는 skipped를 반환한다', async () => {
    const controller = createController();

    const result = await applyPendingOtaUpdate({
      platformOS: 'web',
      isDev: false,
      isEnabled: true,
      controller,
    });

    expect(result).toBe('skipped');
    expect(controller.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('Updates 비활성(Expo Go 등)이면 skipped를 반환한다', async () => {
    const controller = createController();

    const result = await applyPendingOtaUpdate({
      platformOS: 'android',
      isDev: false,
      isEnabled: false,
      controller,
    });

    expect(result).toBe('skipped');
    expect(controller.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('새 업데이트가 없으면 no-update를 반환하고 리로드하지 않는다', async () => {
    const controller = createController();
    controller.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });

    const result = await applyPendingOtaUpdate({
      platformOS: 'ios',
      isDev: false,
      isEnabled: true,
      controller,
    });

    expect(result).toBe('no-update');
    expect(controller.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(controller.reloadAsync).not.toHaveBeenCalled();
  });

  it('창 안에 다운로드가 끝나면 리로드하고 reloaded를 반환한다', async () => {
    const controller = createController();
    controller.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    controller.fetchUpdateAsync.mockResolvedValue(undefined);
    controller.reloadAsync.mockResolvedValue(undefined);

    const result = await applyPendingOtaUpdate({
      platformOS: 'android',
      isDev: false,
      isEnabled: true,
      windowMs: 1000,
      controller,
    });

    expect(result).toBe('reloaded');
    expect(controller.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('창을 넘기면 timed-out을 반환하고 리로드하지 않는다', async () => {
    const controller = createController();
    controller.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    // 다운로드가 창(10ms)보다 오래 걸리는 상황
    controller.fetchUpdateAsync.mockReturnValue(new Promise(() => undefined));

    const result = await applyPendingOtaUpdate({
      platformOS: 'ios',
      isDev: false,
      isEnabled: true,
      windowMs: 10,
      controller,
    });

    expect(result).toBe('timed-out');
    expect(controller.reloadAsync).not.toHaveBeenCalled();
  });

  it('확인 중 에러가 나면 failed를 반환하고 앱 실행은 계속된다', async () => {
    const controller = createController();
    controller.checkForUpdateAsync.mockRejectedValue(new Error('network down'));

    const result = await applyPendingOtaUpdate({
      platformOS: 'android',
      isDev: false,
      isEnabled: true,
      controller,
    });

    expect(result).toBe('failed');
    expect(controller.reloadAsync).not.toHaveBeenCalled();
  });
});

describe('useOtaUpdateGate', () => {
  it('dev 환경(jest)에서는 Updates 모듈을 호출하지 않는다', async () => {
    const Updates = require('expo-updates') as {
      checkForUpdateAsync: jest.Mock;
    };

    function TestComponent(): null {
      useOtaUpdateGate();
      return null;
    }

    let renderer: { update: (el: React.ReactElement) => void; unmount: () => void } | undefined;
    await act(() => {
      renderer = create(React.createElement(TestComponent));
    });
    // 리렌더에도 재실행되지 않는지 확인
    await act(() => {
      renderer?.update(React.createElement(TestComponent));
    });
    await act(() => {
      renderer?.unmount();
    });

    // __DEV__=true 환경이므로 skipped 경로 — 네이티브 모듈 호출 없음
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });
});
