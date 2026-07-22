/**
 * TimeWheelPicker — 웹 분기(WebTimePicker) 검증
 *
 * 웹은 휠 대신 FlatList 탭 선택 폴백 + WebPortal 렌더로 완전히 다른 경로를 탄다.
 * 기존 테스트는 전부 네이티브 경로만 덮고 있어 웹 분기가 자동 검증 공백이었다
 * (2026-07-22 배포 후 확인 중 발견). isWeb 을 모킹해 웹 트리를 렌더한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TimeWheelPicker } from '../TimeWheelPicker';

jest.mock('@/utils/platform', () => ({ isWeb: true }));
// WebPortal 은 react-dom createPortal 의존 — 테스트에선 통과 렌더로 대체
jest.mock('@/components/ui/WebPortal', () => {
  const { View } = require('react-native');
  return { WebPortal: ({ children }: any) => <View>{children}</View> };
});
jest.mock('../../icons', () => ({ AlertCircleIcon: () => null }));

const value = { hour: 19, minute: 0 };

describe('TimeWheelPicker 웹 분기', () => {
  it('visible=false 면 아무것도 렌더하지 않는다', () => {
    const { queryByText } = render(
      <TimeWheelPicker
        visible={false}
        value={value}
        title="출근 시간"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByText('출근 시간')).toBeNull();
  });

  it('웹에서도 시/분 목록과 확인/취소가 렌더된다', () => {
    const { getByText, getByLabelText } = render(
      <TimeWheelPicker
        visible
        value={value}
        title="출근 시간"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('출근 시간')).toBeTruthy();
    expect(getByText('확인')).toBeTruthy();
    expect(getByText('취소')).toBeTruthy();
    expect(getByLabelText('19시')).toBeTruthy();
  });

  it('minuteInterval=15 면 분 목록이 00/15/30/45 만 노출된다 (공고작성 설정)', () => {
    const { getByLabelText, queryByLabelText } = render(
      <TimeWheelPicker
        visible
        value={value}
        minuteInterval={15}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    for (const m of ['00분', '15분', '30분', '45분']) {
      expect(getByLabelText(m)).toBeTruthy();
    }
    expect(queryByLabelText('05분')).toBeNull();
    expect(queryByLabelText('20분')).toBeNull();
  });

  it('시/분을 탭해 선택하면 그 값으로 확정된다', () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = render(
      <TimeWheelPicker
        visible
        value={value}
        minuteInterval={15}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByLabelText('21시'));
    fireEvent.press(getByLabelText('30분'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ hour: 21, minute: 30 });
  });

  it('onConfirmTBA 를 주면 웹에도 시간 미정 버튼이 렌더되고 탭하면 콜백된다', () => {
    const onConfirmTBA = jest.fn();
    const { getByTestId } = render(
      <TimeWheelPicker
        visible
        value={value}
        onConfirm={jest.fn()}
        onConfirmTBA={onConfirmTBA}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('time-wheel-tba'));
    expect(onConfirmTBA).toHaveBeenCalledTimes(1);
  });

  it('onConfirmTBA 가 없으면 웹에도 시간 미정 버튼이 없다', () => {
    const { queryByTestId } = render(
      <TimeWheelPicker visible value={value} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(queryByTestId('time-wheel-tba')).toBeNull();
  });
});
