/**
 * WelfareSheet — 복지 시트 테스트
 *
 * 핵심(리뷰 CRITICAL): guaranteedHours는 PROVIDED_FLAG(-1)가 아니라 시간값(기본 4)으로 체크되고,
 * 0 입력은 키 삭제(체크 해제)로 처리된다. 금액 3종은 빈/0 입력이 PROVIDED_FLAG(-1=제공)로 인코딩된다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { WelfareSheet } from '../WelfareSheet';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

describe('WelfareSheet', () => {
  it('보장시간 체크 시 PROVIDED_FLAG(-1)가 아닌 기본 4시간으로 설정된다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-guaranteedHours'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ guaranteedHours: 4 });
    // -1(PROVIDED_FLAG)이 절대 새어나가면 안 된다 (문서 게이트 min 0 reject → 등록 사망)
    expect(onConfirm.mock.calls[0][0].guaranteedHours).not.toBe(-1);
  });

  it('보장시간에 0 입력하면 키가 삭제된다 (체크 해제와 동일)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-guaranteedHours'));
    fireEvent.changeText(getByTestId('order-sheet-welfare-guaranteedHours-input'), '0');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it('식사 체크 시 금액 없으면 PROVIDED_FLAG(-1=제공)로 인코딩된다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-meal'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ meal: -1 });
  });

  it('교통비에 금액 입력 시 양수 금액으로 설정된다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-transportation'));
    fireEvent.changeText(getByTestId('order-sheet-welfare-transportation-input'), '15000');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ transportation: 15000 });
  });
});
