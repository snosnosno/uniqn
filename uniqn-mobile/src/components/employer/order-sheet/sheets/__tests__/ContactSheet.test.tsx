/**
 * ContactSheet — 연락처 시트 테스트 (프로필 번호 라디오 + 직접 입력)
 *
 * (1) 프로필 번호 있으면 기본 선택·확인 시 그 번호로 onConfirm, (2) 직접 입력 전환 후 trim 확정,
 * (3) 빈 직접입력은 확인 비활성, (4) 프로필 번호 없으면 라디오 미표시(직접 입력 고정).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ContactSheet } from '../ContactSheet';

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

describe('ContactSheet', () => {
  it('프로필 번호가 있으면 기본 선택 — 확인 시 프로필 번호로 onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <ContactSheet
        visible
        value=""
        myPhone="010-1234-5678"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith('010-1234-5678');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('직접 입력 전환 후 번호 입력 시 trim 된 번호로 onConfirm', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <ContactSheet
        visible
        value=""
        myPhone="010-1234-5678"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText('직접 입력'));
    fireEvent.changeText(getByTestId('order-sheet-contact-input'), '  010-9999-8888  ');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith('010-9999-8888');
  });

  it('직접 입력이 비어 있으면 확인 버튼 비활성 (onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <ContactSheet visible value="" myPhone="" onConfirm={onConfirm} onClose={jest.fn()} />
    );

    // myPhone 없으면 직접 입력 고정 — 빈 입력으로 확인
    fireEvent.changeText(getByTestId('order-sheet-contact-input'), '   ');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('프로필과 다른 커스텀 번호로 재오픈 시 직접 입력 모드 + 프리필, 확인 시 그 값 유지', () => {
    const onConfirm = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <ContactSheet
        visible
        value="010-5555-4444"
        myPhone="010-1234-5678"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    // 프로필 번호와 다르므로 직접 입력 모드로 열리고 입력창이 프리필된다
    expect(getByDisplayValue('010-5555-4444')).toBeTruthy();
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith('010-5555-4444');
  });

  it('프로필 번호가 없으면 프로필 라디오를 표시하지 않는다', () => {
    const { queryByText, getByTestId } = render(
      <ContactSheet visible value="" myPhone="" onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    expect(queryByText('내 프로필 번호')).toBeNull();
    expect(getByTestId('order-sheet-contact-input')).toBeTruthy();
  });
});
