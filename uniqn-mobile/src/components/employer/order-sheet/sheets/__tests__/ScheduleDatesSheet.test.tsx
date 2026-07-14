/**
 * ScheduleDatesSheet — 3지 세그먼트 클램프 테스트 (S1 리뷰 M-1 회귀 고정)
 *
 * 비활성 세그먼트의 raw state가 confirm으로 흘러 의도치 않은 그룹 분할이 되지 않아야 한다 —
 * grouped 재진입(초기 ②) 후 비연속 날짜로 바뀌면 ②는 disabled인데 state가 잔존하는 케이스.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ScheduleDatesSheet } from '../ScheduleDatesSheet';

jest.mock('@/components/ui/Modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});
jest.mock('@/components/ui/CalendarPicker', () => ({ CalendarPicker: () => null }));

describe('ScheduleDatesSheet — 세그먼트 클램프 (리뷰 M-1)', () => {
  it('비연속 날짜에서 잔존한 ②(grouped) 상태는 confirm 시 same으로 클램프된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ScheduleDatesSheet
        visible
        postingType="regular"
        initialSelectedDates={['2026-07-20', '2026-07-23']} // 비연속 — ② disabled
        existingDates={[]}
        showSegment
        initialSegment="grouped"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    expect(onConfirm).toHaveBeenCalledWith({
      dates: ['2026-07-20', '2026-07-23'],
      segment: 'same',
    });
  });

  it('연속 날짜의 ②(grouped)는 그대로 전달된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ScheduleDatesSheet
        visible
        postingType="regular"
        initialSelectedDates={['2026-07-20', '2026-07-21']}
        existingDates={[]}
        showSegment
        initialSegment="grouped"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    expect(onConfirm).toHaveBeenCalledWith({
      dates: ['2026-07-20', '2026-07-21'],
      segment: 'grouped',
    });
  });

  it('단일 날짜는 세그먼트와 무관하게 same으로 클램프된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ScheduleDatesSheet
        visible
        postingType="regular"
        initialSelectedDates={['2026-07-20']}
        existingDates={[]}
        showSegment
        initialSegment="separate"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    expect(onConfirm).toHaveBeenCalledWith({ dates: ['2026-07-20'], segment: 'same' });
  });
});
