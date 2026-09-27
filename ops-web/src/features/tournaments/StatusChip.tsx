import { cn } from 'cn';
import type { OpsTournamentStatus } from '@/core/types/ops';
import { STATUS_LABEL } from './tournamentList';

/** 상태 칩 — 알약형은 상태 칩에만(DESIGN.md). 진행=성공색, 예정=대기색, 종료=흐림. */
const TONE: Record<OpsTournamentStatus, string> = {
  active: 'text-success border-success/50',
  upcoming: 'text-warning border-warning/50',
  completed: 'text-muted-foreground border-border',
};

export function StatusChip({ status }: { status: OpsTournamentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold whitespace-nowrap',
        TONE[status]
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
