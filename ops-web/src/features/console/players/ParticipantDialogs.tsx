/**
 * 참가자 입력 대화상자 — 등록·칩 카운트·정보 수정·KO 지정·플레이어 링크/PIN.
 * 문구·검증은 모바일 시트와 같다(스키마는 동기화 사본). 확정형 작업은 ConfirmDialog 가 따로 맡는다.
 */
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
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
import {
  chipCountSchema,
  participantUpdateSchema,
  registerParticipantSchema,
} from '@/core/schemas/opsParticipant.schema';
import type { OpsParticipant } from '@/core/types/ops';
import { toFieldErrors } from '@/lib/formErrors';
import { Field } from '@/routes/auth/AuthShell';
import { chipDeltaLabel, fmt } from '../format';
import { copyToClipboard, playerViewUrl } from './helpers';

function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!busy) onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
            >
              닫기
            </Button>
            <Button type="submit" size="lg" disabled={busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 등록 ─────────────────────────────────────────────────────────────────────

export interface RegisterValues {
  name: string;
  nationality?: string;
  phone?: string;
  buyInAmount?: number;
}

/**
 * 참가 등록 — 속도를 위해 **등록 후에도 열린 채** 이름 칸을 비우고 포커스를 돌린다(연속 등록).
 * 국적은 직전 값을 유지한다(같은 국적이 줄지어 오는 현장).
 */
export function RegisterDialog({
  open,
  onOpenChange,
  tournamentId,
  busy,
  onRegister,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  busy: boolean;
  onRegister: (values: RegisterValues, done: () => void) => void;
}) {
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const values: RegisterValues = {
      name: name.trim(),
      nationality: nationality.trim() || undefined,
      phone: phone.trim() || undefined,
      buyInAmount: buyIn.trim() ? parseAmount(buyIn) : undefined,
    };
    const parsed = registerParticipantSchema.safeParse({ ...values, tournamentId });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      nameRef.current?.focus();
      return;
    }
    setErrors({});
    onRegister(values, () => {
      setName('');
      setPhone('');
      setBuyIn('');
      nameRef.current?.focus();
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="참가 등록"
      description="등록하면 창이 열린 채 다음 사람을 바로 받을 수 있어요. 닫기는 Esc."
      onSubmit={submit}
      submitLabel={busy ? '등록 중…' : '등록'}
      busy={busy}
    >
      <Field id="reg-name" label="이름 *" error={errors.name}>
        <Input
          id="reg-name"
          ref={nameRef}
          autoFocus
          maxLength={50}
          placeholder="예: 홍길동"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'reg-name-error' : undefined}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="reg-nationality" label="국적" error={errors.nationality}>
          <Input
            id="reg-nationality"
            placeholder="예: KR"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
        </Field>
        <Field id="reg-buyin" label="바이인 금액" error={errors.buyInAmount}>
          <Input
            id="reg-buyin"
            inputMode="numeric"
            className="num text-right"
            placeholder="예: 100000"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
          />
        </Field>
      </div>
      <Field id="reg-phone" label="연락처" error={errors.phone}>
        <Input
          id="reg-phone"
          inputMode="tel"
          placeholder="예: 010-1234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
    </FormDialog>
  );
}

// ─── 칩 카운트 ──────────────────────────────────────────────────────────────────

export function ChipCountDialog({
  participant,
  onOpenChange,
  busy,
  onSave,
}: {
  participant: OpsParticipant | null;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSave: (chips: number) => void;
}) {
  // 참가자가 바뀌면 호출부가 key 로 다시 마운트한다 — 입력값 초기화에 effect 를 쓰지 않는다.
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  if (!participant) return null;
  const next = parseAmount(input);
  const delta = chipDeltaLabel(participant.chips, next);

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`#${participant.entryNumber} ${participant.name} 칩 카운트`}
      onSubmit={() => {
        const parsed = chipCountSchema.safeParse({ participantId: participant.id, chips: next });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message);
          return;
        }
        onSave(next);
      }}
      submitLabel={busy ? '저장 중…' : '칩 수량 저장'}
      busy={busy}
    >
      <p className="text-sm">
        <span className="label">현재 칩 </span>
        <b className="num">{fmt(participant.chips)}</b>
      </p>
      <Field id="chip-count" label="새 칩 수량" error={error}>
        <Input
          id="chip-count"
          autoFocus
          inputMode="numeric"
          className="num text-right text-lg"
          placeholder="0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'chip-count-error' : undefined}
        />
      </Field>
      {delta ? <p className="num text-sm text-accent-text">{delta}</p> : null}
    </FormDialog>
  );
}

// ─── 정보 수정 ──────────────────────────────────────────────────────────────────

export interface EditValues {
  name: string;
  nationality: string;
  phone: string;
}

export function EditParticipantDialog({
  participant,
  onOpenChange,
  busy,
  onSave,
}: {
  participant: OpsParticipant | null;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSave: (values: EditValues) => void;
}) {
  // 참가자가 바뀌면 호출부가 key 로 다시 마운트한다(초기값 = 현재 정보).
  const [values, setValues] = useState<EditValues>(() => ({
    name: participant?.name ?? '',
    nationality: participant?.nationality ?? '',
    phone: participant?.phone ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!participant) return null;

  const field = (key: keyof EditValues, label: string, max: number, hint?: string) => (
    <Field id={`edit-${key}`} label={label} error={errors[key]}>
      <Input
        id={`edit-${key}`}
        maxLength={max}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        aria-invalid={Boolean(errors[key])}
      />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Field>
  );

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`#${participant.entryNumber} 정보 수정`}
      onSubmit={() => {
        const parsed = participantUpdateSchema.safeParse({
          participantId: participant.id,
          ...values,
        });
        if (!parsed.success) {
          setErrors(toFieldErrors(parsed.error));
          return;
        }
        onSave(values);
      }}
      submitLabel={busy ? '저장 중…' : '저장'}
      busy={busy}
    >
      {field('name', '이름', 100)}
      {field('nationality', '국적', 50, '비우면 국적 정보가 지워집니다.')}
      {field('phone', '연락처', 30, '비우면 연락처가 지워집니다.')}
    </FormDialog>
  );
}

// ─── KO 지정(바운티) ────────────────────────────────────────────────────────────

export function KoPickerDialog({
  busted,
  candidates,
  onOpenChange,
  onPick,
}: {
  busted: OpsParticipant | null;
  candidates: OpsParticipant[];
  onOpenChange: (open: boolean) => void;
  onPick: (eliminator: OpsParticipant | null) => void;
}) {
  const [query, setQuery] = useState('');
  if (!busted) return null;
  const q = query.trim();
  const list = q
    ? candidates.filter((c) => c.name.includes(q) || String(c.entryNumber) === q)
    : candidates;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{busted.name} 님을 누가 눌렀나요?</DialogTitle>
          <DialogDescription>바운티 대회 — 넉아웃한 참가자를 고르세요.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="이름 또는 엔트리 번호"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="넉아웃 참가자 찾기"
        />
        <ul className="flex max-h-[50dvh] flex-col overflow-auto border">
          <li>
            <button
              type="button"
              className="flex h-11 w-full items-center px-3 text-left text-sm text-muted-foreground hover:bg-muted"
              onClick={() => onPick(null)}
            >
              지정 안 함
            </button>
          </li>
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex h-11 w-full items-center gap-2 border-t px-3 text-left text-sm hover:bg-muted"
                onClick={() => onPick(c)}
              >
                <span className="num w-10 text-muted-foreground">#{c.entryNumber}</span>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// ─── 플레이어 링크 / PIN ─────────────────────────────────────────────────────────

/** 발급 결과 — PIN 은 이번 한 번만 보인다(서버는 해시만 보관). 슬립·QR 에 함께 적도록 안내. */
export function CredentialsDialog({
  credentials,
  onOpenChange,
}: {
  credentials: { name: string; viewToken: string; claimPin: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!credentials) return null;
  const url = playerViewUrl(credentials.viewToken);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{credentials.name} · 연결 PIN 발급됨</DialogTitle>
          <DialogDescription>
            슬립/QR 에 PIN 을 함께 적어 주세요. 이 창을 닫으면 PIN 은 다시 볼 수 없고, 재발급하면 이
            PIN 은 무효가 됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between border px-3 py-2">
          <span className="label">연결 PIN</span>
          <b className="num text-2xl tracking-[0.2em]">{credentials.claimPin}</b>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={url} aria-label="플레이어 링크" className="num text-xs" />
          <Button
            variant="outline"
            size="icon"
            aria-label="플레이어 링크 복사"
            onClick={() => copyToClipboard(url, '링크')}
          >
            <Copy />
          </Button>
        </div>
        <DialogFooter>
          <Button size="lg" onClick={() => onOpenChange(false)}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
