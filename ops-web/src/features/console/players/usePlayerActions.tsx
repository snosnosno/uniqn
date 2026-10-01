/**
 * 참가자 액션 컨트롤러 — 뮤테이션 + 확인창·입력 대화상자 상태를 한곳에서.
 * 상세 패널(≥1024)·시트(<1024)·단축키가 같은 `run(action, participant)` 를 부른다.
 *
 * 확인창 규칙(DESIGN.md + 모바일): 탈락·탈락 취소·노쇼·등록 취소·연결 해제·PIN 재발급 = 확인창.
 * 리바이·애드온·재진입·노쇼 취소 = 즉시(모바일과 같음). 탈락은 성공 뒤 **5초 되돌리기 토스트**.
 */
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import type { OpsParticipant, OpsPrize, OpsTournament } from '@/core/types/ops';
import {
  useAddAddon,
  useAddRebuy,
  useBustParticipant,
  useDeleteParticipant,
  useIssuePlayerCredentials,
  useReenterParticipant,
  useRegisterParticipant,
  useSetParticipantChips,
  useSetParticipantNoShow,
  useUnclaimParticipant,
  useUndoBust,
  useUpdateParticipant,
} from '@/hooks/ops/useConsoleMutations';
import { fmt } from '../format';
import {
  bustResultMessage,
  eliminatorCandidates,
  isBountyTournament,
  predictBust,
  type ParticipantAction,
} from '../participantActions';
import {
  ChipCountDialog,
  CredentialsDialog,
  type IssuedCredentials,
  EditParticipantDialog,
  KoPickerDialog,
  RegisterDialog,
} from './ParticipantDialogs';

type Confirm =
  | { kind: 'bust'; p: OpsParticipant; eliminator: OpsParticipant | null }
  | { kind: 'undoBust' | 'noShow' | 'delete' | 'unclaim' | 'reissue'; p: OpsParticipant };

export type RunnableAction = ParticipantAction | 'credentials';

interface Options {
  tournament: OpsTournament;
  participants: OpsParticipant[];
  prizes: OpsPrize[];
  seatOf: (participantId: string) => string | null;
  onOpenPayouts: () => void;
}

export function usePlayerActions(o: Options) {
  const id = o.tournament.id;
  const rebuy = useAddRebuy(id, o.tournament.rebuyChips ?? 0);
  const addon = useAddAddon(id, o.tournament.addonChips ?? 0);
  const bust = useBustParticipant(id);
  const undoBust = useUndoBust(id);
  const reenter = useReenterParticipant(id);
  const noShow = useSetParticipantNoShow(id);
  const chips = useSetParticipantChips(id);
  const update = useUpdateParticipant(id);
  const remove = useDeleteParticipant(id);
  const unclaim = useUnclaimParticipant(id);
  const issue = useIssuePlayerCredentials(id);
  const register = useRegisterParticipant(id);

  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [chipFor, setChipFor] = useState<OpsParticipant | null>(null);
  const [editFor, setEditFor] = useState<OpsParticipant | null>(null);
  const [koFor, setKoFor] = useState<OpsParticipant | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null);

  const issueCredentials = (p: OpsParticipant) =>
    issue.mutate(p.id, {
      onSuccess: (c) =>
        setCredentials({
          tournamentName: o.tournament.name,
          entryNumber: p.entryNumber,
          name: p.name,
          viewToken: c.viewToken,
          claimPin: c.claimPin,
        }),
    });

  const run = (action: RunnableAction, p: OpsParticipant) => {
    switch (action) {
      case 'rebuy':
        return rebuy.mutate(p.id);
      case 'addon':
        return addon.mutate(p.id);
      case 'reenter':
        return reenter.mutate(p.id);
      case 'undoNoShow':
        return noShow.mutate({ participantId: p.id, noShow: false });
      case 'chips':
        return setChipFor(p);
      case 'edit':
        return setEditFor(p);
      case 'openPayouts':
        return o.onOpenPayouts();
      case 'bust':
        return isBountyTournament(o.tournament)
          ? setKoFor(p)
          : setConfirm({ kind: 'bust', p, eliminator: null });
      case 'undoBust':
      case 'noShow':
      case 'delete':
      case 'unclaim':
        return setConfirm({ kind: action, p });
      case 'credentials':
        return p.viewToken ? setConfirm({ kind: 'reissue', p }) : issueCredentials(p);
    }
  };

  const doBust = (p: OpsParticipant, eliminatorId: string | null) =>
    bust.mutate(
      { participantId: p.id, eliminatorId },
      {
        onSuccess: (r) => {
          const m = bustResultMessage(r);
          // 되돌리기 토스트 — 서버가 ops_undo_bust 를 지원하므로 5초 동안 한 번에 되돌린다(DESIGN.md).
          toast.success(`${m.title} · ${p.name}`, {
            description: m.body,
            duration: 5000,
            // 우승 확정 탈락은 대회가 종료돼 서버가 되돌리기를 거부한다 — 버튼을 내지 않는다.
            action:
              o.tournament.status === 'active' && !r.winnerFinalized
                ? { label: '되돌리기', onClick: () => undoBust.mutate(p.id) }
                : undefined,
          });
        },
      }
    );

  // 서버 ops_bust_participant 와 같은 산식(현재 active 이상 최소 미사용 순위) — live_stats 로딩과 무관.
  const predicted = predictBust(o.participants);
  const predictedPrize = o.prizes.find((z) => z.rank === predicted.rank)?.amount ?? null;

  const confirmBody = (c: Confirm): { title: string; label: string; body: ReactNode } => {
    const who = (
      <b className="text-foreground">
        #{c.p.entryNumber} {c.p.name}
      </b>
    );
    switch (c.kind) {
      case 'bust':
        return {
          title: '탈락 처리',
          label: '탈락',
          body: (
            <>
              {who} · 좌석 <b className="num text-foreground">{o.seatOf(c.p.id) ?? '미착석'}</b> ·
              칩 <b className="num text-foreground">{fmt(c.p.chips)}</b>
              <br />
              예상 순위 <b className="num text-foreground">{predicted.rank}위</b> · 상금{' '}
              <b className="num text-prize">
                {predictedPrize !== null ? fmt(predictedPrize) : '없음'}
              </b>
              {predicted.winnerFinalized ? (
                <>
                  <br />
                  <b className="text-warning">이 탈락으로 우승이 확정되고 대회가 종료돼요.</b>
                </>
              ) : null}
              {isBountyTournament(o.tournament) ? (
                <>
                  <br />
                  KO: <b className="text-foreground">{c.eliminator?.name ?? '지정 안 함'}</b>
                </>
              ) : null}
            </>
          ),
        };
      case 'undoBust':
        return {
          title: '탈락 취소',
          label: '탈락 취소',
          body: <>{who} 님의 탈락을 취소해요. 칩과 좌석이 복원됩니다.</>,
        };
      case 'noShow':
        return {
          title: '노쇼 처리',
          label: '노쇼 처리',
          body: (
            <>{who} 님을 노쇼로 표시해요. 좌석 배정 대상에서 제외되고, 나중에 취소할 수 있어요.</>
          ),
        };
      case 'delete':
        return {
          title: '등록 취소',
          label: '등록 취소',
          body: (
            <>
              {who} 님의 등록을 취소해요. 참가자 기록이 삭제되고 상금 풀에서도 빠집니다. 되돌릴 수
              없어요.
            </>
          ),
        };
      case 'unclaim':
        return {
          title: '플레이어 연결 해제',
          label: '연결 해제',
          body: (
            <>
              {who} 님의 플레이어 계정 연결을 해제해요. 참가자 기록은 그대로 남고, 연결만 풀립니다.
            </>
          ),
        };
      case 'reissue':
        return {
          title: 'PIN 재발급',
          label: '재발급',
          body: <>{who} · 재발급하면 이전 PIN 은 사용할 수 없어요.</>,
        };
    }
  };

  const onConfirm = (c: Confirm) => {
    switch (c.kind) {
      case 'bust':
        return doBust(c.p, c.eliminator?.id ?? null);
      case 'undoBust':
        return undoBust.mutate(c.p.id);
      case 'noShow':
        return noShow.mutate({ participantId: c.p.id, noShow: true });
      case 'delete':
        return remove.mutate(c.p.id);
      case 'unclaim':
        return unclaim.mutate(c.p.id);
      case 'reissue':
        return issueCredentials(c.p);
    }
  };

  const view = confirm ? confirmBody(confirm) : null;

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={view?.title ?? ''}
        confirmLabel={view?.label ?? ''}
        tone={confirm?.kind === 'reissue' ? 'primary' : 'danger'}
        onConfirm={() => confirm && onConfirm(confirm)}
      >
        {view?.body}
      </ConfirmDialog>
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        tournamentId={id}
        busy={register.isPending}
        onRegister={(values, done) => register.mutate(values, { onSuccess: done })}
      />
      <ChipCountDialog
        key={chipFor?.id ?? 'none'}
        // 열린 동안 realtime·낙관적 반영으로 바뀐 "현재 칩"을 보이도록 최신 행으로 갈아 끼운다.
        participant={chipFor ? (o.participants.find((x) => x.id === chipFor.id) ?? chipFor) : null}
        onOpenChange={(open) => !open && setChipFor(null)}
        busy={chips.isPending}
        onSave={(value) =>
          chipFor &&
          chips.mutate(
            { participantId: chipFor.id, chips: value },
            { onSuccess: () => setChipFor(null) }
          )
        }
      />
      <EditParticipantDialog
        key={editFor?.id ?? 'none'}
        participant={editFor}
        onOpenChange={(open) => !open && setEditFor(null)}
        busy={update.isPending}
        onSave={(values) =>
          editFor &&
          update.mutate(
            { participantId: editFor.id, ...values },
            { onSuccess: () => setEditFor(null) }
          )
        }
      />
      <KoPickerDialog
        key={koFor?.id ?? 'none'}
        busted={koFor}
        candidates={koFor ? eliminatorCandidates(o.participants, koFor.id) : []}
        onOpenChange={(open) => !open && setKoFor(null)}
        onPick={(eliminator) => {
          const p = koFor;
          setKoFor(null);
          if (p) setConfirm({ kind: 'bust', p, eliminator });
        }}
      />
      <CredentialsDialog
        credentials={credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
      />
    </>
  );

  return {
    run,
    openRegister: () => setRegisterOpen(true),
    dialogs,
    busy:
      rebuy.isPending ||
      addon.isPending ||
      bust.isPending ||
      reenter.isPending ||
      noShow.isPending ||
      issue.isPending,
  };
}
