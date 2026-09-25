/**
 * ChatStartButton — 플래그 OFF 면 진입점 비노출, ON 이면 new 화면으로
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ChatStartButton } from '../ChatStartButton';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockEnabled = { value: false };
jest.mock('@/hooks/chat/useChatEnabled', () => ({
  useChatEnabled: () => ({ enabled: mockEnabled.value, isLoading: false }),
}));

describe('ChatStartButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('플래그 OFF 면 아무것도 그리지 않는다', () => {
    mockEnabled.value = false;
    const { queryByTestId } = render(<ChatStartButton postingId="p1" method="job_detail" />);
    expect(queryByTestId('chat-start-button')).toBeNull();
  });

  it('플래그 ON 이면 new 화면으로 공고·진입점을 넘긴다', () => {
    mockEnabled.value = true;
    const { getByTestId } = render(
      <ChatStartButton postingId="p1" seekerId="s1" method="applicants" />
    );
    fireEvent.press(getByTestId('chat-start-button'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/chat/new',
      params: { postingId: 'p1', seekerId: 's1', src: 'applicants' },
    });
  });
});
