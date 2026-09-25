/**
 * useSendChatMessage — 낙관적 전송·실패·재전송
 *
 * RG4: 재전송은 첫 시도와 **같은 clientMessageId** 로 간다(서버 멱등키).
 * 새 방: 열기는 성공·보내기는 실패했으면, 재전송은 받은 방 id 로 보내기만 한다(열기 재호출 0).
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendChatMessage } from '../useSendChatMessage';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockOpen = jest.fn();
const mockSendText = jest.fn();
jest.mock('@/services/chat', () => ({
  chatService: {
    openConversation: (...a: unknown[]) => mockOpen(...a),
    sendText: (...a: unknown[]) => mockSendText(...a),
  },
}));

jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn(() => 'user-a') }));

// iOS NSUUID 처럼 대문자로 돌려준다 — 훅이 소문자로 바꾸는지 본다
let mockUuidSeq = 0;
jest.mock('@/utils/generateId', () => ({
  generateUUID: () => {
    mockUuidSeq += 1;
    return `16FD2706-8BAF-433B-82EB-8C7FADA847${String(mockUuidSeq).padStart(2, '0')}`;
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSendChatMessage', () => {
  it('실패하면 failed 로 남고, 재전송은 같은 clientMessageId 로 보낸다 (RG4)', async () => {
    mockSendText
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ messageId: 'm1', createdAt: 'x', deduped: true });

    const { result } = renderHook(
      () => useSendChatMessage({ conversationId: CONV, jobPostingId: 'p1', seekerId: null }),
      { wrapper: wrapper() }
    );

    await act(async () => {
      await result.current.send('안녕하세요');
    });
    await waitFor(() => expect(result.current.outbox[0]?.status).toBe('failed'));
    const firstId = result.current.outbox[0]!.clientMessageId;

    await act(async () => {
      await result.current.retry(firstId);
    });

    expect(mockSendText).toHaveBeenCalledTimes(2);
    expect(mockSendText.mock.calls[0]?.[0].clientMessageId).toBe(firstId);
    expect(mockSendText.mock.calls[1]?.[0].clientMessageId).toBe(firstId);
    expect(mockSendText.mock.calls[1]?.[0].conversationId).toBe(CONV);
    expect(result.current.outbox[0]).toMatchObject({ clientMessageId: firstId, status: 'sent' });
  });

  it('clientMessageId 는 소문자 uuid 다(사진 경로 완전 일치 조건)', async () => {
    mockSendText.mockResolvedValue({ messageId: 'm1', createdAt: 'x', deduped: false });
    const { result } = renderHook(
      () => useSendChatMessage({ conversationId: CONV, jobPostingId: 'p1', seekerId: null }),
      { wrapper: wrapper() }
    );

    await act(async () => {
      await result.current.send('a');
    });
    const id = mockSendText.mock.calls[0]?.[0].clientMessageId as string;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('새 방: 열기 성공·보내기 실패 → 재전송은 열기를 다시 부르지 않는다', async () => {
    mockOpen.mockResolvedValue(CONV);
    mockSendText
      .mockRejectedValueOnce(new Error('rate'))
      .mockResolvedValueOnce({ messageId: 'm1', createdAt: 'x', deduped: false });
    const onSent = jest.fn();

    const { result } = renderHook(
      () =>
        useSendChatMessage({ conversationId: null, jobPostingId: 'p1', seekerId: 's1', onSent }),
      { wrapper: wrapper() }
    );

    await act(async () => {
      await result.current.send('첫 메시지');
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith({ jobPostingId: 'p1', seekerId: 's1' });
    expect(onSent).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.retry(result.current.outbox[0]!.clientMessageId);
    });

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockSendText.mock.calls[1]?.[0].conversationId).toBe(CONV);
    expect(onSent).toHaveBeenCalledWith(CONV);
  });

  it('새 방에서 첫 open 이 끝나기 전 두 번 보내도 open 은 한 번(새 방 한도 토큰 보호)', async () => {
    let resolveOpen: (id: string) => void = () => undefined;
    mockOpen.mockReturnValue(new Promise<string>((r) => (resolveOpen = r)));
    mockSendText.mockResolvedValue({ messageId: 'm', createdAt: 'x', deduped: false });
    const { result } = renderHook(
      () => useSendChatMessage({ conversationId: null, jobPostingId: 'p1', seekerId: null }),
      { wrapper: wrapper() }
    );

    await act(async () => {
      const a = result.current.send('하나');
      const b = result.current.send('둘');
      resolveOpen(CONV);
      await Promise.all([a, b]);
    });

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockSendText).toHaveBeenCalledTimes(2);
    expect(mockSendText.mock.calls.every((c) => c[0].conversationId === CONV)).toBe(true);
  });

  it('방 열기가 실패해도 말풍선은 failed 로 남는다', async () => {
    mockOpen.mockRejectedValue(new Error('CHAT_OPEN_LIMITED'));
    const { result } = renderHook(
      () => useSendChatMessage({ conversationId: null, jobPostingId: 'p1', seekerId: null }),
      { wrapper: wrapper() }
    );

    await act(async () => {
      await result.current.send('a');
    });
    expect(result.current.outbox[0]?.status).toBe('failed');
    expect(mockSendText).not.toHaveBeenCalled();
  });
});
