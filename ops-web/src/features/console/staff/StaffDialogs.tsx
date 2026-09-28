/** 스태프 대화상자 — 근태 기록(사유별 fail-closed)·수동 추가(닉네임 검색). */
import { useState } from 'react';
import { format } from 'date-fns';
import { formatTs } from './formatTs';
import { ko } from 'date-fns/locale/ko';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { LoadError } from '@/components/ops/LoadState';
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
import { addOpsStaffInputSchema } from '@/core/schemas/opsStaff.schema';
import { attendanceState } from './attendanceState';
import type { OpsStaff, OpsStaffWorkLogLink, OpsTable } from '@/core/types/ops';
import { STAFF_ROLE_LABELS, VALID_STAFF_ROLES, type StaffRole } from '@/core/types/role';
import { toUserMessage } from '@/lib/errorMessage';
import {
  useAddOpsStaff,
  useAssignTableStaff,
  useNicknameSearch,
  useRecordOpsAttendance,
} from '@/hooks/ops/useStaffPrizeHistory';

type Pending = { axis: 'checkIn' | 'checkOut'; next: Date | null };

/**
 * 근태 기록 — 모바일 StaffAttendanceSheet: `ok && writeAllowed` 일 때만 컨트롤을 연다(틀린 행에
 * 시각이 박히는 것 방지), 사유별 안내는 모바일 문구 사본, 기록·취소 모두 확인창(알림이 나간다).
 * 🚨 일괄 버튼 없음(알림 폭주 — 모바일 §결정 5). 기록 중에는 두 축을 잠근다(이중 기록·이중 알림 방지).
 */
export function AttendanceDialog({
  tournamentId,
  staffName,
  link,
  loadError,
  onRetry,
  onClose,
}: {
  tournamentId: string;
  staffName: string;
  /** undefined = 불러오는 중, null = 이 스태프의 근무 기록 행 없음 */
  link: OpsStaffWorkLogLink | null | undefined;
  /** 조회 실패 — "근무 기록 없음"으로 위장하지 않는다(리뷰 W6) */
  loadError: unknown;
  onRetry: () => void;
  onClose: () => void;
}) {
  const record = useRecordOpsAttendance(tournamentId);
  const [pending, setPending] = useState<Pending | null>(null);
  const { notice, canWrite } = attendanceState(link, loadError);
  const busy = record.isPending;

  const axisButton = (axis: 'checkIn' | 'checkOut', ts: string | null) => {
    const label = axis === 'checkIn' ? '출근' : '퇴근';
    return ts ? (
      <Button
        variant="outline"
        size="lg"
        disabled={busy}
        onClick={() => setPending({ axis, next: null })}
      >
        {label} 기록 취소
      </Button>
    ) : (
      <Button size="lg" disabled={busy} onClick={() => setPending({ axis, next: new Date() })}>
        지금 {label}
      </Button>
    );
  };

  return (
    <>
      <Dialog open={pending === null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{staffName} 근태</DialogTitle>
            <DialogDescription>기록하면 스태프에게 알림이 발송됩니다.</DialogDescription>
          </DialogHeader>
          {loadError ? (
            <LoadError title="근태 정보를 불러오지 못했어요" error={loadError} onRetry={onRetry} />
          ) : (
            <dl className="grid grid-cols-2 border-t border-l text-sm">
              <div className="border-r border-b p-3">
                <dt className="label">출근</dt>
                <dd className="num font-semibold">{formatTs(link?.checkInTs ?? null)}</dd>
              </div>
              <div className="border-r border-b p-3">
                <dt className="label">퇴근</dt>
                <dd className="num font-semibold">{formatTs(link?.checkOutTs ?? null)}</dd>
              </div>
            </dl>
          )}
          {notice ? <p className="text-sm text-warning">{notice}</p> : null}
          {busy ? (
            <p role="status" className="text-sm text-muted-foreground">
              기록하는 중…
            </p>
          ) : null}
          {canWrite && link ? (
            <DialogFooter className="grid grid-cols-2 gap-2">
              {axisButton('checkIn', link.checkInTs)}
              {axisButton('checkOut', link.checkOutTs)}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={`${pending?.axis === 'checkOut' ? '퇴근' : '출근'} ${pending?.next ? '기록' : '기록 취소'}`}
        confirmLabel={pending?.next ? '기록' : '기록 취소'}
        tone={pending?.next ? 'primary' : 'danger'}
        onConfirm={() => {
          if (!pending || !link?.workLogId || record.isPending) return;
          record.mutate({ workLogId: link.workLogId, [pending.axis]: pending.next });
        }}
      >
        {pending?.next
          ? `${staffName} 님의 ${pending.axis === 'checkIn' ? '출근' : '퇴근'}을 ${format(pending.next, 'M월 d일 HH:mm', { locale: ko })} 로 기록할까요? 스태프에게 알림이 발송됩니다.`
          : `${staffName} 님의 ${pending?.axis === 'checkOut' ? '퇴근' : '출근'} 기록을 지울까요?`}
      </ConfirmDialog>
    </>
  );
}

/**
 * 테이블 지정 — 모바일 바텀시트처럼 목록에서 **눌러야** 바뀐다(select 화살표 키 변이 방지 — 리뷰 W6 HIGH).
 * 이미 다른 딜러가 있는 테이블은 누가 있는지 보여준다(배정하면 그 딜러는 빠진다).
 */
export function TableAssignDialog({
  tournamentId,
  staff,
  tables,
  roster,
  onClose,
}: {
  tournamentId: string;
  staff: OpsStaff;
  tables: OpsTable[];
  roster: OpsStaff[];
  onClose: () => void;
}) {
  const assign = useAssignTableStaff(tournamentId);
  const current = tables.find((t) => t.assignedStaffId === staff.staffId) ?? null;
  const nameOf = (uid: string | null | undefined) =>
    uid ? (roster.find((r) => r.staffId === uid)?.staffName ?? '다른 딜러') : null;
  const run = (tableId: string, staffId: string | null) =>
    assign.mutate({ tableId, staffId }, { onSuccess: onClose });
  const sorted = [...tables].sort((a, b) => a.tableNo - b.tableNo);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{staff.staffName} 테이블 지정</DialogTitle>
          <DialogDescription>
            현재 {current ? `T${current.tableNo}` : '배정 없음'} · 누르면 바로 바뀝니다.
          </DialogDescription>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            테이블이 없습니다. 테이블 탭에서 먼저 만드세요.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col overflow-auto border">
            {sorted.map((t) => {
              const mine = t.id === current?.id;
              const other = mine ? null : nameOf(t.assignedStaffId);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={mine || assign.isPending}
                    aria-current={mine || undefined}
                    onClick={() => run(t.id, staff.staffId)}
                    className={cn(
                      'flex h-12 w-full items-center gap-2 border-b px-3 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent',
                      mine && 'font-bold'
                    )}
                  >
                    <span className="num w-10">T{t.tableNo}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {t.name?.trim() ?? ''}
                    </span>
                    {mine ? <span className="text-xs">현재</span> : null}
                    {other ? <span className="text-xs text-warning">{other} 배정 중</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {current ? (
          <DialogFooter>
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              disabled={assign.isPending}
              onClick={() => run(current.id, null)}
            >
              배정 해제
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** 수동 추가 —모바일 StaffAddSheet: 닉네임 2~15자 검색 → 선택 → 역할(기타면 이름 입력) → zod 재검증. */
export function AddStaffDialog({
  tournamentId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const add = useAddOpsStaff(tournamentId);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ uid: string; label: string } | null>(null);
  const [role, setRole] = useState<StaffRole | ''>('');
  const [customRole, setCustomRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState('');
  const search = useNicknameSearch(submitted);
  const queryLen = query.trim().length;
  const queryValid = queryLen >= 2 && queryLen <= 15;
  const isOther = role === 'other';

  const submit = () => {
    if (!selected || !role) return;
    const parsed = addOpsStaffInputSchema.safeParse({
      staffId: selected.uid,
      role,
      customRole: isOther ? customRole.trim() : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력을 확인해 주세요');
      return;
    }
    add.mutate(
      { staffId: selected.uid, role, customRole: isOther ? customRole.trim() : null },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>스태프 추가</DialogTitle>
          <DialogDescription>UNIQN 가입자를 닉네임으로 찾아요(2~15자).</DialogDescription>
        </DialogHeader>
        {/* 검색은 버튼·Enter 로만 보낸다(모바일과 같음 — 글자마다 RPC 를 쏘지 않는다) */}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSelected(null);
            setSubmitted(query.trim());
          }}
        >
          <Input
            autoFocus
            aria-label="닉네임 검색"
            placeholder="닉네임"
            maxLength={15}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" variant="outline" className="h-11" disabled={!queryValid}>
            검색
          </Button>
        </form>
        <ul className="flex max-h-48 flex-col overflow-auto border">
          {search.isFetching ? (
            <li className="p-3 text-sm text-muted-foreground">찾는 중…</li>
          ) : search.isError ? (
            <li role="alert" className="p-3 text-sm text-destructive">
              {toUserMessage(search.error)}
            </li>
          ) : null}
          {(search.data ?? []).map((u) => (
            <li key={u.uid}>
              <button
                type="button"
                className={cn(
                  'flex h-12 w-full items-center gap-2 border-b px-3 text-left text-sm hover:bg-muted',
                  selected?.uid === u.uid && 'bg-muted font-bold'
                )}
                onClick={() => setSelected({ uid: u.uid, label: u.nickname ?? u.name })}
              >
                {/* 이름 + 닉네임을 함께 — 동명이인 구분(모바일 StaffAddSheet) */}
                <span className="truncate">{u.name}</span>
                {u.nickname ? (
                  <span className="text-xs text-muted-foreground">@{u.nickname}</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">{u.region}</span>
              </button>
            </li>
          ))}
          {search.isSuccess && !search.isFetching && (search.data ?? []).length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">찾는 사람이 없어요.</li>
          ) : null}
        </ul>
        <div role="radiogroup" aria-label="역할" className="flex flex-wrap gap-1.5">
          {VALID_STAFF_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={cn(
                'h-11 rounded-lg border px-3 text-sm',
                role === r
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {STAFF_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        {isOther ? (
          <Input
            aria-label="역할명 직접 입력"
            placeholder="역할명 직접 입력"
            maxLength={20}
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
          />
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            size="lg"
            disabled={!selected || !role || (isOther && !customRole.trim()) || add.isPending}
            onClick={submit}
          >
            {selected ? `${selected.label} 추가` : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
