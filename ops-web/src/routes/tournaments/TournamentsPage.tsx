import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { kstDateString, selectResumeTournament } from '@/core/domains/ops';
import type { OpsTournament } from '@/core/types/ops';
import { StatusChip } from '@/features/tournaments/StatusChip';
import { TournamentTable, TournamentTableSkeleton } from '@/features/tournaments/TournamentTable';
import { formatTournamentMeta, partitionTournaments } from '@/features/tournaments/tournamentList';
import {
  useDuplicateTournament,
  useOpsHubEnteredOnce,
  useOpsTournaments,
  useSetTournamentArchived,
} from '@/hooks/ops/useTournaments';
import { toUserMessage } from '@/lib/errorMessage';
import { useHotkey } from '@/lib/useHotkey';

type PendingConfirm =
  | { kind: 'duplicate'; tournament: OpsTournament; date: string }
  | { kind: 'archive'; tournament: OpsTournament };

/**
 * 대회 목록(허브) — 모바일 `app/(ops)/tournaments/index.tsx` 와 같은 규칙:
 * 재개 행(진행 중 최신 우선) · 보관함 토글(보관분 있을 때만) · 대회 복제(웹은 전 상태) · 보관/복원 · `?postingId=` 필터.
 */
export function Component() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const postingId = params.get('postingId');
  const [showArchived, setShowArchived] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const query = useOpsTournaments();
  const duplicate = useDuplicateTournament();
  const archive = useSetTournamentArchived();
  useOpsHubEnteredOnce(!postingId);

  const tournaments = useMemo(() => query.data ?? [], [query.data]);
  const { visible, archivedCount } = partitionTournaments(tournaments, { showArchived, postingId });
  // 재개 판정 기준 시각 = 목록을 받은 시각. 탭을 켜 둔 채 자정을 넘겨도 재조회(포커스·30s)마다 따라간다.
  const resume =
    !postingId && !showArchived && !query.isError && query.dataUpdatedAt > 0
      ? selectResumeTournament(visible, query.dataUpdatedAt)
      : null;

  const createHref = postingId
    ? `/tournaments/new?postingId=${encodeURIComponent(postingId)}`
    : '/tournaments/new';
  useHotkey('KeyN', () => navigate(createHref));

  const onArchiveToggle = (t: OpsTournament) => {
    // 복원은 되돌리는 방향이라 확인 없이 바로.
    if (t.archivedAt) archive.mutate({ id: t.id, archived: false });
    else setPending({ kind: 'archive', tournament: t });
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[28px] leading-tight font-bold">{showArchived ? '보관함' : '대회'}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!postingId && (archivedCount > 0 || showArchived) ? (
            <Button variant="ghost" className="h-11" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? '활성 대회 보기' : `보관함 (${archivedCount})`}
            </Button>
          ) : null}
          <Button asChild size="lg">
            <Link to={createHref}>
              새 대회 <Kbd>N</Kbd>
            </Link>
          </Button>
        </div>
      </div>

      {postingId ? (
        <p className="flex items-center gap-2 border px-3 py-2 text-sm text-muted-foreground">
          이 공고에 연결된 대회만 보고 있어요.
          <Link to="/tournaments" className="text-accent-text underline-offset-4 hover:underline">
            전체 보기
          </Link>
        </p>
      ) : null}

      {query.isError && visible.length > 0 ? (
        <p
          role="alert"
          className="flex items-center gap-3 border border-destructive/60 px-3 py-2 text-sm"
        >
          목록을 최신화하지 못했어요.
          <Button variant="outline" className="h-11" onClick={() => query.refetch()}>
            다시 시도
          </Button>
        </p>
      ) : null}

      {resume ? (
        <Link
          to={`/tournaments/${resume.id}`}
          className="flex flex-col gap-1 border border-l-4 border-l-primary bg-card px-4 py-3 hover:bg-muted"
        >
          <span className="label text-accent-text">이어서 운영</span>
          <span className="flex items-center gap-2">
            <span className="truncate text-xl font-bold">{resume.name}</span>
            <StatusChip status={resume.status} />
          </span>
          <span className="text-sm text-muted-foreground">{formatTournamentMeta(resume)}</span>
        </Link>
      ) : null}

      <section className="border bg-card">
        {query.isPending ? (
          <TournamentTableSkeleton />
        ) : query.isError && visible.length === 0 ? (
          <EmptyBlock
            title="대회 목록을 불러오지 못했어요"
            body={toUserMessage(query.error)}
            action={
              <Button variant="outline" onClick={() => query.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          showArchived ? (
            <EmptyBlock
              title="보관한 대회가 없어요"
              action={
                <Button variant="outline" onClick={() => setShowArchived(false)}>
                  활성 대회 보기
                </Button>
              }
            />
          ) : (
            <EmptyBlock
              title={postingId ? '이 공고에 연결된 대회가 없어요' : '첫 대회를 열어보세요'}
              body="참가자 등록부터 좌석·블라인드·전광판까지 한 화면에서 운영해요."
              action={
                <Button asChild size="lg">
                  <Link to={createHref}>
                    {postingId ? '이 공고에 대회 만들기' : '첫 대회 만들기'}
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <TournamentTable
            tournaments={visible}
            showActions={!postingId}
            busy={duplicate.isPending || archive.isPending}
            // 복제 날짜는 확인창을 여는 순간의 KST 오늘(자정 넘김 대비 — 모바일도 확정 시점 계산).
            onDuplicate={(t) =>
              setPending({ kind: 'duplicate', tournament: t, date: kstDateString(Date.now()) })
            }
            onArchiveToggle={onArchiveToggle}
          />
        )}
      </section>

      <ConfirmDialog
        open={pending?.kind === 'duplicate'}
        onOpenChange={(open) => !open && setPending(null)}
        title="대회 복제"
        tone="primary"
        confirmLabel="만들기"
        onConfirm={() => {
          if (pending?.kind !== 'duplicate') return;
          duplicate.mutate(
            { sourceTournamentId: pending.tournament.id, eventDate: pending.date },
            { onSuccess: (r) => navigate(`/tournaments/${r.tournamentId}`) }
          );
        }}
      >
        <b className="text-foreground">{pending?.tournament.name}</b> 설정(칩·바이인·블라인드)으로{' '}
        <b className="num text-foreground">{pending?.kind === 'duplicate' ? pending.date : ''}</b>{' '}
        대회를 새로 만들어요.
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'archive'}
        onOpenChange={(open) => !open && setPending(null)}
        title="대회 보관"
        confirmLabel="보관"
        onConfirm={() => {
          if (pending?.kind === 'archive')
            archive.mutate({ id: pending.tournament.id, archived: true });
        }}
      >
        <b className="text-foreground">{pending?.tournament.name}</b> 을 목록에서 숨겨요. 보관함에서
        언제든 복원할 수 있어요.
      </ConfirmDialog>
    </main>
  );
}

function EmptyBlock({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}
