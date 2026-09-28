/** 라이브 운영(ops) 상수. */
import { Platform } from 'react-native';
import { APP_WEB_ORIGIN } from '@/constants/appUrl';
import { getEnv } from '@/lib/env';

/**
 * EXPO_PUBLIC_OPS_URL — 미설정이거나 env 초기화 전이면 null.
 * 끝 슬래시는 뗀다(`https://ops.uniqn.app/` 도 url 검증을 통과해 `//monitor/…` 링크가 되므로).
 */
function getConfiguredOpsUrl(): string | null {
  try {
    return getEnv().EXPO_PUBLIC_OPS_URL?.replace(/\/+$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * ops 공개 링크의 베이스 URL.
 *
 * 공개뷰(`/monitor/*`·`/live/*`)는 ops.uniqn.app(ops-web)이 서빙한다 — `EXPO_PUBLIC_OPS_URL`
 * 을 그 도메인으로 설정해 쓴다(설계 docs/planning/2026-09-27-ops-web-design.md §7).
 * 미설정 폴백은 **메인 웹앱 origin**(`APP_WEB_ORIGIN`): 옛 링크는 메인 도메인의
 * `public/_redirects` 가 ops.uniqn.app 으로 302 하므로 폴백 링크도 끊기지 않는다.
 */
export function getOpsBaseUrl(): string {
  return getConfiguredOpsUrl() ?? APP_WEB_ORIGIN;
}

/**
 * 공개 링크(모니터/플레이어뷰)용 웹 origin.
 * 1순위 EXPO_PUBLIC_OPS_URL — 공개뷰가 ops.uniqn.app(ops-web)으로 옮겨 가면서 웹도 그 도메인으로 링크를 만든다.
 * 미설정이면 웹은 실제 서빙 origin(window.location.origin) — 어느 배포 호스트에서 열어도 그 호스트로 링크가 나간다(§0.5 B2 경성의존 제거).
 * 네이티브(운영 앱)는 getOpsBaseUrl() 폴백.
 */
export function getOpsWebOrigin(): string {
  const configured = getConfiguredOpsUrl();
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return getOpsBaseUrl();
}

/** 공개 모니터(전광판) URL. */
export function getOpsMonitorUrl(token: string): string {
  return `${getOpsWebOrigin()}/monitor/${token}`;
}

/** 공개 플레이어뷰 URL(QR 슬립). */
export function getOpsPlayerUrl(token: string): string {
  return `${getOpsWebOrigin()}/live/${token}`;
}
