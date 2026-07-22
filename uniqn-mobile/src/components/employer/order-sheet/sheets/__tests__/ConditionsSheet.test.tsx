/**
 * ConditionsSheet — 조건 시트 테스트
 *
 * 다중 선택(2026-07-22): 프리셋 칩은 checkbox 시맨틱으로 복수 선택 가능하고, 직접 입력은
 * 항상 노출되어 선택된 프리셋과 **함께** ', ' 조인으로 확정된다. 기존 단일 문자열 필드
 * (dressCode·experience) 유지 — DB/문서 스키마 무변경. 복원은 ', ' 분해 후 프리셋 매칭.
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

  it('프리셋 두 개를 모두 선택하면 ", " 조인으로 확정된다 (다중 선택)', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText(DRESS_CODE_PRESETS[0]));
    fireEvent.press(getByText(DRESS_CODE_PRESETS[1]));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({
      dressCode: `${DRESS_CODE_PRESETS[0]}, ${DRESS_CODE_PRESETS[1]}`,
    });
  });

  it('프리셋 선택과 직접 입력을 병행하면 함께 조인된다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText(EXPERIENCE_PRESETS[0]));
    fireEvent.changeText(getByTestId('order-sheet-condition-경력-custom'), '해외 대회 경험');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ experience: `${EXPERIENCE_PRESETS[0]}, 해외 대회 경험` })
    );
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

  it('저장된 "프리셋, 커스텀" 값은 칩 선택 + 직접 입력으로 복원된다', () => {
    const { getByTestId } = render(
      <ConditionsSheet
        visible
        value={{ dressCode: `${DRESS_CODE_PRESETS[0]}, 정장` }}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(
      getByTestId(`order-sheet-condition-복장-${DRESS_CODE_PRESETS[0]}`).props.accessibilityState
        .checked
    ).toBe(true);
    expect(getByTestId('order-sheet-condition-복장-custom').props.value).toBe('정장');
  });

  it('직접 입력만 단독으로도 확정된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('order-sheet-condition-경력-custom'), 'TDA 3년');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ experience: 'TDA 3년' }));
  });

  it('커스텀 입력의 앞뒤 공백은 확인 시 trim 되어 반영된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('order-sheet-condition-경력-custom'), '  TDA 3년  ');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ experience: 'TDA 3년' }));
  });

  it('공백만 입력한 커스텀 값은 확인 시 undefined 로 떨군다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ConditionsSheet visible value={{}} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('order-sheet-condition-복장-custom'), '   ');
    fireEvent.press(getByText('확인'));
    expect(onConfirm.mock.calls[0]?.[0]?.dressCode).toBeUndefined();
  });

  it('프리셋 상수를 export한다 (e2e 문구 참조)', () => {
    expect(DRESS_CODE_PRESETS).toContain('검정셔츠/슬랙스');
    expect(EXPERIENCE_PRESETS).toContain('TDA 숙지자');
  });
});
