/** 라이브 운영(ops) 상수. */
import { Platform } from 'react-native';
import { getEnv } from '@/lib/env';

/** ops 웹앱 베이스 URL (브릿지 딥링크). env 미설정/예외 시 prod 기본값. */
export function getOpsBaseUrl(): string {
  try {
    return getEnv().EXPO_PUBLIC_OPS_URL ?? 'https://ops.uniqn.app';
  } catch {
    return 'https://ops.uniqn.app';
  }
}

/**
 * 공개 링크(모니터/플레이어뷰)용 웹 origin.
 * 웹은 실제 서빙 origin(window.location.origin) 우선 — 메인앱/ops.uniqn.app 어디서든 동작(§0.5 B2 경성의존 제거).
 * 네이티브(운영 앱)는 getOpsBaseUrl() 폴백.
 */
export function getOpsWebOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return getOpsBaseUrl();
}

/** 공개 모니터(전광판) URL. */
export function getOpsMonitorUrl(token: string): string {
  return `${getOpsWebOrigin()}/monitor/${token}`;
}
