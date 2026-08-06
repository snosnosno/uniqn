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
jest.mock('@/components/ui/CalendarPicker', () => {
  const { View } = require('react-native');
  return { CalendarPicker: () => <View testID="calendar-stub" /> };
});

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

  it('②는 실제 연속 구간 날짜를, ③은 나뉘는 카드 수를 문구에 담는다', () => {
    const { getByText } = render(
      <ScheduleDatesSheet
        visible
        postingType="regular"
        initialSelectedDates={['2026-07-20', '2026-07-21', '2026-07-24']}
        existingDates={[]}
        showSegment
        initialSegment="same"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // ①과 ②는 같은 축(지원자 선택 자유도)으로 대비돼야 한다 — 서로 다른 축을 말하면 비교가 안 된다
    expect(getByText('지원자가 원하는 날짜만 골라 지원해요 (하루만도 가능)')).toBeTruthy();
    expect(getByText('7/20~7/21 다 나올 사람만 지원해요 (하루만 지원 불가)')).toBeTruthy();
    expect(getByText('일정 카드가 3개로 나뉘어요 · 날짜별로 시간·역할·인원을 다르게')).toBeTruthy();
  });

  it('비연속 날짜만 있으면 ②가 비활성 사유를 그 자리에서 말한다', () => {
    const { getByText } = render(
      <ScheduleDatesSheet
        visible
        postingType="regular"
        initialSelectedDates={['2026-07-20', '2026-07-24']}
        existingDates={[]}
        showSegment
        initialSegment="same"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(getByText('붙어 있는 날짜가 없어 고를 수 없어요')).toBeTruthy();
  });

  it('세그먼트는 캘린더보다 앞(위)에 렌더된다', () => {
    const { toJSON } = render(
      <ScheduleDatesSheet
        visible
        postingType="regular"
        initialSelectedDates={['2026-07-20', '2026-07-21']}
        existingDates={[]}
        showSegment
        initialSegment="same"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const tree = JSON.stringify(toJSON());
    const segmentIndex = tree.indexOf('order-sheet-dates-segment-same');
    const calendarIndex = tree.indexOf('calendar-stub');
    expect(segmentIndex).toBeGreaterThan(-1);
    expect(calendarIndex).toBeGreaterThan(-1);
    expect(segmentIndex).toBeLessThan(calendarIndex);
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
