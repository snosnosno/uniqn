/**
 * 레이트 등록 자동 마감 설정 — "레벨·브레이크 N 종료 시 마감".
 * 마감은 서버가 한다(자동 전환이든 운영자가 "다음"을 누르든 기준을 넘는 순간). 수동 토글은 그대로 쓸 수 있고,
 * 수동으로 다시 열면 서버가 이 설정을 지운다.
 * 고르는 것과 적용을 나눈다 — select 는 화살표 키만으로도 값이 바뀌어, 바로 저장하면 의도치 않은 설정이 들어간다.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OpsBlindLevel, OpsTournament } from '@/core/types/ops';
import { useSetRegistrationCutoff } from '@/hooks/ops/useConsoleMutations';
import { cutoffLevelName, cutoffOptions, cutoffState } from '@/core/domains/ops/registrationCutoff';

export function RegistrationCutoff({
  tournament,
  levels,
  currentSort,
}: {
  tournament: OpsTournament;
  levels: readonly OpsBlindLevel[];
  currentSort: number;
}) {
  const saved = tournament.registrationCloseAfterSort ?? null;
  // 저장값이 바뀌면(다른 기기의 변경·수동 개방으로 해제) 고르던 값을 버리고 새 값에서 다시 시작한다.
  return (
    <CutoffForm
      key={saved ?? 'none'}
      tournament={tournament}
      levels={levels}
      currentSort={currentSort}
      saved={saved}
    />
  );
}

function CutoffForm({
  tournament,
  levels,
  currentSort,
  saved,
}: {
  tournament: OpsTournament;
  levels: readonly OpsBlindLevel[];
  currentSort: number;
  saved: number | null;
}) {
  const setCutoff = useSetRegistrationCutoff(tournament.id);
  const [draft, setDraft] = useState(saved === null ? '' : String(saved));
  const options = cutoffOptions(levels, currentSort);
  const state = cutoffState({
    levels,
    cutoffSort: saved,
    currentSort,
    registrationOpen: tournament.registrationOpen,
  });

  // 블라인드 구조가 없거나, 고를 레벨도 저장된 설정도 없으면(마지막 레벨) 자리를 차지하지 않는다.
  if (options.length === 0 && saved === null) return null;

  // 저장된 기준이 이미 지나 목록에서 빠졌어도 select 가 그 값을 보여 주도록 옵션으로 남긴다.
  const savedMissing = saved !== null && !options.some((o) => o.sort === saved);
  const savedName = saved === null ? null : cutoffLevelName(levels, saved);
  const dirty = draft !== (saved === null ? '' : String(saved));
  // 닫힌 동안 새 기준을 넣어도 등록을 여는 순간 서버가 지운다 — 해제("사용 안 함")만 받는다.
  const closedBlocksApply = !tournament.registrationOpen && draft !== '';

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="registration-cutoff" className="label">
          자동 마감
        </label>
        <select
          id="registration-cutoff"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        >
          <option value="">사용 안 함</option>
          {savedMissing ? (
            <option value={String(saved)}>
              {savedName ? `${savedName} 종료 시` : '없어진 레벨'}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.sort} value={o.sort}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          className="h-11"
          aria-label="자동 마감 적용"
          disabled={!dirty || closedBlocksApply || setCutoff.isPending}
          onClick={() => setCutoff.mutate(draft === '' ? null : Number(draft))}
        >
          적용
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {dirty && closedBlocksApply
          ? '등록이 닫혀 있어요. 먼저 등록을 연 뒤 자동 마감을 설정해 주세요.'
          : state.kind === 'scheduled'
            ? tournament.registrationOpen
              ? `${state.label} 종료 후 다음으로 넘어가면 등록을 자동으로 닫아요.`
              : `${state.label} 종료 시 마감으로 설정돼 있어요. 등록을 다시 열면 이 설정은 해제돼요.`
            : state.kind === 'closed'
              ? `${state.label} 종료로 등록이 자동 마감됐어요. 다시 열면 자동 마감 설정은 해제돼요.`
              : state.kind === 'orphan'
                ? '기준으로 잡은 레벨이 블라인드 구조에서 없어졌어요. 다시 골라 주세요.'
                : '레벨이나 휴식이 끝날 때 등록을 자동으로 닫을 수 있어요.'}
      </p>
    </div>
  );
}
