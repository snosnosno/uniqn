/**
 * 공개 전광판 — 시안 A′(2026-09-28 사용자 승인): 제목 가운데 · 양옆 정보는 배경 없이 ·
 * 가운데 초대형 클럭. 프리셋 3종(모바일과 같은 저장값): full(슬롯 좌·상금 우) / mirror(반전) /
 * classic(가운데 클럭 + 하단 슬롯 줄). 세로·좁은 화면은 프리셋과 무관하게 세로로 쌓는다.
 * 항상 다크 · 4초 폴링 · 화면 꺼짐 방지 · 비-PII 스냅샷만(모바일 monitor/[token].tsx).
 */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { cn } from 'cn';
import { resolveMonitorSlots, type ResolvedSlot } from '@/core/components/ops/monitor/registry';
import { parseMonitorConfig, type NextBreakDisplay } from '@/core/domains/ops';
import type { OpsMonitorSnapshot } from '@/core/types/ops';
import { fmt, formatMmSs } from '@/features/console/format';
import { gateOf } from '@/features/public/publicGate';
import { GateNotice, ReconnectingBadge } from '@/features/public/PublicStates';
import { ReportDialog, ReportLink } from '@/features/public/ReportDialog';
import { useMonitorSnapshot, useTrackPublicView } from '@/hooks/public/usePublicViews';
import { useForceDark } from '@/lib/useForceDark';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useScreenAwake } from '@/lib/useScreenAwake';

export function Component() {
  const { token } = useParams();
  useForceDark();
  useTrackPublicView('monitor', token);
  const s = useMonitorSnapshot(token);
  useScreenAwake(!!s.data);
  const [reportOpen, setReportOpen] = useState(false);
  // 세로(폰·세운 모니터)는 세로 스택 — 모바일 isVertical(width<height || width<700)
  const vertical = useMediaQuery('(orientation: portrait), (max-width: 699px)');
  const config = useMemo(() => parseMonitorConfig(s.data?.monitorConfig), [s.data?.monitorConfig]);

  const gate = gateOf({ ...s, hasData: !!s.data });
  if (gate || !s.data) return <GateNotice kind="monitor" gate={gate ?? 'loading'} />;

  const snapshot = s.data;
  const slots = resolveMonitorSlots(config.slots, {
    snapshot,
    nextBreak: s.nextBreak as NextBreakDisplay,
  });
  const showPrize =
    snapshot.payouts.length > 0 ||
    snapshot.stats.prizePool > 0 ||
    snapshot.stats.knockoutPool !== null;
  const hero = (
    <Hero
      snapshot={snapshot}
      remainingSec={s.remainingSec}
      levelMissing={s.levelMissing}
      size={vertical ? 'sm' : config.preset === 'classic' ? 'xl' : 'lg'}
    />
  );
  const layout = vertical ? 'vertical' : config.preset;

  return (
    <main className="relative flex min-h-dvh flex-col px-[3vw] pt-[3vh] pb-2">
      <header className="text-center">
        <h1 className="truncate text-[clamp(24px,2.6vw,56px)] font-extrabold">
          {snapshot.tournament.name}
        </h1>
        {snapshot.tournament.venue ? (
          <p className="label text-[clamp(12px,1vw,20px)]">{snapshot.tournament.venue}</p>
        ) : null}
      </header>
      {s.isDisconnected ? (
        <div className="absolute top-3 right-3">
          <ReconnectingBadge />
        </div>
      ) : null}

      {layout === 'vertical' ? (
        <div className="flex flex-col gap-8 py-6">
          {hero}
          {slots.length ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {slots.map((slot) => (
                <Slot key={slot.id} slot={slot} size="sm" />
              ))}
            </div>
          ) : null}
          {showPrize ? <PrizeColumn snapshot={snapshot} size="sm" /> : null}
        </div>
      ) : layout === 'classic' ? (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center">{hero}</div>
          {slots.length ? (
            <div className="flex justify-around gap-6 border-t pt-[2vh]">
              {slots.map((slot) => (
                <Slot key={slot.id} slot={slot} size="md" align="center" />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-1 items-center gap-[3vw]',
            layout === 'mirror' && 'flex-row-reverse'
          )}
        >
          <div className="flex w-[20%] flex-col gap-[3.5vh]">
            {slots.map((slot) => (
              <Slot key={slot.id} slot={slot} size="md" />
            ))}
          </div>
          <div className="flex flex-1 justify-center">{hero}</div>
          <div className="w-[22%]">
            {showPrize ? <PrizeColumn snapshot={snapshot} size="md" /> : null}
          </div>
        </div>
      )}

      <ReportLink onClick={() => setReportOpen(true)} />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        tokenKind="monitor"
        token={token ?? ''}
      />
    </main>
  );
}

const CLOCK_SIZE = {
  sm: 'text-[clamp(88px,30vw,200px)]',
  lg: 'text-[min(16vw,30vh)]',
  xl: 'text-[min(24vw,42vh)]',
} as const;

function Hero({
  snapshot,
  remainingSec,
  levelMissing,
  size,
}: {
  snapshot: OpsMonitorSnapshot;
  remainingSec: number;
  levelMissing: boolean;
  size: keyof typeof CLOCK_SIZE;
}) {
  const { clock, currentLevel: level, nextLevel } = snapshot;
  const paused = !clock.isRunning && clock.pausedRemainingSec !== null;
  const status = level?.isBreak
    ? '휴식'
    : clock.isRunning
      ? null
      : paused
        ? '일시정지'
        : levelMissing
          ? '레벨 정보 없음'
          : '시작 전';
  const big = size !== 'sm';
  return (
    <section aria-label="클럭" className="flex flex-col items-center text-center">
      <p
        className={cn(
          'bg-primary px-[1.2em] py-[0.15em] font-extrabold text-primary-foreground',
          big ? 'text-[clamp(18px,1.8vw,40px)]' : 'text-lg'
        )}
      >
        {level?.isBreak ? 'BREAK' : `LEVEL ${level?.level ?? '-'}`}
        {status && !level?.isBreak ? ` · ${status}` : ''}
      </p>
      <p
        className={cn('clock my-[0.08em]', CLOCK_SIZE[size], paused && 'text-destructive')}
        aria-label={`남은 시간 ${formatMmSs(remainingSec)}`}
      >
        {formatMmSs(remainingSec)}
      </p>
      {level?.isBreak ? (
        <p className="text-[clamp(28px,3.4vw,72px)] font-bold">휴식 시간</p>
      ) : level ? (
        <p className="num text-[clamp(28px,3.4vw,72px)] font-bold">
          {fmt(level.smallBlind)} / {fmt(level.bigBlind)}
          {level.ante > 0 ? (
            <span className="text-muted-foreground"> ({fmt(level.ante)})</span>
          ) : null}
        </p>
      ) : (
        <p className="text-muted-foreground">블라인드 정보를 불러오는 중…</p>
      )}
      <p className="num label mt-[0.6em] text-[clamp(14px,1.4vw,30px)]">
        {nextLevel
          ? nextLevel.isBreak
            ? '다음 · 휴식'
            : `다음 ${fmt(nextLevel.smallBlind)} / ${fmt(nextLevel.bigBlind)}`
          : '다음 레벨 없음 (마지막)'}
      </p>
    </section>
  );
}

const HANGUL = /[가-힣]/;

const SLOT_SIZE = {
  sm: { label: 'text-sm', value: 'text-2xl break-words' },
  md: {
    label: 'text-[clamp(13px,1.05vw,22px)]',
    value: 'text-[clamp(22px,2vw,44px)] whitespace-nowrap',
  },
} as const;

/** 슬롯 — 배경 없이 라벨 + 값(A′). 골드는 상금 금액 전용. */
function Slot({
  slot,
  size,
  align,
}: {
  slot: ResolvedSlot;
  size: keyof typeof SLOT_SIZE;
  align?: 'center';
}) {
  return (
    <div className={cn(align === 'center' && 'text-center')}>
      <p className={cn('label', SLOT_SIZE[size].label)}>{slot.label}</p>
      <p
        className={cn(
          // 한글 값(등록 진행 중 등)은 본문 폰트 — 고정폭 숫자 폰트는 한글 간격이 벌어져 줄이 꺾인다
          HANGUL.test(slot.value) ? 'font-extrabold' : 'num font-bold',
          'leading-tight',
          SLOT_SIZE[size].value,
          slot.tone === 'gold' && 'text-prize'
        )}
      >
        {slot.value}
      </p>
    </div>
  );
}

/** 상금 — PRIZE POOL(골드) + 상위 5위 + KO 풀(조건부). 배경 없이(A′). */
function PrizeColumn({ snapshot, size }: { snapshot: OpsMonitorSnapshot; size: 'sm' | 'md' }) {
  const { prizePool, knockoutPool } = snapshot.stats;
  const row = size === 'md' ? 'text-[clamp(16px,1.5vw,32px)] py-[0.4em]' : 'text-lg py-1';
  return (
    <section aria-label="상금">
      <p className={cn('label', SLOT_SIZE[size].label)}>PRIZE POOL</p>
      <p
        className={cn(
          'num leading-tight font-bold text-prize',
          size === 'md' ? 'text-[clamp(30px,2.9vw,60px)]' : 'text-4xl'
        )}
      >
        {fmt(prizePool)}
      </p>
      <div className="mt-[0.6em]">
        {snapshot.payouts.map((p) => (
          <div key={p.position} className={cn('flex justify-between', row)}>
            <span className="num text-muted-foreground">{p.position}위</span>
            <span className="num text-prize">{fmt(p.amount)}</span>
          </div>
        ))}
        {knockoutPool !== null ? (
          <div className={cn('flex justify-between border-t', row)}>
            <span className="label">KO POOL</span>
            <span className="num text-prize">{fmt(knockoutPool)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
