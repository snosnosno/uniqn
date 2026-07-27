/**
 * WorkConditionSheet — 근무조건 시트 테스트 (S2 고정 공고)
 *
 * SheetModal 은 children+footer+overlay 만 렌더로 모킹(형제 ScheduleSlotsSheet.test 관례),
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

  // W1-12 / ORDER-4: 출근시간도 없고 협의도 아니면 확인해도 근무조건 행이 '미설정'으로 남아,
  // 연쇄·제출 유도가 같은 자리를 무한히 다시 연다(닫힌 고리). 고정 공고가 홀덤펍 주력 타입이라
  // 첫 공고 작성이 여기서 막혔다.
  describe('닫힌 고리 차단 — 미설정으로 끝날 확인을 막는다', () => {
    const empty = { daysPerWeek: 5, isStartTimeNegotiable: false };

    it('출근시간 없이 협의도 아니면 확인을 막고 이유를 말한다', () => {
      const onConfirm = jest.fn();
      const { getByText } = render(
        <WorkConditionSheet visible value={empty} onConfirm={onConfirm} onClose={jest.fn()} />
      );

      fireEvent.press(getByText('확인'));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(getByText(/시간 협의.*켜면 확인할 수 있어요/)).toBeTruthy();
    });

    it('협의를 켜면 시간 없이도 확인할 수 있다', () => {
      const onConfirm = jest.fn();
      const { getByText, getByTestId } = render(
        <WorkConditionSheet visible value={empty} onConfirm={onConfirm} onClose={jest.fn()} />
      );

      fireEvent.press(getByTestId('work-condition-negotiable'));
      fireEvent.press(getByText('확인'));

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ isStartTimeNegotiable: true })
      );
    });

    it('출근시간을 고르면 확인할 수 있고 힌트는 사라진다', () => {
      const onConfirm = jest.fn();
      const { getByText, getByTestId, queryByText } = render(
        <WorkConditionSheet visible value={empty} onConfirm={onConfirm} onClose={jest.fn()} />
      );

      fireEvent.press(getByTestId('work-condition-time'));
      fireEvent.press(getByTestId('mock-time-confirm'));

      expect(queryByText(/켜면 확인할 수 있어요/)).toBeNull();
      fireEvent.press(getByText('확인'));
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ startTime: '20:30' }));
    });
  });

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

  it('협의 토글 후 확인 시 startTime을 payload에서 제외한다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <WorkConditionSheet visible value={base} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('work-condition-negotiable'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm.mock.calls[0][0]).not.toHaveProperty('startTime');
    expect(onConfirm.mock.calls[0][0]).toEqual(
      expect.objectContaining({ isStartTimeNegotiable: true, daysPerWeek: 5 })
    );
  });
});
