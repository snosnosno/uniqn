import { forwardRef, useEffect } from 'react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import type { OpsParticipant } from '@/core/types/ops';
import { PARTICIPANT_STATUS_LABEL, fmt } from '../format';

const STATUS_TONE: Record<OpsParticipant['status'], string> = {
  registered: 'text-muted-foreground',
  checked_in: 'text-warning',
  active: 'text-success',
  busted: 'text-destructive',
  no_show: 'text-muted-foreground',
};

interface Props {
  participants: OpsParticipant[];
  query: string;
  onQueryChange: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  seatOf: (id: string) => string | null;
  isBounty: boolean;
}

/** 참가자 표 — 행·열(DESIGN.md), 숫자 우측 정렬, 선택 행은 muted 면. 행 높이 40px. */
export const PlayersTable = forwardRef<HTMLInputElement, Props>(function PlayersTable(
  { participants, query, onQueryChange, selectedId, onSelect, seatOf, isBounty },
  searchRef
) {
  // ↑↓ 로 선택이 바뀌면 그 행을 화면 안으로(단축키가 기본 스크롤을 막으므로 — 리뷰 W4).
  useEffect(() => {
    if (!selectedId) return;
    document.querySelector(`[data-pid="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background p-2">
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="이름 또는 #번호  ( / )"
          aria-label="참가자 찾기"
          className="h-11"
        />
      </div>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="label border-b text-left [&>th]:px-3 [&>th]:py-2">
            <th className="w-14">#</th>
            <th>이름</th>
            <th className="hidden w-20 sm:table-cell">좌석</th>
            <th className="w-28 text-right">칩</th>
            <th className="w-20">상태</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr
              key={p.id}
              data-pid={p.id}
              className={cn(
                'h-10 cursor-pointer border-b [&>td]:px-3',
                p.id === selectedId ? 'bg-muted' : 'hover:bg-muted/50'
              )}
              onClick={() => onSelect(p.id)}
            >
              <td className="num text-muted-foreground">{p.entryNumber}</td>
              <td className="truncate">
                <button
                  type="button"
                  aria-pressed={p.id === selectedId}
                  className={cn('text-left', p.id === selectedId && 'font-bold')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(p.id);
                  }}
                >
                  {p.name}
                </button>
                {p.rebuys > 0 ? (
                  <span className="num ml-1.5 text-xs text-muted-foreground">R{p.rebuys}</span>
                ) : null}
                {p.addOns > 0 ? (
                  <span className="num ml-1 text-xs text-muted-foreground">A{p.addOns}</span>
                ) : null}
                {isBounty && p.knockouts > 0 ? (
                  <span className="num ml-1 text-xs text-accent-text">KO {p.knockouts}</span>
                ) : null}
              </td>
              <td className="num hidden sm:table-cell">{seatOf(p.id) ?? '—'}</td>
              <td className="num text-right">{fmt(p.chips)}</td>
              <td className={cn('text-xs font-semibold', STATUS_TONE[p.status])}>
                {p.status === 'busted' && p.finishPosition
                  ? `${p.finishPosition}위`
                  : PARTICIPANT_STATUS_LABEL[p.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {participants.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {query ? '찾는 참가자가 없어요.' : '아직 참가자가 없어요. N 으로 등록하세요.'}
        </p>
      ) : null}
    </div>
  );
});
