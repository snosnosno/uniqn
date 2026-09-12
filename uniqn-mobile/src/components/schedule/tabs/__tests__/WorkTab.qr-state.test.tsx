import React from 'react';
import { render } from '@testing-library/react-native';
import { WorkTab } from '../WorkTab';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

function confirmedSchedule(status: ScheduleEvent['status']): ScheduleEvent {
  return {
    ...createMockScheduleEvent({ type: 'confirmed' }),
    type: 'confirmed',
    status,
    workLogId: 'work-log-1',
  } as ScheduleEvent;
}

describe('WorkTab QR 문구', () => {
  it('다른 근무의 전역 상태가 아니라 현재 일정이 출근 전이면 출근으로 안내한다', () => {
    const { getByText } = render(
      <WorkTab schedule={confirmedSchedule('not_started')} onQRScan={jest.fn()} />
    );

    expect(getByText('QR 코드로 출근하기')).toBeTruthy();
  });

  it('현재 일정이 근무 중일 때만 퇴근으로 안내한다', () => {
    const { getByText } = render(
      <WorkTab schedule={confirmedSchedule('checked_in')} onQRScan={jest.fn()} />
    );

    expect(getByText('QR 코드로 퇴근하기')).toBeTruthy();
  });
});
