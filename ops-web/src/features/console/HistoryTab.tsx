import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Download } from 'lucide-react';
import { cn } from 'cn';
import { LoadError } from '@/components/ops/LoadState';
import { Button } from '@/components/ui/button';
import { EVENT_LABEL, summarizePayload } from '@/core/historyLabels';
import { useOpsEvents } from '@/hooks/ops/useStaffPrizeHistory';
import { radioGroupKeyDown, radioTabIndex } from '@/lib/radioGroup';
import { buildHistoryCsv, csvFileName, downloadCsv } from './exportCsv';
import {
  HISTORY_CATEGORIES,
  HISTORY_MAX,
  HISTORY_PAGE,
  filterEvents,
  type HistoryCategory,
} from './historyFilter';

const CATEGORY_VALUES = HISTORY_CATEGORIES.map((c) => c.value);

/**
 * 이력 — 모바일 HistoryTab: 이벤트 한글 라벨(사본)·상대 시각·payload 요약. 최신순.
 * 웹 추가: 분류 필터(참가자·좌석·클럭·상금·설정) + "더 보기"(100건씩, 최대 1,000건)
 * + CSV(지금 화면에 보이는 분류·건수 그대로).
 */
export function HistoryTab({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const [category, setCategory] = useState<HistoryCategory>('all');
  const events = useOpsEvents(tournamentId, limit);
  const all = events.data ?? [];
  const list = filterEvents(all, category);
  // 받은 건수가 요청 건수와 같으면 더 있을 수 있다
  const mayHaveMore = all.length >= limit && limit < HISTORY_MAX;

  if (events.isError && !events.data) {
    return (
      <LoadError
        title="이력을 불러오지 못했어요"
        error={events.error}
        onRetry={() => events.refetch()}
      />
    );
  }
  if (all.length === 0) {
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
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div
          role="radiogroup"
          aria-label="이력 분류"
          onKeyDown={radioGroupKeyDown(CATEGORY_VALUES, category, setCategory)}
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {HISTORY_CATEGORIES.map((c, i) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              tabIndex={radioTabIndex(i, CATEGORY_VALUES.indexOf(category))}
              onClick={() => setCategory(c.value)}
              className={cn(
                'h-11 shrink-0 border px-3 text-sm whitespace-nowrap',
                category === c.value
                  ? 'border-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          className="h-11 shrink-0"
          aria-label="이력 CSV 내려받기"
          disabled={list.length === 0}
          onClick={() =>
            downloadCsv(csvFileName(tournamentName, new Date(), '이력'), buildHistoryCsv(list))
          }
        >
          <Download /> CSV
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          불러온 {all.length}건 중 이 분류의 기록이 없어요.
        </p>
      ) : (
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
                    {formatDistanceToNowStrict(new Date(e.createdAt), {
                      locale: ko,
                      addSuffix: true,
                    })}
                  </time>
                </div>
                {summary ? (
                  <p className="num truncate text-xs text-muted-foreground">{summary}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {mayHaveMore ? (
        <Button
          variant="outline"
          className="m-3 h-11 self-center"
          disabled={events.isFetching}
          onClick={() => setLimit((n) => Math.min(HISTORY_MAX, n + HISTORY_PAGE))}
        >
          {events.isFetching ? '불러오는 중…' : `이전 기록 ${HISTORY_PAGE}건 더 보기`}
        </Button>
      ) : all.length >= HISTORY_MAX ? (
        <p className="p-3 text-center text-xs text-muted-foreground">
          최근 {HISTORY_MAX.toLocaleString('ko-KR')}건까지 보여요.
        </p>
      ) : null}
    </div>
  );
}
