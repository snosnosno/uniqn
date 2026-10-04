import { Archive, ArchiveRestore, Copy } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import type { OpsTournament } from '@/core/types/ops';
import { StatusChip } from './StatusChip';
import { formatTournamentMeta } from './tournamentList';

interface TournamentTableProps {
  tournaments: OpsTournament[];
  /** 공고 피커 모드에선 정리 액션(복제·보관)을 숨긴다(모바일과 같음). */
  showActions: boolean;
  busy: boolean;
  onDuplicate: (t: OpsTournament) => void;
  onArchiveToggle: (t: OpsTournament) => void;
}

/**
 * 대회 표 — 카드 그리드 대신 행과 열(DESIGN.md). 폰에선 메타를 이름 아래 한 줄로 접는다.
 * 행 전체 클릭은 포인터 편의, 키보드 접근은 이름 링크가 맡는다.
 */
export function TournamentTable({
  tournaments,
  showActions,
  busy,
  onDuplicate,
  onArchiveToggle,
}: TournamentTableProps) {
  const navigate = useNavigate();
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr className="label border-b text-left [&>th]:px-3 [&>th]:py-2">
          <th className="w-24 sm:w-28">상태</th>
          <th>대회</th>
          <th className="hidden w-20 md:table-cell">게임</th>
          <th className="hidden w-40 md:table-cell">장소</th>
          <th className="hidden w-32 sm:table-cell">날짜</th>
          {showActions ? <th className="w-28 text-right">정리</th> : null}
        </tr>
      </thead>
      <tbody>
        {tournaments.map((t) => (
          <tr
            key={t.id}
            className="h-13 cursor-pointer border-b transition-colors duration-100 hover:bg-muted [&>td]:px-3"
            onClick={() => navigate(`/tournaments/${t.id}`)}
          >
            <td>
              <StatusChip status={t.status} />
            </td>
            <td className="max-w-0">
              <Link
                to={`/tournaments/${t.id}`}
                className="block truncate font-semibold outline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                {t.name}
              </Link>
              <span className="block truncate text-xs text-muted-foreground md:hidden">
                {formatTournamentMeta(t)}
              </span>
            </td>
            <td className="hidden md:table-cell">{t.gameType}</td>
            <td className="hidden truncate md:table-cell">{t.venue ?? '—'}</td>
            <td className="num hidden sm:table-cell">{t.eventDate ?? '—'}</td>
            {showActions ? (
              <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                {/* 예정·진행 대회도 복제한다 — 매주 같은 대회를 미리 여러 개 만들어 두는 운영(서버는 상태를 가리지 않는다) */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t.name} 설정으로 새 대회 복제`}
                  title="복제"
                  disabled={busy}
                  onClick={() => onDuplicate(t)}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.archivedAt ? `${t.name} 복원` : `${t.name} 보관`}
                  title={t.archivedAt ? '복원' : '보관'}
                  disabled={busy}
                  onClick={() => onArchiveToggle(t)}
                >
                  {t.archivedAt ? <ArchiveRestore /> : <Archive />}
                </Button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 로딩 — 실제 행과 같은 높이로 자리를 잡아 레이아웃이 튀지 않게 한다. */
export function TournamentTableSkeleton() {
  return (
    <div role="status" aria-label="대회 목록 불러오는 중" className="flex flex-col">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-13 items-center gap-3 border-b px-3">
          <span className="h-5 w-16 rounded-full bg-muted" />
          <span className="h-4 w-1/3 bg-muted" />
          <span className="ml-auto hidden h-4 w-20 bg-muted sm:block" />
        </div>
      ))}
    </div>
  );
}
