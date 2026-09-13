/**
 * SettlementList — [근무] 의 `금액` 탭 (구인자 IA S2).
 *
 * 앱은 돈을 보내지 않는다. 그런데 화면은 `정산 대기 / 정산 완료` 필터, `일괄 정산 선택`,
 * `지급 완료` 버튼으로 앱이 지급을 관리하는 것처럼 굴었고, 아무도 그 버튼을 누르지 않으면
 * 목록이 영원히 "정산 대기"로 쌓였다. 워크플로우를 걷어내고 **금액 계산·표시만** 남긴다.
 *
 * 고정하는 계약:
 *  1. 지급 상태 필터 · 일괄 정산 · 지급 완료 버튼이 없다.
 *  2. `지급 예정 합계` 는 **퇴근이 기록된 근무만** 더한다 — 안 찍힌 줄로 추정 금액을 만들지 않는다.
 *  3. 사람별로 한 카드다 — 민수의 3일치가 한 줄이어야 세 번 보내지 않는다.
 *  4. 이미 확정된 금액(과거 지급 완료 행)은 재계산하지 않고 그 금액을 더한다.
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

/** 10:00~14:00(4시간) × 시급 15,000원 = 60,000원 */
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
    />
  );
}

describe('SettlementList — 지급 워크플로우 없음', () => {
  it('지급 상태 필터 · 일괄 정산 · 지급 완료 버튼이 없다', () => {
    const { queryByText, queryByLabelText } = renderList([
      makeWorkLog({ id: 'wl-a' }),
      makeWorkLog({ id: 'wl-b', payrollStatus: STATUS.PAYROLL.COMPLETED, payrollAmount: 60000 }),
    ]);

    expect(queryByText('일괄 정산 선택')).toBeNull();
    expect(queryByText(/일괄 정산/)).toBeNull();
    expect(queryByText(/지급 완료/)).toBeNull();
    expect(queryByText('정산 대기')).toBeNull();
    expect(queryByLabelText(/필터/)).toBeNull();
  });
});

describe('SettlementList — 지급 예정 합계', () => {
  it('퇴근이 기록된 근무만 더한다 — 퇴근 전 근무는 금액을 만들지 않는다', () => {
    const { getByTestId, getAllByText } = renderList([
      makeWorkLog({ id: 'wl-a', date: '2026-07-10' }),
      makeWorkLog({
        id: 'wl-b',
        date: '2026-07-11',
        checkInTime: '2026-07-11T10:00:00.000Z',
        checkOutTime: '2026-07-11T14:00:00.000Z',
      }),
      makeWorkLog({
        id: 'wl-c',
        date: '2026-07-12',
        status: STATUS.WORK_LOG.CHECKED_IN,
        checkInTime: '2026-07-12T10:00:00.000Z',
        checkOutTime: undefined,
      }),
    ]);

    expect(getByTestId('settlement-payable-total').props.children).toBe('₩120,000');
    expect(getAllByText(/퇴근 전 1건/).length).toBeGreaterThan(0);
  });

  // 🚨 과거에 지급 완료로 처리된 근무를 "지급 예정" 에 더하면, 사장이 합계를 그대로 보내
  //    이미 준 돈을 한 번 더 보낸다(워크플로우가 살아 있던 시절의 공고에 실재한다).
  it('이미 지급 처리된 근무는 지급 예정 합계에서 빼고 따로 밝힌다', () => {
    const { getByTestId } = renderList([
      makeWorkLog({ id: 'wl-a', date: '2026-07-10' }),
      makeWorkLog({
        id: 'wl-paid',
        date: '2026-07-11',
        checkInTime: '2026-07-11T10:00:00.000Z',
        checkOutTime: '2026-07-11T14:00:00.000Z',
        payrollStatus: STATUS.PAYROLL.COMPLETED,
        payrollAmount: 50000,
      }),
    ]);

    expect(getByTestId('settlement-payable-total').props.children).toBe('₩60,000');
    // 확정 금액은 재계산하지 않고 그 금액(50,000)으로 밝힌다.
    expect(getByTestId('settlement-settled-note').props.children).toContain('₩50,000');
  });

  it('이미 지급 처리된 근무가 없으면 안내 줄도 없다', () => {
    const { queryByTestId } = renderList([makeWorkLog({ id: 'wl-a' })]);

    expect(queryByTestId('settlement-settled-note')).toBeNull();
  });
});

describe('SettlementList — 사람별 합산', () => {
  it('같은 사람의 여러 날은 한 카드다', () => {
    const { getAllByLabelText } = renderList([
      makeWorkLog({ id: 'wl-a', date: '2026-07-10' }),
      makeWorkLog({ id: 'wl-b', date: '2026-07-11' }),
      makeWorkLog({ id: 'wl-c', staffId: 'staff-2', staffName: '김철수', date: '2026-07-10' }),
    ]);

    expect(getAllByLabelText(/근무 금액 상세 보기$/)).toHaveLength(2);
  });
});
