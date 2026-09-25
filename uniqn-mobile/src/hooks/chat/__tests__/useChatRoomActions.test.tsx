/**
 * useChatRoomActions — 읽음 처리(결정 D-b 로 S2a 편입)·나가기
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatRoomActions } from '../useChatRoomActions';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockMarkRead = jest.fn();
const mockHide = jest.fn();
jest.mock('@/services/chat', () => ({
  chatService: {
    markRead: (...a: unknown[]) => mockMarkRead(...a),
    hide: (...a: unknown[]) => mockHide(...a),
  },
}));
jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkRead.mockResolvedValue(undefined);
});

describe('useChatRoomActions.markRead', () => {
  it('같은 메시지 id 로는 한 번만 부르고, 목록·배지·알림을 무효화한다', async () => {
    const { Wrapper, invalidate } = setup();
    const { result } = renderHook(() => useChatRoomActions(CONV), { wrapper: Wrapper });

    await act(async () => {
      await result.current.markRead('m1');
      await result.current.markRead('m1');
    });

    expect(mockMarkRead).toHaveBeenCalledTimes(1);
    expect(mockMarkRead).toHaveBeenCalledWith(CONV, 'm1');
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['chat', 'list']),
        JSON.stringify(['chat', 'unread']),
        JSON.stringify(['notifications']),
      ])
    );
  });

  it('실패하면 다음 호출에서 같은 id 로 다시 시도한다', async () => {
    mockMarkRead.mockRejectedValueOnce(new Error('x'));
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatRoomActions(CONV), { wrapper: Wrapper });

    await act(async () => {
      await result.current.markRead('m1');
      await result.current.markRead('m1');
    });
    expect(mockMarkRead).toHaveBeenCalledTimes(2);
  });

  it('메시지가 없으면(null) 부르지 않는다', async () => {
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatRoomActions(CONV), { wrapper: Wrapper });
    await act(async () => {
      await result.current.markRead(null);
    });
    expect(mockMarkRead).not.toHaveBeenCalled();
  });
});
