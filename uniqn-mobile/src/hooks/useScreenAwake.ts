/**
 * 화면 꺼짐 방지 — 웹·네이티브 양쪽 (감사 web-02).
 *
 * ## 왜 두 갈래인가
 * 전광판·플레이어뷰는 대회 내내 켜두는 화면인데 keep-awake 처리가 프로젝트 전체에 0건이었다.
 * OS/브라우저가 몇 분 뒤 화면을 끄면 전광판의 존재 이유가 사라진다.
 *
 * 웹 절반(Screen Wake Lock API)은 CF Pages 배포로 즉시 도달해 먼저 나갔다.
 * 네이티브 절반은 `expo-keep-awake` 라는 **네이티브 모듈**이라 OTA 로 실을 수 없어
 * 1.0.7 스토어 빌드를 기다려야 했다 — 이 훅이 그 나머지 절반을 붙여 하나로 합친 것이다.
 *
 * ## 계약
 * - 호출부는 이 훅 하나만 쓴다. 플랫폼 분기는 여기 안에서 끝난다.
 * - 웹에서 네이티브 경로는 타지 않는다 — `expo-keep-awake` 도 웹에서 같은 Wake Lock API 를
 *   쓰기 때문에, 둘 다 걸면 같은 자원을 두 번 잡고 해제 순서가 꼬인다.
 * - 실패는 삼킨다. 화면 꺼짐 방지가 안 된다고 전광판 표시가 멈춰서는 안 된다.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useWebWakeLock } from './useWebWakeLock';
import { logger } from '@/utils/logger';

/** 화면별로 잠금을 독립 관리하기 위한 태그. 해제할 때 같은 값을 써야 한다. */
const KEEP_AWAKE_TAG = 'uniqn-screen-awake';

function useNativeKeepAwake(enabled: boolean): void {
  useEffect(() => {
    // 웹은 useWebWakeLock 이 담당한다 — 여기서 또 잡으면 이중 잠금이다.
    if (Platform.OS === 'web' || !enabled) {
      return undefined;
    }

    let disposed = false;

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((error: unknown) => {
      logger.info('화면 꺼짐 방지 활성화 실패 — 표시는 계속됩니다', {
        component: 'useScreenAwake',
        data: { message: error instanceof Error ? error.message : String(error) },
      });
    });

    return () => {
      if (disposed) return;
      disposed = true;
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // 이미 해제됐거나 모듈이 없는 경우 — 정리 실패로 화면을 막지 않는다.
      }
    };
  }, [enabled]);
}

/**
 * @param enabled false 면 잠금을 잡지 않는다(예: 아직 데이터를 못 받아 빈 화면일 때).
 * @returns `isSupported` — 웹 Wake Lock API 지원 여부. 네이티브는 항상 지원되므로 true.
 */
export function useScreenAwake(enabled: boolean = true): { isSupported: boolean } {
  const { isSupported: isWebSupported } = useWebWakeLock(enabled);
  useNativeKeepAwake(enabled);

  return { isSupported: Platform.OS === 'web' ? isWebSupported : true };
}
