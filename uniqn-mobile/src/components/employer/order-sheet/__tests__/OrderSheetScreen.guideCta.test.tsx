/**
 * OrderSheetScreen — 안내 CTA("제목부터 입력하기")는 제출 검증을 돌리지 않는다 (UX 감사 G)
 *
 * 미설정 행이 남아 있는 동안 하단 CTA 는 제출 버튼이 아니라 "다음에 채울 칸" 안내다.
 * 예전엔 이 버튼이 handleSubmit 을 그대로 돌려, 첫 탭에 아직 손대지 않은 제목·장소·날짜가
 * 한꺼번에 빨간 오류로 떴다. 목적지(첫 미설정 행의 시트)는 같고 오류만 뜨지 않아야 한다.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

const flushValidation = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('OrderSheetScreen — 안내 CTA', () => {
  const onSubmit = jest.fn();
  const baseProps = {
    initialValues: initialOrderSheetValues(),
    onSubmit,
    isSubmitting: false,
    myPhone: '010-0000-0000',
  };

  it('빈 폼에서 CTA 를 누르면 제목 시트만 열리고 다른 행에 오류가 뜨지 않는다', async () => {
    const { getByTestId, getByText, queryByText } = render(<OrderSheetScreen {...baseProps} />);

    expect(getByText('제목부터 입력하기')).toBeTruthy();
    fireEvent.press(getByTestId('job-posting-create-submit'));
    await flushValidation();

    // 목적지: 제목 시트
    expect(getByText('공고 제목')).toBeTruthy();
    // 아직 손대지 않은 행은 오류를 말하지 않는다 — 장소 행은 rowError 를 렌더하는 일반 행이라
    // 예전 구현(handleSubmit)에선 여기서 '장소를 선택해주세요' 가 떴다(되돌려서 red 확인).
    expect(queryByText('장소를 선택해주세요')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
