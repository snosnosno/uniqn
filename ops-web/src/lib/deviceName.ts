/**
 * 이 기기의 이름 — 이력에 "어느 기기에서 한 조작인지" 남기는 참고 정보.
 * 운영자가 직접 붙인 이름("등록데스크 1")을 이 기기에만 저장하고, 없으면 브라우저·OS 로 대신한다.
 * 서버로는 `x-client-info` 헤더 끝에 `device=<base64(UTF-8)>` 로 실어 보낸다 — 헤더에는 한글을 그대로
 * 실을 수 없고, x-client-info 는 supabase-js 가 늘 보내는 헤더라 CORS 허용 목록을 건드리지 않는다.
 * ⚠️ 클라이언트가 보내는 값이라 위조할 수 있다 — 권한·판정에 쓰지 않는다(서버 주석과 같은 계약).
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ops-web:device-name';
/** 서버가 자르는 길이와 같다(ops_events.actor_device 40자). */
export const DEVICE_NAME_MAX = 40;
const listeners = new Set<() => void>();

/** 제어문자를 걷어 내고 앞뒤 공백을 다듬어 40자로 자른다. */
export function normalizeDeviceName(raw: string): string {
  const printable = [...raw].filter((ch) => {
    const code = ch.charCodeAt(0);
    return code > 0x1f && code !== 0x7f;
  });
  // 글자(코드포인트) 단위로 자른다 — UTF-16 단위로 자르면 이모지가 반으로 갈린다.
  return [...printable.join('').trim()].slice(0, DEVICE_NAME_MAX).join('').trim();
}

/** 이름을 정하지 않은 기기의 기본 이름 — "Chrome · Windows" 처럼 브라우저와 OS. */
export function describeDevice(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /SamsungBrowser\//.test(userAgent)
      ? 'Samsung Internet'
      : /Chrome\/|CriOS\//.test(userAgent)
        ? 'Chrome'
        : /Firefox\/|FxiOS\//.test(userAgent)
          ? 'Firefox'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : '브라우저';
  const os = /iPad/.test(userAgent)
    ? 'iPad'
    : /iPhone/.test(userAgent)
      ? 'iPhone'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(userAgent)
            ? 'Mac'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : '기기';
  return `${browser} · ${os}`;
}

function readStored(): string {
  try {
    return normalizeDeviceName(localStorage.getItem(STORAGE_KEY) ?? '');
  } catch {
    return '';
  }
}

let custom = typeof window === 'undefined' ? '' : readStored();

/** 운영자가 붙인 이름(없으면 빈 문자열). */
export function getCustomDeviceName(): string {
  return custom;
}

/** 서버에 보낼 이름 — 붙인 이름이 없으면 브라우저·OS. */
export function getDeviceName(): string {
  if (custom) return custom;
  return typeof navigator === 'undefined' ? '' : describeDevice(navigator.userAgent);
}

export function setCustomDeviceName(next: string): void {
  custom = normalizeDeviceName(next);
  try {
    if (custom) localStorage.setItem(STORAGE_KEY, custom);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장 못 해도 이번 세션에는 적용된다
  }
  listeners.forEach((l) => l());
}

export function useDeviceName(): string {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    getDeviceName,
    () => ''
  );
}

/** UTF-8 → base64(헤더에 실을 수 있는 ASCII). */
export function encodeDeviceName(name: string): string {
  const bytes = new TextEncoder().encode(normalizeDeviceName(name));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** 요청마다 `x-client-info` 끝에 기기 이름을 붙이는 fetch 래퍼. 이름이 없으면 헤더를 건드리지 않는다. */
export function withDeviceInfo(
  base: typeof fetch,
  deviceName: () => string = getDeviceName
): typeof fetch {
  return (input, init) => {
    const name = deviceName();
    if (!name) return base(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    const info = headers.get('x-client-info');
    headers.set('x-client-info', `${info ? `${info}; ` : ''}device=${encodeDeviceName(name)}`);
    return base(input, { ...init, headers });
  };
}
