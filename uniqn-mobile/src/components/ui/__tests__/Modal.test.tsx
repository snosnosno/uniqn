import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmModal } from '../Modal';

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

jest.mock('@/utils/platform', () => ({
  isWeb: false,
}));

jest.mock('@/components/ui/WebPortal', () => ({
  WebPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/icons', () => ({
  XMarkIcon: () => null,
}));

jest.mock('@/constants', () => ({
  getIconColor: () => '#111827',
}));

describe('ConfirmModal', () => {
  it('renders confirm and cancel buttons with supplied test ids and labels', () => {
    const { getByTestId, getAllByText } = render(
      <ConfirmModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        message="정말 진행하시겠습니까?"
        confirmText="확인"
        cancelText="취소"
        confirmTestID="confirm-action"
        cancelTestID="cancel-action"
      />
    );

    expect(getByTestId('confirm-action')).toBeTruthy();
    expect(getByTestId('cancel-action')).toBeTruthy();
    expect(getAllByText('확인').length).toBeGreaterThan(0);
    expect(getAllByText('취소').length).toBeGreaterThan(0);
  });
});

/**
 * 확인 버튼 이중 발사 가드 회귀 테스트.
 *
 * onConfirm() 직후 onClose() 가 동기로 돌지만 `visible=false` 가 곧 화면에서 사라지는 것은
 * 아니다 — 웹은 닫힘 페이드아웃이 남아 그 사이 두 번째 클릭이 그대로 들어왔고, 삭제·확정
 * 같은 뮤테이션이 두 번 나갔다. ConfirmModal 은 16개 화면이 공유하므로 여기서 한 번 막는다.
 */
describe('ConfirmModal — 이중 확인 가드', () => {
  const setup = (props: Partial<React.ComponentProps<typeof ConfirmModal>> = {}) => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const view = render(
      <ConfirmModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        message="정말 삭제할까요?"
        confirmText="공고 삭제"
        cancelText="계속 보기"
        confirmTestID="confirm-action"
        cancelTestID="cancel-action"
        {...props}
      />
    );
    return { ...view, onConfirm, onClose };
  };

  it('확인을 연달아 두 번 눌러도 onConfirm 은 한 번만 호출된다', () => {
    const { getByTestId, onConfirm } = setup();

    fireEvent.press(getByTestId('confirm-action'));
    fireEvent.press(getByTestId('confirm-action'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('기본값에서는 확인 직후 onClose 가 호출된다 (기존 소비처 계약 보존)', () => {
    const { getByTestId, onClose } = setup();

    fireEvent.press(getByTestId('confirm-action'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeOnConfirm=false 면 닫지 않는다 — 호출부가 결과를 보고 닫는다', () => {
    const { getByTestId, onConfirm, onClose } = setup({ closeOnConfirm: false });

    fireEvent.press(getByTestId('confirm-action'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('isLoading 동안에는 확인도 취소도 먹지 않고, 확인 라벨이 사라진다(스피너 교체)', () => {
    const { getByTestId, queryByText, onConfirm, onClose } = setup({
      isLoading: true,
      closeOnConfirm: false,
    });

    fireEvent.press(getByTestId('confirm-action'));
    fireEvent.press(getByTestId('cancel-action'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(queryByText('공고 삭제')).toBeNull();
  });

  it('처리가 끝나 모달이 열린 채 남으면(실패) 다시 확인할 수 있다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, rerender } = render(
      <ConfirmModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        message="정말 삭제할까요?"
        confirmTestID="confirm-action"
        closeOnConfirm={false}
        isLoading={false}
      />
    );

    fireEvent.press(getByTestId('confirm-action'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // 처리 중 → 실패로 종료(모달은 열린 채)
    const props = {
      visible: true,
      onClose: jest.fn(),
      onConfirm,
      message: '정말 삭제할까요?',
      confirmTestID: 'confirm-action',
      closeOnConfirm: false,
    };
    rerender(<ConfirmModal {...props} isLoading />);
    rerender(<ConfirmModal {...props} isLoading={false} />);

    fireEvent.press(getByTestId('confirm-action'));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
