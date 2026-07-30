/**
 * SettlementTab — 근무 전 예상액 표시 회귀 테스트 (2-A)
 *
 * `time_slot` 정본이 **출근 예정 시각 단일값**(§K)이 되면서, 근무 전에는 예정 종료 시각이
 * 어디에도 없다 → `calculateSettlementBreakdown` 은 금액을 못 내고 null 을 돌려준다.
 * 이 상태를 어떻게 말하느냐가 이 테스트의 대상이다.
 *
 * 고정하는 계약:
 *  1. 금액을 못 낼 때는 **'계산 전'** 이라고 말한다. "정산 정보를 계산할 수 없습니다"는
 *     고장으로 읽히고, 0원은 실제로 0원을 받는다는 뜻으로 읽힌다 — 둘 다 사실이 아니다.
 *  2. 계산 결과가 없으면 "예정 시간 기준으로 계산한 예상 금액입니다" 배너를 띄우지 않는다.
 *     안내와 결과가 모순되면 사용자는 금액이 어딘가 있는데 안 보이는 줄 안다.
 *  3. 대조군 — 실제 출퇴근이 모두 기록되면 종전대로 금액이 계산된다(무회귀).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SettlementTab } from '../SettlementTab';
import type { ScheduleEvent } from '@/types';

function makeSchedule(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: 'confirmed',
    date: '2026-08-01',
    // 출근 예정 단일값을 파싱한 결과 — 시작만 있고 종료는 없다(정본 형식).
    startTime: new Date('2026-08-01T19:00:00'),
    endTime: null,
    jobPostingId: 'posting-1',
    jobPostingName: '홈게임',
    location: '홈',
    role: 'dealer',
    status: 'not_started',
    sourceCollection: 'workLogs',
    sourceId: 'worklog-1',
    timeSlot: '19:00',
    // 합의된 급여는 있다 — '급여가 아직 정해지지 않았어요' 분기와 섞이지 않게 한다.
    customSalaryInfo: { type: 'hourly', amount: 15000 },
    ...overrides,
  } as ScheduleEvent;
}

describe('SettlementTab — 퇴근 기록 전', () => {
  it("금액을 못 낼 때 '계산 전'을 보여준다(고장 문구·0원 아님)", () => {
    const { getByText, queryByText } = render(<SettlementTab schedule={makeSchedule()} />);

    expect(getByText('계산 전')).toBeTruthy();
    expect(getByText(/출근·퇴근이 모두 기록되면/)).toBeTruthy();
    expect(queryByText('정산 정보를 계산할 수 없습니다.')).toBeNull();
  });

  it('계산 결과가 없으면 예상 금액 배너를 띄우지 않는다', () => {
    const { queryByText } = render(<SettlementTab schedule={makeSchedule()} />);

    expect(queryByText(/예정 시간 기준으로 계산한 예상 금액/)).toBeNull();
    expect(queryByText('예상 총 금액')).toBeNull();
  });

  it('대조군: 실제 출퇴근이 모두 있으면 종전대로 금액이 계산된다', () => {
    const { getByText, queryByText } = render(
      <SettlementTab
        schedule={makeSchedule({
          checkInTime: new Date('2026-08-01T19:00:00'),
          checkOutTime: new Date('2026-08-02T02:00:00'),
        })}
      />
    );

    expect(getByText('총 정산 금액')).toBeTruthy();
    expect(queryByText('계산 전')).toBeNull();
  });
});
