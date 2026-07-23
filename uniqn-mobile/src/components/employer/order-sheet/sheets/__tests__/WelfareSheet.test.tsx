/**
 * WelfareSheet — 복지 시트 테스트
 *
 * 핵심(리뷰 CRITICAL): guaranteedHours는 PROVIDED_FLAG(-1)가 아니라 시간값으로만 확정되고,
 * 기본값이 없다(2026-07-22 — 기본 4가 입력을 지울 때마다 부활해 6·8 입력이 불가했던 결함 제거).
 * 미입력/0 입력은 미설정으로 확정된다. 금액 3종은 빈/0 입력이 PROVIDED_FLAG(-1=제공)로 인코딩된다.
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
  it('보장시간 체크 시 기본값 없이 빈 입력으로 시작하고, 미입력 확인은 미설정으로 확정된다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-guaranteedHours'));
    expect(getByTestId('order-sheet-welfare-guaranteedHours-input').props.value).toBe('');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({});
    // -1(PROVIDED_FLAG)이 절대 새어나가면 안 된다 (문서 게이트 min 0 reject → 등록 사망)
    expect(onConfirm.mock.calls[0][0].guaranteedHours).not.toBe(-1);
  });

  it('보장시간에 입력한 값이 그대로 확정된다 (예: 6시간)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-guaranteedHours'));
    fireEvent.changeText(getByTestId('order-sheet-welfare-guaranteedHours-input'), '6');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ guaranteedHours: 6 });
  });

  it('보장시간 입력을 지워도 기본값이 부활하지 않는다 (결함 회귀 가드)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet
        visible
        value={{ guaranteedHours: 4 }}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    const input = getByTestId('order-sheet-welfare-guaranteedHours-input');
    fireEvent.changeText(input, '');
    // 구 구현: 빈 입력 → 즉시 4 복원 → 6·8 입력 불가. 빈 상태가 유지돼야 한다.
    expect(getByTestId('order-sheet-welfare-guaranteedHours-input').props.value).toBe('');
    fireEvent.changeText(input, '8');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ guaranteedHours: 8 });
  });

  it('보장시간에 0 입력하면 미설정으로 확정된다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-welfare-guaranteedHours'));
    fireEvent.changeText(getByTestId('order-sheet-welfare-guaranteedHours-input'), '0');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it('기존 보장시간 값은 입력칸에 복원되고 체크 해제 시 확정에서 빠진다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <WelfareSheet
        visible
        value={{ guaranteedHours: 6, meal: -1 }}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    expect(getByTestId('order-sheet-welfare-guaranteedHours-input').props.value).toBe('6');
    fireEvent.press(getByTestId('order-sheet-welfare-guaranteedHours')); // 체크 해제
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ meal: -1 });
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
