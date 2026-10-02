import { cn } from 'cn';

export interface ClockStripData {
  /** 레벨 번호. 휴식이면 '휴식', 블라인드 미설정이면 '—'. */
  level: number | string;
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

/**
 * 콘솔 상단 고정 클럭 스트립 — 모든 콘솔 화면에서 항상 보인다(DESIGN.md 레이아웃).
 * `onActivate` 를 주면 스트립 전체가 클럭 제어를 여는 버튼이 된다(모바일: 스트립 탭 → 제어 시트).
 */
export function ClockStrip({
  data,
  onActivate,
  paused = false,
  warning = false,
}: {
  data: ClockStripData;
  onActivate?: () => void;
  /** 일시정지면 남은 시간을 경고색으로(모바일 ClockControl 과 같음). */
  paused?: boolean;
  /** 진행 중 1분 이하 — 레벨이 곧 바뀐다는 주의색. */
  warning?: boolean;
}) {
  const body = <ClockStripCells data={data} paused={paused} warning={warning} />;
  if (onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="block w-full text-left hover:bg-muted/40"
        aria-label={`클럭 제어 열기 — 레벨 ${data.level}, 남은 시간 ${data.remaining}${paused ? ', 일시정지' : ''}${data.connected ? '' : ', 실시간 재연결 중'}`}
      >
        {body}
      </button>
    );
  }
  return (
    <div role="status" aria-label="대회 진행 상태">
      {body}
    </div>
  );
}

function ClockStripCells({
  data,
  paused,
  warning,
}: {
  data: ClockStripData;
  paused: boolean;
  warning: boolean;
}) {
  return (
    <div className="flex items-stretch border-b bg-card">
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
        <span
          className={cn(
            'clock text-[40px] sm:text-[44px]',
            paused ? 'text-destructive' : warning && 'text-warning'
          )}
        >
          {data.remaining}
        </span>
        {/* 폰은 오른쪽 연결 표시가 숨으므로 끊겼을 때만 여기 작게 알린다 */}
        {!data.connected ? (
          <span className="text-[11px] font-semibold text-warning sm:hidden">재연결 중</span>
        ) : null}
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
