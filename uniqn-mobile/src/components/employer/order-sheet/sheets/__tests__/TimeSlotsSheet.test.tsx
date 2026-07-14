/**
 * TimeSlotsSheet — 출근 시간 시트 테스트 (다중 시간대)
 *
 * SheetModal 은 children+footer+overlay 만 렌더로 모킹, TimeWheelPicker 는 확인 스텁으로 모킹.
 * 검증: (1) 빈 값이면 기본 슬롯 1개, (2) 시간대 추가/삭제, (3) 휠 오버레이로 출근시간 변경,
 * (4) 슬롯별 역할 편집 진입 시 onConfirm(슬롯 지속)+onEditSlotRoles(i) 동시 호출, (5) 확인 시 onConfirm+onClose.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { TimeSlotsSheet } from '../TimeSlotsSheet';

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

describe('TimeSlotsSheet', () => {
  it('빈 값이면 기본 슬롯 1개(19:00) 표시', () => {
    const { getByText } = render(
      <TimeSlotsSheet
        visible
        value={[]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        onEditSlotRoles={jest.fn()}
      />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
  });

  it('시간대 추가 → 두 번째 슬롯(미설정 시간)이 생긴다', () => {
    const { getByTestId, getByText } = render(
      <TimeSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [] }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        onEditSlotRoles={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-add-slot'));
    expect(getByText('출근 --:--')).toBeTruthy();
  });

  it('슬롯 2개일 때 삭제 → 1개로 줄어든다', () => {
    const { getByTestId, queryByTestId } = render(
      <TimeSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        onEditSlotRoles={jest.fn()}
      />
    );
    expect(getByTestId('order-time-remove-1')).toBeTruthy();
    fireEvent.press(getByTestId('order-time-remove-1'));
    // 1개만 남으면 삭제 버튼 사라짐
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });

  it('출근시간 탭 → 휠 오버레이 확인 시 startTime 반영', () => {
    const { getByTestId, getByText } = render(
      <TimeSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [] }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        onEditSlotRoles={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    expect(getByText('출근 20:30')).toBeTruthy();
  });

  it('슬롯 역할 편집 진입 → onConfirm(슬롯 지속) + onEditSlotRoles(i) 호출', () => {
    const onConfirm = jest.fn();
    const onEditSlotRoles = jest.fn();
    const { getByTestId } = render(
      <TimeSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [] }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
        onEditSlotRoles={onEditSlotRoles}
      />
    );
    fireEvent.press(getByTestId('order-time-roles-0'));
    expect(onConfirm).toHaveBeenCalledWith([{ startTime: '19:00', roles: [] }]);
    expect(onEditSlotRoles).toHaveBeenCalledWith(0);
  });

  it('슬롯 역할 요약은 한글 라벨(딜러 2) — raw key(dealer) 노출 금지', () => {
    const { getByText, queryByText } = render(
      <TimeSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        onEditSlotRoles={jest.fn()}
      />
    );
    expect(getByText('딜러 2')).toBeTruthy();
    expect(queryByText('dealer 2')).toBeNull();
  });

  it('확인 → onConfirm(슬롯) + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <TimeSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [] }]}
        onConfirm={onConfirm}
        onClose={onClose}
        onEditSlotRoles={jest.fn()}
      />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ startTime: '19:00', roles: [] }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
