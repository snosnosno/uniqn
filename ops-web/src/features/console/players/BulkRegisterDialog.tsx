/**
 * 명단 붙여넣기 등록 — 엑셀·카톡에서 복사한 줄들을 미리 보고 한 번에 등록한다.
 * 서버가 전부 성공하거나 전부 취소하므로(원자성), 오류가 있는 줄이 하나라도 있으면 등록 버튼을 막는다.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { parseAmount } from '@/core/components/ops/payoutRows';
import type { BulkRegisterRow } from '@/core/repositories/ops';
import { BULK_REGISTER_MAX } from '@/core/schemas/opsParticipant.schema';
import { Field } from '@/routes/auth/AuthShell';
import { parseRoster } from '@/core/domains/ops/roster';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: readonly string[];
  busy: boolean;
  onRegister: (rows: BulkRegisterRow[], buyInAmount: number | undefined, done: () => void) => void;
}

export function BulkRegisterDialog(props: Props) {
  const { open, onOpenChange, busy } = props;
  return (
    // 등록 중에는 닫지 않는다 — 닫고 새 명단을 적는 사이 앞 요청이 끝나면 새 입력이 지워진다.
    <Dialog open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-[640px]">
        {/* 열 때마다 빈 폼에서 시작한다(직전 명단·바이인 금액이 다음 등록에 남지 않게) */}
        {open ? <BulkRegisterForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function BulkRegisterForm({ onOpenChange, existingNames, busy, onRegister }: Props) {
  const [text, setText] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const parsed = useMemo(() => parseRoster(text, existingNames), [text, existingNames]);
  // 숫자가 하나도 없는 금액("abc")은 0원으로 기록하지 않고 막는다.
  const buyInInvalid = buyIn.trim() !== '' && !/\d/.test(buyIn);
  const blocked =
    busy || parsed.rows.length === 0 || parsed.errorCount > 0 || parsed.overLimit || buyInInvalid;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    onRegister(
      parsed.rows.map((r) => ({ name: r.name, phone: r.phone })),
      buyIn.trim() ? parseAmount(buyIn) : undefined,
      () => onOpenChange(false)
    );
  };

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>명단 붙여넣기</DialogTitle>
        <DialogDescription>
          한 줄에 한 명씩 붙여넣으세요. 이름 옆에 연락처가 있으면 함께 등록해요. 한 번에{' '}
          {BULK_REGISTER_MAX}명까지.
        </DialogDescription>
      </DialogHeader>

      <Field id="bulk-roster" label="명단">
        <textarea
          id="bulk-roster"
          autoFocus
          rows={7}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
          placeholder={'홍길동\n김철수 010-1234-5678\n3. 이영희'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>

      {/* 요약은 비어 있어도 항상 둔다 — 내용과 함께 새로 붙는 live region 은 읽히지 않는 경우가 많다 */}
      <p role="status" className={parsed.rows.length > 0 ? 'text-sm' : 'sr-only'}>
        {parsed.rows.length > 0 ? (
          <>
            <b className="num">{parsed.validCount}</b>명 등록 예정
            {parsed.errorCount > 0 ? (
              <span className="text-destructive"> · 오류 {parsed.errorCount}줄</span>
            ) : null}
            {parsed.overLimit ? (
              <span className="text-destructive">
                {' '}
                · {BULK_REGISTER_MAX}명을 넘었어요. 나눠서 등록해 주세요.
              </span>
            ) : null}
          </>
        ) : null}
      </p>

      {parsed.rows.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="max-h-60 overflow-auto border">
            <table className="w-full table-fixed border-collapse text-sm">
              <caption className="sr-only">등록할 명단 미리보기</caption>
              <thead>
                <tr className="label border-b text-left [&>th]:px-2 [&>th]:py-1.5">
                  <th className="w-12 text-right">줄</th>
                  <th>이름</th>
                  <th className="hidden w-36 sm:table-cell">연락처</th>
                  <th className="w-36 sm:w-44">확인</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => (
                  <tr key={r.line} className="h-10 border-b last:border-b-0 [&>td]:px-2">
                    <td className="num text-right text-muted-foreground">{r.line}</td>
                    <td className="truncate font-semibold">{r.name || '—'}</td>
                    <td className="num hidden truncate sm:table-cell">{r.phone ?? ''}</td>
                    <td
                      className={
                        r.error ? 'text-destructive' : r.warning ? 'text-warning' : undefined
                      }
                    >
                      {r.error ?? r.warning ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.errorCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              오류가 있는 줄을 고치거나 지워야 등록할 수 있어요. 한 줄이라도 틀리면 전체가 등록되지
              않아요.
            </p>
          ) : null}
        </div>
      ) : null}

      <Field
        id="bulk-buyin"
        label="바이인 금액(선택 · 전원 같은 금액)"
        error={buyInInvalid ? '금액은 숫자로 입력해 주세요' : undefined}
      >
        <Input
          id="bulk-buyin"
          inputMode="numeric"
          className="num text-right"
          placeholder="입력 안 함"
          value={buyIn}
          onChange={(e) => setBuyIn(e.target.value)}
          aria-invalid={buyInInvalid}
          aria-describedby={buyInInvalid ? 'bulk-buyin-error' : undefined}
        />
      </Field>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          닫기
        </Button>
        <Button type="submit" size="lg" disabled={blocked}>
          {busy ? '등록 중…' : `${parsed.validCount}명 등록`}
        </Button>
      </DialogFooter>
    </form>
  );
}
