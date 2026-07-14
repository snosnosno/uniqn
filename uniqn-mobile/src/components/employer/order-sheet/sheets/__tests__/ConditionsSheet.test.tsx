/**
 * ConditionsSheet — 조건 시트 테스트
 *
 * (1) 프리셋 칩 선택 시 값 반영, (2) 프리셋 재탭 시 해제, (3) 직접 입력 모드 + 커스텀 값,
 * (4) 프리셋 상수 export 검증(e2e 문구 참조).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ConditionsSheet, DRESS_CODE_PRESETS, EXPERIENCE_PRESETS } from '../ConditionsSheet';

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

describe('ConditionsSheet', () => {
  it('복장 프리셋 선택 후 확인하면 dressCode가 반영된다', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText(DRESS_CODE_PRESETS[0]));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dressCode: DRESS_CODE_PRESETS[0] });
  });

  it('선택된 프리셋을 다시 누르면 해제된다(undefined)', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ConditionsSheet
        visible
        value={{ dressCode: DRESS_CODE_PRESETS[0] }}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText(DRESS_CODE_PRESETS[0])); // 재탭 → 해제
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dressCode: undefined });
  });

  it('경력 직접 입력 모드로 커스텀 값 입력 후 확인하면 experience가 반영된다', () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByTestId, getByText } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    // 복장/경력 각각 '직접 입력' 칩이 있으므로 경력 섹션의 것을 accessibilityLabel로 조준
    fireEvent.press(getByLabelText('경력 직접 입력'));
    fireEvent.changeText(getByTestId('order-sheet-condition-경력-custom'), 'TDA 3년');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ experience: 'TDA 3년' }));
  });

  it('프리셋 상수를 export한다 (e2e 문구 참조)', () => {
    expect(DRESS_CODE_PRESETS).toContain('검정셔츠/슬랙스');
    expect(EXPERIENCE_PRESETS).toContain('TDA 숙지자');
  });
});
