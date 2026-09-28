import { LoadError, Loading } from '@/components/ops/LoadState';
import { fmtKrw } from '@/core/components/ops/payoutRows';
import type { OpsLiveStats, OpsParticipant, OpsPrize, OpsTournament } from '@/core/types/ops';
import { PayoutLedger } from './PayoutLedger';
import { StructureEditor } from './StructureEditor';

/** 상금 — 구조 편집 + 지급 대장(모바일은 세그먼트, 넓은 화면은 나란히) + 완료 대회 결과. */
export function PayoutsTab({
  tournament,
  prizes,
  prizesError,
  onRetry,
  participants,
  stats,
}: {
  tournament: OpsTournament;
  /** undefined = 아직 못 받음. 빈 구조로 보이면 거기서 만든 구조가 저장 시 기존 구조를 덮어쓴다(리뷰 W6 HIGH). */
  prizes: OpsPrize[] | undefined;
  prizesError: unknown;
  onRetry: () => void;
  participants: OpsParticipant[];
  stats: OpsLiveStats | null;
}) {
  if (!prizes) {
    return prizesError ? (
      <LoadError title="상금 구조를 불러오지 못했어요" error={prizesError} onRetry={onRetry} />
    ) : (
      <Loading label="상금 구조를 불러오는 중…" />
    );
  }
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      {tournament.status === 'completed' ? (
        <ResultSummary participants={participants} stats={stats} />
      ) : null}
      <StructureEditor
        tournament={tournament}
        prizes={prizes}
        pool={stats?.prizePool ?? 0}
        entries={stats?.entries ?? 0}
      />
      <PayoutLedger tournament={tournament} prizes={prizes} participants={participants} />
    </div>
  );
}

/**
 * 완료 대회 결과 — 모바일 TournamentResultCard. 우승자는 finishPosition===1 만
 * (수동 종료(딜/찹)로 1위가 없으면 "미확정" — 최저 순위 탈락자를 우승자로 오표기하지 않는다).
 */
export function ResultSummary({
  participants,
  stats,
}: {
  participants: OpsParticipant[];
  stats: OpsLiveStats | null;
}) {
  const ranked = participants
    .filter((p) => p.finishPosition !== null && p.finishPosition !== undefined)
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
  const winner = ranked.find((p) => p.finishPosition === 1) ?? null;
  const totalPaid = ranked.reduce((s, p) => s + (p.prizeAmount ?? 0), 0);
  const prize = (n: number | null | undefined, fb: string) => (n != null ? `${fmtKrw(n)}원` : fb);
  return (
    <section
      aria-label="대회 결과"
      className="flex flex-col gap-3 border bg-card p-4 xl:col-span-2"
    >
      <div>
        <p className="label">우승</p>
        {winner ? (
          <p className="text-xl font-bold">
            {winner.name}{' '}
            <span className="num text-prize">{prize(winner.prizeAmount, '상금 미정')}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">우승자 미확정(수동 종료)</p>
        )}
      </div>
      {/* 쌍마다 div 로 감싼다 — dt/dd 를 그리드에 번갈아 넣으면 열 수가 바뀔 때 라벨과 값이 어긋난다 */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
        <Stat label="총 풀" value={`${fmtKrw(stats?.prizePool ?? 0)}원`} />
        <Stat label="지급 합계" value={`${fmtKrw(totalPaid)}원`} />
        {stats && stats.knockoutPool !== null ? (
          <Stat label="KO 풀" value={`${fmtKrw(stats.knockoutPool)}원`} />
        ) : null}
        <Stat label="엔트리" value={fmtKrw(stats?.entries ?? 0)} />
        <Stat label="재진입" value={fmtKrw(stats?.reentriesTotal ?? 0)} />
      </dl>
      {ranked.length > 0 ? (
        <ol className="max-h-64 overflow-auto border-t pt-2 text-sm">
          {ranked.map((p) => (
            <li key={p.id} className="flex justify-between py-0.5">
              <span>
                <span className="num text-muted-foreground">{p.finishPosition}위</span> {p.name}
              </span>
              <span className="num">{prize(p.prizeAmount, '—')}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">아직 확정된 순위가 없습니다.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
