/** 테이블 탭 대화상자 — 좌석 배정·테이블 설정(잠금/우선순위/상태/딜러)·테이블 추가·배정 미리보기. */
import { useMemo, useState } from 'react';
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
import type { OpsParticipant, OpsSeat, OpsTable, OpsTableLockType } from '@/core/types/ops';
import { STAFF_ROLE_LABELS, type StaffRole } from '@/core/types/role';
import { useAssignTableStaff, useOpsStaff } from '@/hooks/ops/useStaffPrizeHistory';
import { radioGroupKeyDown, radioTabIndex } from '@/lib/radioGroup';
import {
  useAddTable,
  useCloseTable,
  useRedrawWaitlistFill,
  useReseatParticipants,
  useSetTableLock,
  useSetTablePriority,
} from '@/hooks/ops/useTableMutations';
import { fmt } from '../format';
import { filterParticipants } from '../players/helpers';
import {
  LOCK_LABEL,
  STATUS_LABEL,
  planFingerprint,
  planRedraw,
  unseatedParticipants,
  type RedrawMode,
} from './seatPlan';

/** 딜러 우선 — 모바일 DealerPickerSheet ROLE_ORDER. */
const ROLE_ORDER: StaffRole[] = ['dealer', 'floor', 'manager', 'serving', 'staff', 'other'];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  immediate = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  /** 고르는 즉시 서버에 쓰는 그룹 — 화살표는 포커스만, 확정은 Space/Enter */
  immediate?: boolean;
}) {
  const values = options.map((o) => o.value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={
        disabled
          ? undefined
          : radioGroupKeyDown(values, value, onChange, { selectOnMove: !immediate })
      }
      className="flex border"
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={radioTabIndex(i, values.indexOf(value))}
          disabled={disabled}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            'h-11 flex-1 px-3 text-sm font-semibold',
            value === o.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/** 빈 좌석에 착석 대기 참가자 배정 — 검색(이름·#번호) 후 누르면 바로 배정. */
export function AssignSeatDialog({
  target,
  participants,
  seats,
  onClose,
  onPick,
}: {
  target: OpsSeat | null;
  participants: OpsParticipant[];
  seats: OpsSeat[];
  onClose: () => void;
  onPick: (participantId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const waiting = useMemo(() => unseatedParticipants(participants, seats), [participants, seats]);
  const visible = filterParticipants(waiting, query);
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && (setQuery(''), onClose())}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{target ? `T${target.tableNo}-${target.seatNo}` : ''} 좌석 배정</DialogTitle>
          <DialogDescription>
            착석 대기 {waiting.length}명 · 누르면 바로 앉힙니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="대기 참가자 찾기"
          placeholder="이름 또는 #번호"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col overflow-auto border">
          {visible.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">착석 대기 참가자가 없습니다.</li>
          ) : (
            visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => (setQuery(''), onPick(p.id))}
                  className="flex h-12 w-full items-center gap-2 border-b px-3 text-left text-sm hover:bg-muted"
                >
                  <span className="num w-10 text-muted-foreground">#{p.entryNumber}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="num text-xs text-muted-foreground">{fmt(p.chips)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** 테이블 설정 — 모바일 TablesTab 상세 상단(잠금·우선순위·딜러·상태). 버튼을 눌러야 바뀐다. */
export function TableSettingsDialog({
  tournamentId,
  table,
  onClose,
}: {
  tournamentId: string;
  table: OpsTable;
  onClose: () => void;
}) {
  const lock = useSetTableLock(tournamentId);
  const priority = useSetTablePriority(tournamentId);
  const status = useCloseTable(tournamentId);
  const assign = useAssignTableStaff(tournamentId);
  const roster = useOpsStaff(tournamentId);
  const busy = lock.isPending || priority.isPending || status.isPending || assign.isPending;
  const staff = [...(roster.data ?? [])].sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.staffName.localeCompare(b.staffName, 'ko')
  );
  const current = table.priority == null ? 'none' : String(table.priority);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            T{table.tableNo}
            {table.name?.trim() ? ` · ${table.name}` : ''} 설정
          </DialogTitle>
          <DialogDescription>
            잠금·피처 테이블과 오픈이 아닌 테이블은 자동 배정에서 빠집니다.
          </DialogDescription>
        </DialogHeader>
        <p className="label">잠금</p>
        <Segmented
          label="잠금"
          value={table.lockType}
          options={opts(LOCK_LABEL)}
          disabled={busy}
          immediate
          onChange={(v) => lock.mutate({ tableId: table.id, lockType: v })}
        />
        <p className="label">상태</p>
        <Segmented
          label="상태"
          value={table.status}
          options={opts(STATUS_LABEL)}
          disabled={busy}
          immediate
          onChange={(v) => status.mutate({ tableId: table.id, status: v })}
        />
        <p className="label">우선순위</p>
        <Segmented
          label="우선순위"
          value={current}
          options={['none', '1', '2', '3', '4', '5'].map((v) => ({
            value: v,
            label: v === 'none' ? '없음' : v,
          }))}
          disabled={busy}
          immediate
          onChange={(v) =>
            priority.mutate({ tableId: table.id, priority: v === 'none' ? null : Number(v) })
          }
        />
        <p className="label">딜러</p>
        <ul className="flex max-h-48 flex-col overflow-auto border">
          {roster.isPending ? (
            <li className="p-3 text-sm text-muted-foreground">로스터를 불러오는 중…</li>
          ) : staff.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">
              스태프 탭에서 로스터를 먼저 채우세요.
            </li>
          ) : (
            staff.map((s) => {
              const mine = table.assignedStaffId === s.staffId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy || mine}
                    onClick={() => assign.mutate({ tableId: table.id, staffId: s.staffId })}
                    className={cn(
                      'flex h-12 w-full items-center gap-2 border-b px-3 text-left text-sm hover:bg-muted disabled:hover:bg-transparent',
                      mine && 'font-bold'
                    )}
                  >
                    <span className="w-14 text-xs text-muted-foreground">
                      {s.role === 'other' && s.customRole
                        ? s.customRole
                        : STAFF_ROLE_LABELS[s.role]}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.staffName}</span>
                    {mine ? <span className="text-xs">현재</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {table.assignedStaffId ? (
          <DialogFooter>
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              disabled={busy}
              onClick={() => assign.mutate({ tableId: table.id, staffId: null })}
            >
              딜러 배정 해제
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** 테이블 추가 — 모바일 AddTableForm(좌석 1~11·이름·잠금·우선순위). */
export function AddTableDialog({
  tournamentId,
  onClose,
}: {
  tournamentId: string;
  onClose: () => void;
}) {
  const add = useAddTable(tournamentId);
  const [seatCount, setSeatCount] = useState('9');
  const [name, setName] = useState('');
  const [lockType, setLockType] = useState<OpsTableLockType>('none');
  const [priority, setPriority] = useState('');
  const seatNum = parseInt(seatCount.replace(/[^0-9]/g, ''), 10);
  const seatValid = Number.isInteger(seatNum) && seatNum >= 1 && seatNum <= 11;
  const prio = parseInt(priority.replace(/[^0-9]/g, ''), 10);
  const submit = () => {
    if (!seatValid || add.isPending) return;
    add.mutate(
      {
        seatCount: seatNum,
        name: name.trim() || undefined,
        lockType,
        priority: Number.isInteger(prio) ? prio : undefined,
      },
      { onSuccess: onClose }
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>테이블 추가</DialogTitle>
          <DialogDescription>번호는 자동으로 다음 번호가 붙습니다.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="label">좌석 수(1~11)</span>
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={2}
              className="num"
              value={seatCount}
              onChange={(e) => setSeatCount(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">이름(선택)</span>
            <Input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">우선순위(선택)</span>
            <Input
              inputMode="numeric"
              maxLength={2}
              className="num"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </label>
          <Segmented
            label="잠금"
            value={lockType}
            options={opts(LOCK_LABEL)}
            onChange={setLockType}
          />
          {!seatValid ? (
            <p className="text-sm text-destructive">좌석 수는 1~11 사이여야 해요.</p>
          ) : null}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={!seatValid || add.isPending}>
              {add.isPending ? '추가 중…' : '테이블 추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const REDRAW_TITLE: Record<RedrawMode, string> = {
  waitlist_fill: '빈자리 채우기',
  random_draw: '랜덤 전원 재배치',
  chip_draft: '칩 드래프트 전원 재배치',
};

/**
 * 배정 미리보기 — 모바일 RedrawModal: 누가 어디로 가는지 먼저 보여주고 [다시 계산]·[확정].
 * 전원 재배치(파괴적)는 확정 전에 한 번 더 확인창.
 */
export function RedrawDialog({
  tournamentId,
  mode,
  tables,
  seats,
  participants,
  onClose,
}: {
  tournamentId: string;
  mode: RedrawMode;
  tables: OpsTable[];
  seats: OpsSeat[];
  participants: OpsParticipant[];
  onClose: () => void;
}) {
  const fill = useRedrawWaitlistFill(tournamentId);
  const reseat = useReseatParticipants(tournamentId);
  const [confirming, setConfirming] = useState(false);
  // 좌석이 realtime 으로 바뀌어도 미리보기가 저절로 흔들리지 않게 "다시 계산"을 눌렀을 때만 다시 뽑는다.
  // 대신 계산 뒤 입력이 바뀌면(다른 운영자·새 등록) 확정을 막고 다시 계산을 요구한다(리뷰 W5 — 낡은 계획 재전송).
  const current = planFingerprint(tables, seats, participants);
  const compute = () => ({ plan: planRedraw(mode, tables, seats, participants), fp: current });
  const [planned, setPlanned] = useState(compute);
  const { plan } = planned;
  const stale = planned.fp !== current;
  const nameOf = new Map(participants.map((p) => [p.id, p.name] as const));
  const labelOf = new Map(seats.map((s) => [s.id, `T${s.tableNo}-${s.seatNo}`] as const));
  const pending = fill.isPending || reseat.isPending;
  const canConfirm = plan.assignments.length > 0 && !plan.insufficient && !pending && !stale;
  const recompute = () => setPlanned(compute());
  const run = () => {
    if (!canConfirm) return;
    // 서버가 거절하면(좌석 충돌 등) 같은 계획을 다시 보내지 않게 새로 계산해 둔다
    const after = { onSuccess: onClose, onError: recompute };
    if (plan.mode === 'waitlist_fill') fill.mutate(plan.assignments, after);
    else reseat.mutate({ assignments: plan.assignments, mode: plan.mode }, after);
  };
  const empty = plan.insufficient
    ? '적격 빈 좌석이 부족해 전원을 배치할 수 없어요.'
    : plan.assignments.length === 0
      ? mode === 'waitlist_fill'
        ? '배정할 대기 인원 또는 빈 좌석이 없습니다.'
        : '배정할 활성 참가자가 없습니다.'
      : null;
  return (
    <>
      <Dialog open={!confirming} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{REDRAW_TITLE[mode]}</DialogTitle>
            <DialogDescription>
              {mode === 'waitlist_fill'
                ? `착석 대기 참가자를 빈 좌석(오픈·잠금 없음)에 고르게 앉힙니다. (${plan.assignments.length}명)`
                : `잠금·피처 테이블을 뺀 전원을 새 좌석에 다시 앉힙니다. (${plan.assignments.length}명)`}
            </DialogDescription>
          </DialogHeader>
          {empty ? (
            <p className="text-sm text-muted-foreground">{empty}</p>
          ) : (
            <ol className="flex max-h-72 flex-col overflow-auto border text-sm">
              {plan.assignments.map((a) => (
                <li key={a.seatId} className="flex h-10 items-center gap-2 border-b px-3">
                  <span className="min-w-0 flex-1 truncate">
                    {nameOf.get(a.participantId) ?? '—'}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="num w-16 text-right font-semibold">
                    {labelOf.get(a.seatId) ?? '—'}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {stale ? (
            <p role="alert" className="text-sm text-warning">
              계산한 뒤 좌석이나 참가자가 바뀌었어요. 다시 계산한 뒤 배정하세요.
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" disabled={pending} onClick={recompute}>
              다시 계산
            </Button>
            <Button
              size="lg"
              disabled={!canConfirm}
              onClick={() => (mode === 'waitlist_fill' ? run() : setConfirming(true))}
            >
              {pending ? '배정 중…' : `${plan.assignments.length}명 배정`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        title="전원 재배치"
        confirmLabel="재배치"
        onConfirm={run}
      >
        {plan.assignments.length}명을 새 좌석에 전원 재배치합니다. 지금 앉은 자리는 모두 바뀝니다.
      </ConfirmDialog>
    </>
  );
}
