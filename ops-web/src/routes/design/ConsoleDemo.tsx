import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { useHotkey } from '@/lib/useHotkey';
import { SAMPLE_PLAYERS, type SamplePlayer } from './sampleData';

const RAIL = ['상태', '참가자', '테이블', '레벨', '상금', '스태프', '이력'] as const;
const STATUS_LABEL = { live: '진행', wait: '좌석 대기', bust: '탈락' } as const;
const STATUS_COLOR = {
  live: 'text-success',
  wait: 'text-warning',
  bust: 'text-destructive',
} as const;

function Chips({ value }: { value: number }) {
  const [head, ...rest] = value.toLocaleString('ko-KR').split(',');
  return (
    <span className="num">
      {head}
      {rest.map((part, index) => (
        <span key={index}>
          <span className="opacity-45">,</span>
          {part}
        </span>
      ))}
    </span>
  );
}

/** 견본 콘솔 — 선택 → 탈락(X) → 확인창(Enter) → 되돌리기 토스트 흐름을 실제 컴포넌트로 보여준다. */
export function ConsoleDemo() {
  const [players, setPlayers] = useState<readonly SamplePlayer[]>(SAMPLE_PLAYERS);
  const [selected, setSelected] = useState('061');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>('044');
  const current = players.find((player) => player.entry === selected);
  const rank = players.filter((player) => player.status !== 'bust').length;

  // X = 탈락. 입력 중·한글 조합 중·Ctrl/Cmd 조합·다른 대화상자 열림이면 무시(useHotkey)
  useHotkey('KeyX', () => setConfirmOpen(true), current?.status === 'live');

  const updateStatus = (entry: string, status: SamplePlayer['status'], note?: string) => {
    setPlayers((prev) => prev.map((p) => (p.entry === entry ? { ...p, status, note } : p)));
    setFlash(entry);
  };

  const bust = () => {
    if (!current) return;
    const entry = current.entry;
    updateStatus(entry, 'bust', `${rank}위`);
    toast(`${current.name} 탈락 · ${rank}위`, {
      duration: 5000,
      action: { label: '되돌리기', onClick: () => updateStatus(entry, 'live') },
    });
  };

  return (
    <div className="grid min-h-[520px] grid-cols-1 border md:grid-cols-[168px_1fr] lg:grid-cols-[168px_1fr_340px]">
      <nav className="hidden flex-col gap-0.5 border-r bg-card p-2 md:flex" aria-label="콘솔 영역">
        {RAIL.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={item === '참가자' ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center rounded-sm px-3 text-left text-[15px]',
              item === '참가자' && 'bg-muted font-bold shadow-[inset_3px_0_0_var(--primary)]'
            )}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="min-w-0 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="label border-b text-left [&>th]:px-3 [&>th]:py-2">
              <th className="hidden sm:table-cell">#</th>
              <th>이름</th>
              <th className="hidden sm:table-cell">좌석</th>
              <th className="text-right">칩</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr
                key={player.entry}
                onClick={() => setSelected(player.entry)}
                onAnimationEnd={() => setFlash(null)}
                className={cn(
                  'h-10 cursor-pointer border-b whitespace-nowrap [&>td]:px-3 max-sm:h-14',
                  player.entry === selected && 'bg-muted shadow-[inset_3px_0_0_var(--primary)]',
                  player.entry === flash && 'motion-color animate-[flash_580ms_var(--ease-snap)]',
                  player.status === 'bust' &&
                    'text-muted-foreground line-through decoration-destructive'
                )}
              >
                <td className="num hidden sm:table-cell">{player.entry}</td>
                <td className={cn(player.entry === selected && 'font-bold')}>
                  {player.name}
                  {/* 폰: # · 좌석 열 대신 이름 아래 한 줄 */}
                  <span className="num block text-[11px] font-normal text-muted-foreground sm:hidden">
                    #{player.entry} · {player.seat}
                  </span>
                </td>
                <td className="num hidden sm:table-cell">{player.seat}</td>
                <td className="text-right">
                  <Chips value={player.chips} />
                </td>
                <td className={cn('text-xs font-semibold', STATUS_COLOR[player.status])}>
                  {STATUS_LABEL[player.status]}
                  {player.note ? ` · ${player.note}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* 폰·태블릿 세로: 상세 패널 대신 하단 고정 주 액션 2개(52px) */}
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-card p-2 lg:hidden">
          <Button
            size="lg"
            variant="destructive"
            disabled={current?.status !== 'live'}
            onClick={() => setConfirmOpen(true)}
          >
            탈락
          </Button>
          <Button size="lg">＋ 등록</Button>
        </div>
      </div>
      {current ? (
        <aside
          className="hidden flex-col gap-3 border-l bg-card p-4 lg:flex"
          aria-label="선택한 참가자"
        >
          <div>
            <div className="label">선택됨 · #{current.entry}</div>
            <div className="text-[22px] font-bold">{current.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-px border bg-border">
            <div className="bg-card p-3">
              <div className="label">좌석</div>
              <div className="num text-lg font-semibold">{current.seat}</div>
            </div>
            <div className="bg-card p-3">
              <div className="label">칩</div>
              <div className="text-lg font-semibold">
                <Chips value={current.chips} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="destructive"
              className="justify-between"
              disabled={current.status !== 'live'}
              onClick={() => setConfirmOpen(true)}
            >
              탈락 <Kbd>X</Kbd>
            </Button>
            <Button size="lg" variant="outline" className="justify-between">
              리바이 <Kbd>R</Kbd>
            </Button>
            <Button size="lg" variant="outline" className="justify-between">
              좌석 이동 <Kbd>M</Kbd>
            </Button>
            <Button size="lg" variant="outline" className="justify-between">
              칩 수정 <Kbd>C</Kbd>
            </Button>
          </div>
        </aside>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${current?.name ?? ''} 탈락 처리`}
        confirmLabel="탈락"
        onConfirm={bust}
      >
        <span className="num">{current?.seat}</span> · 칩{' '}
        <b className="num text-foreground">{current?.chips.toLocaleString('ko-KR')}</b>
        <br />
        순위 <b className="num text-foreground">{rank}위</b> · 상금{' '}
        <b className="text-foreground">없음</b> (ITM 36위부터)
      </ConfirmDialog>
    </div>
  );
}
