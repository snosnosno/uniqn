/**
 * 공개 플레이어뷰 — 시안 B(2026-09-28 사용자 승인): 라임 클럭 머리줄 상단 고정 + 내 정보 표.
 * 본인 안전 필드만(타 참가자·연락처·토큰 미노출) · 4초 폴링 · 모바일 live/[view_token].tsx 동등.
 * 테마는 사용자 설정을 따른다(전광판만 다크 고정). 라임 머리줄 글자는 검정(라이트에서도 대비 확보).
 */
import { useState } from 'react';
import { useParams } from 'react-router';
import { cn } from 'cn';
import { formatHms } from '@/core/domains/ops';
import type { OpsPlayerView } from '@/core/types/ops';
import { fmt, formatBb, formatMmSs } from '@/features/console/format';
import { ClaimSection } from '@/features/public/ClaimSection';
import { gateOf } from '@/features/public/publicGate';
import { GateNotice, ReconnectingBadge } from '@/features/public/PublicStates';
import { ReportDialog, ReportLink } from '@/features/public/ReportDialog';
import { usePlayerView, useTrackPublicView } from '@/hooks/public/usePublicViews';

const STATUS_LABEL: Record<string, string> = {
  registered: '등록',
  checked_in: '체크인',
  active: '진행 중',
  busted: '탈락',
  no_show: '불참',
};

export function Component() {
  const { viewToken } = useParams();
  useTrackPublicView('player', viewToken);
  const s = usePlayerView(viewToken);
  const [reportOpen, setReportOpen] = useState(false);

  const gate = gateOf({ ...s, hasData: !!s.data });
  if (gate || !s.data) return <GateNotice kind="player" gate={gate ?? 'loading'} />;
  const view = s.data;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col">
      <ClockHeader view={view} remainingSec={s.remainingSec} nextBreak={s.nextBreak} />
      {s.isDisconnected ? (
        <div className="px-[18px] pt-3">
          <ReconnectingBadge />
        </div>
      ) : null}
      <div className="px-[18px] pt-4 pb-2">
        <p className="label">{view.tournament.venue ?? 'UNIQN OPS'}</p>
        <h1 className="truncate text-lg font-bold">{view.tournament.name}</h1>
        {/* 비가역 계정 연결 직전에 본인 기록인지 확인할 단서 — 슬립이 뒤바뀌었을 때(리뷰 W7) */}
        <p className="mt-1 text-base font-semibold">
          <span className="num text-muted-foreground">#{view.me.entryNumber}</span> {view.me.name}
        </p>
      </div>
      <InfoTable view={view} />
      <ClaimSection token={viewToken ?? ''} who={`#${view.me.entryNumber} ${view.me.name}`} />
      <ReportLink onClick={() => setReportOpen(true)} />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        tokenKind="player"
        token={viewToken ?? ''}
      />
    </main>
  );
}

function ClockHeader({
  view,
  remainingSec,
  nextBreak,
}: {
  view: OpsPlayerView;
  remainingSec: number;
  nextBreak: ReturnType<typeof usePlayerView>['nextBreak'];
}) {
  const level = view.currentLevel;
  const paused = !view.clock.isRunning && view.clock.pausedRemainingSec !== null;
  return (
    <header className="sticky top-0 z-10 bg-primary px-[18px] pt-3 pb-3 text-primary-foreground">
      <div className="flex items-baseline justify-between">
        <b>{level?.isBreak ? 'BREAK' : `LEVEL ${level?.level ?? '-'}`}</b>
        <span className="num text-sm">
          {level && !level.isBreak
            ? `${fmt(level.smallBlind)} / ${fmt(level.bigBlind)}${level.ante > 0 ? ` (${fmt(level.ante)})` : ''}`
            : level?.isBreak
              ? '휴식 시간'
              : ''}
        </span>
      </div>
      <p
        className="clock text-center text-[96px]"
        aria-label={`남은 시간 ${formatMmSs(remainingSec)}`}
      >
        {formatMmSs(remainingSec)}
      </p>
      <p className="num text-center text-xs">
        {paused ? '일시정지 · ' : ''}
        {nextBreak.kind === 'until' ? `브레이크까지 ${formatHms(nextBreak.remainingSec)}` : ''}
        {nextBreak.kind === 'inBreak' ? '지금은 휴식 시간' : ''}
      </p>
    </header>
  );
}

function InfoTable({ view }: { view: OpsPlayerView }) {
  const { me, currentLevel, stats } = view;
  const bb =
    currentLevel && !currentLevel.isBreak && currentLevel.bigBlind > 0
      ? me.chips / currentLevel.bigBlind
      : null;
  const rows: [string, string][] = [
    [
      '내 자리',
      me.tableNo !== null && me.seatNo !== null ? `T${me.tableNo} · ${me.seatNo}번` : '배정 전',
    ],
    ['내 스택', fmt(me.chips)],
    ...(bb !== null ? ([['BB', formatBb(bb)]] as [string, string][]) : []),
    [
      '리바이 / 애드온',
      `${me.rebuys} / ${me.addOns}${me.reentries > 0 ? ` · 재입장 ${me.reentries}` : ''}`,
    ],
    ['상태', STATUS_LABEL[me.status] ?? me.status],
    ...(me.status === 'busted' && me.finishPosition !== null
      ? ([
          [
            '순위',
            `${me.finishPosition}위${me.prizeAmount !== null ? ` · 상금 ${fmt(me.prizeAmount)}` : ''}`,
          ],
        ] as [string, string][])
      : []),
    ...(me.bountyAccrued !== null
      ? ([['KO · 바운티', `${me.knockouts} · ${fmt(me.bountyAccrued)}원`]] as [string, string][])
      : []),
    ['남은 인원', `${fmt(stats.playing)} / ${fmt(stats.entries)}`],
    ['평균 스택', fmt(stats.averageStack)],
  ];
  return (
    <table className="w-full border-collapse text-base">
      <caption className="sr-only">
        #{me.entryNumber} {me.name} 님의 대회 정보
      </caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="h-[52px] border-b">
            <th scope="row" className="px-[18px] text-left font-normal text-muted-foreground">
              {k}
            </th>
            <td
              className={cn(
                'px-[18px] text-right font-bold',
                // 한글 값은 본문 폰트 — 고정폭 숫자 폰트는 한글 간격이 벌어진다
                /[가-힣]/.test(v) ? '' : 'num'
              )}
            >
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
