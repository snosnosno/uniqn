import { useMemo, useState } from 'react';
import { Coffee, Plus, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { LoadError, Loading } from '@/components/ops/LoadState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OPS_BLIND_LEVELS_MAX, type OpsBlindLevelInput } from '@/core/schemas/opsBlindLevel.schema';
import type { OpsBlindLevel } from '@/core/types/ops';
import { useSetBlindLevels } from '@/hooks/ops/useBlindMutations';
import { useOpsBlindLevels } from '@/hooks/ops/useConsoleQueries';
import { toast } from 'sonner';
import { breakRow, nextRow, toDraftRow, toInputs, type DraftRow } from './blindDraft';
import { BlindPresetDialog } from './BlindPresetDialog';

type Col = 'level' | 'smallBlind' | 'bigBlind' | 'ante' | 'minutes';
/** maxLength = 모바일 BlindLevelForm(레벨·분 3, 블라인드 9) — int4 초과로 서버가 22003 을 내지 않게. */
const COLS: { key: Col; label: string; max: number }[] = [
  { key: 'level', label: 'LV', max: 3 },
  { key: 'smallBlind', label: 'SB', max: 9 },
  { key: 'bigBlind', label: 'BB', max: 9 },
  { key: 'ante', label: '앤티', max: 9 },
  { key: 'minutes', label: '분', max: 3 },
];

/**
 * 블라인드 구조 — 모바일 BlindLevelsTab: 로컬 draft 편집 → 전체 교체 저장(진행 중이면 재계산 확인),
 * 프리셋 적용/저장/삭제. 웹은 **표에서 바로 고친다**(행마다 폼을 여는 대신 — 속도).
 * draft 는 편집을 시작한 순간에만 생긴다(null = 서버 값 그대로, 편집 전 realtime 갱신을 그대로 반영).
 */
export function LevelsTab({
  tournamentId,
  isRunning,
}: {
  tournamentId: string;
  isRunning: boolean;
}) {
  const query = useOpsBlindLevels(tournamentId);
  // 로딩·실패를 "구조 없음"으로 보이면, 거기서 만든 구조가 저장 시 기존 구조를 통째로 덮어쓴다(리뷰 W5 HIGH).
  if (!query.data) {
    return query.isError ? (
      <LoadError
        title="블라인드 구조를 불러오지 못했어요"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    ) : (
      <Loading label="블라인드 구조를 불러오는 중…" />
    );
  }
  return <LevelsEditor tournamentId={tournamentId} levels={query.data} isRunning={isRunning} />;
}

function LevelsEditor({
  tournamentId,
  levels,
  isRunning,
}: {
  tournamentId: string;
  levels: OpsBlindLevel[];
  isRunning: boolean;
}) {
  const serverRows = useMemo(() => levels.map((l) => toDraftRow(l)), [levels]);
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const [presetName, setPresetName] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const save = useSetBlindLevels(tournamentId);
  const rows = draft ?? serverRows;
  const dirty = draft !== null;

  const edit = (next: DraftRow[], name: string | null = null) => {
    setDraft(next);
    setPresetName(name);
  };
  const setCell = (i: number, key: Col, value: string) =>
    edit(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const add = (row: DraftRow) => {
    if (rows.length >= OPS_BLIND_LEVELS_MAX) {
      toast.warning(`블라인드 레벨은 최대 ${OPS_BLIND_LEVELS_MAX}개까지 추가할 수 있습니다`);
      return;
    }
    edit([...rows, row]);
  };

  const parsed = toInputs(rows);
  const canSave = dirty && rows.length > 0 && parsed.ok && !save.isPending;
  const doSave = () => {
    if (!parsed.ok) return;
    save.mutate(parsed.levels, { onSuccess: () => setDraft(null) });
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button variant="outline" className="h-11" onClick={() => setPresetOpen(true)}>
          {presetName ? `프리셋 · ${presetName}` : '프리셋'}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => add(nextRow(rows))}>
          <Plus /> 레벨
        </Button>
        <Button variant="outline" className="h-11" onClick={() => add(breakRow(rows))}>
          <Coffee /> 휴식
        </Button>
        {dirty ? (
          <>
            <span className="text-xs text-warning">저장되지 않은 변경이 있습니다.</span>
            <Button variant="ghost" className="h-11" onClick={() => setDraft(null)}>
              되돌리기
            </Button>
          </>
        ) : null}
        <Button
          size="lg"
          className="ml-auto"
          disabled={!canSave}
          onClick={() => (isRunning ? setConfirmSave(true) : doSave())}
        >
          {save.isPending ? '저장 중…' : '구조 저장'}
        </Button>
      </div>
      {!parsed.ok ? (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          {parsed.badRow}번 행의 시간(분)은 1 이상이어야 해요.
        </p>
      ) : null}

      {/* 폰에서 칸이 좁아 숫자가 잘리지 않도록 표만 가로 스크롤(페이지는 넘치지 않는다) */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="label border-b text-left [&>th]:px-2 [&>th]:py-2">
              <th className="w-10">#</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-right">
                  {c.label}
                </th>
              ))}
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn('h-13 border-b', r.isBreak && 'bg-muted')}>
                <td className="num px-2 text-muted-foreground">{i + 1}</td>
                {r.isBreak ? (
                  <>
                    <td colSpan={4} className="px-2 text-sm font-semibold">
                      휴식
                    </td>
                    <td className="px-1">
                      <CellInput
                        label={`${i + 1}번 휴식 시간(분)`}
                        max={3}
                        value={r.minutes}
                        onChange={(v) => setCell(i, 'minutes', v)}
                      />
                    </td>
                  </>
                ) : (
                  COLS.map((c) => (
                    <td key={c.key} className="px-1">
                      <CellInput
                        label={`${i + 1}번 ${c.label}`}
                        max={c.max}
                        value={r[c.key]}
                        onChange={(v) => setCell(i, c.key, v)}
                      />
                    </td>
                  ))
                )}
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${i + 1}번 레벨 삭제`}
                    onClick={() => edit(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          블라인드 구조가 없어요. 프리셋에서 불러오거나 레벨을 추가하세요.
        </p>
      ) : null}

      <BlindPresetDialog
        open={presetOpen}
        onOpenChange={setPresetOpen}
        currentLevels={parsed.ok ? parsed.levels : []}
        onApply={(applied: OpsBlindLevelInput[], name: string) =>
          edit(
            // 프리셋 행은 옛 구조의 어느 레벨과도 이어지지 않는다 — jsonb 에 sort 가 섞여 있어도 순번으로 줍지 않게 뗀다.
            applied.map((l) => toDraftRow({ ...l, sort: undefined })),
            name
          )
        }
      />
      <ConfirmDialog
        open={confirmSave}
        onOpenChange={setConfirmSave}
        title="블라인드 구조 저장"
        confirmLabel="저장하고 재계산"
        tone="primary"
        onConfirm={doSave}
      >
        진행 중인 타이머가 재계산됩니다. 계속할까요?
      </ConfirmDialog>
    </div>
  );
}

function CellInput({
  label,
  max,
  value,
  onChange,
}: {
  label: string;
  max: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      maxLength={max}
      className="num h-11 text-right"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
