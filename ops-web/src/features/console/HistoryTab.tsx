import { formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { LoadError } from '@/components/ops/LoadState';
import { EVENT_LABEL, summarizePayload } from '@/core/historyLabels';
import { useOpsEvents } from '@/hooks/ops/useStaffPrizeHistory';

/** 이력 — 모바일 HistoryTab: 이벤트 한글 라벨(사본)·상대 시각·payload 요약. 최신순. */
export function HistoryTab({ tournamentId }: { tournamentId: string }) {
  const events = useOpsEvents(tournamentId);
  const list = events.data ?? [];
  if (events.isError && !events.data) {
    return (
      <LoadError
        title="이력을 불러오지 못했어요"
        error={events.error}
        onRetry={() => events.refetch()}
      />
    );
  }
  if (list.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">아직 기록이 없어요</p>
        <p className="text-sm text-muted-foreground">
          {events.isPending
            ? '불러오는 중…'
            : '등록·클럭·좌석 등 모든 운영 동작이 이곳에 시간순으로 남습니다.'}
        </p>
      </div>
    );
  }
  return (
    <ol className="flex flex-col">
      {list.map((e) => {
        const summary = summarizePayload(e.payload);
        return (
          <li key={e.id} className="flex flex-col gap-0.5 border-b px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>
              <time
                dateTime={e.createdAt}
                title={new Date(e.createdAt).toLocaleString('ko-KR')}
                className="ml-auto text-xs text-muted-foreground"
              >
                {formatDistanceToNowStrict(new Date(e.createdAt), { locale: ko, addSuffix: true })}
              </time>
            </div>
            {summary ? (
              <p className="num truncate text-xs text-muted-foreground">{summary}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
