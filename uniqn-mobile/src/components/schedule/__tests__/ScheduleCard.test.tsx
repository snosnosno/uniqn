import React from 'react';
import { render } from '@testing-library/react-native';
import { ScheduleCard } from '../ScheduleCard';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

describe('ScheduleCard', () => {
  it('shows a pending-cancellation notice for confirmed schedules under review', () => {
    const schedule = createMockScheduleEvent({
      type: 'confirmed',
      isCancellationPending: true,
    }) as unknown as ScheduleEvent;

    const { getByText } = render(<ScheduleCard schedule={schedule} />);

    expect(getByText('취소 요청 검토 중입니다.')).toBeTruthy();
  });

  it('drops the pending-cancellation notice once approval resolves to cancelled', () => {
    const schedule = createMockScheduleEvent({
      type: 'cancelled',
    }) as unknown as ScheduleEvent;

    const { getByText, queryByText } = render(<ScheduleCard schedule={schedule} />);

    expect(queryByText('취소 요청 검토 중입니다.')).toBeNull();
    expect(getByText('이 일정이 취소되었습니다.')).toBeTruthy();
  });
});
