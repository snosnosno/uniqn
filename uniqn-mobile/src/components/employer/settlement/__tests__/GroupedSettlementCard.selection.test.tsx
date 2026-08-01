/**
 * GroupedSettlementCard — 그룹 선택/집계 축 회귀 테스트.
 *
 * 이 컴포넌트에는 렌더 테스트가 **0건**이었고, 그래서 "정산 가능" 판정을 새로 세운 변경이
 * 소비처 두 곳을 빠뜨린 채 전량 green 으로 통과했다(집계 축 1건 + 선택 축 1건).
 * 지키는 불변식은 두 개다:
 *
 *   ① 배지가 세는 '정산 가능'과 일괄 정산 버튼이 세는 '정산 가능'은 **같은 축**이어야 한다.
 *   ② 그룹 체크박스는 **왕복**해야 한다 — 켤 수 있으면 끌 수 있어야 한다.
 *
 * 실제 배선까지 보려고 `SettlementList` 를 통해 렌더한다. 카드만 단독 렌더하면
 * 부모가 내려주는 선택 축(`selectableIds`)이 빠져 정작 회귀한 경로를 안 밟는다.
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

/** 같은 staffId + jobPostingId 라 한 그룹으로 묶인다 */
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

describe('GroupedSettlementCard — 집계 축(M1)', () => {
  it('시각만 있고 status 가 미승격인 행은 정산 가능으로 세지 않는다', () => {
    // 정산 대기 2건: 하나는 서버 게이트 통과 가능, 하나는 시각만 있고 status 미승격(레거시 배치).
    // 축이 어긋나면 배지가 "정산 가능 2건"으로 접혀 보이고(= 미완료 배지 미표시)
    // 일괄 정산 버튼은 1건만 잡아, 구인자는 설명 없는 모순을 마주한다.
    const { getByText } = renderList([
      makeWorkLog({ id: 'wl-ok' }),
      makeWorkLog({ id: 'wl-legacy', date: '2026-07-11', status: STATUS.WORK_LOG.CHECKED_IN }),
    ]);

    expect(getByText('출퇴근 미완료 1건')).toBeTruthy();
    expect(getByText('1건 일괄 정산')).toBeTruthy();
  });

  it('두 건 모두 서버 게이트를 통과할 수 있으면 미완료 배지를 띄우지 않는다', () => {
    const { queryByText, getByText } = renderList([
      makeWorkLog({ id: 'wl-a' }),
      makeWorkLog({ id: 'wl-b', date: '2026-07-11' }),
    ]);

    expect(queryByText(/출퇴근 미완료/)).toBeNull();
    expect(getByText('2건 일괄 정산')).toBeTruthy();
  });
});

describe('GroupedSettlementCard — 선택 축(M2)', () => {
  it('지급완료가 섞인 그룹에서도 그룹 체크박스가 왕복한다', () => {
    // 지급완료 1건 + 정산 가능 2건. 전량 선택이 원리적으로 불가능한 그룹이다 —
    // '전체 선택'의 분모를 그룹 전체 행수로 잡으면 영구 false 가 되어 해제 분기에 못 간다.
    const { getByText, getAllByRole } = renderList([
      makeWorkLog({ id: 'wl-paid', payrollStatus: STATUS.PAYROLL.COMPLETED }),
      makeWorkLog({ id: 'wl-1', date: '2026-07-11' }),
      makeWorkLog({ id: 'wl-2', date: '2026-07-12' }),
    ]);

    fireEvent.press(getByText(BULK_TOGGLE));

    const groupCheckbox = getAllByRole('checkbox')[0];

    fireEvent.press(groupCheckbox);
    expect(getByText('2건 선택')).toBeTruthy();

    // 여기서 아무 일도 일어나지 않던 것이 회귀였다(체크는 켜지는데 꺼지지 않는다)
    fireEvent.press(getAllByRole('checkbox')[0]);
    expect(getByText('0건 선택')).toBeTruthy();
  });

  it('선택 가능한 행만 있는 그룹도 왕복한다', () => {
    const { getByText, getAllByRole } = renderList([
      makeWorkLog({ id: 'wl-1' }),
      makeWorkLog({ id: 'wl-2', date: '2026-07-11' }),
    ]);

    fireEvent.press(getByText(BULK_TOGGLE));

    fireEvent.press(getAllByRole('checkbox')[0]);
    expect(getByText('2건 선택')).toBeTruthy();

    fireEvent.press(getAllByRole('checkbox')[0]);
    expect(getByText('0건 선택')).toBeTruthy();
  });

  it('선택 가능한 행이 하나도 없으면 그룹 체크박스가 켜지지 않는다', () => {
    // 전부 지급완료. `selectableInGroup.length > 0` 가드가 없으면 0 === 0 으로
    // '전체 선택됨'이 참이 되어 체크 표시가 켜진 채 시작한다.
    const { queryByText, getByText, getAllByRole } = renderList([
      makeWorkLog({ id: 'wl-paid-1', payrollStatus: STATUS.PAYROLL.COMPLETED }),
      makeWorkLog({
        id: 'wl-ok',
        date: '2026-07-11',
      }),
    ]);

    fireEvent.press(getByText(BULK_TOGGLE));
    const groupCheckbox = getAllByRole('checkbox')[0];
    expect(groupCheckbox.props.accessibilityState?.checked).toBe(false);
    expect(queryByText('1건 선택')).toBeNull();
  });
});
