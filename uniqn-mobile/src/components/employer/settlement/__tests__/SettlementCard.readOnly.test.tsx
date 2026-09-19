/**
 * SettlementCard — 지점 근무 금액 화면의 근무 한 줄 (구인자 IA S2).
 *
 * 지킨다: 지급 상태 배지 · 지급 완료 버튼이 없다. 퇴근이 안 찍힌 줄은 금액을 만들지 않고
 * 무엇이 있어야 금액이 정해지는지 말한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SettlementCard } from '../SettlementCard';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: ({ fallbackName }: { fallbackName?: string }) => ({
    displayName: fallbackName ?? '스태프',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: undefined,
  }),
}));

const BEFORE_CHECKOUT = '퇴근을 찍어야 금액이 정해져요';

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

function renderCard(workLog: WorkLog) {
  return render(
    <SettlementCard
      workLog={workLog}
      salaryInfo={{ type: 'hourly', amount: 15000 }}
      calculatedAmount={60000}
    />
  );
}

describe('SettlementCard — 금액만 보여준다', () => {
  it.each([STATUS.PAYROLL.PENDING, STATUS.PAYROLL.COMPLETED, STATUS.PAYROLL.FAILED])(
    'payrollStatus=%s 에서도 지급 상태 배지·지급 완료 버튼이 없다',
    (payrollStatus) => {
      const { queryByText, queryByLabelText } = renderCard(
        makeWorkLog({ payrollStatus } as Partial<WorkLog>)
      );

      expect(queryByText(/정산 대기|정산 완료|지급 완료/)).toBeNull();
      expect(queryByLabelText(/지급 완료로 표시/)).toBeNull();
    }
  );

  it('퇴근이 기록되면 금액을 보여준다', () => {
    const { getByText, queryByText } = renderCard(makeWorkLog());

    expect(getByText('₩60,000')).toBeTruthy();
    expect(queryByText(BEFORE_CHECKOUT)).toBeNull();
  });

  it('퇴근이 안 찍힌 줄은 금액 대신 무엇이 필요한지 말한다', () => {
    const { getByText, queryByText } = renderCard(makeWorkLog({ checkOutTime: undefined }));

    expect(getByText(BEFORE_CHECKOUT)).toBeTruthy();
    expect(queryByText('₩60,000')).toBeNull();
  });
});
