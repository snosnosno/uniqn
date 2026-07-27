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
});
