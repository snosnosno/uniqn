/** 라이브 운영(ops) 상수. */
import { Platform } from 'react-native';
import { getEnv } from '@/lib/env';

/**
 * ops 전용 웹 origin — 대회 운영 웹(`ops-web/`)이 서빙되는 정본 주소.
 *
 * 이력: 2026-08-07 에는 이 도메인이 만들어지지 않아(DNS 미해석) 메인 웹앱 origin 으로
 * 폴백했었다. ops 웹 개통(W8, 설계 `docs/planning/2026-09-27-ops-web-design.md` §7·§9)으로
 * 공개뷰(`/monitor/*`·`/live/*`)의 정본이 이 도메인으로 옮겨졌다.
 * 옛 링크(`uniqn.app/monitor/*`·`/live/*`)는 `public/_redirects` 의 302 가 이리로 넘긴다.
 *
 * ⚠️ 이 값을 바꾸는 배포는 대상 도메인이 실제로 응답할 때만 나가야 한다 —
 * `scripts/deploy-cloudflare.js` 가 `_redirects` 의 외부 대상을 배포 전에 실측한다.
 */
export const OPS_WEB_ORIGIN = 'https://ops.uniqn.app';

/**
 * ops 공개 링크의 베이스 URL. `EXPO_PUBLIC_OPS_URL` 이 있으면 그 값(탈출구), 없으면 정본.
 */
export function getOpsBaseUrl(): string {
  try {
    return getEnv().EXPO_PUBLIC_OPS_URL ?? OPS_WEB_ORIGIN;
  } catch {
    return OPS_WEB_ORIGIN;
  }
}

/** 로컬 개발 서버 origin 인지 — 개발 중 만든 링크는 자기 서버로 열려야 로컬 DB 토큰이 통한다. */
function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * 공개 링크(모니터/플레이어뷰)용 웹 origin.
 * - 네이티브·운영 웹(uniqn.app 등): ops 정본 도메인(`getOpsBaseUrl`).
 * - 웹 로컬 개발(localhost·127.0.0.1)이고 `EXPO_PUBLIC_OPS_URL` 미설정: 자기 origin.
 *   (로컬 서버의 `/monitor`·`/live` 라우트가 로컬 Supabase 토큰을 해석한다.)
 */
export function getOpsWebOrigin(): string {
  let override: string | undefined;
  try {
    override = getEnv().EXPO_PUBLIC_OPS_URL;
  } catch {
    override = undefined;
  }
  if (override) return override;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (isLocalDevOrigin(origin)) return origin;
  }
  return OPS_WEB_ORIGIN;
}

/** 공개 모니터(전광판) URL. */
export function getOpsMonitorUrl(token: string): string {
  return `${getOpsWebOrigin()}/monitor/${token}`;
}

/** 공개 플레이어뷰 URL(QR 슬립). */
export function getOpsPlayerUrl(token: string): string {
  return `${getOpsWebOrigin()}/live/${token}`;
}
