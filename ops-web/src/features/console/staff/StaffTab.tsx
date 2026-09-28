import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { LoadError, Loading } from '@/components/ops/LoadState';
import { Button } from '@/components/ui/button';
import type { OpsStaff, OpsTable, OpsTournament } from '@/core/types/ops';
import { STAFF_ROLE_LABELS } from '@/core/types/role';
import { useAuth } from '@/auth/authContext';
import { useManagedPostings, useSetTournamentPosting } from '@/hooks/ops/useTournaments';
import {
  useImportOpsStaff,
  useOpsStaff,
  useOpsStaffWorkLogs,
  useRemoveOpsStaff,
} from '@/hooks/ops/useStaffPrizeHistory';
import { formatTs } from './formatTs';
import { AddStaffDialog, AttendanceDialog, TableAssignDialog } from './StaffDialogs';

type Confirm =
  | { kind: 'link'; postingId: string; title: string }
  | { kind: 'unlink' }
  | { kind: 'import'; date: string | null }
  | { kind: 'remove'; staff: OpsStaff };

const CONFIRM_TEXT = {
  link: { title: '공고 연결', label: '연결', tone: 'primary' },
  unlink: { title: '공고 연결 해제', label: '해제', tone: 'danger' },
  import: { title: '확정 스태프 가져오기', label: '가져오기', tone: 'primary' },
  remove: { title: '로스터에서 삭제', label: '삭제', tone: 'danger' },
} as const;

/**
 * 스태프 — 모바일 StaffTab: 연결 공고(owner 만 변경/해제), 확정 스태프 가져오기(전체 기간 토글),
 * 로스터(근태·테이블 지정·삭제), 수동 추가. 권한 최종 판정은 서버 RPC.
 * 🚨 select 의 change 로 바로 변이하지 않는다 — 닫힌 select 는 화살표 키마다 change 를 낸다(리뷰 W6 HIGH).
 * 공고는 고른 뒤 버튼 + 확인창, 테이블은 목록 대화상자에서 누른다(모바일 바텀시트와 같은 명시 선택).
 */
export function StaffTab({
  tournament,
  tables,
}: {
  tournament: OpsTournament;
  tables: OpsTable[];
}) {
  const id = tournament.id;
  const auth = useAuth();
  const isOwner = auth.status === 'signedIn' && auth.session.user.id === tournament.ownerId;
  const roster = useOpsStaff(id);
  const links = useOpsStaffWorkLogs(id);
  const importStaff = useImportOpsStaff(id);
  const setPosting = useSetTournamentPosting(id);
  const remove = useRemoveOpsStaff(id);
  const [fullPeriod, setFullPeriod] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<OpsStaff | null>(null);
  const [tableFor, setTableFor] = useState<OpsStaff | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const list = roster.data ?? [];
  const linkOf = (s: OpsStaff) => (links.data ?? []).find((l) => l.opsStaffId === s.id);
  const tableOf = (s: OpsStaff) => tables.find((t) => t.assignedStaffId === s.staffId) ?? null;
  const importDate = fullPeriod || !tournament.eventDate ? null : tournament.eventDate;
  const text = confirm ? CONFIRM_TEXT[confirm.kind] : CONFIRM_TEXT.remove;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PostingSection
        tournament={tournament}
        isOwner={isOwner}
        busy={setPosting.isPending}
        onPick={(postingId, title) => setConfirm({ kind: 'link', postingId, title })}
        onUnlink={() => setConfirm({ kind: 'unlink' })}
      />

      {tournament.jobPostingId ? (
        <section
          aria-label="확정 스태프 가져오기"
          className="flex flex-wrap items-center gap-3 border bg-card p-4"
        >
          <span className="text-sm">
            <b className="num">{importDate ?? '전체 기간'}</b> 기준
          </span>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fullPeriod}
              onChange={(e) => setFullPeriod(e.target.checked)}
            />
            전체 기간
          </label>
          <Button
            size="lg"
            className="ml-auto"
            disabled={importStaff.isPending}
            onClick={() => setConfirm({ kind: 'import', date: importDate })}
          >
            확정 스태프 가져오기
          </Button>
        </section>
      ) : null}

      <section aria-label="스태프 로스터" className="border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="label">로스터 · {list.length}명</span>
          <Button variant="outline" className="ml-auto h-11" onClick={() => setAddOpen(true)}>
            <UserPlus /> 스태프 추가
          </Button>
        </div>
        {roster.isError && !roster.data ? (
          <LoadError
            title="스태프 로스터를 불러오지 못했어요"
            error={roster.error}
            onRetry={() => roster.refetch()}
          />
        ) : roster.isPending ? (
          <Loading label="로스터를 불러오는 중…" />
        ) : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">등록된 스태프가 없습니다.</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="label border-b text-left [&>th]:px-2 [&>th]:py-2">
                <th>이름</th>
                <th className="hidden w-20 sm:table-cell">역할</th>
                <th className="hidden w-32 md:table-cell">출근</th>
                <th className="hidden w-32 md:table-cell">퇴근</th>
                <th className="w-16">테이블</th>
                <th className="w-[124px] text-right">동작</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const link = linkOf(s);
                const table = tableOf(s);
                const role =
                  s.role === 'other' && s.customRole ? s.customRole : STAFF_ROLE_LABELS[s.role];
                return (
                  <tr key={s.id} className="h-13 border-b [&>td]:px-2">
                    <td className="truncate">
                      {s.staffName}
                      {s.staffNickname ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          @{s.staffNickname}
                        </span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground sm:hidden">{role}</span>
                    </td>
                    <td className="hidden sm:table-cell">{role}</td>
                    <td className="num hidden md:table-cell">
                      {formatTs(link?.checkInTs ?? null)}
                    </td>
                    <td className="num hidden md:table-cell">
                      {formatTs(link?.checkOutTs ?? null)}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        className="num h-11 w-full px-1"
                        aria-label={`${s.staffName} 테이블 지정(현재 ${table ? `T${table.tableNo}` : '없음'})`}
                        onClick={() => setTableFor(s)}
                      >
                        {table ? `T${table.tableNo}` : '—'}
                      </Button>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        className="h-11 px-2.5"
                        onClick={() => setAttendanceFor(s)}
                      >
                        근태
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 px-2.5 text-destructive"
                        onClick={() => setConfirm({ kind: 'remove', staff: s })}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {attendanceFor ? (
        <AttendanceDialog
          tournamentId={id}
          staffName={attendanceFor.staffName}
          link={links.isPending ? undefined : (linkOf(attendanceFor) ?? null)}
          loadError={links.isError && !links.data ? links.error : null}
          onRetry={() => links.refetch()}
          onClose={() => setAttendanceFor(null)}
        />
      ) : null}
      {tableFor ? (
        <TableAssignDialog
          tournamentId={id}
          staff={tableFor}
          tables={tables}
          roster={list}
          onClose={() => setTableFor(null)}
        />
      ) : null}
      {/* 열 때마다 새로 마운트 — 닫았다 열면 검색어·선택·역할이 비워진다(모바일 resetAll) */}
      {addOpen ? <AddStaffDialog tournamentId={id} open onOpenChange={setAddOpen} /> : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={text.title}
        confirmLabel={text.label}
        tone={text.tone}
        onConfirm={() => {
          if (confirm?.kind === 'link') setPosting.mutate(confirm.postingId);
          else if (confirm?.kind === 'unlink') setPosting.mutate(null);
          else if (confirm?.kind === 'import') importStaff.mutate(confirm.date);
          else if (confirm?.kind === 'remove') remove.mutate(confirm.staff.id);
        }}
      >
        <ConfirmBody confirm={confirm} hasLinked={!!tournament.jobPostingId} />
      </ConfirmDialog>
    </div>
  );
}

function ConfirmBody({ confirm, hasLinked }: { confirm: Confirm | null; hasLinked: boolean }) {
  switch (confirm?.kind) {
    case 'link':
      return (
        <>
          <b>{confirm.title}</b> 공고에 연결할까요?
          {hasLinked
            ? ' 기존 공고 경유로 접근하던 팀 멤버의 열람 권한이 축소될 수 있고, 근태는 새 공고의 근무 기록 기준으로 바뀝니다.'
            : ''}
        </>
      );
    case 'unlink':
      return '연결을 해제하면 이 대회에 공고 경유로 접근하던 팀 멤버의 열람 권한이 축소될 수 있습니다.';
    case 'import':
      return '이미 있는 스태프는 건너뛰고, 삭제했던 스태프는 다시 추가됩니다.';
    case 'remove':
      return `${confirm.staff.staffName} 님을 로스터에서 삭제할까요? 배정된 테이블이 있으면 함께 해제됩니다.`;
    default:
      return null;
  }
}

/** 연결 공고 — select 는 고르기만 하고, 변경은 버튼 → 확인창에서만 일어난다. */
function PostingSection({
  tournament,
  isOwner,
  busy,
  onPick,
  onUnlink,
}: {
  tournament: OpsTournament;
  isOwner: boolean;
  busy: boolean;
  onPick: (postingId: string, title: string) => void;
  onUnlink: () => void;
}) {
  const postings = useManagedPostings();
  const [picked, setPicked] = useState('');
  const current = tournament.jobPostingId;
  const linked = current ? ((postings.data ?? []).find((p) => p.id === current) ?? null) : null;
  const options = (postings.data ?? []).filter((p) => p.id !== current);
  const pickedTitle = options.find((p) => p.id === picked)?.title ?? null;

  return (
    <section
      aria-label="연결된 공고"
      className="flex flex-wrap items-center gap-3 border bg-card p-4"
    >
      <span className="label">연결된 공고</span>
      <span className="min-w-0 flex-1 truncate font-semibold">
        {current ? (linked?.title ?? '연결됨(현재 목록에서 찾을 수 없음)') : '연결 안 됨'}
      </span>
      {isOwner ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <select
            aria-label={current ? '바꿀 공고 선택' : '연결할 공고 선택'}
            className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm sm:w-56 sm:flex-none dark:bg-input/30"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value="">{current ? '바꿀 공고…' : '연결할 공고…'}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            className="h-11"
            disabled={!pickedTitle || busy}
            onClick={() => {
              if (!pickedTitle) return;
              onPick(picked, pickedTitle);
              setPicked('');
            }}
          >
            {current ? '변경' : '연결'}
          </Button>
          {current ? (
            <Button variant="ghost" className="h-11 text-destructive" onClick={onUnlink}>
              해제
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
