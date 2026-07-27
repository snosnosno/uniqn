import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BulkShareActionBar } from '../BulkShareActionBar';

jest.mock('@/components/icons', () => ({
  ShareIcon: () => null,
}));

describe('BulkShareActionBar', () => {
  const baseProps = {
    selectedCount: 0,
    maxCount: 10,
    onSelectAll: jest.fn(),
    onShare: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('선택 수를 상한과 함께 표시한다', () => {
    const { getByText } = render(<BulkShareActionBar {...baseProps} selectedCount={3} />);
    expect(getByText('3/10 선택')).toBeTruthy();
    expect(getByText('3건 공유')).toBeTruthy();
  });

  it('선택이 없으면 공유 버튼이 비활성', () => {
    const { getByLabelText } = render(<BulkShareActionBar {...baseProps} />);
    const shareButton = getByLabelText('공유할 공고를 선택하세요');

    expect(shareButton.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(shareButton);
    expect(baseProps.onShare).not.toHaveBeenCalled();
  });

  it('선택이 있으면 공유가 눌린다', () => {
    const { getByLabelText } = render(<BulkShareActionBar {...baseProps} selectedCount={2} />);
    fireEvent.press(getByLabelText('선택한 2건 공유하기'));
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);
  });

  it('공유 진행 중에는 다시 눌리지 않는다', () => {
    const { getByLabelText } = render(
      <BulkShareActionBar {...baseProps} selectedCount={2} isSharing />
    );
    fireEvent.press(getByLabelText('선택한 2건 공유하기'));
    expect(baseProps.onShare).not.toHaveBeenCalled();
  });

  it('전체 선택·취소를 전달한다', () => {
    const { getByLabelText } = render(<BulkShareActionBar {...baseProps} selectedCount={1} />);

    fireEvent.press(getByLabelText('공유 가능한 공고 전체 선택'));
    expect(baseProps.onSelectAll).toHaveBeenCalledTimes(1);

    fireEvent.press(getByLabelText('선택 모드 종료'));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  // 전체선택은 원래 있었지만 "0/10 선택" 라벨 아래 붙은 12px 회색 텍스트라
  // 누를 수 있는 요소로 안 읽혔다(사용자가 "기능이 없다"고 보고). 버튼으로 승격 + 해제 토글.
  describe('전체 선택 토글', () => {
    it('전부 선택된 상태에서는 "전체 해제" 로 바뀐다', () => {
      const { getByText, queryByText } = render(
        <BulkShareActionBar {...baseProps} selectedCount={5} isAllSelected />
      );

      expect(getByText('전체 해제')).toBeTruthy();
      expect(queryByText('전체 선택')).toBeNull();
    });

    it('전체 해제도 같은 콜백으로 전달된다 (토글은 호출자가 판단)', () => {
      const { getByLabelText } = render(
        <BulkShareActionBar {...baseProps} selectedCount={5} isAllSelected />
      );

      fireEvent.press(getByLabelText('선택한 공고 전체 해제'));
      expect(baseProps.onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('공유 진행 중에는 눌리지 않는다', () => {
      const { getByLabelText } = render(
        <BulkShareActionBar {...baseProps} selectedCount={2} isSharing />
      );

      fireEvent.press(getByLabelText('공유 가능한 공고 전체 선택'));
      expect(baseProps.onSelectAll).not.toHaveBeenCalled();
    });
  });
});
