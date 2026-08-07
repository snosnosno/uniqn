/**
 * SettlementList — 일괄 정산 선택 어포던스 게이트 회귀 테스트.
 *
 * 지키는 불변식: **선택 가능한 것으로 제시된 근무는 실제로 정산에 성공할 수 있어야 한다.**
 * 서버가 `status ∈ {checked_out, completed}` 를 검사하므로, 선택 모집합이 시각만 보면
 * "전체 선택 → 일괄 정산" 이 서버가 거부할 행까지 담아 부분 실패를 만든다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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

/**
 * 감사 M11 — `payroll_status` 3값 중 `'failed'` 를 이 목록의 세 축이 모두 흘렸다.
 * 셋 다 `=== PENDING` 2값 비교였고, `'failed'` 는 어느 칸에도 안 들어간다:
 *
 *  1. 선택 모집합(`selectableWorkLogs`) — failed 행은 일괄 정산으로 집을 수 없다
 *  2. 필터 카운트(`filterOptions`)      — 탭 합계가 '전체' 와 안 맞는다(1+0 ≠ 2)
 *  3. 필터링(`filteredWorkLogs`)        — '정산 대기' 탭에서 failed 행이 사라진다
 *
 * 올바른 축은 `!== COMPLETED` = 화면 어휘 2단(`toSettlementDisplayStatus`).
 * 'failed' 는 스태프 입장에서 "아직 못 받았다" 이므로 pending 과 같은 칸에 든다.
 */
describe("SettlementList payrollStatus='failed' 축 통일 (감사 M11)", () => {
  const failed = { payrollStatus: STATUS.PAYROLL.FAILED } as Partial<WorkLog>;

  it('failed 행뿐이어도 선택 진입점을 노출한다 — 미지급이므로 일괄 정산 대상이다', () => {
    const { getByText } = renderList([makeWorkLog(failed)]);
    expect(getByText(BULK_TOGGLE)).toBeTruthy();
  });

  it("필터 탭 카운트가 failed 를 '정산 대기' 칸에 센다 — 탭 합계가 전체와 맞아야 한다", () => {
    const { getByLabelText } = renderList([
      makeWorkLog({ id: 'wl-pending' }),
      makeWorkLog({ id: 'wl-failed', ...failed } as Partial<WorkLog>),
    ]);
    // 전체 2건 = 정산 대기 2건 + 정산 완료 0건. failed 가 새면 '정산 대기' 가 1건이 된다.
    expect(getByLabelText('전체 필터, 2건')).toBeTruthy();
    expect(getByLabelText('정산 대기 필터, 2건')).toBeTruthy();
    expect(getByLabelText('정산 완료 필터, 0건')).toBeTruthy();
  });

  it("'정산 대기' 필터를 눌러도 failed 행이 목록에 남는다", () => {
    const { getByLabelText, getByText } = renderList([
      makeWorkLog({ id: 'wl-pending', staffId: 'staff-p', staffName: '홍길동' }),
      makeWorkLog({
        id: 'wl-failed',
        staffId: 'staff-f',
        staffName: '김철수',
        ...failed,
      } as Partial<WorkLog>),
    ]);

    fireEvent.press(getByLabelText('정산 대기 필터, 2건'));

    expect(getByText('홍길동')).toBeTruthy();
    expect(getByText('김철수')).toBeTruthy();
  });
});
