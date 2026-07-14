/**
 * PreQuestionsSheet — 사전질문 시트 테스트
 *
 * (1) 질문 추가 → 카드 등장, (2) 답변유형 인라인 라디오로 선택형 전환 시 선택지 입력 등장(ActionSheet 아님),
 * (3) 질문 입력 후 확인 시 usesPreQuestions=true + 정리된 목록, (4) 빈 질문만이면 usesPreQuestions=false,
 * (5) 10개면 추가 버튼 미표시(zod max10 게이트와 정렬).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { PreQuestionsSheet } from '../PreQuestionsSheet';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

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

type PreQ = OrderSheetValues['preQuestions'][number];
const makeQuestions = (n: number): PreQ[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `q-${i}`,
    question: `질문 ${i}`,
    required: false,
    type: 'text' as const,
  }));

describe('PreQuestionsSheet', () => {
  it('질문 추가 버튼을 누르면 질문 카드가 등장한다', () => {
    const { getByTestId, queryByTestId } = render(
      <PreQuestionsSheet visible value={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    expect(queryByTestId('order-sheet-prequestion-0')).toBeNull();
    fireEvent.press(getByTestId('order-sheet-prequestion-add'));
    expect(getByTestId('order-sheet-prequestion-0')).toBeTruthy();
  });

  it('답변유형 인라인 라디오로 선택형 전환 시 선택지 입력이 등장한다', () => {
    const { getByTestId, queryByTestId } = render(
      <PreQuestionsSheet visible value={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-prequestion-add'));
    expect(queryByTestId('order-sheet-prequestion-0-option-0')).toBeNull();
    fireEvent.press(getByTestId('order-sheet-prequestion-0-type-select'));
    expect(getByTestId('order-sheet-prequestion-0-option-0')).toBeTruthy();
  });

  it('질문 입력 후 확인하면 usesPreQuestions=true + 정리된 목록으로 onConfirm', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <PreQuestionsSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-prequestion-add'));
    fireEvent.changeText(getByTestId('order-sheet-prequestion-0-text'), '경력이 있으신가요?');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({
      usesPreQuestions: true,
      preQuestions: [
        expect.objectContaining({ question: '경력이 있으신가요?', type: 'text', required: false }),
      ],
    });
  });

  it('빈 질문만 추가하고 확인하면 usesPreQuestions=false + 빈 목록', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <PreQuestionsSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByTestId('order-sheet-prequestion-add'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ usesPreQuestions: false, preQuestions: [] });
  });

  it('질문이 10개면 추가 버튼이 표시되지 않는다', () => {
    const { queryByTestId } = render(
      <PreQuestionsSheet
        visible
        value={makeQuestions(10)}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(queryByTestId('order-sheet-prequestion-add')).toBeNull();
  });
});
