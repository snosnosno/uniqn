import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { cn } from 'cn';
import { Kbd } from '@/components/ui/kbd';
import { useHotkeyMap } from '@/lib/useHotkey';
import { CONSOLE_TABS, PHONE_TABS, type ConsoleTab } from './tabs';

interface ConsoleShellProps {
  tournamentId: string;
  tab: ConsoleTab;
  header: ReactNode;
  clock: ReactNode;
  /** 탭 라벨 옆 개수(참가 N·스태프 N) */
  counts?: Partial<Record<ConsoleTab, number>>;
  children: ReactNode;
  /** ≥1024 우측 상세 패널(340px). 없으면 본문이 넓어진다. */
  detail?: ReactNode;
}

const tabHref = (id: string, key: ConsoleTab) => `/tournaments/${id}/${key}`;

/**
 * 운영 콘솔 틀 — DESIGN.md 콘솔 레이아웃.
 * ≥1024: 클럭 스트립 → [좌측 레일 168 | 본문 | 우측 상세 340]
 * 640–1023: 클럭 스트립 → 상단 탭 → 본문(상세는 호출부가 시트로)
 * <640: 클럭 스트립 → 본문 → 하단 탭 5 + 더보기
 * 숫자 키 1–7 로 탭 이동(입력 중·대화상자 열림이면 무시 — useHotkey).
 */
export function ConsoleShell({
  tournamentId,
  tab,
  header,
  clock,
  counts = {},
  children,
  detail,
}: ConsoleShellProps) {
  const navigate = useNavigate();
  useHotkeyMap(
    Object.fromEntries(
      CONSOLE_TABS.map((t, i) => [`Digit${i + 1}`, () => navigate(tabHref(tournamentId, t.key))])
    )
  );

  const label = (key: ConsoleTab, text: string) =>
    counts[key] !== undefined ? `${text} ${counts[key]}` : text;

  return (
    <div className="flex h-dvh flex-col">
      {header}
      {clock}
      {/* 640–1023: 상단 탭 */}
      <nav
        aria-label="콘솔 영역"
        className="hidden overflow-x-auto border-b bg-card sm:flex lg:hidden"
      >
        {CONSOLE_TABS.map((t) => (
          <NavLink
            key={t.key}
            to={tabHref(tournamentId, t.key)}
            className={cn(
              'flex h-11 shrink-0 items-center px-4 text-sm font-semibold whitespace-nowrap text-muted-foreground',
              t.key === tab && 'border-b-2 border-primary text-foreground'
            )}
            aria-current={t.key === tab ? 'page' : undefined}
          >
            {label(t.key, t.label)}
          </NavLink>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1">
        {/* ≥1024: 좌측 레일 */}
        <nav
          aria-label="콘솔 영역"
          className="hidden w-[168px] shrink-0 flex-col gap-0.5 border-r bg-card p-2 lg:flex"
        >
          {CONSOLE_TABS.map((t, i) => (
            <NavLink
              key={t.key}
              to={tabHref(tournamentId, t.key)}
              aria-current={t.key === tab ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center justify-between px-3 text-sm font-semibold text-muted-foreground hover:bg-muted',
                t.key === tab && 'bg-muted text-foreground'
              )}
            >
              <span>{label(t.key, t.label)}</span>
              <Kbd>{i + 1}</Kbd>
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        {detail ? (
          <aside
            aria-label="선택 항목 상세"
            className="hidden w-[340px] shrink-0 overflow-auto border-l bg-card lg:block"
          >
            {detail}
          </aside>
        ) : null}
      </div>
      {/* <640: 하단 탭 */}
      <nav aria-label="콘솔 영역" className="grid grid-cols-6 border-t bg-card sm:hidden">
        {PHONE_TABS.map((key) => {
          const t = CONSOLE_TABS.find((x) => x.key === key)!;
          return (
            <NavLink
              key={key}
              to={tabHref(tournamentId, key)}
              aria-current={key === tab ? 'page' : undefined}
              className={cn(
                'flex h-13 flex-col items-center justify-center text-[11px] font-semibold text-muted-foreground',
                key === tab && 'text-foreground shadow-[inset_0_2px_0_var(--primary)]'
              )}
            >
              {t.label}
              {counts[key] !== undefined ? <span className="num">{counts[key]}</span> : null}
            </NavLink>
          );
        })}
        <MoreTabs tournamentId={tournamentId} tab={tab} />
      </nav>
    </div>
  );
}

function MoreTabs({ tournamentId, tab }: { tournamentId: string; tab: ConsoleTab }) {
  const rest = CONSOLE_TABS.filter((t) => !PHONE_TABS.includes(t.key));
  const active = rest.some((t) => t.key === tab);
  // key 로 탭이 바뀌면 다시 마운트 — 이동 뒤에도 메뉴가 열린 채 남지 않게.
  return (
    <details key={tab} className="relative">
      <summary
        className={cn(
          'flex h-13 cursor-pointer list-none flex-col items-center justify-center text-[11px] font-semibold text-muted-foreground',
          active && 'text-foreground shadow-[inset_0_2px_0_var(--primary)]'
        )}
        aria-label="더보기"
      >
        <MoreHorizontal className="size-4" />
        더보기
      </summary>
      <div className="absolute right-0 bottom-full flex w-40 flex-col border bg-popover">
        {rest.map((t) => (
          <NavLink
            key={t.key}
            to={tabHref(tournamentId, t.key)}
            className="flex h-11 items-center px-3 text-sm hover:bg-muted"
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </details>
  );
}
