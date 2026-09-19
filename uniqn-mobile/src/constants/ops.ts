/** 라이브 운영(ops) 상수. */
import { Platform } from 'react-native';
import { APP_WEB_ORIGIN } from '@/constants/appUrl';
import { getEnv } from '@/lib/env';

/**
 * ops 공개 링크의 베이스 URL.
 *
 * 기본값이 **메인 웹앱 origin**(`APP_WEB_ORIGIN`)인 이유: 별도 ops 도메인은
 * 1c 설계에서 "브랜딩용·비차단"으로 잡혔다가 끝내 만들어지지 않았다(2026-08-07 실측:
 * `ops.uniqn.app` DNS 미해석). 공개 라우트(`/monitor/*`·`/live/*`)는 메인 도메인의
 * SPA fallback(`public/_redirects`)으로 이미 서빙되므로 메인 origin 이 유일한 실주소다.
 *
 * 나중에 별도 도메인을 붙이면 `EXPO_PUBLIC_OPS_URL` 만 채우면 된다(탈출구 유지).
 */
export function getOpsBaseUrl(): string {
  try {
    return getEnv().EXPO_PUBLIC_OPS_URL ?? APP_WEB_ORIGIN;
  } catch {
    return APP_WEB_ORIGIN;
  }
}

/**
 * 공개 링크(모니터/플레이어뷰)용 웹 origin.
 * 웹은 실제 서빙 origin(window.location.origin) 우선 — 어느 배포 호스트에서 열어도 그 호스트로 링크가 나간다(§0.5 B2 경성의존 제거).
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

/** 공개 플레이어뷰 URL(QR 슬립). */
export function getOpsPlayerUrl(token: string): string {
  return `${getOpsWebOrigin()}/live/${token}`;
}
