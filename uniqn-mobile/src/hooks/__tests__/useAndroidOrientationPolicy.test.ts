/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { logger } from '@/utils/logger';
import {
  applyAndroidOrientationLock,
  applyAndroidOrientationPolicy,
  resolveAndroidOrientationPolicy,
  useAndroidOrientationPolicy,
} from '../useAndroidOrientationPolicy';

const { act, create } = require('react-test-renderer') as {
  act: <T>(callback: () => Promise<T> | T) => Promise<T>;
  create: (element: React.ReactElement) => {
    update: (nextElement: React.ReactElement) => void;
    unmount: () => void;
  };
};

const mockWindowDimensions = {
  width: 360,
  height: 800,
  scale: 1,
  fontScale: 1,
};

jest.mock('react-native', () => {
  return {
    Platform: {
      OS: 'android',
      select: jest.fn((config) => config.android ?? config.default ?? config.ios),
    },
    useWindowDimensions: jest.fn(() => mockWindowDimensions),
  };
});

jest.mock('@/constants', () => ({
  ANDROID_COMPLIANCE: {
    LARGE_SCREEN_MIN_WIDTH_DP: 600,
  },
}));

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: {
    PORTRAIT_UP: 'PORTRAIT_UP',
  },
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function TestHarness({ width }: { width: number }) {
  mockWindowDimensions.width = width;
  useAndroidOrientationPolicy();

  return null;
}

describe('useAndroidOrientationPolicy', () => {
  beforeEach(() => {
    mockWindowDimensions.width = 360;
    jest.mocked(ScreenOrientation.lockAsync).mockReset();
    jest.mocked(ScreenOrientation.unlockAsync).mockReset();
    jest.mocked(ScreenOrientation.lockAsync).mockResolvedValue(undefined);
    jest.mocked(ScreenOrientation.unlockAsync).mockResolvedValue(undefined);
    jest.mocked(logger.warn).mockReset();
  });

  it('resolves portrait policy below the Android large-screen threshold', () => {
    expect(resolveAndroidOrientationPolicy(599)).toBe('portrait');
  });

  it('resolves unlocked policy at and above the Android large-screen threshold', () => {
    expect(resolveAndroidOrientationPolicy(600)).toBe('unlocked');
  });

  it('locks portrait orientation for phone-sized Android windows', async () => {
    const appliedPolicy = await applyAndroidOrientationPolicy({
      platformOS: 'android',
      width: 360,
    });

    expect(appliedPolicy).toBe('portrait');
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
  });

  it('unlocks orientation for Android large screens and re-applies on resize', async () => {
    const firstPolicy = await applyAndroidOrientationPolicy({
      platformOS: 'android',
      width: 360,
    });
    const secondPolicy = await applyAndroidOrientationPolicy({
      platformOS: 'android',
      width: 840,
      lastPolicy: firstPolicy,
    });

    expect(firstPolicy).toBe('portrait');
    expect(secondPolicy).toBe('unlocked');
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
  });

  it('skips duplicate native calls when the target policy is already applied', async () => {
    const appliedPolicy = await applyAndroidOrientationLock({
      platformOS: 'android',
      policy: 'portrait',
      lastPolicy: 'portrait',
    });

    expect(appliedPolicy).toBe('portrait');
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
  });

  it('does nothing on iOS', async () => {
    const appliedPolicy = await applyAndroidOrientationPolicy({
      platformOS: 'ios',
      width: 360,
    });

    expect(appliedPolicy).toBeNull();
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
  });

  it('applies the latest policy when the window width changes during an in-flight native request', async () => {
    const deferredLock = createDeferred<void>();
    jest.mocked(ScreenOrientation.lockAsync).mockReturnValueOnce(deferredLock.promise);
    let renderer: ReturnType<typeof create> | null = null;

    await act(async () => {
      renderer = create(React.createElement(TestHarness, { width: 360 }));
      await Promise.resolve();
    });

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer?.update(React.createElement(TestHarness, { width: 840 }));
      await Promise.resolve();
    });

    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();

    await act(async () => {
      deferredLock.resolve(undefined);
      await deferredLock.promise;
      await Promise.resolve();
    });

    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('stops after logging a native orientation failure instead of retrying indefinitely', async () => {
    jest.mocked(ScreenOrientation.lockAsync).mockRejectedValueOnce(new Error('native failure'));
    let renderer: ReturnType<typeof create> | null = null;

    await act(async () => {
      renderer = create(React.createElement(TestHarness, { width: 360 }));
      await Promise.resolve();
    });

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to apply Android orientation policy',
      expect.objectContaining({
        component: 'useAndroidOrientationPolicy',
        width: 360,
        policy: 'portrait',
        error: 'native failure',
      })
    );

    await act(async () => {
      renderer?.unmount();
    });
  });
});
