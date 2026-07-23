import { getRoleSalaries, findRoleSalary, hasRoleSalary } from '../roleSalaries';
import { parseVenueContainer } from '../venueContainer';

const dealer = { role: 'dealer', salary: { type: 'hourly', amount: 20000 } };
const chipRunner = {
  role: 'other',
  customRole: '칩 러너',
  salary: { type: 'daily', amount: 150000 },
};

describe('getRoleSalaries', () => {
  it('정상 배열을 파싱한다', () => {
    expect(getRoleSalaries({ roleSalaries: [dealer, chipRunner] })).toEqual([dealer, chipRunner]);
  });
  it('없거나 배열이 아니면 빈 배열(증발 회피)', () => {
    expect(getRoleSalaries(undefined)).toEqual([]);
    expect(getRoleSalaries({})).toEqual([]);
    expect(getRoleSalaries({ roleSalaries: 'oops' })).toEqual([]);
    expect(getRoleSalaries(null)).toEqual([]);
  });
  it('이형 항목은 건너뛰고 정상 항목만 남긴다', () => {
    expect(getRoleSalaries({ roleSalaries: [dealer, { bogus: 1 }, 42] })).toEqual([dealer]);
  });
});

describe('findRoleSalary / hasRoleSalary', () => {
  const entries = getRoleSalaries({ roleSalaries: [dealer, chipRunner] });
  it('표준 역할 매칭', () => {
    expect(findRoleSalary(entries, 'dealer')).toEqual({ type: 'hourly', amount: 20000 });
    expect(hasRoleSalary(entries, 'dealer')).toBe(true);
  });
  it('커스텀 역할은 other:<customRole> 단위 매칭', () => {
    expect(findRoleSalary(entries, 'other', '칩 러너')).toEqual({ type: 'daily', amount: 150000 });
    expect(findRoleSalary(entries, 'other', '서빙 헬퍼')).toBeUndefined();
    expect(hasRoleSalary(entries, 'other', '서빙 헬퍼')).toBe(false);
  });
  it('미매칭이면 undefined/false', () => {
    expect(findRoleSalary(entries, 'serving')).toBeUndefined();
    expect(hasRoleSalary([], 'dealer')).toBe(false);
  });
});

describe('parseVenueContainer.roleSalaries', () => {
  const row = {
    id: 'v1',
    title: '강남점',
    workspace_id: 'w1',
    owner_id: 'u1',
    venue_id: 'v1',
    status: 'container',
    schedule: { kind: 'dated', softTargets: {}, roleSalaries: [dealer] },
  };
  it('schedule.roleSalaries 를 파싱해 싣는다', () => {
    expect(parseVenueContainer(row)?.roleSalaries).toEqual([dealer]);
  });
  it('roleSalaries 부재 시 빈 배열', () => {
    expect(parseVenueContainer({ ...row, schedule: { kind: 'dated' } })?.roleSalaries).toEqual([]);
  });
});
