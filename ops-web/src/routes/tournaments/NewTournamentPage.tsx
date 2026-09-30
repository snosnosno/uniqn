import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { kstDateString } from '@/core/domains/ops';
import { createOpsTournamentSchema } from '@/core/schemas/opsTournament.schema';
import {
  initialCreateForm,
  toCreateInput,
  type CreateFormState,
} from '@/features/tournaments/createForm';
import { useCreateOpsTournament, useManagedPostings } from '@/hooks/ops/useTournaments';
import { toUserMessage } from '@/lib/errorMessage';
import { focusFirstError } from '@/lib/formErrors';
import { UUID_LIKE_RE } from '@/core/schemas/common';
import { FIELD_ORDER, toCreateFormErrors } from '@/features/tournaments/createFormErrors';
import { Field, FormError } from '@/routes/auth/AuthShell';

type NumKey = Exclude<
  keyof CreateFormState,
  'name' | 'venue' | 'gameType' | 'eventDate' | 'jobPostingId'
>;

/** 대회 만들기 — 모바일 new.tsx 와 같은 필드·기본값. 이름만 필수, 나머지는 기본값으로 바로 시작. */
export function Component() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState<CreateFormState>(() => {
    // URL 의 postingId 는 UUID 일 때만 받는다 — 아니면 보이지 않는 검증 오류로 제출이 조용히 막힌다.
    const preset = params.get('postingId');
    return initialCreateForm(
      kstDateString(Date.now()),
      preset && UUID_LIKE_RE.test(preset) ? preset : null
    );
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreateOpsTournament();
  const postings = useManagedPostings();

  const set = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = toCreateInput(form);
    const parsed = createOpsTournamentSchema.safeParse(input);
    if (!parsed.success) {
      const errors = toCreateFormErrors(parsed.error);
      setFieldErrors(errors.fields);
      setFormError(errors.other);
      focusFirstError(errors.fields, FIELD_ORDER);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    create.mutate(input, {
      onSuccess: (r) => navigate(`/tournaments/${r.tournamentId}`, { replace: true }),
    });
  };

  const num = (key: NumKey, label: string, placeholder = '0') => (
    <Field id={key} label={label} error={fieldErrors[key]}>
      <Input
        id={key}
        inputMode="numeric"
        className="num text-right"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(fieldErrors[key])}
        aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
      />
    </Field>
  );

  // 선택값이 로드된 목록에 없으면(로딩 중·조회 실패·권한 밖) 그 값을 옵션으로 남긴다 —
  // 없으면 브라우저는 "연결 안 함"을 보여 주면서 실제로는 연결된 채 제출한다(리뷰 W3).
  const selectedMissing =
    form.jobPostingId !== null && !(postings.data ?? []).some((p) => p.id === form.jobPostingId);
  const missingLabel = postings.isPending
    ? '연결됨(확인 중…)'
    : postings.isError
      ? '연결됨(목록을 불러오지 못함)'
      : '연결됨(목록에서 찾을 수 없음)';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] leading-tight font-bold">새 대회</h1>
        <Link
          to="/tournaments"
          className="ml-auto inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          목록으로
        </Link>
      </div>

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <Section title="기본">
          <Field id="name" label="대회 이름 *" error={fieldErrors.name}>
            <Input
              id="name"
              autoFocus
              maxLength={100}
              placeholder="예: 수요 딥스택"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="venue" label="장소" error={fieldErrors.venue}>
              <Input
                id="venue"
                placeholder="예: 강남 홀덤펍"
                value={form.venue}
                onChange={(e) => set('venue', e.target.value)}
              />
            </Field>
            {/* 날짜는 달력 입력만 — 자유 텍스트였을 때 "7/1" 이 저장돼 '이어서 운영'이 사라졌다(모바일 결함 ④). */}
            <Field id="eventDate" label="날짜" error={fieldErrors.eventDate}>
              <Input
                id="eventDate"
                type="date"
                className="num"
                value={form.eventDate}
                onChange={(e) => set('eventDate', e.target.value)}
              />
            </Field>
            <Field id="gameType" label="게임" error={fieldErrors.gameType}>
              <Input
                id="gameType"
                value={form.gameType}
                onChange={(e) => set('gameType', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="칩 · 좌석">
          <div className="grid grid-cols-2 gap-4">
            {num('startingChips', '시작 칩')}
            {num('seatsPerTable', '테이블당 좌석')}
          </div>
        </Section>

        <Section title="바이인 · 리바이 · 애드온">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {num('buyInChips', '바이인 칩')}
            {num('buyInCost', '바이인 금액')}
            {num('feeCost', '수수료')}
            {num('bountyCost', '바운티(빈칸=없음)', '없음')}
            {num('rebuyChips', '리바이 칩')}
            {num('rebuyCost', '리바이 금액')}
            {num('addonChips', '애드온 칩')}
            {num('addonCost', '애드온 금액')}
          </div>
        </Section>

        <Section title="UNIQN 공고 연결(선택)">
          <Field id="jobPostingId" label="공고">
            <select
              id="jobPostingId"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
              value={form.jobPostingId ?? ''}
              onChange={(e) => set('jobPostingId', e.target.value || null)}
            >
              <option value="">연결 안 함</option>
              {selectedMissing ? (
                <option value={form.jobPostingId ?? ''}>{missingLabel}</option>
              ) : null}
              {(postings.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          {postings.isError ? (
            <p className="flex items-center gap-3 text-xs text-destructive">
              공고 목록을 불러오지 못했어요.
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => postings.refetch()}
              >
                다시 시도
              </Button>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {postings.isPending
                ? '공고를 불러오는 중…'
                : (postings.data?.length ?? 0) === 0
                  ? '관리 중인 공고가 없어요. 연결 없이도 대회를 운영할 수 있어요.'
                  : '연결하면 공고의 확정 스태프를 대회로 가져올 수 있어요.'}
            </p>
          )}
        </Section>

        <FormError message={formError ?? (create.isError ? toUserMessage(create.error) : null)} />
        <Button type="submit" size="lg" disabled={create.isPending}>
          {create.isPending ? '만드는 중…' : '대회 만들기'}
        </Button>
      </form>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border bg-card p-4">
      <legend className="label px-1">{title}</legend>
      {children}
    </fieldset>
  );
}
