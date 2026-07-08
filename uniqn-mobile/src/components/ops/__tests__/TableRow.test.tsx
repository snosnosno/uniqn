/**
 * TableRow — 1e 딜러 배지 회귀.
 * assignedStaffId 유무 + staffNameById(부모 주입 맵) 조회 결과에 따라
 * "딜러 {이름}" 배지 또는 "딜러 외부 스태프" 폴백을 렌더하는지 검증한다.
 * 행 컴포넌트는 훅을 호출하지 않는다(부모가 계산한 map/scalar 만 소비) — import 에 훅이 없음으로도 방증.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { TableRow } from '../TableRow';
import type { OpsTable } from '@/types/ops';

const baseTable: OpsTable = {
  id: 't1',
  tournamentId: 'trn1',
  tableNo: 1,
  name: null,
  status: 'open',
  assignedStaffId: null,
  lockType: 'none',
  priority: null,
  position: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('TableRow — 딜러 배지(1e)', () => {
  it('assignedStaffId 없으면 딜러 배지를 렌더하지 않는다', () => {
    const { queryByText } = render(
      <TableRow
        table={baseTable}
        seatCount={9}
        filled={3}
        staffNameById={new Map([['u1', '홍길동']])}
        onPress={jest.fn()}
      />
    );

    expect(queryByText(/^딜러/)).toBeNull();
  });

  it('assignedStaffId 있고 로스터 맵에 있으면 이름 배지를 렌더한다', () => {
    const table: OpsTable = { ...baseTable, assignedStaffId: 'u1' };
    const { getByText } = render(
      <TableRow
        table={table}
        seatCount={9}
        filled={3}
        staffNameById={new Map([['u1', '홍길동']])}
        onPress={jest.fn()}
      />
    );

    expect(getByText('딜러 홍길동')).toBeTruthy();
  });

  it('assignedStaffId 있지만 로스터 맵에 없으면 "외부 스태프" 폴백 라벨을 렌더한다', () => {
    const table: OpsTable = { ...baseTable, assignedStaffId: 'u-removed' };
    const { getByText } = render(
      <TableRow
        table={table}
        seatCount={9}
        filled={3}
        staffNameById={new Map([['u1', '홍길동']])}
        onPress={jest.fn()}
      />
    );

    expect(getByText('딜러 외부 스태프')).toBeTruthy();
  });
});
