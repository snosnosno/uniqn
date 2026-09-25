/**
 * ChatReportSheet — (S4) 메시지 신고 시트: 사유 5종 라디오 + 선택 설명(500자)
 *
 * 사유를 고르기 전에는 제출할 수 없다. 성공하면 닫고, 실패하면 연 채로 둔다(다시 시도).
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ChatReportSheet } from '../ChatReportSheet';

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => {
    const { View } = jest.requireActual('react-native');
    return visible ? (
      <View>
        {children}
        {footer}
      </View>
    ) : null;
  },
}));

const mockReport = jest.fn();
jest.mock('@/hooks/chat', () => ({
  useReportChatMessage: () => ({ report: mockReport, isReporting: false }),
}));

const MSG = '9b2d6f3e-1c4a-4e8b-9f1a-2b3c4d5e6f70';

beforeEach(() => {
  jest.clearAllMocks();
  mockReport.mockResolvedValue(true);
});

describe('ChatReportSheet', () => {
  it('사유 5종을 라디오로 보인다', () => {
    const { getByRole } = render(<ChatReportSheet messageId={MSG} onClose={jest.fn()} />);
    for (const label of ['욕설·비하', '사기·금전 요구', '음란·불쾌한 사진', '스팸·광고', '기타']) {
      expect(getByRole('radio', { name: label })).toBeTruthy();
    }
  });

  it('사유를 고르기 전에는 제출 버튼이 비활성', () => {
    const { getByLabelText } = render(<ChatReportSheet messageId={MSG} onClose={jest.fn()} />);
    fireEvent.press(getByLabelText('신고 제출'));
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('사유·설명을 넣고 제출하면 report 를 부르고, 성공하면 닫는다', async () => {
    const onClose = jest.fn();
    const { getByRole, getByLabelText } = render(
      <ChatReportSheet messageId={MSG} onClose={onClose} />
    );

    fireEvent.press(getByRole('radio', { name: '사기·금전 요구' }));
    fireEvent.changeText(getByLabelText('신고 설명 (선택)'), '입금을 요구했어요');
    await act(async () => {
      fireEvent.press(getByLabelText('신고 제출'));
    });

    expect(mockReport).toHaveBeenCalledWith({
      messageId: MSG,
      reason: 'scam',
      detail: '입금을 요구했어요',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('설명이 비면 null 로 보낸다', async () => {
    const { getByRole, getByLabelText } = render(
      <ChatReportSheet messageId={MSG} onClose={jest.fn()} />
    );
    fireEvent.press(getByRole('radio', { name: '기타' }));
    await act(async () => {
      fireEvent.press(getByLabelText('신고 제출'));
    });
    expect(mockReport).toHaveBeenCalledWith({ messageId: MSG, reason: 'other', detail: null });
  });

  it('실패하면 닫지 않는다', async () => {
    mockReport.mockResolvedValue(false);
    const onClose = jest.fn();
    const { getByRole, getByLabelText } = render(
      <ChatReportSheet messageId={MSG} onClose={onClose} />
    );
    fireEvent.press(getByRole('radio', { name: '스팸·광고' }));
    await act(async () => {
      fireEvent.press(getByLabelText('신고 제출'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('설명 입력은 500자로 묶인다', () => {
    const { getByLabelText } = render(<ChatReportSheet messageId={MSG} onClose={jest.fn()} />);
    expect(getByLabelText('신고 설명 (선택)').props.maxLength).toBe(500);
  });

  it('대상 메시지가 없으면 그리지 않는다', () => {
    const { queryByLabelText } = render(<ChatReportSheet messageId={null} onClose={jest.fn()} />);
    expect(queryByLabelText('신고 제출')).toBeNull();
  });
});
