import React from 'react';
import { Modal, ScrollView } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PublicReportSheet } from '../PublicReportSheet';

jest.mock('@/services/ops', () => ({
  opsReportService: { submitReport: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { opsReportService } = require('@/services/ops') as {
  opsReportService: { submitReport: jest.Mock };
};

/**
 * 공개 라우트(무계정) 시트라 그동안 테스트가 없었다(2026-07-25 리뷰 지적).
 * 레이아웃은 jest 가 계산하지 않으므로, 회귀 시 사용자가 버튼을 못 누르게 되는
 * 두 계약만 고정한다: ①액션이 스크롤 밖 ②ModalKeyboardAvoider 전제인
 * statusBarTranslucent 가 Modal 에 걸려 있을 것(빠지면 Android 이중 보정).
 */

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  tokenKind: 'monitor' as const,
  token: 'token-1',
};

describe('PublicReportSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    opsReportService.submitReport.mockResolvedValue(undefined);
  });

  it('Modal 에 statusBarTranslucent 를 건다 — ModalKeyboardAvoider 의 전제', () => {
    render(<PublicReportSheet {...baseProps} />);

    expect(screen.UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
  });

  it('폼 본문만 스크롤하고 취소/신고 버튼은 스크롤 밖에 남긴다', () => {
    render(<PublicReportSheet {...baseProps} />);

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require('react-native') as typeof import('react-native');
    const scrollTexts = scrollView
      .findAllByType(RN.Text)
      .map((node: { props: { children: unknown } }) => String(node.props.children));

    expect(scrollTexts).toContain('문제 신고');
    expect(scrollTexts).not.toContain('신고하기');
    expect(scrollTexts).not.toContain('취소');
    expect(screen.getByText('신고하기')).toBeTruthy();
  });

  it('선택한 사유와 상세 내용으로 신고를 접수하고 완료 화면을 보여준다', async () => {
    render(<PublicReportSheet {...baseProps} />);

    fireEvent.press(screen.getByText('기타'));
    fireEvent.changeText(screen.getByLabelText('신고 상세 내용'), '  현장 상황 설명  ');
    fireEvent.press(screen.getByText('신고하기'));

    await waitFor(() => {
      expect(opsReportService.submitReport).toHaveBeenCalledWith({
        tokenKind: 'monitor',
        token: 'token-1',
        reason: 'other',
        // trim 으로 검사했으니 전송도 trim 된 값 — 원문 전송은 공백 저장 + 절단 위치 어긋남
        details: '현장 상황 설명',
      });
    });

    expect(await screen.findByText('신고가 접수됐어요')).toBeTruthy();
  });

  it('상세 내용이 비면 details 를 null 로 보낸다', async () => {
    render(<PublicReportSheet {...baseProps} />);

    fireEvent.press(screen.getByText('신고하기'));

    await waitFor(() => {
      expect(opsReportService.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({ details: null, reason: 'gambling' })
      );
    });
  });
});
