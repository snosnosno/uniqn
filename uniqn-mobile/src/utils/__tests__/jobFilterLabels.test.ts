/**
 * 필터 pill 라벨 포매터 테스트
 */

import { formatManWon, formatRoleFiltersLabel, formatSalaryFilterLabel } from '../jobFilterLabels';

describe('formatRoleFiltersLabel', () => {
  it("없음: '역할' / 1개: 라벨 / n개: '외 n-1'", () => {
    expect(formatRoleFiltersLabel([])).toBe('역할');
    expect(formatRoleFiltersLabel(['dealer'])).toBe('딜러');
    expect(formatRoleFiltersLabel(['dealer', 'floor', 'serving'])).toBe('딜러 외 2');
  });
});

describe('formatManWon', () => {
  it('만원 축약 — 소수점은 필요한 만큼만', () => {
    expect(formatManWon(11000)).toBe('1.1만');
    expect(formatManWon(13000)).toBe('1.3만');
    expect(formatManWon(20000)).toBe('2만');
    expect(formatManWon(100000)).toBe('10만');
    expect(formatManWon(3000000)).toBe('300만');
  });
});

describe('formatSalaryFilterLabel', () => {
  it("없음: '급여' / 있음: '시급 1.3만+'", () => {
    expect(formatSalaryFilterLabel(null)).toBe('급여');
    expect(formatSalaryFilterLabel({ type: 'hourly', min: 13000 })).toBe('시급 1.3만+');
    expect(formatSalaryFilterLabel({ type: 'daily', min: 150000 })).toBe('일급 15만+');
    expect(formatSalaryFilterLabel({ type: 'monthly', min: 3000000 })).toBe('월급 300만+');
  });
});
