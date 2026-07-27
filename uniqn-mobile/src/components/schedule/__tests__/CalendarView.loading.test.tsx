import React from 'react';
import { render } from '@testing-library/react-native';
import { CalendarView } from '../CalendarView';

/**
 * 캘린더는 이 탭의 기본 뷰인데, 월을 옮길 때마다 빈 격자가 그대로 노출됐다 —
 * '불러오는 중'과 '이 달은 진짜 0건'이 시각적으로 같았다. 같은 순간 리스트 모드는
 * ScreenSkeleton 4행을 그린다(impeccable §16 위반).
 *
 * isLoading 경로는 react-native-calendars 의 <Calendar> 를 아예 렌더하지 않으므로
 * 실렌더 비용 없이 검증할 수 있다. 대조군(isLoading=false)은 무거워서 렌더하지 않고,
 * 자리표시자가 사라진다는 사실만 확인한다.
 */
jest.mock('react-native-calendars', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Calendar: () => <View testID="real-calendar" />,
    LocaleConfig: { locales: {}, defaultLocale: 'en' },
  };
});

const baseProps = {
  schedules: [],
  selectedDate: '2026-07-27',
  currentMonth: { year: 2026, month: 7 },
  onDateSelect: jest.fn(),
  onMonthChange: jest.fn(),
};

describe('CalendarView 로딩 스켈레톤', () => {
  it('조회 중이면 빈 격자 대신 자리표시자를 그린다', () => {
    const { getByLabelText, queryByTestId } = render(
      <CalendarView {...baseProps} isLoading={true} />
    );

    expect(getByLabelText('캘린더를 불러오는 중')).toBeTruthy();
    // 로딩 중에는 실제 캘린더를 띄우지 않는다 — 빈 격자가 보이는 것이 결함이었다.
    expect(queryByTestId('real-calendar')).toBeNull();
  });

  it('로딩이 끝나면 자리표시자를 걷고 캘린더를 그린다', () => {
    const { getByTestId, queryByLabelText } = render(
      <CalendarView {...baseProps} isLoading={false} />
    );

    expect(getByTestId('real-calendar')).toBeTruthy();
    expect(queryByLabelText('캘린더를 불러오는 중')).toBeNull();
  });

  it('isLoading 을 안 넘기면 예전과 같이 캘린더를 그린다(기본값 false)', () => {
    const { getByTestId } = render(<CalendarView {...baseProps} />);

    expect(getByTestId('real-calendar')).toBeTruthy();
  });

  it('스켈레톤 셀 42개를 개별 낭독하지 않는다 — 컨테이너 라벨 하나로 알린다', () => {
    const { getAllByLabelText } = render(<CalendarView {...baseProps} isLoading={true} />);

    expect(getAllByLabelText('캘린더를 불러오는 중')).toHaveLength(1);
  });
});
