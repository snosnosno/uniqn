import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
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
import { buildLedgerRows, fmtKrw, parseAmount } from '@/core/components/ops/payoutRows';
import type { OpsParticipant, OpsPrize, OpsTournament } from '@/core/types/ops';
import { useCorrectPrize, useSetPrizePaid } from '@/hooks/ops/useStaffPrizeHistory';

type Target = { id: string; name: string; prizeAmount: number | null };

/**
 * 지급 대장 — 모바일 PayoutLedger: 구조 + 실지급 조인(순위 확정 전원), 정정 행 강조, 지급 완료 토글
 * (확인 없음·왕복 자유, 상금 배정 행만), 행 → 정정/회수(회수는 확인), 바운티 적립 섹션.
 */
export function PayoutLedger({
  tournament,
  prizes,
  participants,
}: {
  tournament: OpsTournament;
  prizes: OpsPrize[];
  participants: OpsParticipant[];
}) {
  const paid = useSetPrizePaid(tournament.id);
  const [target, setTarget] = useState<Target | null>(null);
  const rows = buildLedgerRows(prizes, participants);
  const pendingId = paid.isPending ? paid.variables?.participantId : undefined;
  const bountyCost = tournament.bountyCost ?? null;
  const bountyRows = bountyCost !== null ? participants.filter((p) => p.knockouts > 0) : [];

  return (
    <section aria-label="지급 대장" className="flex flex-col border bg-card">
      <h2 className="label border-b px-4 py-3">지급 대장</h2>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          아직 지급 내역이 없어요. 상금 구조를 만들거나 참가자가 확정되면 표시돼요.
        </p>
      ) : (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="label border-b text-left [&>th]:px-3 [&>th]:py-2">
              {/* 375px 에서 이름 열이 사라지지 않게 구조 열은 sm 이상에서만(리뷰 W6) */}
              <th className="w-12">순위</th>
              <th>참가자</th>
              <th className="hidden w-28 text-right sm:table-cell">구조</th>
              <th className="w-24 text-right">실지급</th>
              <th className="w-14 text-center">지급</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isPaid = r.prizePaidAt !== null;
              const canToggle =
                r.participantId !== null && r.paidAmount !== null && r.paidAmount > 0;
              return (
                <tr
                  key={`${r.rank}-${r.participantId ?? 'none'}`}
                  className={cn('h-13 border-b [&>td]:px-2', r.corrected && 'bg-warning/10')}
                >
                  <td className="num">{r.rank}</td>
                  <td className="truncate">
                    {r.participantId ? (
                      <button
                        type="button"
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() =>
                          setTarget({
                            id: r.participantId!,
                            name: r.winnerName ?? '무명',
                            prizeAmount: r.paidAmount,
                          })
                        }
                      >
                        {r.winnerName ?? '무명'}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">미확정</span>
                    )}
                  </td>
                  <td className="num hidden text-right text-muted-foreground sm:table-cell">
                    {r.structureAmount !== null ? fmtKrw(r.structureAmount) : '—'}
                  </td>
                  <td className="num text-right text-prize">
                    {r.paidAmount !== null ? fmtKrw(r.paidAmount) : '—'}
                  </td>
                  <td className="text-center">
                    {canToggle ? (
                      <Button
                        variant={isPaid ? 'default' : 'outline'}
                        size="icon"
                        role="checkbox"
                        aria-checked={isPaid}
                        aria-label={`${r.rank}위 지급 완료`}
                        disabled={pendingId === r.participantId}
                        onClick={() =>
                          paid.mutate({ participantId: r.participantId!, paid: !isPaid })
                        }
                      >
                        {isPaid ? <Check /> : null}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {bountyCost !== null ? (
        <div className="border-t p-4 text-sm">
          <p className="label mb-2">바운티 적립 (건당 {fmtKrw(bountyCost)}원)</p>
          {bountyRows.length === 0 ? (
            <p className="text-muted-foreground">아직 녹아웃 적립이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {bountyRows.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="num">
                    KO {p.knockouts} · 적립 {fmtKrw(p.knockouts * bountyCost)}원
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t pt-1 font-semibold">
                <span>합계</span>
                <span className="num text-prize">
                  {fmtKrw(bountyRows.reduce((s, p) => s + p.knockouts * bountyCost, 0))}원
                </span>
              </li>
            </ul>
          )}
        </div>
      ) : null}

      <PrizeCorrectDialog
        key={target?.id ?? 'none'}
        tournamentId={tournament.id}
        target={target}
        onClose={() => setTarget(null)}
      />
    </section>
  );
}

/** 상금 정정 — 새 금액 + 사유(선택). 회수(0/미지급)는 확인창. 완료 대회에서도 동작(모바일 D3). */
function PrizeCorrectDialog({
  tournamentId,
  target,
  onClose,
}: {
  tournamentId: string;
  target: Target | null;
  onClose: () => void;
}) {
  const correct = useCorrectPrize(tournamentId);
  const [amount, setAmount] = useState(
    target?.prizeAmount != null ? String(target.prizeAmount) : ''
  );
  const [reason, setReason] = useState('');
  const [confirmRecall, setConfirmRecall] = useState(false);
  if (!target) return null;
  const reasonValue = reason.trim() || undefined;
  return (
    <>
      <Dialog open={!confirmRecall} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{target.name} 상금 정정</DialogTitle>
            <DialogDescription>
              현재{' '}
              <b className="num">
                {target.prizeAmount != null ? fmtKrw(target.prizeAmount) : '미지급'}
              </b>
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5">
            <span className="label">새 금액</span>
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={13}
              className="num text-right"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">사유(선택)</span>
            <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </label>
          <DialogFooter>
            <Button
              variant="destructive"
              className="h-11 sm:mr-auto"
              disabled={correct.isPending}
              onClick={() => setConfirmRecall(true)}
            >
              회수
            </Button>
            <Button
              size="lg"
              disabled={correct.isPending}
              onClick={() =>
                correct.mutate(
                  { participantId: target.id, amount: parseAmount(amount), reason: reasonValue },
                  { onSuccess: onClose }
                )
              }
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmRecall}
        onOpenChange={setConfirmRecall}
        title="상금 회수"
        confirmLabel="회수"
        onConfirm={() =>
          !correct.isPending &&
          correct.mutate(
            { participantId: target.id, amount: null, reason: reasonValue },
            { onSuccess: onClose }
          )
        }
      >
        {target.name} 님의 상금을 회수(0/미지급)할까요?
      </ConfirmDialog>
    </>
  );
}
