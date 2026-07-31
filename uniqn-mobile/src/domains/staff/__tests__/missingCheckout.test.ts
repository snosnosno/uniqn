import { summarizeMissingCheckouts } from '../missingCheckout';
import type { ConfirmedStaffGroup } from '@/types/confirmedStaff';

function group(overrides: Partial<ConfirmedStaffGroup> = {}): ConfirmedStaffGroup {
  return {
    date: '2026-07-29',
    formattedDate: '7월 29일',
    staff: [],
    isToday: false,
    isPast: true,
    stats: { total: 3, checkedIn: 0, completed: 0, noShow: 0 },
    ...overrides,
  };
}

describe('summarizeMissingCheckouts', () => {
  it('지난 날짜의 checked_in 인원을 모두 센다', () => {
    const summary = summarizeMissingCheckouts([
      group({ date: '2026-07-28', stats: { total: 3, checkedIn: 2, completed: 1, noShow: 0 } }),
      group({ date: '2026-07-29', stats: { total: 2, checkedIn: 1, completed: 1, noShow: 0 } }),
    ]);

    expect(summary.count).toBe(3);
  });

  // 🔴 오늘 근무 중인 사람은 미기록이 아니다. 세면 배지가 영업시간 내내 켜져 안전망이 죽는다.
  it('오늘·미래 날짜의 근무 중 인원은 세지 않는다', () => {
    const summary = summarizeMissingCheckouts([
      group({
        date: '2026-07-31',
        isToday: true,
        isPast: false,
        stats: { total: 5, checkedIn: 5, completed: 0, noShow: 0 },
      }),
      group({
        date: '2026-08-02',
        isPast: false,
        stats: { total: 2, checkedIn: 1, completed: 0, noShow: 0 },
      }),
    ]);

    expect(summary).toEqual({ count: 0, earliestDate: null });
  });

  it('가장 오래된 미기록 날짜를 돌려준다', () => {
    const summary = summarizeMissingCheckouts([
      group({ date: '2026-07-29', stats: { total: 1, checkedIn: 1, completed: 0, noShow: 0 } }),
      group({ date: '2026-07-20', stats: { total: 1, checkedIn: 1, completed: 0, noShow: 0 } }),
      group({ date: '2026-07-25', stats: { total: 1, checkedIn: 1, completed: 0, noShow: 0 } }),
    ]);

    expect(summary.earliestDate).toBe('2026-07-20');
  });

  // 미기록이 0인 지난 날짜가 earliestDate 를 선점하면 배지가 엉뚱한 날로 보낸다.
  it('미기록이 없는 지난 날짜는 earliestDate 후보가 아니다', () => {
    const summary = summarizeMissingCheckouts([
      group({ date: '2026-07-01', stats: { total: 4, checkedIn: 0, completed: 4, noShow: 0 } }),
      group({ date: '2026-07-25', stats: { total: 1, checkedIn: 1, completed: 0, noShow: 0 } }),
    ]);

    expect(summary).toEqual({ count: 1, earliestDate: '2026-07-25' });
  });

  it('완료·노쇼만 있으면 미기록이 아니다', () => {
    const summary = summarizeMissingCheckouts([
      group({ stats: { total: 4, checkedIn: 0, completed: 3, noShow: 1 } }),
    ]);

    expect(summary).toEqual({ count: 0, earliestDate: null });
  });

  it('그룹이 없으면 0건이다', () => {
    expect(summarizeMissingCheckouts([])).toEqual({ count: 0, earliestDate: null });
  });
});
