/**
 * TitleSheet — 공고 제목 입력 시트 테스트
 *
 * SheetModal(RNModal+reanimated)은 children+footer 만 렌더로 모킹하고
 * (1) 입력 후 확인이 trim 된 제목으로 onConfirm+onClose, (2) 빈 제목은 확인 비활성,
 * (3) 글자 수 카운터 반영, (4) 최근 제목 칩 탭 시 입력 채움을 검증한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { TitleSheet } from '../TitleSheet';

// 무거운 의존(SheetModal=RNModal+reanimated) 모킹: visible 일 때 children+footer 만 렌더
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

describe('TitleSheet', () => {
  it('제목 입력 후 확인 시 trim 된 제목으로 onConfirm + onClose 호출', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <TitleSheet visible value="" recentTitles={[]} onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.changeText(getByTestId('order-sheet-title-input'), '  주말 딜러 구합니다  ');
    fireEvent.press(getByText('확인'));

    expect(onConfirm).toHaveBeenCalledWith('주말 딜러 구합니다');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('빈 제목이면 확인 버튼 비활성 (onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <TitleSheet visible value="" recentTitles={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('글자 수 카운터가 입력 길이를 반영한다', () => {
    const { getByTestId, getByText } = render(
      <TitleSheet visible value="" recentTitles={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러');
    expect(getByText('5/25')).toBeTruthy();
  });

  it('최근 제목 칩 탭 시 입력창을 그 값으로 채운다', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <TitleSheet
        visible
        value=""
        recentTitles={['주말 딜러 모집']}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText('주말 딜러 모집'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith('주말 딜러 모집');
  });
});
