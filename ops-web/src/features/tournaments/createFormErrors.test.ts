import { describe, expect, it } from 'vitest';
import { createOpsTournamentSchema } from '@/core/schemas/opsTournament.schema';
import { initialCreateForm, toCreateInput } from './createForm';
import { toCreateFormErrors } from './createFormErrors';

const errorsFor = (patch: Parameters<typeof toCreateInput>[0]) => {
  const r = createOpsTournamentSchema.safeParse(toCreateInput(patch));
  if (r.success) throw new Error('검증이 통과해 버렸습니다');
  return toCreateFormErrors(r.error);
};

describe('toCreateFormErrors', () => {
  it('이름 누락은 name 칸', () => {
    expect(errorsFor(initialCreateForm('')).fields).toHaveProperty('name');
  });

  it('config 안의 칩 값 오류는 해당 칸으로 풀린다(조용히 멈추지 않는다)', () => {
    const e = errorsFor({ ...initialCreateForm(''), name: 'x', buyInChips: '9'.repeat(20) });
    expect(Object.keys(e.fields).length + (e.other ? 1 : 0)).toBeGreaterThan(0);
    expect(e.fields.config).toBeUndefined();
  });

  it('칸이 없는 오류는 other 로 모은다', () => {
    const e = errorsFor({ ...initialCreateForm(''), name: 'x', jobPostingId: 'not-a-uuid' });
    expect(e.fields.jobPostingId ?? e.other).toBeTruthy();
  });
});
