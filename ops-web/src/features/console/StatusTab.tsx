import { useState } from 'react';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { Button } from '@/components/ui/button';
import type { OpsLiveStats, OpsTournament } from '@/core/types/ops';
import { useSetTournamentStatus, useToggleRegistration } from '@/hooks/ops/useConsoleMutations';
import type { useOpsClock } from '@/hooks/ops/useConsoleQueries';
import { ClockControlPanel } from './ClockControlPanel';
import { fmt, formatBb } from './format';

/** 현황 탭 상태 라벨(모바일 OpsStatusTab — 목록의 '예정'과 달리 '시작 전'). */
const STATUS_LABEL: Record<OpsTournament['status'], string> = {
  upcoming: '시작 전',
  active: '진행 중',
  completed: '종료',
};

/**
 * 현황 — 모바일 OpsStatusTab: 클럭 제어 · 라이브 통계 · 등록 토글(완료 대회 숨김) · 상태 전환(한 방향).
 * 웹은 **대회 종료에 확인창**을 둔다(되돌릴 수 없는 전환 — DESIGN.md 확인창 규칙). 모바일은 즉시.
 */
export function StatusTab({
  tournament,
  stats,
  clock,
}: {
  tournament: OpsTournament;
  stats: OpsLiveStats | null;
  clock: ReturnType<typeof useOpsClock>;
}) {
  const toggle = useToggleRegistration(tournament.id);
  const setStatus = useSetTournamentStatus(tournament.id);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const isCompleted = tournament.status === 'completed';

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,420px)_1fr]">
      <section aria-label="클럭" className="border bg-card">
        {isCompleted ? (
          <p className="p-4 text-sm text-muted-foreground">종료된 대회예요.</p>
        ) : (
          <ClockControlPanel tournamentId={tournament.id} clock={clock} />
        )}
      </section>

      <div className="flex flex-col gap-4">
        <LiveStatsGrid stats={stats} />

        <section aria-label="대회 상태" className="flex flex-col gap-3 border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label">상태</span>
            <span className="font-semibold">{STATUS_LABEL[tournament.status]}</span>
            {tournament.status === 'upcoming' ? (
              <Button
                size="lg"
                className="ml-auto"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate('active')}
              >
                대회 시작
              </Button>
            ) : null}
            {tournament.status === 'active' ? (
              <Button
                size="lg"
                variant="destructive"
                className="ml-auto"
                disabled={setStatus.isPending}
                onClick={() => setConfirmEnd(true)}
              >
                대회 종료
              </Button>
            ) : null}
          </div>
          {!isCompleted ? (
            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <span className="label">참가 등록</span>
              <span className="font-semibold">{tournament.registrationOpen ? '열림' : '마감'}</span>
              <Button
                variant="outline"
                className="ml-auto h-11"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate(!tournament.registrationOpen)}
              >
                {tournament.registrationOpen ? '등록 마감하기' : '등록 열기'}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="대회 종료"
        confirmLabel="종료"
        onConfirm={() => setStatus.mutate('completed')}
      >
        <b className="text-foreground">{tournament.name}</b> 을 종료해요. 종료하면 다시 진행 중으로
        되돌릴 수 없고, 남은 인원 <b className="num text-foreground">{stats?.playing ?? 0}명</b>의
        순위는 확정되지 않을 수 있어요.
      </ConfirmDialog>
    </div>
  );
}

/** 라이브 통계 — 모바일 LiveStatsPanel 과 같은 항목·순서. 서버 트리거 값만 표시(클라 파생 계산 없음). */
export function LiveStatsGrid({ stats }: { stats: OpsLiveStats | null }) {
  const cells: { label: string; value: string; sub?: string; prize?: boolean }[] = [
    { label: 'PLAYING', value: fmt(stats?.playing ?? 0) },
    { label: 'ENTRIES', value: fmt(stats?.entries ?? 0) },
    { label: 'RE-ENTRY', value: fmt(stats?.reentriesTotal ?? 0) },
    { label: 'TABLES', value: fmt(stats?.tablesOpen ?? 0) },
    { label: 'SEATS', value: fmt(stats?.seatsTotal ?? 0) },
    { label: 'FREE', value: fmt(stats?.seatsFree ?? 0) },
    {
      label: 'AVG',
      value: fmt(stats?.averageStack ?? 0),
      sub: `${formatBb(stats?.avgStackBb ?? 0)} BB`,
    },
    { label: 'CHIPS', value: fmt(stats?.totalChips ?? 0) },
    { label: 'POOL', value: fmt(stats?.prizePool ?? 0), prize: true },
    ...(stats && stats.knockoutPool !== null
      ? [{ label: 'KO POOL', value: fmt(stats.knockoutPool), prize: true }]
      : []),
  ];
  return (
    <dl
      aria-label="라이브 통계"
      // 괘선은 셀 테두리로 — gap+배경색 방식은 칸 수가 모자란 줄의 빈자리가 괘선색 덩어리가 된다.
      className="grid grid-cols-2 border-t border-l bg-card sm:grid-cols-5"
    >
      {cells.map((c) => (
        <div key={c.label} className="border-r border-b px-3 py-2.5">
          <dt className="label">{c.label}</dt>
          <dd
            className={
              c.prize ? 'num text-xl font-semibold text-prize' : 'num text-xl font-semibold'
            }
          >
            {c.value}
          </dd>
          {c.sub ? <dd className="num text-xs text-muted-foreground">{c.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
