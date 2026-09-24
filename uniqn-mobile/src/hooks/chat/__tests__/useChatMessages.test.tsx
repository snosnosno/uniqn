/**
 * useChatMessages — 과거 페이지 + 꼬리 + realtime
 *
 * D7=R1: realtime 콜백은 `['chat','messages',id,'tail']` **접두사 무효화만** 한다.
 * payload 로 캐시를 직접 고치지 않는다(RLS 를 거치지 않은 행이 화면에 들어가는 경로를 없앤다).
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatMessages } from '../useChatMessages';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockPage = jest.fn();
const mockAfter = jest.fn();
jest.mock('@/repositories/chat', () => ({
  chatRepository: {
    getMessagesPage: (...a: unknown[]) => mockPage(...a),
    getMessagesAfter: (...a: unknown[]) => mockAfter(...a),
  },
}));

type Callback = (payload: unknown) => void;
type OnError = (status: string) => void;
const mockSubscribe = jest.fn<() => void, [string, string | undefined, Callback, OnError?]>(() =>
  jest.fn()
);
jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: (...a: [string, string | undefined, Callback, OnError?]) =>
    mockSubscribe(...a),
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn(() => 'user-a') }));

const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';

function row(id: string, createdAt: string) {
  return {
    id,
    conversationId: CONV,
    senderId: 'u',
    senderSide: 'seeker' as const,
    senderDisplayName: 'n',
    kind: 'text' as const,
    body: id,
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    clientMessageId: `c-${id}`,
    createdAt,
    deletedAt: null,
  };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const setData = jest.spyOn(client, 'setQueryData');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate, setData };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPage.mockResolvedValue([row('b', '2026-09-25T09:02:00Z'), row('a', '2026-09-25T09:01:00Z')]);
  mockAfter.mockResolvedValue([row('c', '2026-09-25T09:03:00Z')]);
});

describe('useChatMessages', () => {
  it('과거 페이지 + 꼬리를 오름차순으로 합친다', async () => {
    const { Wrapper } = setup();
    const { result } = renderHook(() => useChatMessages(CONV), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'b', 'c']));
    // 꼬리 anchor = 첫 페이지의 가장 최신 created_at
    expect(mockAfter).toHaveBeenCalledWith(CONV, '2026-09-25T09:02:00Z', 200);
  });

  it('방 화면에서만 chat_messages 를 conversation_id 필터로 구독한다', async () => {
    const { Wrapper } = setup();
    renderHook(() => useChatMessages(CONV), { wrapper: Wrapper });
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    expect(mockSubscribe.mock.calls[0]?.[0]).toBe('chat_messages');
    expect(mockSubscribe.mock.calls[0]?.[1]).toBe(`conversation_id=eq.${CONV}`);
  });

  it('realtime 콜백은 tail 접두사 무효화만 하고 캐시에 직접 쓰지 않는다 (R1)', async () => {
    const { Wrapper, invalidate, setData } = setup();
    renderHook(() => useChatMessages(CONV), { wrapper: Wrapper });
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    invalidate.mockClear();
    setData.mockClear();

    const callback = mockSubscribe.mock.calls[0]?.[2];
    callback?.({ eventType: 'INSERT', new: { id: 'evil', body: '<script>' } });

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chat', 'messages', CONV, 'tail'] });
    expect(setData).not.toHaveBeenCalled();
  });

  it('재연결 복구(RECOVERED) 때도 tail 을 무효화한다', async () => {
    const { Wrapper, invalidate } = setup();
    renderHook(() => useChatMessages(CONV), { wrapper: Wrapper });
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    invalidate.mockClear();

    mockSubscribe.mock.calls[0]?.[3]?.('RECOVERED');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chat', 'messages', CONV, 'tail'] });
  });

  it('방 id 가 없으면 조회·구독하지 않는다(새 방 화면)', () => {
    const { Wrapper } = setup();
    renderHook(() => useChatMessages(null), { wrapper: Wrapper });
    expect(mockPage).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});
