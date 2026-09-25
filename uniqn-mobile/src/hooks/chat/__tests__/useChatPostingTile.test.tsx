/**
 * useChatPostingTile — 공고 관리 '채팅' 타일(결정 D-d: 전체 목록 + 공고 필터)
 */
import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useChatPostingTile } from '../useChatPostingTile';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockFlag = { enabled: true };
jest.mock('../useChatEnabled', () => ({
  useChatEnabled: () => ({ enabled: mockFlag.enabled, isLoading: false }),
}));

const mockConversations = jest.fn();
jest.mock('../useChatConversations', () => ({
  useChatConversations: (opts: unknown) => mockConversations(opts),
}));

describe('useChatPostingTile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('이 공고 방들의 안 읽음 합계를 배지로, 누르면 공고 필터 목록으로', () => {
    mockFlag.enabled = true;
    mockConversations.mockReturnValue({
      conversations: [{ unreadCount: 2 }, { unreadCount: 3 }],
    });

    const { result } = renderHook(() => useChatPostingTile('posting-1'));

    expect(mockConversations).toHaveBeenCalledWith({ enabled: true, postingId: 'posting-1' });
    expect(result.current.visible).toBe(true);
    expect(result.current.badge).toEqual({ label: '안 읽음 5', variant: 'error' });

    result.current.onPress();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/(tabs)/board/chat',
      params: { postingId: 'posting-1' },
    });
  });

  it('플래그 OFF 면 숨기고 목록도 조회하지 않는다', () => {
    mockFlag.enabled = false;
    mockConversations.mockReturnValue({ conversations: [] });

    const { result } = renderHook(() => useChatPostingTile('posting-1'));

    expect(result.current.visible).toBe(false);
    expect(mockConversations).toHaveBeenCalledWith({ enabled: false, postingId: 'posting-1' });
    expect(result.current.badge).toBeUndefined();
  });
});
