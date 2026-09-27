import { cn } from 'cn';

export interface ClockStripData {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  remaining: string;
  playersLeft: number;
  playersTotal: number;
  averageStack: number;
  prizePool: number;
  connected: boolean;
}

const fmt = (value: number) => value.toLocaleString('ko-KR');

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col justify-center border-r px-4 py-2.5', className)}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/** 콘솔 상단 고정 클럭 스트립 — 모든 콘솔 화면에서 항상 보인다(DESIGN.md 레이아웃). */
export function ClockStrip({ data }: { data: ClockStripData }) {
  return (
    <div className="flex items-stretch border-b bg-card" role="status" aria-label="대회 진행 상태">
      <Cell
        label="LEVEL"
        className="bg-primary text-primary-foreground [&_.label]:text-primary-foreground/75"
      >
        <span className="num text-xl font-semibold">{data.level}</span>
        {/* 폰(<640): 블라인드 칸이 숨으므로 레벨 칸 아래에 작게 붙인다 */}
        <span className="num text-[11px] whitespace-nowrap sm:hidden">
          {fmt(data.smallBlind)}/{fmt(data.bigBlind)}
        </span>
      </Cell>
      <Cell label="블라인드 · 앤티" className="hidden sm:flex">
        <span className="num text-xl font-semibold whitespace-nowrap">
          {fmt(data.smallBlind)} / {fmt(data.bigBlind)}{' '}
          <span className="text-muted-foreground">({fmt(data.ante)})</span>
        </span>
      </Cell>
      <Cell label="남은 시간" className="flex-1 sm:flex-none">
        <span className="clock text-[40px] sm:text-[44px]">{data.remaining}</span>
      </Cell>
      <Cell label="남은 인원" className="border-r-0 sm:border-r">
        <span className="num text-xl font-semibold whitespace-nowrap">
          {data.playersLeft} <span className="text-muted-foreground">/ {data.playersTotal}</span>
        </span>
      </Cell>
      <Cell label="평균 스택" className="hidden lg:flex">
        <span className="num text-xl font-semibold">{fmt(data.averageStack)}</span>
      </Cell>
      <Cell label="상금 풀" className="hidden xl:flex">
        <span className="num text-xl font-semibold text-prize">{fmt(data.prizePool)}</span>
      </Cell>
      <div className="hidden flex-1 sm:block" />
      <div className="hidden items-center gap-2 px-4 text-[13px] sm:flex">
        <span
          className={cn('size-2 rounded-full', data.connected ? 'bg-success' : 'bg-warning')}
          aria-hidden
        />
        {data.connected ? '실시간 연결' : '재연결 중'}
      </div>
    </div>
  );
}
