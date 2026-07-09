import { useEffect, useMemo, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ANDROID_COMPLIANCE } from '@/constants';
import { logger } from '@/utils/logger';

export type AndroidOrientationPolicy = 'portrait' | 'unlocked';
type OrientationController = Pick<typeof ScreenOrientation, 'lockAsync' | 'unlockAsync'>;

export function resolveAndroidOrientationPolicy(width: number): AndroidOrientationPolicy {
  return width >= ANDROID_COMPLIANCE.LARGE_SCREEN_MIN_WIDTH_DP ? 'unlocked' : 'portrait';
}

export async function applyAndroidOrientationLock({
  platformOS,
  policy,
  lastPolicy = null,
  controller = ScreenOrientation,
}: {
  platformOS: string;
  policy: AndroidOrientationPolicy;
  lastPolicy?: AndroidOrientationPolicy | null;
  controller?: OrientationController;
}) {
  if (platformOS !== 'android') {
    return lastPolicy;
  }

  if (lastPolicy === policy) {
    return lastPolicy;
  }

  if (policy === 'portrait') {
    await controller.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return policy;
  }

  await controller.unlockAsync();
  return policy;
}

export async function applyAndroidOrientationPolicy({
  platformOS,
  width,
  lastPolicy = null,
  controller = ScreenOrientation,
}: {
  platformOS: string;
  width: number;
  lastPolicy?: AndroidOrientationPolicy | null;
  controller?: OrientationController;
}) {
  if (platformOS !== 'android' || width <= 0) {
    return lastPolicy;
  }

  return applyAndroidOrientationLock({
    platformOS,
    policy: resolveAndroidOrientationPolicy(width),
    lastPolicy,
    controller,
  });
}

export function useAndroidOrientationPolicy() {
  const { width } = useWindowDimensions();
  const isMountedRef = useRef(true);
  const latestWidthRef = useRef(width);
  const appliedPolicyRef = useRef<AndroidOrientationPolicy | null>(null);
  const desiredPolicyRef = useRef<AndroidOrientationPolicy | null>(null);
  const isApplyingRef = useRef(false);
  const pendingPolicyChangeRef = useRef(false);
  const nextPolicy = useMemo(() => {
    if (width <= 0) {
      return null;
    }

    return resolveAndroidOrientationPolicy(width);
  }, [width]);

  useEffect(() => {
    latestWidthRef.current = width;
  }, [width]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !nextPolicy) {
      return;
    }

    desiredPolicyRef.current = nextPolicy;

    const flushOrientationPolicy = async () => {
      if (!isMountedRef.current) {
        return;
      }

      if (isApplyingRef.current) {
        pendingPolicyChangeRef.current = true;
        return;
      }

      isApplyingRef.current = true;
      pendingPolicyChangeRef.current = false;

      try {
        while (
          isMountedRef.current &&
          desiredPolicyRef.current &&
          appliedPolicyRef.current !== desiredPolicyRef.current
        ) {
          const targetPolicy = desiredPolicyRef.current;
          const appliedPolicy = await applyAndroidOrientationLock({
            platformOS: Platform.OS,
            policy: targetPolicy,
            lastPolicy: appliedPolicyRef.current,
          });

          if (!isMountedRef.current) {
            return;
          }

          appliedPolicyRef.current = appliedPolicy;
        }
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        logger.warn('Failed to apply Android orientation policy', {
          component: 'useAndroidOrientationPolicy',
          width: latestWidthRef.current,
          policy: desiredPolicyRef.current ?? nextPolicy,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        isApplyingRef.current = false;

        if (
          isMountedRef.current &&
          pendingPolicyChangeRef.current &&
          desiredPolicyRef.current &&
          appliedPolicyRef.current !== desiredPolicyRef.current
        ) {
          void flushOrientationPolicy();
        }
      }
    };

    void flushOrientationPolicy();
  }, [nextPolicy]);
}
