/**
 * SettlementCard — "지급 완료" 버튼 게이트 회귀 테스트.
 *
 * 지키는 불변식: **버튼이 보이면 눌러서 성공할 수 있어야 한다.**
 * 서버(settleWorkLogWithTransaction)는 `status ∈ {checked_out, completed}` 를 검사하므로,
 * 카드가 시각(checkInTime/checkOutTime)만 보고 버튼을 그리면 status 미승격 레거시 행에서
 * "누를 수 있는데 항상 실패하는 버튼"이 된다("출퇴근이 완료된 근무 기록만 정산할 수 있습니다").
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

const SETTLE_LABEL = '홍길동 지급 완료로 표시';

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
      onSettle={jest.fn()}
    />
  );
}

describe('SettlementCard 지급 완료 버튼 게이트', () => {
  it.each([STATUS.WORK_LOG.CHECKED_OUT, STATUS.WORK_LOG.COMPLETED])(
    'status=%s + 미정산 + 시각 완비면 버튼을 그린다',
    (status) => {
      const { getByLabelText } = renderCard(makeWorkLog({ status } as Partial<WorkLog>));
      expect(getByLabelText(SETTLE_LABEL)).toBeTruthy();
    }
  );

  it('시각은 있지만 status 가 승격되지 않은 행에는 버튼을 그리지 않는다', () => {
    // 서버가 거부하는 상태다 — 버튼을 그리면 "누르면 항상 실패" 가 된다.
    const { queryByLabelText } = renderCard(
      makeWorkLog({ status: STATUS.WORK_LOG.CHECKED_IN } as Partial<WorkLog>)
    );
    expect(queryByLabelText(SETTLE_LABEL)).toBeNull();
  });

  it('status 는 통과해도 시각이 없으면 버튼을 그리지 않는다', () => {
    const { queryByLabelText } = renderCard(makeWorkLog({ checkOutTime: undefined }));
    expect(queryByLabelText(SETTLE_LABEL)).toBeNull();
  });

  it('이미 지급 완료인 행에는 버튼을 그리지 않는다', () => {
    const { queryByLabelText } = renderCard(
      makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED } as Partial<WorkLog>)
    );
    expect(queryByLabelText(SETTLE_LABEL)).toBeNull();
  });

  it('onSettle 이 없으면 버튼을 그리지 않는다 (읽기 전용 사용처)', () => {
    const { queryByLabelText } = render(
      <SettlementCard workLog={makeWorkLog()} salaryInfo={{ type: 'hourly', amount: 15000 }} />
    );
    expect(queryByLabelText(SETTLE_LABEL)).toBeNull();
  });
});
