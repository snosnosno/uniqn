/**
 * WorkConditionSheet — 근무조건 시트 테스트 (S2 고정 공고)
 *
 * SheetModal 은 children+footer+overlay 만 렌더로 모킹(형제 TimeSlotsSheet.test 관례),
 * TimeWheelPicker 는 확인 스텁으로 모킹해 오버레이 children/testID 가 테스트에서 보이게 한다.
 * 검증: (1) 확인 시 현재 값 onConfirm, (2) 협의 토글 시 출근시간 피커 숨김, (3) 주 출근일수 칩 반영.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { WorkConditionSheet } from '../WorkConditionSheet';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer, overlay }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, onConfirm }: any) =>
      visible ? (
        <Pressable testID="mock-time-confirm" onPress={() => onConfirm({ hour: 20, minute: 30 })}>
          <Text>MockPicker</Text>
        </Pressable>
      ) : null,
  };
});

describe('WorkConditionSheet (S2)', () => {
  const base = { daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false };

  it('확인 시 현재 값을 onConfirm으로 넘긴다', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <WorkConditionSheet visible value={base} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false })
    );
  });

  it('협의 토글 시 출근시간 피커가 숨는다', () => {
    const { getByTestId, queryByTestId } = render(
      <WorkConditionSheet visible value={base} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByTestId('work-condition-time')).toBeTruthy();
    fireEvent.press(getByTestId('work-condition-negotiable'));
    expect(queryByTestId('work-condition-time')).toBeNull();
  });

  it('주 출근일수 칩 선택이 반영된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <WorkConditionSheet visible value={base} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('work-condition-days-3'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ daysPerWeek: 3 }));
  });
});
