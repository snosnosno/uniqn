import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmtKrw } from '@/core/components/ops/payoutRows';
import { recommendPayoutCurve, type ItmRatio } from '@/core/domains/ops';
import type { PrizeStructureInput } from '@/core/schemas/opsPrize.schema';
import type { OpsPrize, OpsTournament } from '@/core/types/ops';
import { useSetPrizeStructure } from '@/hooks/ops/useStaffPrizeHistory';
import { radioGroupKeyDown, radioTabIndex } from '@/lib/radioGroup';
import { buildPayload, displaySum, percentPreview, type PayoutMode } from './payoutDraft';

const ITM_RATIOS: ItmRatio[] = [0.1, 0.15, 0.2];
const MODES: readonly PayoutMode[] = ['amount', 'percent'];

/**
 * 상금 구조 편집 — 모바일 PayoutStructureEditor: 금액 | % 모드, ITM 템플릿 추천, 현재 풀 대비 합계,
 * 진행 중 저장은 "소급 안 됨" 확인. draft 는 편집을 시작해야 생긴다(null = 서버 구조 그대로).
 */
export function StructureEditor({
  tournament,
  prizes,
  pool,
  entries,
}: {
  tournament: OpsTournament;
  prizes: OpsPrize[];
  pool: number;
  entries: number;
}) {
  const save = useSetPrizeStructure(tournament.id);
  const serverAmounts = useMemo(
    () => [...prizes].sort((a, b) => a.rank - b.rank).map((p) => String(p.amount)),
    [prizes]
  );
  const [mode, setMode] = useState<PayoutMode>('amount');
  const [amounts, setAmounts] = useState<string[] | null>(null);
  const [percents, setPercents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PrizeStructureInput | null>(null);
  const rows = amounts ?? serverAmounts;
  const dirty = amounts !== null || percents.length > 0;

  const list = mode === 'amount' ? rows : percents;
  const setList = (next: string[]) => {
    setError(null);
    if (mode === 'amount') setAmounts(next);
    else setPercents(next);
  };
  const preview = percentPreview(pool, percents);
  const sum = displaySum(mode, rows, percents, pool);

  const onSave = () => {
    const r = buildPayload(mode, rows, percents, pool);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (tournament.status === 'active') setPending(r.payload);
    else doSave(r.payload);
  };
  const doSave = (payload: PrizeStructureInput) =>
    save.mutate(payload, {
      onSuccess: () => {
        setAmounts(null);
        setPercents([]);
      },
    });

  return (
    <section aria-label="상금 구조" className="flex flex-col gap-3 border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="입력 방식"
          onKeyDown={radioGroupKeyDown(MODES, mode, setMode)}
          className="flex border"
        >
          {MODES.map((m, i) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              tabIndex={radioTabIndex(i, MODES.indexOf(mode))}
              onClick={() => setMode(m)}
              className={cn(
                'h-11 px-4 text-sm font-semibold',
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {m === 'amount' ? '금액' : '%'}
            </button>
          ))}
        </div>
        <span className="label ml-2">템플릿(현재 {entries}엔트리)</span>
        {ITM_RATIOS.map((r) => (
          <Button
            key={r}
            variant="outline"
            className="h-11"
            onClick={() => {
              setPercents(recommendPayoutCurve(entries, r).map(String));
              setMode('percent');
              setError(null);
            }}
          >
            ITM {Math.round(r * 100)}% · {recommendPayoutCurve(entries, r).length}명
          </Button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          순위별 수령액을 설정하면 탈락 시 자동으로 배정돼요.
        </p>
      ) : (
        <ol className="flex flex-col">
          {list.map((v, i) => (
            <li key={i} className="flex h-13 items-center gap-2 border-b">
              <span className="num w-12 text-muted-foreground">{i + 1}위</span>
              <Input
                aria-label={`${i + 1}위 ${mode === 'amount' ? '금액' : '비율'}`}
                inputMode={mode === 'amount' ? 'numeric' : 'decimal'}
                maxLength={mode === 'amount' ? 13 : 6}
                className="num h-11 flex-1 text-right"
                value={v}
                onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {mode === 'percent' ? (
                <span className="num w-28 text-right text-sm text-prize">
                  {preview.curve.ok ? `${fmtKrw(preview.curve.amounts[i] ?? 0)}원` : '—'}
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${i + 1}위 삭제`}
                onClick={() => setList(list.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Button variant="outline" className="h-11 self-start" onClick={() => setList([...list, ''])}>
        <Plus /> 순위 추가
      </Button>

      {mode === 'percent' && percents.length > 0 && preview.error ? (
        <p className="text-sm text-warning">{preview.error}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
        <span>
          합계 <b className="num text-prize">{fmtKrw(sum)}</b>
        </span>
        <span className="text-muted-foreground">
          현재 풀 <span className="num">{fmtKrw(pool)}</span> · 남음{' '}
          <span className={cn('num', pool - sum < 0 && 'text-destructive')}>
            {fmtKrw(pool - sum)}
          </span>
        </span>
        <Button size="lg" className="ml-auto" disabled={!dirty || save.isPending} onClick={onSave}>
          {save.isPending ? '저장 중…' : '상금 구조 저장'}
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="상금 구조 저장"
        tone="primary"
        confirmLabel="저장"
        onConfirm={() => pending && doSave(pending)}
      >
        이미 탈락한 참가자에게는 소급되지 않아요. 저장할까요?
      </ConfirmDialog>
    </section>
  );
}
