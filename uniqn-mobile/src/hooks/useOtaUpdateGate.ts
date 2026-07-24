import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { logger } from '@/utils/logger';

/**
 * OTA 적용 대기 창(ms).
 * 이 시간 안에 다운로드가 끝나면 즉시 리로드해 첫 세션부터 최신 코드를 쓰고,
 * 넘기면 리로드 없이 백그라운드 다운로드만 이어져 다음 콜드 스타트에 적용된다.
 */
const OTA_APPLY_WINDOW_MS = 5000;

type UpdatesController = Pick<
  typeof Updates,
  'checkForUpdateAsync' | 'fetchUpdateAsync' | 'reloadAsync'
>;

export type OtaApplyResult = 'skipped' | 'no-update' | 'reloaded' | 'timed-out' | 'failed';

const TIMED_OUT = Symbol('ota-timed-out');

export async function applyPendingOtaUpdate({
  platformOS,
  isDev,
  isEnabled,
  windowMs = OTA_APPLY_WINDOW_MS,
  controller = Updates,
}: {
  platformOS: string;
  isDev: boolean;
  isEnabled: boolean;
  windowMs?: number;
  controller?: UpdatesController;
}): Promise<OtaApplyResult> {
  // 웹은 정적 배포라 OTA 대상이 아니고, dev/Expo Go에서는 Updates 모듈이 비활성이다.
  if (isDev || platformOS === 'web' || !isEnabled) {
    return 'skipped';
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const download = (async (): Promise<'no-update' | 'fetched'> => {
      const check = await controller.checkForUpdateAsync();
      if (!check.isAvailable) {
        return 'no-update';
      }
      await controller.fetchUpdateAsync();
      return 'fetched';
    })();

    const raced = await Promise.race([
      download,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), windowMs);
      }),
    ]);

    if (raced === TIMED_OUT) {
      // 다운로드는 취소되지 않고 계속되며, 완료분은 다음 콜드 스타트에 적용된다.
      logger.info('OTA 적용 창 초과 — 다음 실행 시 적용', {
        component: 'useOtaUpdateGate',
        windowMs,
      });
      return 'timed-out';
    }

    if (raced === 'no-update') {
      return 'no-update';
    }

    await controller.reloadAsync();
    return 'reloaded';
  } catch (error) {
    logger.warn('OTA 확인 실패 — 다음 실행 시 적용', {
      component: 'useOtaUpdateGate',
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * 앱 시작 직후 대기 중인 OTA 업데이트를 확인해 짧은 창 안에 받히면 즉시 리로드한다.
 * 신규 설치 사용자(내장 번들로 첫 실행)도 첫 세션에서 최신 OTA 코드를 받게 하는 게이트.
 */
export function useOtaUpdateGate(): void {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;

    void applyPendingOtaUpdate({
      platformOS: Platform.OS,
      isDev: __DEV__,
      isEnabled: Updates.isEnabled,
    });
  }, []);
}

export default useOtaUpdateGate;
