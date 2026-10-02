import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { OpsParticipant, OpsTournament } from '@/core/types/ops';
import { PARTICIPANT_STATUS_LABEL, fmt } from '../format';
import { participantActions, type ParticipantAction } from '../participantActions';
import { ACTION_KEYS, ACTION_LABEL as LABEL, copyToClipboard, playerViewUrl } from './helpers';
import type { RunnableAction } from './usePlayerActions';

const DANGER: ParticipantAction[] = ['bust', 'noShow', 'undoBust', 'delete', 'unclaim'];

/** 선택된 참가자 상세 + 액션. 파괴적 액션은 아래로 격리(모바일 L6). */
export function ParticipantDetail({
  participant: p,
  tournament,
  seat,
  busy,
  onRun,
}: {
  participant: OpsParticipant;
  tournament: OpsTournament;
  seat: string | null;
  busy: boolean;
  onRun: (action: RunnableAction, p: OpsParticipant) => void;
}) {
  const actions = participantActions(p, tournament);
  const safe = actions.filter((a) => !DANGER.includes(a));
  const danger = actions.filter((a) => DANGER.includes(a));

  const btn = (a: ParticipantAction) => (
    <Button
      key={a}
      variant={a === 'bust' ? 'destructive' : 'outline'}
      size="lg"
      className="justify-between"
      disabled={busy}
      onClick={() => onRun(a, p)}
    >
      {LABEL[a]}
      {ACTION_KEYS[a] ? <Kbd>{ACTION_KEYS[a]}</Kbd> : null}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="label">
          선택됨 · #{p.entryNumber} · {PARTICIPANT_STATUS_LABEL[p.status]}
        </div>
        <div className="text-[22px] font-bold">{p.name}</div>
        {p.nationality ? (
          <div className="text-sm text-muted-foreground">{p.nationality}</div>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-px border bg-border">
        <div className="bg-card p-3">
          <dt className="label">좌석</dt>
          <dd className="num text-lg font-semibold">{seat ?? '미착석'}</dd>
        </div>
        <div className="bg-card p-3">
          <dt className="label">칩</dt>
          <dd className="num text-lg font-semibold">{fmt(p.chips)}</dd>
        </div>
        <div className="bg-card p-3">
          <dt className="label">리바이 · 애드온</dt>
          <dd className="num font-semibold">
            {p.rebuys} · {p.addOns}
          </dd>
        </div>
        <div className="bg-card p-3">
          <dt className="label">{p.status === 'busted' ? '순위 · 상금' : '재진입'}</dt>
          <dd className="num font-semibold">
            {p.status === 'busted' ? (
              <>
                {p.finishPosition ?? '-'}위 ·{' '}
                <span className="text-prize">
                  {p.prizeAmount !== null && p.prizeAmount !== undefined
                    ? fmt(p.prizeAmount)
                    : '없음'}
                </span>
              </>
            ) : (
              p.reentries
            )}
          </dd>
        </div>
      </dl>
      <div className="grid grid-cols-2 gap-2">{safe.map(btn)}</div>
      {p.viewToken ? (
        <Button
          variant="outline"
          className="h-11"
          onClick={() => void copyToClipboard(playerViewUrl(p.viewToken!), '플레이어 링크')}
        >
          플레이어 링크 복사(PIN 유지)
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="h-11"
        disabled={busy}
        onClick={() => onRun('credentials', p)}
      >
        {p.viewToken ? '플레이어 PIN 재발급' : '플레이어 링크·PIN 발급'}
      </Button>
      {danger.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-4">{danger.map(btn)}</div>
      ) : null}
    </div>
  );
}
