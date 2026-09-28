import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { Button } from '@/components/ui/button';
import { ConsoleClock, WithClock } from '@/features/console/ConsoleClock';
import { HistoryTab } from '@/features/console/HistoryTab';
import { PayoutsTab } from '@/features/console/payouts/PayoutsTab';
import { StaffTab } from '@/features/console/staff/StaffTab';
import { ConsoleShell } from '@/features/console/ConsoleShell';
import { seatLabel } from '@/features/console/format';
import { PlayersDetailPanel, PlayersTab } from '@/features/console/players/PlayersTab';
import { usePlayerActions } from '@/features/console/players/usePlayerActions';
import { LevelsTab } from '@/features/console/levels/LevelsTab';
import { StatusTab } from '@/features/console/StatusTab';
import { parseConsoleTab, type ConsoleTab } from '@/features/console/tabs';
import { StatusChip } from '@/features/tournaments/StatusChip';
import {
  useOpsLiveStats,
  useOpsParticipants,
  useOpsPrizes,
  useOpsSeats,
  useOpsTables,
  useOpsTournament,
} from '@/hooks/ops/useConsoleQueries';
import { useResyncOnReturn } from '@/hooks/ops/useResyncOnReturn';
import { toUserMessage } from '@/lib/errorMessage';
import { AuthShell } from '@/routes/auth/AuthShell';
import { UUID_LIKE_RE } from '@/core/schemas/common';
import type { OpsTournament } from '@/core/types/ops';

/** 운영 콘솔 — 모바일 app/(ops)/tournaments/[id].tsx. 기본 진입 = 현황. */
export function Component() {
  const { id = '', tab: rawTab } = useParams();
  const tab = parseConsoleTab(rawTab);
  // UUID 가 아닌 주소는 조회하지 않고 바로 "찾을 수 없음" — 조회하면 22P02 오류 화면으로 빠진다.
  if (!UUID_LIKE_RE.test(id)) return <NotFound />;
  return <ConsoleLoader id={id} tab={tab} />;
}

function NotFound() {
  return (
    <AuthShell title="대회를 찾을 수 없어요" description="대회가 없거나 접근 권한이 없습니다.">
      <Button asChild size="lg">
        <Link to="/tournaments">대회 목록으로</Link>
      </Button>
    </AuthShell>
  );
}

function ConsoleLoader({ id, tab }: { id: string; tab: ConsoleTab }) {
  const tournament = useOpsTournament(id);
  useResyncOnReturn(id);

  if (tournament.isPending) return <FullScreenLoading />;
  // 조회 실패를 "권한 없음"으로 보이지 않게 먼저 가른다(모바일 감사 A4). 막다른 화면이 되지 않게 목록 링크도 둔다.
  if (tournament.isError && !tournament.data) {
    return (
      <AuthShell
        title="대회 정보를 불러오지 못했어요"
        description={toUserMessage(tournament.error)}
      >
        <Button size="lg" onClick={() => tournament.refetch()}>
          다시 시도
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/tournaments">대회 목록으로</Link>
        </Button>
      </AuthShell>
    );
  }
  if (!tournament.data) return <NotFound />;
  return <Console tournament={tournament.data} tab={tab} />;
}

function Console({ tournament, tab }: { tournament: OpsTournament; tab: ConsoleTab }) {
  const id = tournament.id;
  const navigate = useNavigate();
  const participants = useOpsParticipants(id);
  const seats = useOpsSeats(id);
  const tables = useOpsTables(id);
  const stats = useOpsLiveStats(id);
  const prizes = useOpsPrizes(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const seatMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of seats.data ?? []) {
      if (s.participantId) m.set(s.participantId, seatLabel(s.tableNo, s.seatNo));
    }
    return m;
  }, [seats.data]);
  const seatOf = useCallback((pid: string) => seatMap.get(pid) ?? null, [seatMap]);

  const list = participants.data ?? [];
  const actions = usePlayerActions({
    tournament,
    participants: list,
    prizes: prizes.data ?? [],
    seatOf,
    onOpenPayouts: () => navigate(`/tournaments/${id}/payouts`),
  });

  const header = (
    <header className="flex h-12 items-center gap-2 border-b px-2">
      <Button asChild variant="ghost" size="icon" aria-label="대회 목록으로">
        <Link to="/tournaments">
          <ArrowLeft />
        </Link>
      </Button>
      <h1 className="truncate text-base font-bold">{tournament.name}</h1>
      <StatusChip status={tournament.status} />
    </header>
  );

  const selected = list.find((p) => p.id === selectedId) ?? null;
  const statsData = stats.data ?? null;

  const body = (() => {
    switch (tab) {
      case 'status':
        return (
          <WithClock tournamentId={id}>
            {(clock) => <StatusTab tournament={tournament} stats={statsData} clock={clock} />}
          </WithClock>
        );
      case 'players':
        return (
          <PlayersTab
            tournament={tournament}
            participants={list}
            loading={participants.isPending}
            loadError={participants.isError ? participants.error : null}
            onRetry={() => participants.refetch()}
            seatOf={seatOf}
            selectedId={selectedId}
            onSelect={setSelectedId}
            actions={actions}
          />
        );
      case 'levels':
        return (
          <WithClock tournamentId={id}>
            {(clock) => <LevelsTab tournamentId={id} isRunning={clock.clock?.isRunning ?? false} />}
          </WithClock>
        );
      case 'staff':
        return <StaffTab tournament={tournament} tables={tables.data ?? []} />;
      case 'payouts':
        return (
          <PayoutsTab
            tournament={tournament}
            prizes={prizes.data}
            prizesError={prizes.isError ? prizes.error : null}
            onRetry={() => prizes.refetch()}
            participants={list}
            stats={statsData}
          />
        );
      case 'history':
        return <HistoryTab tournamentId={id} />;
      default:
        return (
          <p className="p-6 text-sm text-muted-foreground">이 영역은 다음 단계에서 열립니다.</p>
        );
    }
  })();

  return (
    <>
      <ConsoleShell
        tournamentId={id}
        tab={tab}
        header={header}
        clock={
          tournament.status === 'completed' ? null : (
            <ConsoleClock tournamentId={id} stats={statsData} />
          )
        }
        counts={{ players: list.length }}
        detail={
          tab === 'players' ? (
            <PlayersDetailPanel
              tournament={tournament}
              participant={selected}
              seat={selected ? seatOf(selected.id) : null}
              actions={actions}
            />
          ) : undefined
        }
      >
        {body}
      </ConsoleShell>
      {actions.dialogs}
    </>
  );
}
