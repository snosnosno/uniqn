/**
 * useSendChatMessage — 사진 전송·재전송 (S2b C9 → S4 M1)
 *
 * 순서: 재인코딩 → (방 열기) → inbox 업로드 → 정화 EF → 보내기(EF 가 잰 크기로).
 * 재전송은 같은 clientMessageId 로 가고, **이미 올라간 사진은 다시 올리지 않는다**(업로드 완료분 재사용).
 * 정화가 실패했으면 재전송은 EF 부터 다시 한다(EF 는 멱등).
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessError } from '@/errors/AppError';
import { CHAT_ERROR_CODES } from '@/errors/chat';
import { useSendChatMessage } from '../useSendChatMessage';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockOpen = jest.fn();
const mockSendText = jest.fn();
const mockSendImage = jest.fn();
const mockPrepare = jest.fn();
const mockUpload = jest.fn();
const mockSanitize = jest.fn();
jest.mock('@/services/chat', () => ({
  sanitizeChatImage: (...a: unknown[]) => mockSanitize(...a),
  chatService: {
    openConversation: (...a: unknown[]) => mockOpen(...a),
    sendText: (...a: unknown[]) => mockSendText(...a),
    sendImage: (...a: unknown[]) => mockSendImage(...a),
  },
  prepareChatImage: (...a: unknown[]) => mockPrepare(...a),
  buildChatImagePath: (c: string, u: string, m: string) => `${c}/${u}/${m}.jpg`.toLowerCase(),
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
  // 서버가 다시 잰 크기 — 재인코딩 결과(1600x1200)와 일부러 다르게 둔다
  mockSanitize.mockImplementation(async (path: string) => ({ path, width: 1598, height: 1198 }));
  mockSendImage.mockResolvedValue({ messageId: 'm1', createdAt: 'x', deduped: false });
  mockOpen.mockResolvedValue(CONV);
});

describe('useSendChatMessage — 사진', () => {
  it('재인코딩 → 업로드 → 정화 → 보내기 순서로 가고, 말풍선은 로컬 사진으로 먼저 보인다', async () => {
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
      // EF 응답 width/height 로 보낸다(재인코딩 결과 크기가 아니라)
      width: 1598,
      height: 1198,
    });
    expect(mockSanitize).toHaveBeenCalledWith(
      `${CONV}/a3bb189e-8bf9-3888-9912-ace4e6543002/${uploadInput.clientMessageId}.jpg`
    );
    expect(mockPrepare.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpload.mock.invocationCallOrder[0] ?? 0
    );
    expect(mockUpload.mock.invocationCallOrder[0]).toBeLessThan(
      mockSanitize.mock.invocationCallOrder[0] ?? 0
    );
    expect(mockSanitize.mock.invocationCallOrder[0]).toBeLessThan(
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

  it('정화가 실패했으면 재전송은 재업로드 없이 EF 부터 다시 한다', async () => {
    mockSanitize.mockRejectedValueOnce(new Error('EF 502'));
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    await waitFor(() => expect(result.current.outbox[0]?.status).toBe('failed'));
    expect(mockSendImage).not.toHaveBeenCalled();
    const id = result.current.outbox[0]?.clientMessageId ?? '';

    await act(async () => {
      await result.current.retry(id);
    });

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockSanitize).toHaveBeenCalledTimes(2);
    expect(mockSanitize.mock.calls[1]?.[0]).toBe(mockSanitize.mock.calls[0]?.[0]);
    expect(mockSendImage).toHaveBeenCalledTimes(1);
    expect(result.current.outbox[0]?.status).toBe('sent');
  });

  it('정화 뒤 보내기만 실패했으면 재전송은 업로드·정화 없이 같은 크기로 보낸다', async () => {
    mockSendImage.mockRejectedValueOnce(new Error('network'));
    const { result } = renderRoom();
    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    const id = result.current.outbox[0]?.clientMessageId ?? '';

    await act(async () => {
      await result.current.retry(id);
    });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockSanitize).toHaveBeenCalledTimes(1);
    expect(mockSendImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 1598, height: 1198 })
    );
  });

  it('EF 가 inbox 객체를 못 찾으면(E6160) 재전송은 다시 올린다', async () => {
    mockSanitize.mockRejectedValueOnce(
      new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_MISSING, {
        userMessage: '사진을 보내지 못했어요. 다시 시도해 주세요.',
        isRetryable: true,
      })
    );
    const { result } = renderRoom();
    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    expect(result.current.outbox[0]).toMatchObject({ status: 'failed', retryable: true });
    const id = result.current.outbox[0]?.clientMessageId ?? '';

    await act(async () => {
      await result.current.retry(id);
    });

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(result.current.outbox[0]?.status).toBe('sent');
  });

  it('정화가 사진을 거부(E6153)하면 보내지 않고 재전송 불가로 남는다', async () => {
    mockSanitize.mockRejectedValueOnce(
      new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_INVALID, {
        userMessage: '사진을 보낼 수 없어요. 다시 선택해 주세요.',
      })
    );
    const { result } = renderRoom();
    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    expect(mockSendImage).not.toHaveBeenCalled();
    expect(result.current.outbox[0]).toMatchObject({ status: 'failed', retryable: false });
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

  it('업로드가 한도(E6157)로 막혀도 이미 올라간 객체일 수 있으니 정화·보내기를 한 번 시도한다', async () => {
    // 첫 시도: 업로드는 됐는데 응답 유실 → 재전송 시 정책(10분 20장) 경계에서 403
    const limit = new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_LIMIT, {
      userMessage: '지금은 사진을 더 보낼 수 없어요.',
      isRetryable: true,
    });
    mockUpload.mockRejectedValueOnce(limit);
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });

    const id = (mockSendImage.mock.calls[0]?.[0] as { clientMessageId: string }).clientMessageId;
    expect(mockSendImage).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePath: `${CONV}/a3bb189e-8bf9-3888-9912-ace4e6543002/${id}.jpg`,
      })
    );
    expect(result.current.outbox[0]?.status).toBe('sent');
  });

  it('한도에 막히고 정화도 실패하면(객체 없음) 원래 한도 문구로 실패한다', async () => {
    const limit = new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_LIMIT, {
      userMessage: '지금은 사진을 더 보낼 수 없어요.',
      isRetryable: true,
    });
    mockUpload.mockRejectedValueOnce(limit);
    mockSanitize.mockRejectedValueOnce(
      new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_MISSING, { userMessage: 'x' })
    );
    const { result } = renderRoom();

    await act(async () => {
      await result.current.sendImage(PICKED);
    });

    expect(result.current.outbox[0]).toMatchObject({
      status: 'failed',
      errorMessage: '지금은 사진을 더 보낼 수 없어요.',
    });
  });

  it('성공한 사진은 재전송 재료(바이트)를 들고 있지 않는다 — 재전송을 불러도 아무 호출 없음', async () => {
    const { result } = renderRoom();
    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    const id = result.current.outbox[0]?.clientMessageId ?? '';
    jest.clearAllMocks();

    await act(async () => {
      await result.current.retry(id);
    });

    expect(mockPrepare).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSanitize).not.toHaveBeenCalled();
    expect(mockSendImage).not.toHaveBeenCalled();
  });

  it('재전송을 연타해도 같은 id 로 한 번만 진행한다', async () => {
    mockSendImage.mockRejectedValueOnce(new Error('network'));
    const { result } = renderRoom();
    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    const id = result.current.outbox[0]?.clientMessageId ?? '';
    mockSendImage.mockClear();

    await act(async () => {
      await Promise.all([result.current.retry(id), result.current.retry(id)]);
    });

    expect(mockSendImage).toHaveBeenCalledTimes(1);
  });

  it('다시 해도 같은 실패(재시도 불가 에러)는 retryable=false 로 표시한다', async () => {
    mockPrepare.mockRejectedValueOnce(
      new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_INVALID, {
        userMessage: '사진 용량이 너무 커요. 다른 사진을 골라 주세요.',
      })
    );
    const { result } = renderRoom();
    await act(async () => {
      await result.current.sendImage(PICKED);
    });
    expect(result.current.outbox[0]).toMatchObject({ status: 'failed', retryable: false });
  });
});
