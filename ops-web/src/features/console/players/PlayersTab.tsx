import { useMemo, useRef, useState } from 'react';
import { Download, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { OpsParticipant, OpsTournament } from '@/core/types/ops';
import { LoadError, Loading } from '@/components/ops/LoadState';
import { useHotkeyMap } from '@/lib/useHotkey';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { buildParticipantsCsv, csvFileName, downloadCsv } from '../exportCsv';
import { isBountyTournament, participantActions } from '../participantActions';
import { ACTION_KEYS, filterParticipants } from './helpers';
import { ParticipantDetail } from './ParticipantDetail';
import { PlayersTable } from './PlayersTable';
import type { usePlayerActions } from './usePlayerActions';

type Actions = ReturnType<typeof usePlayerActions>;

/**
 * 참가 탭 — 표 + 선택 상세. 선택은 부모(콘솔)가 들고 있어 ≥1024 우측 패널과 공유한다.
 * 단축키: N 등록 · / 찾기 · ↑↓ 선택 · R 리바이 · A 애드온 · C 칩 · X 탈락 · E 수정.
 */
export function PlayersTab({
  tournament,
  participants,
  loading,
  loadError,
  onRetry,
  seatOf,
  selectedId,
  onSelect,
  actions,
}: {
  tournament: OpsTournament;
  participants: OpsParticipant[];
  /** 로딩·조회 실패를 "참가자 없음"과 가른다 — 실패를 빈 목록으로 보이면 중복 등록 위험(리뷰 W4). */
  loading: boolean;
  loadError: unknown;
  onRetry: () => void;
  seatOf: (id: string) => string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  actions: Actions;
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const phone = !useMediaQuery('(min-width: 640px)');
  const visible = useMemo(() => filterParticipants(participants, query), [participants, query]);
  const selected = participants.find((p) => p.id === selectedId) ?? null;

  const move = (delta: number) => {
    if (visible.length === 0) return;
    const i = visible.findIndex((p) => p.id === selectedId);
    const next = i < 0 ? 0 : Math.min(visible.length - 1, Math.max(0, i + delta));
    onSelect(visible[next].id);
  };

  const keyed: Record<string, () => void> = {
    KeyN: actions.openRegister,
    Slash: () => searchRef.current?.focus(),
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
  };
  // 처리 중에는 액션 단축키를 받지 않는다(버튼 비활성과 같은 규칙 — 연타 이중 요청 방지).
  if (selected && !actions.busy) {
    const allowed = participantActions(selected, tournament);
    for (const [action, key] of Object.entries(ACTION_KEYS)) {
      if (allowed.includes(action as never)) {
        keyed[`Key${key}`] = () => actions.run(action as never, selected);
      }
    }
  }
  useHotkeyMap(keyed);

  const detail = selected ? (
    <ParticipantDetail
      participant={selected}
      tournament={tournament}
      seat={seatOf(selected.id)}
      busy={actions.busy}
      onRun={actions.run}
    />
  ) : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="label">
          {tournament.registrationOpen ? '등록 열림' : '등록 마감'} · {participants.length}명
        </span>
        <Button
          variant="outline"
          size="lg"
          className="ml-auto"
          disabled={participants.length === 0}
          onClick={() =>
            downloadCsv(csvFileName(tournament.name), buildParticipantsCsv(participants, seatOf))
          }
        >
          <Download /> CSV
        </Button>
        <Button size="lg" onClick={actions.openRegister}>
          <UserPlus /> 등록 <Kbd>N</Kbd>
        </Button>
      </div>
      {loadError && participants.length === 0 ? (
        <LoadError title="참가자 목록을 불러오지 못했어요" error={loadError} onRetry={onRetry} />
      ) : loading ? (
        <Loading label="참가자를 불러오는 중…" />
      ) : (
        <PlayersTable
          ref={searchRef}
          participants={visible}
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedId}
          onSelect={onSelect}
          seatOf={seatOf}
          isBounty={isBountyTournament(tournament)}
        />
      )}
      {/* <640: 주 액션 하단 고정 52px 버튼 2개(DESIGN.md) */}
      {phone ? (
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-card p-2">
          <Button size="lg" onClick={actions.openRegister}>
            <UserPlus /> 등록
          </Button>
          <Button size="lg" variant="outline" onClick={() => searchRef.current?.focus()}>
            <Search /> 찾기
          </Button>
        </div>
      ) : null}
      {!wide ? (
        <Sheet open={selected !== null} onOpenChange={(open) => !open && onSelect(null)}>
          {/* 폰은 바텀시트, 태블릿 세로는 우측 시트(DESIGN.md 브레이크포인트) */}
          <SheetContent
            side={phone ? 'bottom' : 'right'}
            className={phone ? 'max-h-[85dvh] overflow-auto' : 'w-full overflow-auto sm:max-w-sm'}
          >
            <SheetTitle className="sr-only">참가자 상세</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

/** ≥1024 우측 패널용 — 콘솔이 detail 슬롯에 넣는다. */
export function PlayersDetailPanel(props: {
  tournament: OpsTournament;
  participant: OpsParticipant | null;
  seat: string | null;
  actions: Actions;
}) {
  if (!props.participant) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        참가자를 고르면 여기서 바로 처리해요. ↑↓ 로 이동.
      </p>
    );
  }
  return (
    <ParticipantDetail
      participant={props.participant}
      tournament={props.tournament}
      seat={props.seat}
      busy={props.actions.busy}
      onRun={props.actions.run}
    />
  );
}
