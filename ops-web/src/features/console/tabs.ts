/** 콘솔 탭 — 모바일 OpsConsoleShell 과 같은 키·순서(폰 5 + 더보기 2, 태블릿 7). */
export const CONSOLE_TABS = [
  { key: 'status', label: '현황' },
  { key: 'tables', label: '테이블' },
  { key: 'players', label: '참가' },
  { key: 'levels', label: '블라인드' },
  { key: 'staff', label: '스태프' },
  { key: 'payouts', label: '상금' },
  { key: 'history', label: '이력' },
] as const;

export type ConsoleTab = (typeof CONSOLE_TABS)[number]['key'];

/** 폰 하단 탭 5개 — 나머지는 더보기. */
export const PHONE_TABS: readonly ConsoleTab[] = ['status', 'tables', 'players', 'levels', 'staff'];

export function parseConsoleTab(raw: string | undefined): ConsoleTab {
  return CONSOLE_TABS.some((t) => t.key === raw) ? (raw as ConsoleTab) : 'status';
}
