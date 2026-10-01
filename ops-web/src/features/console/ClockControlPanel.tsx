import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { cn } from 'cn';
import { LoadError, Loading } from '@/components/ops/LoadState';
import { Button } from '@/components/ui/button';
import { formatHms } from '@/core/domains/ops';
import {
  useAdjustClock,
  usePauseClock,
  useSetLevel,
  useStartClock,
} from '@/hooks/ops/useConsoleMutations';
import { opsKeys } from '@/hooks/ops/keys';
import type { useOpsClock } from '@/hooks/ops/useConsoleQueries';
import { clockView, parseClockInput } from './clock';
import { fmt, formatMmSs } from './format';

type ClockState = ReturnType<typeof useOpsClock>;

/** 클럭 제어 — 모바일 ClockControl 과 같은 동작(이전/시작·일시정지/다음 · ±1분 · 다음 레벨·브레이크). */
export function ClockControlPanel({
  tournamentId,
  clock,
}: {
  tournamentId: string;
  clock: ClockState;
}) {
  const start = useStartClock(tournamentId);
  const pause = usePauseClock(tournamentId);
  const setLevel = useSetLevel(tournamentId);
  const adjust = useAdjustClock(tournamentId);
  const busy = start.isPending || pause.isPending || setLevel.isPending || adjust.isPending;
  const qc = useQueryClient();
  const onRetry = () => {
    void qc.invalidateQueries({ queryKey: opsKeys.clock(tournamentId) });
    void qc.invalidateQueries({ queryKey: opsKeys.blindLevels(tournamentId) });
  };

  if (clock.isPending) return <Loading label="클럭을 불러오는 중…" />;
  if (clock.error && clock.blindLevels.length === 0) {
    return (
      <LoadError title="클럭 정보를 불러오지 못했어요" error={clock.error} onRetry={onRetry} />
    );
  }
  if (clock.blindLevels.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="font-semibold">블라인드 구조가 아직 없어요</p>
        <p className="text-sm text-muted-foreground">
          클럭을 시작하려면 블라인드 탭에서 구조를 먼저 설정하세요.
        </p>
        <Button asChild variant="outline" className="h-11 self-start">
          <Link to={`/tournaments/${tournamentId}/levels`}>블라인드 설정하러 가기</Link>
        </Button>
      </div>
    );
  }

  const v = clockView(clock.clock, clock.blindLevels, clock.remainingSec, clock.levelMissing);
  const current = clock.currentLevel;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold">
          {current?.isBreak ? '휴식' : `LEVEL ${current?.level ?? '-'}`}
        </span>
        <span className="label">· {v.statusLabel}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="h-13 w-16"
          disabled={busy}
          onClick={() => adjust.mutate(-60)}
          aria-label="1분 단축"
        >
          −1분
        </Button>
        <span
          className={cn('clock text-[56px]', v.isPaused && 'text-destructive')}
          aria-label={`남은 시간 ${formatMmSs(clock.remainingSec)}`}
        >
          {formatMmSs(clock.remainingSec)}
        </span>
        <Button
          variant="outline"
          className="h-13 w-16"
          disabled={busy}
          onClick={() => adjust.mutate(60)}
          aria-label="1분 추가"
        >
          +1분
        </Button>
      </div>

      {/* 시작 전에는 남은 시간 개념이 없다(서버가 일시정지 상태를 새로 만든다) — 진행·일시정지에서만 */}
      {v.isRunning || v.isPaused ? (
        <SeekForm disabled={busy} onSeek={(target) => adjust.mutate(target - clock.remainingSec)} />
      ) : null}

      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={!v.hasPrev || busy}
          onClick={() => setLevel.mutate(v.currentSort - 1)}
          aria-label="이전 레벨로 이동"
        >
          <ChevronLeft /> 이전
        </Button>
        <Button
          size="lg"
          disabled={busy}
          onClick={() => (v.isRunning ? pause.mutate() : start.mutate())}
          aria-label={`클럭 ${v.playLabel}`}
        >
          {v.isRunning ? <Pause /> : <Play />} {v.playLabel}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={!v.hasNext || busy}
          onClick={() => setLevel.mutate(v.currentSort + 1)}
          aria-label="다음 레벨로 이동"
        >
          다음 <ChevronRight />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-px border bg-border text-sm">
        <div className="bg-card p-3">
          <dt className="label">현재</dt>
          <dd className="num font-semibold">
            {current?.isBreak
              ? '휴식 시간'
              : current
                ? `${fmt(current.smallBlind)} / ${fmt(current.bigBlind)}${current.ante > 0 ? ` · 앤티 ${fmt(current.ante)}` : ''}`
                : '현재 레벨 정보를 찾을 수 없어요'}
          </dd>
        </div>
        <div className="bg-card p-3">
          <dt className="label">다음</dt>
          <dd className="num font-semibold">
            {v.nextLevel
              ? v.nextLevel.isBreak
                ? '휴식'
                : `${fmt(v.nextLevel.smallBlind)} / ${fmt(v.nextLevel.bigBlind)}`
              : '마지막 레벨'}
          </dd>
        </div>
        {v.breakCountdownSec !== null ? (
          <div className="col-span-2 bg-card p-3">
            <dt className="label">다음 브레이크까지</dt>
            <dd className="num font-semibold">{formatHms(v.breakCountdownSec)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** 남은 시간 직접 맞추기 — 입력값과 지금 남은 시간의 차이만큼 기존 보정 RPC 로 증감한다. */
function SeekForm({
  disabled,
  onSeek,
}: {
  disabled: boolean;
  onSeek: (targetSec: number) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const target = parseClockInput(value);
        if (target === null) {
          setError('12:30 처럼 분:초로 입력하세요(최대 99:59)');
          return;
        }
        onSeek(target);
        setValue('');
        setError(null);
      }}
    >
      <label htmlFor="clock-seek" className="text-sm">
        남은 시간 맞추기
      </label>
      <input
        id="clock-seek"
        inputMode="numeric"
        placeholder="12:30"
        value={value}
        onChange={(e) => (setValue(e.target.value), setError(null))}
        aria-invalid={error !== null}
        aria-describedby={error ? 'clock-seek-error' : undefined}
        className="num h-11 w-24 rounded-lg border border-input bg-background px-2 dark:bg-input/30"
      />
      <Button type="submit" variant="outline" className="h-11" disabled={disabled || !value.trim()}>
        적용
      </Button>
      {error ? (
        <span id="clock-seek-error" role="alert" className="w-full text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
