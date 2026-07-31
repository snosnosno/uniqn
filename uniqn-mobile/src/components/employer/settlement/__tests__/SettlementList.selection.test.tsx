/**
 * SettlementList — 일괄 정산 선택 어포던스 게이트 회귀 테스트.
 *
 * 지키는 불변식: **선택 가능한 것으로 제시된 근무는 실제로 정산에 성공할 수 있어야 한다.**
 * 서버가 `status ∈ {checked_out, completed}` 를 검사하므로, 선택 모집합이 시각만 보면
 * "전체 선택 → 일괄 정산" 이 서버가 거부할 행까지 담아 부분 실패를 만든다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SettlementList } from '../SettlementList';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: ({ fallbackName }: { fallbackName?: string }) => ({
    displayName: fallbackName ?? '스태프',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: undefined,
  }),
}));

const BULK_TOGGLE = '일괄 정산 선택';

function makeWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    staffName: '홍길동',
    jobPostingId: 'jp-1',
    date: '2026-07-10',
    role: 'dealer',
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.PENDING,
    checkInTime: '2026-07-10T10:00:00.000Z',
    checkOutTime: '2026-07-10T14:00:00.000Z',
    ...overrides,
  } as unknown as WorkLog;
}

function renderList(workLogs: WorkLog[]) {
  return render(
    <SettlementList
      workLogs={workLogs}
      roles={[{ role: 'dealer', salary: { type: 'hourly', amount: 15000 } }]}
      defaultSalary={{ type: 'hourly', amount: 15000 }}
      showBulkActions
    />
  );
}

describe('SettlementList 일괄 정산 선택 게이트', () => {
  it('서버 게이트를 통과할 수 있는 행이 있으면 선택 진입점을 노출한다', () => {
    const { getByText } = renderList([makeWorkLog()]);
    expect(getByText(BULK_TOGGLE)).toBeTruthy();
  });

  it('시각은 있지만 status 가 승격되지 않은 행뿐이면 선택 진입점을 노출하지 않는다', () => {
    // 이 행들을 "전체 선택" 으로 담으면 일괄 정산이 통째로 실패한다.
    const { queryByText } = renderList([
      makeWorkLog({ id: 'wl-in', status: STATUS.WORK_LOG.CHECKED_IN } as Partial<WorkLog>),
    ]);
    expect(queryByText(BULK_TOGGLE)).toBeNull();
  });

  it('정산 가능 행과 status 미승격 행이 섞이면 진입점은 남는다 (모집합에서만 제외)', () => {
    const { getByText } = renderList([
      makeWorkLog({ id: 'wl-out' }),
      makeWorkLog({ id: 'wl-in', status: STATUS.WORK_LOG.CHECKED_IN } as Partial<WorkLog>),
    ]);
    expect(getByText(BULK_TOGGLE)).toBeTruthy();
  });

  it('이미 지급 완료된 행뿐이면 선택 진입점을 노출하지 않는다', () => {
    const { queryByText } = renderList([
      makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED } as Partial<WorkLog>),
    ]);
    expect(queryByText(BULK_TOGGLE)).toBeNull();
  });
});
