import { useSyncExternalStore } from 'react';

/**
 * 테마 — 다크가 기본(DESIGN.md). 라이트는 사용자가 고를 때만.
 * next-themes 대신 직접 둔다: 이 앱은 <html data-theme> 한 속성만 쓰고, 인라인 스크립트 없이
 * (CSP script-src 'self') index.html 이 이미 data-theme="dark" 로 시작한다.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ops-web:theme';
const listeners = new Set<() => void>();

export function parseStoredTheme(value: string | null): Theme {
  return value === 'light' ? 'light' : 'dark';
}

function readStored(): Theme {
  try {
    return parseStoredTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

function currentTheme(): Theme {
  return parseStoredTheme(document.documentElement.dataset.theme ?? null);
}

/** 앱 시작 시 한 번 — 저장된 선호를 <html> 에 반영한다. */
export function applyStoredTheme(): void {
  document.documentElement.dataset.theme = readStored();
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 이번 세션에만 적용된다.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'dark' as const);
  return { theme, setTheme };
}
