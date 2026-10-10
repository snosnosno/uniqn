import { cutoffLevelName, cutoffOptions, cutoffState } from '../registrationCutoff';

// 레벨 1 · 레벨 2 · 휴식 · 레벨 3 · 레벨 4
const levels = [
  { sort: 1, level: 1, isBreak: false },
  { sort: 2, level: 2, isBreak: false },
  { sort: 3, level: 2, isBreak: true },
  { sort: 4, level: 3, isBreak: false },
  { sort: 5, level: 4, isBreak: false },
];

describe('cutoffLevelName', () => {
  it('레벨은 번호로, 휴식은 바로 앞 레벨로 가리킨다', () => {
    expect(cutoffLevelName(levels, 2)).toBe('레벨 2');
    expect(cutoffLevelName(levels, 3)).toBe('레벨 2 뒤 휴식');
  });

  it('맨 앞 휴식은 그냥 휴식', () => {
    expect(cutoffLevelName([{ sort: 1, level: 1, isBreak: true }], 1)).toBe('휴식');
  });

  it('없는 순번은 null', () => {
    expect(cutoffLevelName(levels, 9)).toBeNull();
  });
});

describe('cutoffOptions', () => {
  it('지금 레벨부터, 마지막 순번은 뺀다(넘어갈 레벨이 없어 발동하지 않는다)', () => {
    expect(cutoffOptions(levels, 2)).toEqual([
      { sort: 2, label: '레벨 2 종료 시' },
      { sort: 3, label: '레벨 2 뒤 휴식 종료 시' },
      { sort: 4, label: '레벨 3 종료 시' },
    ]);
  });

  it('마지막 레벨에 와 있으면 고를 것이 없다', () => {
    expect(cutoffOptions(levels, 5)).toEqual([]);
  });

  it('구조가 비어 있으면 빈 목록', () => {
    expect(cutoffOptions([], 1)).toEqual([]);
  });
});

describe('cutoffState', () => {
  const base = { levels, currentSort: 2, registrationOpen: true };

  it('설정이 없으면 none', () => {
    expect(cutoffState({ ...base, cutoffSort: null })).toEqual({ kind: 'none' });
    expect(cutoffState({ ...base, cutoffSort: undefined })).toEqual({ kind: 'none' });
  });

  it('기준 전이면 예정', () => {
    expect(cutoffState({ ...base, cutoffSort: 3 })).toEqual({
      kind: 'scheduled',
      label: '레벨 2 뒤 휴식',
    });
  });

  it('기준을 넘어 닫혔으면 자동 마감됨', () => {
    expect(
      cutoffState({ ...base, cutoffSort: 3, currentSort: 4, registrationOpen: false })
    ).toEqual({ kind: 'closed', label: '레벨 2 뒤 휴식' });
  });

  it('기준 전에 수동으로 닫은 것은 자동 마감이 아니다(설정은 예정으로 남는다)', () => {
    expect(cutoffState({ ...base, cutoffSort: 3, registrationOpen: false })).toEqual({
      kind: 'scheduled',
      label: '레벨 2 뒤 휴식',
    });
  });

  it('기준 순번이 구조에서 사라졌으면 orphan', () => {
    expect(cutoffState({ ...base, cutoffSort: 9 })).toEqual({ kind: 'orphan' });
  });
});
