/**
 * 채팅 스택 가드 — 플래그 OFF 면 방·새 방 대신 안내(딥링크·웹 URL 직접 진입 차단)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import ChatLayout from '../_layout';

const mockFlag = { enabled: false, isLoading: false };
jest.mock('@/hooks/chat', () => ({
  useChatEnabled: () => mockFlag,
}));

jest.mock('@/components/headers', () => ({
  StackHeader: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{title}</Text>;
  },
}));

describe('ChatLayout', () => {
  it('플래그 OFF → 준비 중 안내', () => {
    mockFlag.enabled = false;
    mockFlag.isLoading = false;
    const { getByText } = render(<ChatLayout />);
    expect(getByText('채팅은 준비 중이에요')).toBeTruthy();
  });

  it('로딩 중에도 열지 않는다(빈 화면)', () => {
    mockFlag.enabled = false;
    mockFlag.isLoading = true;
    const { queryByText, toJSON } = render(<ChatLayout />);
    expect(queryByText('채팅은 준비 중이에요')).toBeNull();
    expect(toJSON()).toBeNull();
  });
});
