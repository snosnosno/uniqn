/**
 * TodayOpsStrip (당일 운영 요약 스트립, M4) 테스트
 *
 * @description 오늘 그룹 유무·출근(checkInTime 기준) 집계·노쇼/정산대기 조건부 노출을 잠근다.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TodayOpsStrip } from '../TodayOpsStrip';
import type { ConfirmedStaff, ConfirmedStaffGroup } from '@/types/confirmedStaff';

function makeStaff(overrides: Partial<ConfirmedStaff> = {}): ConfirmedStaff {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    staffName: '스태프1',
    role: 'dealer',
    date: '2026-07-11',
    status: 'scheduled',
    ...overrides,
  } as ConfirmedStaff;
}

function makeTodayGroup(
  staff: ConfirmedStaff[],
  statsOverrides: Partial<ConfirmedStaffGroup['stats']> = {}
): ConfirmedStaffGroup {
  return {
    date: '2026-07-11',
    formattedDate: '7월 11일(토)',
    staff,
    isToday: true,
    isPast: false,
    stats: {
      total: staff.length,
      checkedIn: 0,
      completed: 0,
      noShow: 0,
      ...statsOverrides,
    },
  };
}

describe('TodayOpsStrip', () => {
  it('오늘 그룹이 없으면 아무것도 렌더하지 않는다', () => {
    const { toJSON } = render(<TodayOpsStrip todayGroup={undefined} pendingSettlementCount={3} />);
    expect(toJSON()).toBeNull();
  });

  it('출근 집계는 status가 아니라 checkInTime 존재 기준이다', () => {
    // 출근 2명(checked_in 1 + checked_out 1) / 미출근 1명(scheduled)
    const group = makeTodayGroup([
      makeStaff({ id: 'wl-1', status: 'checked_in', checkInTime: '2026-07-11T09:00:00Z' }),
      makeStaff({
        id: 'wl-2',
        status: 'checked_out',
        checkInTime: '2026-07-11T09:00:00Z',
        checkOutTime: '2026-07-11T18:00:00Z',
      }),
      makeStaff({ id: 'wl-3', status: 'scheduled' }),
    ]);

    const { getByText } = render(<TodayOpsStrip todayGroup={group} pendingSettlementCount={0} />);
    expect(getByText('출근 2/3')).toBeTruthy();
  });

  it('노쇼 0이면 노쇼 배지를 표시하지 않는다', () => {
    const group = makeTodayGroup([makeStaff()]);
    const { queryByText } = render(<TodayOpsStrip todayGroup={group} pendingSettlementCount={0} />);
    expect(queryByText(/노쇼/)).toBeNull();
  });

  it('노쇼가 있으면 노쇼 배지를 표시한다', () => {
    const group = makeTodayGroup([makeStaff({ status: 'no_show', isNoShow: true })], { noShow: 1 });
    const { getByText } = render(<TodayOpsStrip todayGroup={group} pendingSettlementCount={0} />);
    expect(getByText('노쇼 1')).toBeTruthy();
  });

  it('정산 대기가 있으면 건수를 표시하고 0이면 숨긴다', () => {
    const group = makeTodayGroup([makeStaff()]);

    const withPending = render(<TodayOpsStrip todayGroup={group} pendingSettlementCount={2} />);
    expect(withPending.getByText('정산 대기 2건')).toBeTruthy();

    const withoutPending = render(<TodayOpsStrip todayGroup={group} pendingSettlementCount={0} />);
    expect(withoutPending.queryByText(/정산 대기/)).toBeNull();
  });

  it('정산 대기 배지를 누르면 onPressSettlement가 호출된다 (QW10)', () => {
    const group = makeTodayGroup([makeStaff()]);
    const onPressSettlement = jest.fn();

    const { getByLabelText } = render(
      <TodayOpsStrip
        todayGroup={group}
        pendingSettlementCount={2}
        onPressSettlement={onPressSettlement}
      />
    );

    fireEvent.press(getByLabelText('정산 대기 2건, 정산 탭으로 이동'));
    expect(onPressSettlement).toHaveBeenCalledTimes(1);
  });
});
