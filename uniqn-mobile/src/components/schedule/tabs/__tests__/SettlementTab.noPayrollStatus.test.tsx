/**
 * SettlementTab — 지급 상태 라벨 제거 (구인자 IA S2b)
 *
 * 앱은 돈을 보내지 않는다. 사장이 `지급 완료` 를 누르는 흐름을 없앴으므로 구직자 화면에
 * `정산 대기` 배지가 남으면 영원히 "대기" 로 보인다. 구조(정산 탭)는 그대로 두고 라벨만 고친다.
 *
 * 고정하는 계약:
 *  1. 지급 상태 배지(`정산 대기`/`정산 완료`)와 `○월 ○일 지급 처리` 줄이 없다.
 *  2. 입금 주체를 밝힌다 — 앱이 지급을 보증하는 것처럼 읽히면 안 된다.
 *  3. 대조군 — 금액 계산은 그대로다(과거 확정 금액은 그 금액을 보여준다).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SettlementTab } from '../SettlementTab';
import type { ScheduleEvent } from '@/types';

function makeSchedule(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: 'completed',
    date: '2026-08-01',
    startTime: new Date('2026-08-01T19:00:00'),
    endTime: null,
    checkInTime: new Date('2026-08-01T19:00:00'),
    checkOutTime: new Date('2026-08-02T02:00:00'),
    jobPostingId: 'posting-1',
    jobPostingName: '홈게임',
    location: '홈',
    role: 'dealer',
    status: 'checked_out',
    sourceCollection: 'workLogs',
    sourceId: 'worklog-1',
    timeSlot: '19:00',
    customSalaryInfo: { type: 'hourly', amount: 15000 },
    ...overrides,
  } as ScheduleEvent;
}

describe('SettlementTab — 지급 상태 라벨 없음', () => {
  it.each(['pending', 'completed', 'failed'] as const)(
    'payrollStatus=%s 에서도 지급 상태 배지·지급 처리 줄이 없다',
    (payrollStatus) => {
      const { queryByText } = render(
        <SettlementTab
          schedule={makeSchedule({
            payrollStatus,
            payrollDate: new Date('2026-08-03T10:00:00'),
          } as Partial<ScheduleEvent>)}
        />
      );

      expect(queryByText(/^정산 (대기|완료)$/)).toBeNull();
      expect(queryByText(/지급 처리/)).toBeNull();
    }
  );

  it('입금 주체와 문의처를 밝힌다', () => {
    const { getByText } = render(<SettlementTab schedule={makeSchedule()} />);

    expect(getByText(/입금은 사장님이 직접 보냅니다/)).toBeTruthy();
    expect(getByText(/금액이 다르면 사장님께 문의하세요/)).toBeTruthy();
  });

  it('대조군: 과거에 확정된 금액은 그 금액을 보여준다', () => {
    const { getByText } = render(
      <SettlementTab
        schedule={makeSchedule({
          payrollStatus: 'completed',
          payrollAmount: 88000,
        } as Partial<ScheduleEvent>)}
      />
    );

    expect(getByText('₩88,000')).toBeTruthy();
  });
});
