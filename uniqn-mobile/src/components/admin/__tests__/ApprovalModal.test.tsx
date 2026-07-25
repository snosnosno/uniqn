import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ApprovalModal } from '../ApprovalModal';

/**
 * 이 화면은 그동안 테스트가 없어 구조 변경(본문 ScrollView 분리 + maxHeight 90%)이
 * 어떤 자동 검증도 받지 못했다(2026-07-25 리뷰에서 커버리지 부재로 지적).
 * 레이아웃 자체는 jest 가 계산하지 않으므로, 여기서는 **회귀하면 사용자가 버튼을
 * 못 누르게 되는 계약**만 고정한다: 액션 버튼이 스크롤 영역 밖 형제일 것.
 */

const baseProps = {
  visible: true,
  postingTitle: '테스트 공고 제목',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
  isProcessing: false,
};

describe('ApprovalModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('본문은 스크롤 영역 안, 액션 버튼은 스크롤 밖에 둔다', () => {
    render(<ApprovalModal {...baseProps} mode="approve" />);

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    const scrollTextNodes = scrollView.findAllByType(require('react-native').Text);
    const scrollTexts = scrollTextNodes.map((node: { props: { children: unknown } }) =>
      String(node.props.children)
    );

    // 본문(공고 제목)은 스크롤 안에 있다
    expect(scrollTexts).toContain('테스트 공고 제목');
    // 액션 라벨은 스크롤 안에 없다 — 있으면 긴 본문에서 버튼이 밀려난다
    expect(scrollTexts).not.toContain('승인');
    expect(scrollTexts).not.toContain('취소');
    // 그러면서도 화면에는 존재한다
    expect(screen.getByText('승인')).toBeTruthy();
  });

  it('승인 모드에서 확인을 누르면 사유 없이 onConfirm 을 호출한다', () => {
    render(<ApprovalModal {...baseProps} mode="approve" />);

    fireEvent.press(screen.getByText('승인'));

    expect(baseProps.onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('거부 모드는 사유 10자 미만이면 거부 버튼을 막는다', () => {
    render(<ApprovalModal {...baseProps} mode="reject" />);

    fireEvent.changeText(screen.getByLabelText('거부 사유 입력'), '짧음');

    expect(screen.getByRole('button', { name: '거부' }).props.accessibilityState.disabled).toBe(
      true
    );
  });

  it('거부 사유가 10자 이상이면 trim 후 onConfirm 에 전달한다', () => {
    render(<ApprovalModal {...baseProps} mode="reject" />);

    fireEvent.changeText(screen.getByLabelText('거부 사유 입력'), '  사유가 충분히 길어졌습니다  ');
    fireEvent.press(screen.getByText('거부'));

    expect(baseProps.onConfirm).toHaveBeenCalledWith('사유가 충분히 길어졌습니다');
  });
});
