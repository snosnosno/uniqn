/**
 * useSendChatMessage — 사진 전송·재전송 (S2b C9)
 *
 * 순서: 재인코딩 → (방 열기) → 업로드 → 보내기.
 * 재전송은 같은 clientMessageId 로 가고, **이미 올라간 사진은 다시 올리지 않는다**(업로드 완료분 재사용).
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendChatMessage } from '../useSendChatMessage';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockOpen = jest.fn();
const mockSendText = jest.fn();
const mockSendImage = jest.fn();
const mockPrepare = jest.fn();
const mockUpload = jest.fn();
jest.mock('@/services/chat', () => ({
  chatService: {
    openConversation: (...a: unknown[]) => mockOpen(...a),
    sendText: (...a: unknown[]) => mockSendText(...a),
    sendImage: (...a: unknown[]) => mockSendImage(...a),
  },
  prepareChatImage: (...a: unknown[]) => mockPrepare(...a),
  uploadChatImage: (...a: unknown[]) => mockUpload(...a),
}));

jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({ user: { uid: 'a3bb189e-8bf9-3888-9912-ace4e6543002' } })
  ),
}));

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
const PICKED = { uri: 'file:///orig.heic', width: 4000, height: 3000 };
const PREPARED = { bytes: new Uint8Array([1, 2]).buffer, width: 1600, height: 1200 };

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderRoom(conversationId: string | null = CONV) {
  return renderHook(
    () =>
      useSendChatMessage({
        conversationId,
        jobPostingId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        seekerId: null,
      }),
    { wrapper: wrapper() }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepare.mockResolvedValue(PREPARED);
  mockUpload.mockImplementation(
    async (input: { conversationId: string; uid: string; clientMessageId: string }) =>
      `${input.conversationId}/${input.uid}/${input.clientMessageId}.jpg`
  );
  mockSendImage.mockResolvedValue({ messageId: 'm1', createdAt: 'x', deduped: false });
  mockOpen.mockResolvedValue(CONV);
});

describe('useSendChatMessage — 사진', () => {
  it('재인코딩 → 업로드 → 보내기 순서로 가고, 말풍선은 로컬 사진으로 먼저 보인다', async () => {
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });

    expect(mockPrepare).toHaveBeenCalledWith(PICKED);
    const uploadInput = mockUpload.mock.calls[0]?.[0] as {
      image: unknown;
      clientMessageId: string;
    };
    expect(uploadInput.image).toBe(PREPARED);
    expect(uploadInput.clientMessageId).toMatch(/^[0-9a-f-]+$/);
    expect(mockSendImage).toHaveBeenCalledWith({
      conversationId: CONV,
      clientMessageId: uploadInput.clientMessageId,
      imagePath: `${CONV}/a3bb189e-8bf9-3888-9912-ace4e6543002/${uploadInput.clientMessageId}.jpg`,
      width: 1600,
      height: 1200,
    });
    expect(mockPrepare.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpload.mock.invocationCallOrder[0] ?? 0
    );
    expect(mockUpload.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendImage.mock.invocationCallOrder[0] ?? 0
    );
    expect(result.current.outbox[0]).toMatchObject({
      kind: 'image',
      status: 'sent',
      image: { localUri: PICKED.uri, width: 4000, height: 3000 },
    });
  });

  it('보내기만 실패했으면 재전송은 업로드를 건너뛰고 같은 clientMessageId·경로로 보낸다', async () => {
    mockSendImage.mockRejectedValueOnce(new Error('network'));
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    await waitFor(() => expect(result.current.outbox[0]?.status).toBe('failed'));
    const id = result.current.outbox[0]?.clientMessageId ?? '';

    await act(async () => {
      await result.current.retry(id);
    });

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockSendImage).toHaveBeenCalledTimes(2);
    const [first, second] = mockSendImage.mock.calls.map((c) => c[0]) as {
      clientMessageId: string;
      imagePath: string;
    }[];
    expect(second?.clientMessageId).toBe(first?.clientMessageId);
    expect(second?.imagePath).toBe(first?.imagePath);
    expect(result.current.outbox[0]?.status).toBe('sent');
  });

  it('업로드가 실패했으면 재전송은 재인코딩 없이 같은 clientMessageId 로 다시 올린다', async () => {
    mockUpload.mockRejectedValueOnce(new Error('upload failed'));
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    await waitFor(() => expect(result.current.outbox[0]?.status).toBe('failed'));
    const id = result.current.outbox[0]?.clientMessageId ?? '';

    await act(async () => {
      await result.current.retry(id);
    });

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(2);
    const ids = mockUpload.mock.calls.map(
      (c) => (c[0] as { clientMessageId: string }).clientMessageId
    );
    expect(ids[1]).toBe(ids[0]);
    expect(mockSendImage).toHaveBeenCalledTimes(1);
  });

  it('새 방이면 업로드 전에 방을 연다(경로에 방 id 가 들어간다)', async () => {
    const { result } = renderRoom(null);

    await act(async () => {
      await result.current.sendImage(PICKED);
    });

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpload.mock.invocationCallOrder[0] ?? 0
    );
    expect((mockUpload.mock.calls[0]?.[0] as { conversationId: string }).conversationId).toBe(CONV);
  });

  it('재인코딩이 실패하면 업로드·보내기 없이 실패 말풍선으로 남는다', async () => {
    mockPrepare.mockRejectedValueOnce(new Error('decode failed'));
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });

    expect(result.current.outbox[0]?.status).toBe('failed');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSendImage).not.toHaveBeenCalled();
  });
});
