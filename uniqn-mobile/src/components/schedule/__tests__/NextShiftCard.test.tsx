import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NextShiftCard } from '../NextShiftCard';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

const NOW = new Date('2026-07-27T09:00:00');

function nextShift(overrides: Record<string, unknown> = {}): ScheduleEvent {
  return {
    ...createMockScheduleEvent({ type: 'confirmed' }),
    status: 'not_started',
    date: '2026-07-27',
    startTime: new Date('2026-07-27T12:00:00'),
    endTime: new Date('2026-07-27T18:00:00'),
    jobPostingName: '강남 홀덤펍 주말 딜러',
    location: '강남구 역삼동',
    workLogId: 'wl-1',
    ...overrides,
  } as unknown as ScheduleEvent;
}

describe('NextShiftCard', () => {
  it('다음 근무가 없으면 아무것도 렌더하지 않는다', () => {
    const { toJSON } = render(<NextShiftCard schedule={null} onPress={jest.fn()} now={NOW} />);

    expect(toJSON()).toBeNull();
  });

  it('공고명과 남은 시간을 함께 보여준다', () => {
    const { getByText } = render(
      <NextShiftCard schedule={nextShift()} onPress={jest.fn()} now={NOW} />
    );

    expect(getByText('강남 홀덤펍 주말 딜러')).toBeTruthy();
    expect(getByText('3시간 후 출근')).toBeTruthy();
  });

  it('출근 중이면 퇴근 액션으로 바뀐다', () => {
    const { getByText } = render(
      <NextShiftCard
        schedule={nextShift({ status: 'checked_in' })}
        onPress={jest.fn()}
        onQRScan={jest.fn()}
        now={NOW}
      />
    );

    expect(getByText('근무 중')).toBeTruthy();
    expect(getByText('QR 코드로 퇴근하기')).toBeTruthy();
  });

  // workLogId 가 없으면 스캔해도 서버가 붙일 근무 기록이 없다.
  it('workLogId가 없으면 QR 버튼을 숨긴다', () => {
    const { queryByTestId } = render(
      <NextShiftCard
        schedule={nextShift({ workLogId: undefined })}
        onPress={jest.fn()}
        onQRScan={jest.fn()}
        now={NOW}
      />
    );

    expect(queryByTestId('schedule-next-shift-qr-button')).toBeNull();
  });

  it('카드를 누르면 상세로, QR을 누르면 스캔으로 각각 전달한다', () => {
    const onPress = jest.fn();
    const onQRScan = jest.fn();
    const { getByTestId } = render(
      <NextShiftCard schedule={nextShift()} onPress={onPress} onQRScan={onQRScan} now={NOW} />
    );

    fireEvent.press(getByTestId('schedule-next-shift-qr-button'));
    expect(onQRScan).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('schedule-next-shift-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
