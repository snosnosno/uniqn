/**
 * ChatBlockedNotice — (S4) 차단 상태에서 입력창 대신 보이는 안내
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatBlockedNotice } from '../ChatBlockedNotice';

describe('ChatBlockedNotice', () => {
  it('안내 문구를 보인다', () => {
    const { getByText } = render(<ChatBlockedNotice canUnblock={false} onUnblock={jest.fn()} />);
    expect(getByText('대화할 수 없는 상태예요')).toBeTruthy();
  });

  it('상대가 막았으면 해제 버튼이 없다', () => {
    const { queryByLabelText } = render(
      <ChatBlockedNotice canUnblock={false} onUnblock={jest.fn()} />
    );
    expect(queryByLabelText('차단 해제')).toBeNull();
  });

  it('내가 막았으면 해제 버튼 → onUnblock', () => {
    const onUnblock = jest.fn();
    const { getByLabelText } = render(<ChatBlockedNotice canUnblock onUnblock={onUnblock} />);
    fireEvent.press(getByLabelText('차단 해제'));
    expect(onUnblock).toHaveBeenCalledTimes(1);
  });
});
